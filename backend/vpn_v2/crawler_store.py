"""Persistent source provenance, parsed cache and observations. No raw responses."""
import hashlib
import json
import sqlite3
import time
import ipaddress
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, unquote


def public_url(url):
    try:
        p = urlsplit(url)
        if p.scheme != 'https' or not p.hostname or p.username or p.password:
            return None
        if p.hostname.lower() == 'localhost' or p.hostname.lower().endswith(('.local','.localhost','.internal')):
            return None
        try:
            if not ipaddress.ip_address(p.hostname).is_global: return None
        except ValueError: pass
        # Only pagination and known non-secret query keys can enter public state.
        allowed = {'before','page','per_page','ref'}
        if p.hostname in ('gitlab.com','codeberg.org','gitverse.ru') and p.path.startswith('/api/'):
            allowed.update(('q','search','order_by','limit','recursive','simple'))
        if any(k.lower() not in allowed for k,v in parse_qsl(p.query)):
            return None
        if any(s in unquote(url).lower() for s in ('ghp_', 'github_pat_', 'bearer ', 'll_')):
            return None
        return urlunsplit(('https', p.netloc.lower(), p.path or '/', p.query, ''))
    except ValueError:
        return None


def source_id(url):
    p = urlsplit(url)
    parts = p.path.strip('/').split('/')
    if p.hostname == 'github.com' and len(parts) >= 5 and parts[2] in ('blob', 'raw'):
        return 'github://' + '/'.join([parts[0].lower(), parts[1].lower(), *parts[4:]])
    if p.hostname == 'raw.githubusercontent.com' and len(parts) >= 4:
        start = 5 if parts[2:4] == ['refs', 'heads'] else 3
        return 'github://' + '/'.join([parts[0].lower(), parts[1].lower(), *parts[start:]])
    return url


class Store:
    def __init__(self, path, clock=time.time):
        self.path, self.clock = Path(path), clock
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.path)
        try:
            if self.db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise ValueError('Crawler database is corrupt; refusing an empty replacement')
        except BaseException:
            self.db.close()
            raise
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT);
        CREATE TABLE IF NOT EXISTS repos(name TEXT PRIMARY KEY, branch TEXT, etag TEXT, updated TEXT);
        CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY,url TEXT NOT NULL,status TEXT DEFAULT 'new',
          failures INTEGER DEFAULT 0,due REAL DEFAULT 0,reason TEXT,etag TEXT,last_modified TEXT,
          content_hash TEXT,last_seen REAL,score REAL DEFAULT 0,cost REAL DEFAULT 0,depth INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS nodes(id TEXT PRIMARY KEY,uri TEXT NOT NULL,first_seen REAL);
        CREATE TABLE IF NOT EXISTS source_nodes(source TEXT,node TEXT,published TEXT,PRIMARY KEY(source,node));
        CREATE INDEX IF NOT EXISTS source_nodes_by_node ON source_nodes(node);
        CREATE TABLE IF NOT EXISTS observations(source TEXT,at REAL,status TEXT,count INTEGER,reason TEXT);
        CREATE TABLE IF NOT EXISTS checks(run TEXT,node TEXT,at REAL,verified INTEGER,payload TEXT,PRIMARY KEY(run,node));
        CREATE TABLE IF NOT EXISTS jobs(run TEXT,node TEXT,request_id TEXT,account INTEGER,status TEXT,payload TEXT,
          PRIMARY KEY(run,node));
        ''')
        self.db.commit()

    def add(self, url, depth=0):
        url = public_url(url)
        if not url: return False
        path = urlsplit(url).path.lower()
        pieces = path.split('/')
        if any(p in ('.github','node_modules','tests','test','vendor','android','ios','assets') for p in pieces): return False
        if path.endswith(('.py','.js','.ts','.tsx','.exe','.dll','.zip','.tar.gz','.png','.jpg','.lock','.rs','.go')): return False
        if pieces[-1] in ('package.json','package-lock.json','tsconfig.json','requirements.txt','composer.json'): return False
        ident = source_id(url)
        prior = self.db.execute('SELECT url FROM sources WHERE id=?', (ident,)).fetchone()
        if prior:
            # An observed branch reference supersedes a commit snapshot, not vice versa.
            import re
            if re.search(r'/[a-fA-F0-9]{40}/', prior[0]) and not re.search(r'/[a-fA-F0-9]{40}/', url):
                self.db.execute('UPDATE sources SET url=?,etag=NULL,last_modified=NULL WHERE id=?', (url, ident))
        else:
            self.db.execute('INSERT INTO sources(id,url,depth) VALUES(?,?,?)', (ident,url,depth))
        self.db.commit()
        return prior is None

    def due(self):
        self.db.row_factory = sqlite3.Row
        return [dict(r) for r in self.db.execute("SELECT * FROM sources WHERE status!='disabled' AND (status!='quarantine' OR due<=?) ORDER BY score DESC,id", (self.clock(),))]

    def cached(self, ident):
        return [r[0] for r in self.db.execute('SELECT n.uri FROM nodes n JOIN source_nodes s ON n.id=s.node WHERE s.source=? ORDER BY n.id', (ident,))]

    def success(self, row, uris, headers, seconds=0, published=None):
        now = self.clock()
        old_published = dict(self.db.execute('SELECT node,published FROM source_nodes WHERE source=?',(row['id'],))) if published is None else {}
        self.db.execute('DELETE FROM source_nodes WHERE source=?', (row['id'],))
        ids = []
        for uri in uris:
            ident = hashlib.sha256(uri.split('#',1)[0].encode()).hexdigest()
            ids.append(ident)
            self.db.execute('INSERT OR IGNORE INTO nodes VALUES(?,?,?)', (ident,uri,now))
            self.db.execute('INSERT INTO source_nodes VALUES(?,?,?)', (row['id'],ident,(published or {}).get(uri,old_published.get(ident))))
        digest = hashlib.sha256('\n'.join(sorted(ids)).encode()).hexdigest()
        self.db.execute("UPDATE sources SET status='active',failures=0,due=0,reason=NULL,etag=?,last_modified=?,content_hash=?,last_seen=?,cost=? WHERE id=?",
            (headers.get('etag',row.get('etag')),headers.get('last-modified',row.get('last_modified')),digest,now,seconds,row['id']))
        self.db.execute('INSERT INTO observations VALUES(?,?,?,?,?)', (row['id'],now,'active',len(ids),None))
        self.db.commit()

    def failure(self, row, reason, substantive=True):
        count = row['failures'] + 1 if substantive else row['failures']
        quarantine = substantive and count >= 3
        days = (1,3,7)[min(max(count-3,0),2)]
        self.db.execute('UPDATE sources SET failures=?,status=?,due=?,reason=? WHERE id=?',
            (count,'quarantine' if quarantine else row['status'],self.clock()+days*86400 if quarantine else 0,reason,row['id']))
        self.db.execute('INSERT INTO observations VALUES(?,?,?,?,?)', (row['id'],self.clock(),'failure',0,reason))
        self.db.commit()

    def record_checks(self, run, candidates, verified, update_scores=True):
        good = {hashlib.sha256(n['uri'].split('#',1)[0].encode()).hexdigest():n for n in verified}
        for uri in candidates:
            ident = hashlib.sha256(uri.split('#',1)[0].encode()).hexdigest()
            self.db.execute('INSERT OR REPLACE INTO checks VALUES(?,?,?,?,?)',
                (run,ident,self.clock(),int(ident in good),json.dumps(good.get(ident,{}))))
        # Credit shared nodes fractionally, so mirrors do not win by duplication.
        if update_scores:
            from collections import defaultdict
            import math
            copies = dict(self.db.execute('SELECT node,count(*) FROM source_nodes GROUP BY node'))
            totals,credits = defaultdict(int),defaultdict(float)
            for source,node in self.db.execute('SELECT source,node FROM source_nodes'):
                totals[source] += 1
                if node in good: credits[source] += 1/max(1,copies[node])
            for source,cost in self.db.execute('SELECT id,cost FROM sources').fetchall():
                score = (credits[source]/max(1,totals[source]))*math.log1p(credits[source])/max(1,cost or 0)
                self.db.execute('UPDATE sources SET score=0.7*score+0.3*? WHERE id=?',(score,source))
        self.db.commit()

    def close(self):
        self.db.execute('DELETE FROM observations WHERE at<?',(self.clock()-90*86400,))
        self.db.execute('DELETE FROM checks WHERE at<?',(self.clock()-7*86400,))
        self.db.commit()
        self.db.close()
