"""One registry, one fetch/parse stage, bounded public link discovery."""
import json
import re
import sys
import time
from collections import OrderedDict
from datetime import datetime, timezone, timedelta
from urllib.parse import urlsplit, quote
import requests
from .sources import LEGACY_DIR, normalize
from .crawler_http import Http, DownloadError
from .crawler_store import public_url
from .parallel import host_downloads
from .resources import concurrency

# Discovery vocabulary includes projects without protocol topics. Every query is
# paginated separately; date partitions avoid GitHub's 1000-result search ceiling.
DISCOVERY_TERMS = (
    'vless','vmess','trojan','shadowsocks','shadowsocksr','hysteria','hysteria2',
    'hy2','tuic','anytls','reality','xhttp','xtls','v2ray','xray','mihomo',
    'clash','clash-meta','sing-box','singbox','naiveproxy','shadowtls',
    'wireguard','amneziawg','ss2022','ssr','brook','snell','socks5',
)
DISCOVERY_PHRASES = (
    'vpn subscription','proxy subscription','free vpn configs','proxy nodes',
    'vpn configs','v2ray configs','clash subscription','sing-box subscription',
    'vpn aggregator','proxy collector','telegram proxy configs','anti censorship',
    'vpn подписки','бесплатные vpn','обход блокировок','白嫖 节点','免费 节点',
    'کانفیگ رایگان','اشتراک رایگان',
)


def search_queries():
    # Broad discovery does not imply protocol support: parsers and core validation
    # decide which keys can actually enter TurboProbe's verified subscriptions.
    return list(dict.fromkeys(
        ['topic:'+term for term in DISCOVERY_TERMS] +
        [term+' in:name,description,readme' for term in DISCOVERY_TERMS] +
        [phrase+' in:name,description,readme' for phrase in DISCOVERY_PHRASES]))


def useful_path(path):
    parts = path.lower().split('/')
    name = parts[-1]
    if any(p in ('.github','node_modules','tests','test','android','ios','vendor','.git','assets') for p in parts): return False
    if name in ('package.json','package-lock.json','requirements.txt','tsconfig.json','composer.json','cargo.lock','go.sum'): return False
    if name.startswith('readme') and name.endswith('.md'): return True
    if name in ('all','sub','config','configs','nodes','list','output','subscription','proxies'): return True
    if name.endswith(('.py','.js','.ts','.tsx','.go','.rs','.lock','.png','.jpg','.zip','.exe','.dll','.md')): return False
    return name.endswith(('.txt','.yaml','.yml','.json')) or any(k in name for k in ('vless','vmess','trojan','hysteria','subscription','proxies','allconfigs','clash','singbox'))


class GitHub:
    def __init__(self, token, store, deadline, clock=time.monotonic, sleep=time.sleep):
        self.store,self.deadline,self.clock,self.sleep = store,deadline,clock,sleep
        self.session = requests.Session()
        self.session.trust_env = False
        self.session.headers.update({'Accept':'application/vnd.github+json','User-Agent':'TurboProbe-Crawler/3'})
        if token: self.session.headers['Authorization'] = 'Bearer '+token

    def get(self, path, etag=None):
        if not path.startswith('/') or path.startswith('//'): raise ValueError('invalid API path')
        for attempt in range(3):
            if self.clock() >= self.deadline: raise TimeoutError('discovery deadline')
            try:
                response = self.session.get('https://api.github.com'+path,headers={'If-None-Match':etag} if etag else {},timeout=(5,10),allow_redirects=False)
            except requests.RequestException:
                if attempt == 2: raise DownloadError('github_network') from None
                continue
            if response.status_code == 304: return None,response.headers
            if response.status_code in (403,429):
                try:
                    wait = max(1,float(response.headers.get('Retry-After') or 60))
                    if response.headers.get('X-RateLimit-Remaining') == '0':
                        wait = max(wait,float(response.headers.get('X-RateLimit-Reset','0'))-time.time())
                except ValueError: wait = 60
                if attempt == 2 or self.clock()+wait >= self.deadline: raise DownloadError('github_rate_limit')
                print(f'GitHub rate limit: waiting {wait:.0f}s before retry',flush=True)
                self.sleep(wait)
                continue
            if response.status_code != 200: raise DownloadError('github_http_'+str(response.status_code))
            return response.json(),response.headers
        raise DownloadError('github_error')

    def repos(self):
        today = datetime.now(timezone.utc).date()
        cutoffs = [today-timedelta(days=d) for d in (7,30,180,730)]
        ranges = [(cutoffs[0],today),(cutoffs[1],cutoffs[0]-timedelta(days=1)),
                  (cutoffs[2],cutoffs[1]-timedelta(days=1)),(cutoffs[3],cutoffs[2]-timedelta(days=1)),
                  (datetime(2008,1,1).date(),cutoffs[3]-timedelta(days=1))]
        prior = self.store.db.execute("SELECT value FROM meta WHERE key='search_queue'").fetchone()
        queue = json.loads(prior[0]) if prior else []
        if not queue:
            # Interleave protocols within each freshness band, rather than letting
            # one broad term consume all discovery time on every fresh session.
            queue = [{'q':q,'start':str(start),'end':str(end),'page':1} for start,end in ranges for q in search_queries()]
        repos = {}
        pages = 0
        print(f'GitHub search: {len(queue)} queued partitions',flush=True)
        while queue:
            job = queue[0]
            data,headers = self.get('/search/repositories?q='+quote(job['q']+' pushed:'+job['start']+'..'+job['end'])+'&sort=updated&per_page=100&page='+str(job['page']))
            if data.get('total_count',0)>1000 and job['start'] < job['end']:
                start = datetime.fromisoformat(job['start']).date()
                end = datetime.fromisoformat(job['end']).date()
                middle = start+(end-start)//2
                queue[:1] = [{**job,'start':str(middle+timedelta(days=1)),'page':1}, {**job,'end':str(middle),'page':1}]
            else:
                for item in data.get('items',[]):
                    repos[item['full_name']] = item.get('default_branch','main')
                    self.store.db.execute('INSERT OR IGNORE INTO repos(name,branch) VALUES(?,?)',
                        (item['full_name'],item.get('default_branch','main')))
                if data.get('incomplete_results') or data.get('total_count',0)>1000:
                    self.store.db.execute("INSERT OR REPLACE INTO meta VALUES('search_coverage_warning','GitHub search incomplete; no exhaustive coverage claim')")
                if 'rel="next"' in headers.get('Link','') and job['page']<10:
                    job['page'] += 1
                else: queue.pop(0)
            self.store.db.execute("INSERT OR REPLACE INTO meta VALUES('search_queue',?)",(json.dumps(queue),))
            self.store.db.commit()
            pages += 1
            if pages % 10 == 0:
                print(f'GitHub search: {pages} pages; {len(repos)} repositories found; {len(queue)} partitions left',flush=True)
        return repos

    def scan(self, name):
        prior = self.store.db.execute('SELECT branch,etag,updated FROM repos WHERE name=?',(name,)).fetchone()
        repo,headers = self.get('/repos/'+name, prior[1] if prior else None)
        if repo is None: return
        branch,pushed = repo['default_branch'],repo.get('pushed_at','')
        if prior and prior[0] == branch and prior[2] == pushed: return
        ref = quote(branch,safe='')
        tree,_ = self.get('/repos/'+name+'/git/trees/'+ref+'?recursive=1')
        paths = []
        if tree.get('truncated'):
            queue = [(ref,'')]
            while queue:
                sha,prefix = queue.pop()
                subtree,_ = self.get('/repos/'+name+'/git/trees/'+sha)
                for item in subtree.get('tree',[]):
                    path = prefix+item['path']
                    if item['type'] == 'tree':
                        if not any(p in path.lower().split('/') for p in ('.github','node_modules','vendor','tests','android','ios')):
                            queue.append((item['sha'],path+'/'))
                    else: paths.append(path)
        else: paths = [item['path'] for item in tree.get('tree',[]) if item.get('type') == 'blob']
        for path in paths:
            if useful_path(path) or path.lower() == 'readme.md':
                self.store.add('https://raw.githubusercontent.com/'+name+'/'+ref+'/'+quote(path,safe='/'),commit=False)
        self.store.db.execute('INSERT OR REPLACE INTO repos VALUES(?,?,?,?)',(name,branch,headers.get('ETag'),pushed))
        self.store.db.commit()


def seed(store):
    import aggregator
    import discover_sources as legacy
    if store.db.execute("SELECT value FROM meta WHERE key='seed_v1'").fetchone():
        print('Source registry already initialized',flush=True)
        return
    print('Importing initial source registry in one transaction',flush=True)
    for url in aggregator.SOURCES: store.add(url,commit=False)
    path = LEGACY_DIR/'discovered_sources.json'
    if path.exists():
        for index,url in enumerate(json.loads(path.read_text(encoding='utf-8')),1):
            if not url.startswith('_'): store.add(url,commit=False)
            if index % 2000 == 0: print(f'Registry import: {index} legacy entries processed',flush=True)
    for channel in legacy.TELEGRAM_CHANNELS: store.add('https://t.me/s/'+channel,commit=False)
    for repo,branch in legacy.SEED_REPOSITORIES:
        store.db.execute('INSERT OR IGNORE INTO repos(name,branch) VALUES(?,?)',(repo,branch))
    store.db.execute("INSERT INTO meta VALUES('seed_v1','1')")
    store.db.commit()
    print(f"Registry import complete: {store.db.execute('SELECT count(*) FROM sources').fetchone()[0]} sources",flush=True)


def discover(store, token, deadline):
    discovery_start = time.monotonic()
    github = GitHub(token,store,deadline)
    errors = []
    try:
        github.deadline = min(deadline,discovery_start+600)
        try: github.repos()
        except (TimeoutError,DownloadError) as exc: errors.append(type(exc).__name__)
        github.deadline = deadline
        # Secondary forges use the same bounded downloader and source admission.
        secondary = Http(min(deadline,discovery_start+900))
        for forge in ('gitverse','gitlab','codeberg'):
            print(f'Secondary discovery: {forge}',flush=True)
            try: discover_forge(store,forge,secondary)
            except (DownloadError,TimeoutError,ValueError,KeyError,TypeError,AttributeError): errors.append(forge+'_discovery_incomplete')
        repositories = dict(store.db.execute('SELECT name,branch FROM repos ORDER BY updated IS NOT NULL,updated,name'))
        print(f'Discovery: {len(repositories)} repositories queued',flush=True)
        for index,name in enumerate(repositories,1):
            try: github.scan(name)
            except DownloadError as exc: errors.append(str(exc))
            if index % 5 == 0: print(f'Repository progress: {index}/{len(repositories)}',flush=True)
    finally:
        github.session.close()
    return errors


def discover_forge(store, forge, http):
    for term in ('vless','vmess','trojan','hysteria','hysteria2','tuic','mihomo','sing-box','vpn subscription'):
        for page in range(1,11):
            if forge == 'gitlab':
                url = f'https://gitlab.com/api/v4/projects?search={quote(term)}&order_by=updated_at&per_page=20&page={page}'
            else:
                base = 'https://gitverse.ru/api/repos/search' if forge=='gitverse' else 'https://codeberg.org/api/v1/repos/search'
                url = base+f'?q={quote(term)}&limit=20&page={page}'
            _,_,body = http.fetch(url)
            data = json.loads(body)
            rows = data if isinstance(data,list) else data.get('data',[])
            for row in rows:
                if forge == 'gitlab':
                    name,branch = row.get('path_with_namespace'),row.get('default_branch')
                elif forge == 'gitverse':
                    name,branch = row.get('fullName'),row.get('defaultBranch')
                else:
                    name,branch = row.get('full_name'),row.get('default_branch')
                if not isinstance(name,str) or not isinstance(branch,str): continue
                # Bounded fallback for secondary forges; confirmed links from README
                # enter the common depth-limited frontier without another validator.
                for path in ('README.md','sub/all.txt','all.txt','vless.txt','configs.txt','clash.yaml','sub.txt'):
                    if forge == 'gitlab': target = f'https://gitlab.com/{name}/-/raw/{quote(branch,safe="")}/{path}'
                    elif forge == 'gitverse': target = f'https://gitverse.ru/api/repos/{name}/raw/branch/{quote(branch,safe="")}/{path}'
                    else: target = f'https://codeberg.org/{name}/raw/branch/{quote(branch,safe="")}/{path}'
                    store.add(target,commit=False)
                store.db.commit()
            if len(rows)<20: break


class ParsedCache:
    """A small mirror cache, rather than every parsed source for the entire run."""
    def __init__(self, max_bytes=8*1024*1024, max_entries=128):
        self.max_bytes, self.max_entries = max_bytes, max_entries
        self.items = OrderedDict()
        self.bytes = 0

    def get(self, digest):
        item = self.items.get(digest)
        if item is not None:
            self.items.move_to_end(digest)
            return item[0]
        return None

    def put(self, digest, uris):
        prior = self.items.pop(digest,None)
        if prior is not None:
            self.bytes -= prior[1]
        size = sys.getsizeof(uris) + sum(sys.getsizeof(uri) for uri in uris)
        if size > self.max_bytes:
            return
        while self.items and (self.bytes+size > self.max_bytes or len(self.items) >= self.max_entries):
            _, (_, removed) = self.items.popitem(last=False)
            self.bytes -= removed
        self.items[digest] = (uris, size)
        self.bytes += size


def collect(store, deadline, http=None, only=None, workers=None):
    from discover_sources import extract_subscription_urls_from_text
    http = http or Http(deadline)
    workers = workers if workers is not None else concurrency()['downloads']
    if not 1 <= workers <= 64:
        raise ValueError('download worker limit must be 1..64')
    def cancel():
        http.deadline = 0
    visited,keys,errors = set(),{},[]
    successful = cached = duplicates = 0
    parsed_bodies = ParsedCache()
    started = time.monotonic()
    download_seconds = parse_seconds = storage_seconds = 0
    scheduled = 0
    print(f'Crawler concurrency: {workers} downloads, at most 2 per host; bounded response cache',flush=True)
    for wave in range(3):
        rows = [r for r in store.due() if r['id'] not in visited and r['depth'] <= 2 and (only is None or r['id'] in only)]
        if not rows: break
        scheduled += len(rows)
        print(f'Crawler wave {wave+1}: {len(rows)} sources; {scheduled-len(visited)} queued',flush=True)
        def fetch(row):
            headers = {}
            if row['etag']: headers['If-None-Match'] = row['etag']
            if row['last_modified']: headers['If-Modified-Since'] = row['last_modified']
            start = time.monotonic()
            return (*http.fetch(row['url'],headers=headers),time.monotonic()-start)
        with host_downloads(rows,fetch,workers,deadline,cancel) as downloads:
            for row,future in downloads:
                visited.add(row['id'])
                try:
                    code,headers,body,seconds = future.result()
                    download_seconds += seconds
                    phase_started = time.monotonic()
                    if code == 304:
                        uris = store.cached(row['id'])
                        if not uris and row['content_hash'] is None: raise DownloadError('cache_missing')
                        cached += 1
                    else:
                        if any(marker in body.lower() for marker in ('cf-chl-','g-recaptcha','just a moment...')):
                            raise DownloadError('platform_challenge')
                        digest = __import__('hashlib').sha256(body.encode()).hexdigest()
                        uris = parsed_bodies.get(digest)
                        if uris is None:
                            uris = [u for u in normalize([body]) if supported(u)]
                            parsed_bodies.put(digest,uris)
                    if row['depth'] < 2 and code == 200:
                        for link in extract_subscription_urls_from_text(body):
                            if public_url(link):
                                store.add(link,row['depth']+1,commit=False)
                                if only is not None:
                                    from .crawler_store import source_id
                                    only.add(source_id(public_url(link)))
                    is_page = '/t.me/s/' in row['url'] or urlsplit(row['url']).path.rsplit('/',1)[-1].lower().startswith('readme')
                    if not uris and not is_page: raise DownloadError('no_supported_configs',True)
                    # Invalid endpoint/configs never enter the persistent parsed cache.
                    published = {}
                    if is_page and code == 200:
                        for block in re.findall(r'<div class="tgme_widget_message_wrap[^>]*>.*?(?=<div class="tgme_widget_message_wrap|\Z)',body,re.S):
                            match = re.search(r'<time[^>]*datetime="([^"]+)"',block)
                            if match:
                                for uri in normalize([block]): published[uri] = match[1]
                    parse_seconds += time.monotonic()-phase_started
                    phase_started = time.monotonic()
                    store.success(row,uris,headers,seconds,published if is_page and code != 304 else None,unchanged=code==304)
                    storage_seconds += time.monotonic()-phase_started
                    successful += 1
                    for uri in uris:
                        ident = __import__('hashlib').sha256(uri.split('#',1)[0].encode()).hexdigest()
                        if ident in keys: duplicates += 1
                        else: keys[ident] = uri
                except DownloadError as exc:
                    store.failure(row,str(exc),exc.substantive)
                    errors.append({'source_id':row['id'],'reason':str(exc)})
                if len(visited)%50 == 0 or len(visited) == scheduled:
                    elapsed = time.monotonic()-started
                    print(f'Crawler: {len(visited)}/{scheduled} URLs; {scheduled-len(visited)} queued; '
                          f'{len(keys)} keys; {len(errors)} errors; {cached} cached; '
                          f'{len(visited)/max(elapsed,.001):.1f} URLs/s',flush=True)
    return list(keys.values()), errors, {'urls':len(visited),'successful':successful,'cached':cached,'duplicates':duplicates,'bytes':http.bytes,
        'workers':workers,'elapsed_seconds':time.monotonic()-started,'download_work_seconds':download_seconds,
        'parse_seconds':parse_seconds,'storage_seconds':storage_seconds}


def supported(uri):
    from .probe import service_prober as p
    if any(s in uri.lower() for s in ('ghp_','github_pat_','bearer ','ll_')) or '\n' in uri or '\r' in uri:
        return False
    if uri.startswith(('hy2://','hysteria2://','tuic://')):
        from urllib.parse import urlsplit
        try:
            value = urlsplit(uri)
            host,port,_ = p.parse_host_and_port(uri)
            return bool(host and 1 <= port <= 65535 and value.username and (value.password if value.scheme=='tuic' else True))
        except ValueError: return False
    out = p.uri_to_xray_outbound(uri,'preflight')
    if not out: return False
    if out.get('protocol') in ('vless','vmess'):
        try:
            if not p.is_valid_xray_uuid(out['settings']['vnext'][0]['users'][0]['id']): return False
        except (KeyError,IndexError): return False
    return p.prepare_outbound_for_current_xray(out) is not None
