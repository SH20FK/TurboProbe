"""Portable, filtered crawler state on a dedicated data-only Git branch."""
import base64
import gzip
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
from .crawler_store import public_url

TABLES = ('meta','repos','sources','nodes','source_nodes','observations','checks','jobs')
BRANCH = 'crawler-state'
REMOTE = 'https://github.com/SH20FK/TurboProbe.git'


def encode(store):
    sources = {r[0] for r in store.db.execute('SELECT id,url FROM sources') if public_url(r[1])}
    data = {}
    for table in TABLES:
        columns = [r[1] for r in store.db.execute('PRAGMA table_info('+table+')')]
        rows = []
        for row in store.db.execute('SELECT * FROM '+table):
            record = dict(zip(columns,row))
            if table == 'sources' and record['id'] not in sources: continue
            if 'source' in record and record['source'] not in sources: continue
            text = json.dumps(record)
            if any(prefix in text.lower() for prefix in ('ghp_','github_pat_','bearer ','ll_')): continue
            # Check/job payloads contain private API diagnostics; only metadata travels.
            if table in ('checks','jobs'): record['payload'] = '{}'
            rows.append([record[c] for c in columns])
        data[table] = {'columns':columns,'rows':rows}
    return gzip.compress(json.dumps({'version':1,'tables':data},ensure_ascii=False).encode(),mtime=0)


def restore(store, compressed):
    with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as stream:
        body = stream.read(100*1024*1024+1)
    if len(body)>100*1024*1024: raise ValueError('crawler state too large')
    data = json.loads(body)
    if data.get('version') != 1: raise ValueError('unknown crawler state version')
    # Validate the complete envelope before changing local state.
    for table in TABLES:
        expected = [r[1] for r in store.db.execute('PRAGMA table_info('+table+')')]
        item = data['tables'][table]
        if item['columns'] != expected or any(len(row)!=len(expected) for row in item['rows']):
            raise ValueError('invalid crawler state table')
    with store.db:
        for table in TABLES:
            store.db.execute('DELETE FROM '+table)
            rows = data['tables'][table]['rows']
            if table == 'sources':
                url_index = data['tables'][table]['columns'].index('url')
                if any(not public_url(r[url_index]) for r in rows): raise ValueError('unsafe source in remote state')
            if rows:
                store.db.executemany('INSERT INTO '+table+' VALUES('+','.join('?' for _ in rows[0])+')',rows)


class StateBranch:
    def __init__(self, token):
        if not token: raise ValueError('GitHub credentials required for persistent crawler state')
        self.temp = tempfile.TemporaryDirectory(prefix='turboprobe_state_')
        self.path = Path(self.temp.name)/'repo'
        self.env = {**os.environ,'GIT_TERMINAL_PROMPT':'0','GIT_CONFIG_COUNT':'1',
                    'GIT_CONFIG_KEY_0':'http.https://github.com/.extraheader',
                    'GIT_CONFIG_VALUE_0':'AUTHORIZATION: basic '+base64.b64encode(('x-access-token:'+token).encode()).decode()}

    def git(self, *args):
        return subprocess.run(['git',*args],cwd=self.path if self.path.exists() else self.temp.name,
                              env=self.env,capture_output=True,timeout=180)

    def open(self, store):
        exists = self.git('ls-remote','--exit-code','--heads',REMOTE,BRANCH)
        if exists.returncode not in (0,2): raise RuntimeError('Cannot read crawler-state branch')
        if exists.returncode == 0:
            if self.git('clone','--quiet','--depth','1','--single-branch','--branch',BRANCH,REMOTE,str(self.path)).returncode:
                raise RuntimeError('Cannot download crawler state')
            restore(store,(self.path/'state.json.gz').read_bytes())
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
        (self.path/'state.json.gz').write_bytes(encode(store))
        (self.path/'README.md').write_text('TurboProbe public crawler state. No workflows or site assets.\n',encoding='utf-8')
        if self.git('add','state.json.gz','README.md').returncode: raise RuntimeError('State staging failed')
        if self.git('diff','--cached','--quiet').returncode == 0: return
        if self.git('-c','user.name=TurboProbe','-c','user.email=turboprobe@users.noreply.github.com','commit','-m','chore: crawler checkpoint').returncode:
            raise RuntimeError('State commit failed')
        if self.git('push','origin','HEAD:'+BRANCH).returncode:
            raise RuntimeError('State push failed; local checkpoint preserved, no force push')

    def save_jobs(self, store):
        rows = store.db.execute('SELECT run,node,request_id,account,status FROM jobs').fetchall()
        (self.path/'jobs.json').write_text(json.dumps(rows),encoding='utf-8')
        if self.git('add','jobs.json').returncode: raise RuntimeError('Job journal staging failed')
        if self.git('diff','--cached','--quiet').returncode == 0: return
        if self.git('-c','user.name=TurboProbe','-c','user.email=turboprobe@users.noreply.github.com','commit','-m','chore: API job checkpoint').returncode:
            raise RuntimeError('Job journal commit failed')
        if self.git('push','origin','HEAD:'+BRANCH).returncode:
            raise RuntimeError('Job journal push failed; refusing untracked API submission')

    def close(self):
        self.temp.cleanup()
