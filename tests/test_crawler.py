import gzip
import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from backend.vpn_v2.crawler_store import Store, public_url, source_id
from backend.vpn_v2.crawler_state import encode, restore
from backend.vpn_v2.crawler_state import StateBranch
from backend.vpn_v2.crawler_http import Http, DownloadError, public_addresses
from backend.vpn_v2 import crawler
from backend.vpn_v2 import __main__ as cli
from backend.vpn_v2.latencylab import LabClient, LabError

URI = 'vless://11111111-2222-3333-4444-555555555555@example.com:443?security=tls&sni=example.com'


class RegistryTests(unittest.TestCase):
    def test_seed_import_commits_once_and_is_not_reimported(self):
        import aggregator
        import discover_sources
        root=Path(self.temp.name)/'seed';root.mkdir()
        (root/'discovered_sources.json').write_text(json.dumps({'https://example.com/'+str(i)+'.txt':{} for i in range(100)}))
        statements=[]
        self.store.db.set_trace_callback(statements.append)
        with patch.object(crawler,'LEGACY_DIR',root), \
             patch.object(aggregator,'SOURCES',[]), \
             patch.object(discover_sources,'TELEGRAM_CHANNELS',[]), \
             patch.object(discover_sources,'SEED_REPOSITORIES',[]):
            crawler.seed(self.store)
            crawler.seed(self.store)
        self.assertEqual(sum(s == 'COMMIT' for s in statements),1)
        self.assertEqual(len(self.store.due()),100)
        self.store.db.set_trace_callback(None)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.now = 1000000
        self.store = Store(Path(self.temp.name)/'crawler.sqlite',clock=lambda:self.now)

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def test_public_sources_exclude_secrets_private_hosts_and_credentials(self):
        for url in ('https://host.test/sub?token=private','https://user:pass@host.test/sub',
                    'http://host.test/all.txt','https://127.0.0.1/all.txt','https://localhost/sub',
                    'https://host.test/%67hp_secret'):
            self.assertIsNone(public_url(url))
        self.assertEqual(public_url('https://t.me/s/public?before=123'),'https://t.me/s/public?before=123')

    def test_identity_preserves_path_case_and_collapses_commit_branch_aliases(self):
        commit='a'*40
        a=f'https://raw.githubusercontent.com/Owner/Repo/{commit}/Sub/Keys.txt'
        b='https://raw.githubusercontent.com/owner/repo/refs/heads/main/Sub/Keys.txt'
        c='https://github.com/owner/repo/blob/feature%2Fx/Sub/Keys.txt'
        self.assertEqual(source_id(a),source_id(b))
        self.assertEqual(source_id(a),source_id(c))
        self.store.add(a);self.store.add(b)
        self.assertEqual(len(self.store.due()),1)
        self.assertEqual(self.store.due()[0]['url'],b)

    def test_code_and_dependency_files_do_not_enter_registry(self):
        for path in ('package.json','tests/config.yaml','app.py','.github/workflows/check.yml','node_modules/all.txt'):
            self.assertFalse(self.store.add('https://example.com/'+path))
        self.assertTrue(self.store.add('https://example.com/sub/all.txt'))

    def test_quarantine_schedule_and_infrastructure_failures(self):
        self.store.add('https://example.com/all.txt')
        for i in range(3): self.store.failure(self.store.due()[0],'empty',True)
        self.assertEqual(self.store.due(),[])
        self.now += 86400
        row=self.store.due()[0]
        self.store.failure(row,'rate_limited',False)
        self.assertEqual(self.store.db.execute('SELECT failures FROM sources').fetchone()[0],3)
        self.store.failure(self.store.due()[0],'empty',True)
        self.assertEqual(self.store.db.execute('SELECT due FROM sources').fetchone()[0],self.now+3*86400)
        self.now += 3*86400
        self.store.failure(self.store.due()[0],'empty',True)
        self.assertEqual(self.store.db.execute('SELECT due FROM sources').fetchone()[0],self.now+7*86400)

    def test_cached_304_keeps_keys_and_source_provenance(self):
        self.store.add('https://example.com/a.txt')
        self.store.add('https://example.org/b.txt')
        class FakeHttp:
            bytes=0
            def __init__(self): self.calls=[];self.second=False
            def fetch(inner,url,headers):
                inner.calls.append(dict(headers))
                if inner.second:return 304,{},''
                inner.bytes += len(URI)
                return 200,{'etag':'version-1'},URI
        http=FakeHttp()
        first,errors,metrics=crawler.collect(self.store,time.monotonic()+60,http)
        self.assertEqual(first,[URI]);self.assertEqual(errors,[])
        self.assertEqual(metrics['duplicates'],1)
        self.assertEqual(self.store.db.execute('SELECT count(*) FROM source_nodes').fetchone()[0],2)
        http.second=True;http.bytes=0
        second,errors,metrics=crawler.collect(self.store,time.monotonic()+60,http)
        self.assertEqual(second,first);self.assertEqual(metrics['bytes'],0)
        self.assertEqual(metrics['cached'],2)
        self.assertTrue(all(h.get('If-None-Match')=='version-1' for h in http.calls[-2:]))

    def test_link_depth_and_cycles_stop(self):
        self.store.add('https://example.com/README.md')
        class Fake:
            bytes=0
            def fetch(self,url,headers):
                if url.endswith('README.md'): return 200,{},'https://example.com/one.txt'
                if url.endswith('one.txt'): return 200,{},URI+'\nhttps://example.com/two.txt'
                return 200,{},URI+'\nhttps://example.com/three.txt\nhttps://example.com/one.txt'
        _,_,metrics=crawler.collect(self.store,time.monotonic()+60,Fake())
        self.assertEqual(metrics['urls'],3)
        self.assertIsNone(self.store.db.execute("SELECT id FROM sources WHERE url LIKE '%three.txt'").fetchone())

    def test_restore_in_clean_session_and_filtered_public_checkpoint(self):
        self.store.add('https://example.com/a.txt')
        self.store.success(self.store.due()[0],[URI],{'etag':'v1'})
        self.store.db.execute("INSERT INTO meta VALUES('secret','Bearer do-not-publish')")
        self.store.db.commit()
        blob=encode(self.store)
        self.assertNotIn(b'do-not-publish',gzip.decompress(blob))
        other=Store(Path(self.temp.name)/'restored.sqlite')
        try:
            restore(other,blob)
            self.assertEqual(other.cached(other.due()[0]['id']),[URI])
            self.assertEqual(other.due()[0]['etag'],'v1')
            with self.assertRaises((ValueError,KeyError)): restore(other,gzip.compress(b'{"version":99}'))
            self.assertEqual(len(other.due()),1)
        finally:other.close()

    def test_corrupt_database_fails_without_silently_reseeding(self):
        path=Path(self.temp.name)/'corrupt.sqlite';path.write_bytes(b'broken state')
        import sqlite3
        with self.assertRaises(sqlite3.DatabaseError):Store(path)


class ApiTests(unittest.TestCase):
    def test_state_branch_roundtrip_is_data_only(self):
        import subprocess
        with tempfile.TemporaryDirectory() as temp:
            bare=Path(temp)/'remote.git'
            subprocess.run(['git','init','--bare',str(bare)],capture_output=True,check=True)
            first=Store(Path(temp)/'first.sqlite')
            first.add('https://example.com/sub.txt')
            first.success(first.due()[0],[URI],{'etag':'v1'})
            second=Store(Path(temp)/'second.sqlite')
            with patch('backend.vpn_v2.crawler_state.REMOTE',str(bare)):
                branch=StateBranch('unused')
                try:
                    branch.open(first);branch.save(first)
                    files=branch.git('ls-tree','--name-only','HEAD').stdout.decode().splitlines()
                    self.assertEqual(set(files),{'README.md','state.json','state'})
                finally:branch.close()
                branch=StateBranch('unused')
                try:
                    branch.open(second)
                    self.assertEqual(second.cached(second.due()[0]['id']),[URI])
                finally:branch.close()
            first.close();second.close()

    def test_search_pagination_is_saved_and_resumed(self):
        with tempfile.TemporaryDirectory() as temp:
            store=Store(Path(temp)/'test.sqlite')
            store.db.execute("INSERT INTO meta VALUES('search_queue',?)",(json.dumps([{'q':'topic:tuic','start':'2026-01-01','end':'2026-01-02','page':1}]),))
            store.db.commit()
            api=crawler.GitHub('',store,time.monotonic()+60)
            api.get=Mock(side_effect=[
                ({'items':[{'full_name':'one/repo','default_branch':'main'}]}, {'Link':'<next>; rel="next"'}),
                TimeoutError('stop'),
            ])
            with self.assertRaises(TimeoutError):api.repos()
            queue=json.loads(store.db.execute("SELECT value FROM meta WHERE key='search_queue'").fetchone()[0])
            self.assertEqual(queue[0]['page'],2)
            api.get=Mock(return_value=({'items':[]},{}))
            api.repos()
            self.assertIn('page=2',api.get.call_args.args[0])
            self.assertEqual(store.db.execute('SELECT name FROM repos').fetchone()[0],'one/repo')
            store.close()

    def test_known_pending_job_is_polled_after_restart_without_post(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temp:
            store=Store(Path(temp)/'test.sqlite')
            node=hashlib.sha256(URI.encode()).hexdigest()
            store.db.execute('INSERT INTO jobs VALUES(?,?,?,?,?,?)',('old',node,'job',0,'pending','{}'))
            store.db.commit()
            client=LabClient('unused');client.attach_store(store,'new',0,Mock())
            client.request=Mock(return_value={'ok':True,'status':'done','result':{'operator':'mts','ok':True}})
            self.assertTrue(client.check(URI,['mts']))
            self.assertEqual(client.request.call_args.args,('GET','/api/lab/job/job'))
            store.close()

    def test_uncertain_submission_is_never_resent(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temp:
            store=Store(Path(temp)/'test.sqlite')
            store.db.execute('INSERT INTO jobs VALUES(?,?,?,?,?,?)',('old',hashlib.sha256(URI.encode()).hexdigest(),None,0,'submitting','{}'))
            store.db.commit()
            client=LabClient('unused');client.attach_store(store,'new',0,Mock())
            client.request=Mock(return_value={'ok':True,'status':'idle'})
            with self.assertRaises(LabError):client.check(URI,['mts'])
            self.assertEqual(client.request.call_args.args,('GET','/api/lab/job/active'))
            store.close()

    def test_discovery_terms_cover_protocols_and_non_topic_search(self):
        queries=crawler.search_queries()
        self.assertIn('topic:hysteria2',queries)
        self.assertIn('topic:tuic',queries)
        self.assertIn('shadowsocks in:name,description,readme',queries)
        self.assertGreater(len(queries),60)

    def test_truncated_tree_is_walked_and_default_branch_with_slash_encoded(self):
        with tempfile.TemporaryDirectory() as temp:
            store=Store(Path(temp)/'test.sqlite')
            try:
                api=crawler.GitHub('',store,time.monotonic()+60)
                api.get=Mock(side_effect=[
                    ({'default_branch':'feature/new','pushed_at':'now'},{'ETag':'meta'}),
                    ({'truncated':True,'tree':[]},{}),
                    ({'tree':[{'type':'tree','path':'sub','sha':'child'},{'type':'blob','path':'package.json'}]},{}),
                    ({'tree':[{'type':'blob','path':'all.txt'}]},{}),
                ])
                api.scan('owner/repo')
                self.assertIn('feature%2Fnew',api.get.call_args_list[1].args[0])
                self.assertEqual([r['url'] for r in store.due()],['https://raw.githubusercontent.com/owner/repo/feature%2Fnew/sub/all.txt'])
            finally:store.close()

    def test_rate_limit_honors_retry_after(self):
        with tempfile.TemporaryDirectory() as temp:
            store=Store(Path(temp)/'test.sqlite')
            sleep=Mock();api=crawler.GitHub('unused',store,time.monotonic()+120,sleep=sleep)
            limited=Mock(status_code=429,headers={'Retry-After':'3'})
            good=Mock(status_code=200,headers={});good.json.return_value={}
            api.session.get=Mock(side_effect=[limited,good])
            api.get('/repos/owner/repo')
            sleep.assert_called_once_with(3)
            store.close()

    def test_private_redirect_blocked_before_second_connection(self):
        response=Mock(status=302)
        response.getheaders.return_value=[('Location','https://127.0.0.1/private')]
        conn=Mock();conn.getresponse.return_value=response
        with patch('backend.vpn_v2.crawler_http.public_addresses',return_value=['8.8.8.8']), \
             patch('backend.vpn_v2.crawler_http.http.client.HTTPSConnection',return_value=conn) as connection:
            with self.assertRaises(DownloadError):Http(time.monotonic()+60).fetch('https://example.com/sub')
            self.assertEqual(connection.call_count,1)

    def test_expired_budget_does_not_connect(self):
        with patch('backend.vpn_v2.crawler_http.http.client.HTTPSConnection') as conn:
            with self.assertRaises(TimeoutError):Http(0).fetch('https://example.com/sub')
            conn.assert_not_called()

    def test_incomplete_local_pool_never_publishes(self):
        private=Path(cli.__file__).resolve().parent/'.local'
        private.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=private) as temp:
            run=Mock(deadline=time.monotonic()+21600,local_deadline=time.monotonic()+16200)
            run.collect.side_effect=TimeoutError('pool incomplete')
            with patch('sys.argv',['vpn_v2','--out',str(Path(temp)/'run.json'),'--push']), \
                 patch.object(cli,'CrawlRun',return_value=run), \
                 patch.object(cli,'load',return_value='unused'), \
                 patch('backend.vpn_v2.github.push_snapshot') as push:
                with self.assertRaises(cli.LabError):cli.main()
                push.assert_not_called()
                run.close.assert_called_once()
