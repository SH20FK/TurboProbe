"""Portable, filtered crawler state on a dedicated data-only Git branch."""
import base64
import gzip
import io
import json
import os
import re
import shutil
import time
from pathlib import Path
import subprocess
import tempfile
from .crawler_store import public_url
from .crawler_archive import TABLES, columns, public_rows, read_archive, read_legacy, write_archive

BRANCH = 'crawler-state'
REMOTE = 'https://github.com/SH20FK/TurboProbe.git'


def encode(store):
    sources = {r[0] for r in store.db.execute('SELECT id,url FROM sources') if public_url(r[1])}
    data = {}
    for table in TABLES:
        data[table] = {'columns':columns(store,table),'rows':list(public_rows(store,table,sources))}
    return gzip.compress(json.dumps({'version':1,'tables':data},ensure_ascii=False).encode(),mtime=0)


def restore(store, compressed):
    # Bytes wrapper retained for callers with small version-1 fixtures.
    read_legacy(store,io.BytesIO(compressed))


class StateBranch:
    def __init__(self, token):
        if not token: raise ValueError('GitHub credentials required for persistent crawler state')
        self.temp = tempfile.TemporaryDirectory(prefix='turboprobe_state_')
        self.path = Path(self.temp.name)/'repo'
        self._redact = (token,base64.b64encode(('x-access-token:'+token).encode()).decode())
        self.env = {**os.environ,'GIT_TERMINAL_PROMPT':'0','GIT_CONFIG_COUNT':'1',
                    'GIT_CONFIG_KEY_0':'http.https://github.com/.extraheader',
                    'GIT_CONFIG_VALUE_0':'AUTHORIZATION: basic '+base64.b64encode(('x-access-token:'+token).encode()).decode()}

    def git(self, *args):
        return subprocess.run(['git',*args],cwd=self.path if self.path.exists() else self.temp.name,
                              env=self.env,capture_output=True,timeout=180)

    def push(self):
        for attempt in range(3):
            result = self.git('-c','http.version=HTTP/1.1','push','origin','HEAD:'+BRANCH)
            if not result.returncode: return
            detail = (result.stderr+result.stdout).decode('utf-8','replace')
            for secret in self._redact: detail = detail.replace(secret,'[redacted]')
            detail = re.sub(r'https?://\S+','[remote]',detail)
            detail = re.sub(r'(?i)(?:gh[pousr]_|github_pat_|KGAT_)[A-Za-z0-9_]+','[redacted]',detail)
            detail = re.sub(r'(?im)^.*authorization.*$','[authorization redacted]',detail)
            detail = detail[-1600:].strip()
            # A conflict/auth failure needs attention; retry only transport failures.
            transient = any(s in detail.lower() for s in ('http 500','http 502','http 503','http 504',
                'connection reset','remote end hung up','rpc failed','could not resolve host','timed out'))
            conflict = any(s in detail.lower() for s in ('fetch first','non-fast-forward','permission denied','authentication failed','http 403'))
            if transient and not conflict and attempt < 2:
                print(f'Crawler state: temporary push failure; retry {attempt+1}/2',flush=True)
                time.sleep(2**attempt)
                continue
            raise RuntimeError('State push failed; checkpoint preserved, no force push. Git: '+detail)

    def open(self, store):
        exists = self.git('ls-remote','--exit-code','--heads',REMOTE,BRANCH)
        if exists.returncode not in (0,2): raise RuntimeError('Cannot read crawler-state branch')
        if exists.returncode == 0:
            if self.git('clone','--quiet','--depth','1','--single-branch','--branch',BRANCH,REMOTE,str(self.path)).returncode:
                raise RuntimeError('Cannot download crawler state')
            if (self.path/'state.json').exists():
                read_archive(store,self.path)
            else:
                with (self.path/'state.json.gz').open('rb') as stream:
                    read_legacy(store,stream)
            journal = self.path/'jobs.json'
            if journal.exists():
                rows = json.loads(journal.read_text(encoding='utf-8'))
                with store.db:
                    for row in rows:
                        if not isinstance(row,list) or len(row)!=5: raise ValueError('invalid job journal')
                        run,node,req_id,account,status = row
                        import re
                        if not re.fullmatch('[a-f0-9]{64}',node) or type(account) is not int or account not in (0,1) or status not in ('submitting','pending','done','agent_error'):
                            raise ValueError('invalid job journal row')
                        store.db.execute('INSERT OR REPLACE INTO jobs VALUES(?,?,?,?,?,?)',(*row,'{}'))
        else:
            self.path.mkdir()
            for args in [('init','-b',BRANCH),('remote','add','origin',REMOTE)]:
                if self.git(*args).returncode: raise RuntimeError('Cannot initialize crawler state')

    def save(self, store):
        print('Crawler checkpoint: compressing public state in parts',flush=True)
        backup = store.path.parent/'public-checkpoint'
        backup.mkdir(exist_ok=True)
        write_archive(store,backup)
        # The prepared checkpoint must survive TemporaryDirectory cleanup/failure.
        target = self.path/'state'
        if target.is_symlink(): raise ValueError('unsafe checkpoint directory')
        target.mkdir(exist_ok=True)
        for old in target.glob('*.jsonl.gz'): old.unlink()
        shutil.copytree(backup/'state',target,dirs_exist_ok=True)
        shutil.copyfile(backup/'state.json',self.path/'state.json')
        (self.path/'state.json.gz').unlink(missing_ok=True)
        (self.path/'README.md').write_text('TurboProbe public crawler state. No workflows or site assets.\n',encoding='utf-8')
        if self.git('add','-A','--','state.json','state','README.md').returncode: raise RuntimeError('State staging failed')
        if self.git('rm','--ignore-unmatch','--cached','--','state.json.gz').returncode: raise RuntimeError('Legacy state removal failed')
        if self.git('diff','--cached','--quiet').returncode == 0: return
        if self.git('-c','user.name=TurboProbe','-c','user.email=turboprobe@users.noreply.github.com','commit','-m','chore: crawler checkpoint').returncode:
            raise RuntimeError('State commit failed')
        self.push()
        print('Crawler checkpoint: saved to GitHub crawler-state',flush=True)

    def save_jobs(self, store):
        rows = store.db.execute('SELECT run,node,request_id,account,status FROM jobs').fetchall()
        (self.path/'jobs.json').write_text(json.dumps(rows),encoding='utf-8')
        if self.git('add','jobs.json').returncode: raise RuntimeError('Job journal staging failed')
        if self.git('diff','--cached','--quiet').returncode == 0: return
        if self.git('-c','user.name=TurboProbe','-c','user.email=turboprobe@users.noreply.github.com','commit','-m','chore: API job checkpoint').returncode:
            raise RuntimeError('Job journal commit failed')
        self.push()

    def save_progress(self, progress):
        text = json.dumps(progress,ensure_ascii=False,separators=(',',':'))
        if any(marker in text.lower() for marker in ('ghp_','github_pat_','bearer ','KGAT_'.lower(),'ll_')):
            raise ValueError('unsafe probe progress')
        (self.path/'probe-progress.json').write_text(text,encoding='utf-8')
        if self.git('add','probe-progress.json').returncode: raise RuntimeError('Progress staging failed')
        if self.git('diff','--cached','--quiet').returncode == 0: return
        if self.git('-c','user.name=TurboProbe','-c','user.email=turboprobe@users.noreply.github.com',
                    'commit','-m','chore: checkpoint rolling tunnel queue').returncode:
            raise RuntimeError('Progress commit failed')
        self.push()

    def close(self):
        self.temp.cleanup()
