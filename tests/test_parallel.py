import asyncio
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

from backend.vpn_v2.parallel import completed, host_downloads
from backend.vpn_v2.crawler import ParsedCache
from backend.vpn_v2.crawler_store import Store
from backend.vpn_v2.probe_prefilter import prefilter
from backend.vpn_v2 import resources, probe


class QueueTests(unittest.TestCase):
    def test_hosts_are_fair_and_both_concurrency_caps_hold(self):
        rows = [{'url':f'https://{host}/{i}', 'host':host} for host in ('one.test','two.test','three.test') for i in range(10)]
        active = defaultdict(int)
        peaks = defaultdict(int)
        order = []
        lock = threading.Lock()
        def fetch(row):
            with lock:
                active[row['host']] += 1
                active['total'] += 1
                for key in active: peaks[key] = max(peaks[key],active[key])
                order.append(row['host'])
            time.sleep(.005)
            with lock:
                active[row['host']] -= 1
                active['total'] -= 1
            return row['url']
        with host_downloads(rows,fetch,4,time.monotonic()+30,Mock()) as downloads:
            results = [future.result() for _,future in downloads]
        self.assertCountEqual(results,[r['url'] for r in rows])
        self.assertLessEqual(peaks['total'],4)
        self.assertTrue(all(peaks[h] <= 2 for h in ('one.test','two.test','three.test')))
        self.assertEqual(set(order[:3]),{'one.test','two.test','three.test'})

    def test_completed_responses_do_not_accumulate_while_consumer_parses(self):
        rows = [{'url':f'https://h{i}.test/sub.txt'} for i in range(1000)]
        fetch = Mock(return_value=b'x'*1024)
        with host_downloads(rows,fetch,4,time.monotonic()+30,Mock()) as downloads:
            next(downloads)
            time.sleep(.01)  # Even if every download finishes, no more are admitted.
            self.assertLessEqual(fetch.call_count,4)
            self.assertEqual(sum(1 for _ in downloads),999)

    def test_deadline_does_not_submit_any_download(self):
        fetch = Mock()
        with host_downloads([{'url':'https://example.com/sub'}],fetch,4,0,Mock()) as downloads:
            with self.assertRaises(TimeoutError): next(downloads)
        fetch.assert_not_called()

    def test_consumer_failure_cancels_downloads_and_stops_admission(self):
        rows = [{'url':f'https://h{i}.test/sub.txt'} for i in range(100)]
        fetch = Mock(return_value=b'data')
        cancel = Mock()
        with self.assertRaisesRegex(RuntimeError,'parse failed'):
            with host_downloads(rows,fetch,4,time.monotonic()+30,cancel) as downloads:
                next(downloads)
                raise RuntimeError('parse failed')
        self.assertLessEqual(fetch.call_count,4)
        cancel.assert_called_once()

    def test_core_batch_queue_is_bounded(self):
        work = Mock(side_effect=lambda item:item*2)
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = completed(pool,range(1000),work,4,time.monotonic()+30)
            first = next(results)
            time.sleep(.01)
            self.assertLessEqual(work.call_count,4)
            all_results = [first]+list(results)
        self.assertEqual(sorted(f.result() for _,f in all_results),list(range(0,2000,2)))

    def test_mirror_cache_is_bounded_and_uses_lru_eviction(self):
        cache = ParsedCache(max_bytes=1024,max_entries=2)
        cache.put('a',['one']);cache.put('b',['two'])
        self.assertEqual(cache.get('a'),['one'])
        cache.put('c',['three'])
        self.assertIsNone(cache.get('b'))
        cache.put('huge',['x'*2048])
        self.assertIsNone(cache.get('huge'))
        cache.put('a',['new'])
        self.assertLessEqual(cache.bytes,1024)
        self.assertEqual(len(cache.items),2)


class PrefilterScaleTests(unittest.TestCase):
    def test_many_credentials_create_only_endpoint_workers_and_keep_order(self):
        uris = [f'trojan://p{i}@h{i%10}.test:443' for i in range(10000)]
        create = asyncio.create_task
        writer = Mock()
        with patch('backend.vpn_v2.probe_prefilter.public_addresses',return_value=['8.8.8.8']) as dns, \
             patch('backend.vpn_v2.probe_prefilter.asyncio.open_connection',new_callable=AsyncMock,return_value=(Mock(),writer)) as tcp, \
             patch('backend.vpn_v2.probe_prefilter.asyncio.create_task',wraps=create) as tasks:
            result = asyncio.run(prefilter(uris,probe.service_prober.parse_host_and_port,time.monotonic()+30))
        self.assertEqual(result,uris)
        self.assertEqual(dns.call_count,10)
        self.assertEqual(tcp.await_count,10)
        self.assertEqual(tasks.call_count,20)

    def test_udp_with_failed_dns_is_not_retained(self):
        with patch('backend.vpn_v2.probe_prefilter.public_addresses',side_effect=OSError('DNS failure')), \
             patch('backend.vpn_v2.probe_prefilter.asyncio.open_connection',new_callable=AsyncMock) as tcp:
            self.assertEqual(asyncio.run(prefilter(['hy2://p@h.test:443'],probe.service_prober.parse_host_and_port,time.monotonic()+30)),[])
        tcp.assert_not_called()


class StorageScaleTests(unittest.TestCase):
    def test_304_and_identical_body_do_not_rewrite_nodes_or_provenance(self):
        with tempfile.TemporaryDirectory() as temp:
            store = Store(Path(temp)/'cache.sqlite')
            try:
                store.add('https://example.com/sub.txt')
                uris = ['trojan://p@example.com:443']
                store.success(store.due()[0],uris,{'etag':'one'},published={uris[0]:'2026-01-01'})
                before = tuple(store.db.execute('SELECT * FROM source_nodes').fetchone())
                statements = []
                store.db.set_trace_callback(statements.append)
                store.success(store.due()[0],uris,{},unchanged=True)
                store.success(store.due()[0],uris,{'etag':'two'})
                mutations = [s for s in statements if s.startswith(('INSERT INTO source_nodes','DELETE FROM source_nodes','INSERT OR IGNORE INTO nodes'))]
                self.assertEqual(mutations,[])
                self.assertEqual(tuple(store.db.execute('SELECT * FROM source_nodes').fetchone()),before)
                self.assertEqual(store.due()[0]['etag'],'two')
            finally:
                store.db.set_trace_callback(None)
                store.close()

    def test_bulk_links_preserve_password_case_and_new_publication(self):
        with tempfile.TemporaryDirectory() as temp:
            store = Store(Path(temp)/'cache.sqlite')
            try:
                store.add('https://example.com/sub.txt')
                uris = ['trojan://Pass@example.com:443','trojan://pass@example.com:443']
                store.success(store.due()[0],uris,{},published={u:'first' for u in uris})
                store.success(store.due()[0],uris,{},published={u:'second' for u in uris})
                self.assertCountEqual(store.cached(store.due()[0]['id']),uris)
                self.assertEqual([r[0] for r in store.db.execute('SELECT published FROM source_nodes')],['second','second'])
            finally: store.close()


class ResourceTests(unittest.TestCase):
    def test_profile_scales_but_stays_within_caps(self):
        for cpus,downloads,cores in ((1,24,2),(2,32,4),(4,64,8),(64,64,8)):
            with patch.object(resources,'cpu_count',return_value=cpus):
                result = resources.concurrency()
            self.assertEqual((result['downloads'],result['probe_workers']),(downloads,cores))
            self.assertLessEqual(result['probe_batch']*result['probe_workers'],128)

    def test_cgroup_quota_limits_host_cpu_count(self):
        with patch.object(resources.os,'process_cpu_count',return_value=64,create=True), \
             patch.object(resources.os,'sched_getaffinity',return_value=set(range(16)),create=True), \
             patch.object(resources.Path,'read_text',return_value='200000 100000'):
            self.assertEqual(resources.cpu_count(),2)
