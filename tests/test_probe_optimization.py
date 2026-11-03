import asyncio
import time
import unittest
from unittest.mock import AsyncMock, Mock, patch
from backend.vpn_v2.probe_prefilter import prefilter, ProbeCache, RUN_CACHE
from backend.vpn_v2 import probe


class ProbeOptimizationTests(unittest.TestCase):
    def setUp(self): RUN_CACHE.items.clear()
    def test_stability_rejects_first_pass_only_and_keeps_conservative_latency(self):
        first=[{'uri':'trojan://a@example.com:443#old','ping_ms':20},
               {'uri':'trojan://b@example.com:443','ping_ms':10}]
        second=[{'uri':'trojan://a@example.com:443#new','ping_ms':30,'country':'DE'}]
        with patch.object(probe,'verify',side_effect=[first,second]) as verify:
            result=probe.verify_stable(['input'],deadline=123)
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]['ping_ms'],30)
        self.assertEqual(result[0]['verification_rounds'],2)
        self.assertEqual(verify.call_args_list[1].args[0],[n['uri'] for n in first])
        self.assertEqual(verify.call_args_list[1].kwargs['deadline'],123)

    def test_empty_first_pass_does_not_start_second_core_round(self):
        with patch.object(probe,'verify',return_value=[]) as verify:
            self.assertEqual(probe.verify_stable(['input']),[])
        self.assertEqual(verify.call_count,1)

    def test_watchdog_does_not_signal_parent_notebook_group(self):
        from backend.vpn_v2 import kaggle
        import signal
        proc=Mock(pid=123)
        with patch.object(kaggle.os,'getpgid',return_value=456,create=True), \
             patch.object(kaggle.os,'getpgrp',return_value=456,create=True), \
             patch.object(kaggle.os,'killpg',create=True) as group:
            kaggle.signal_job(proc,signal.SIGTERM)
        group.assert_not_called();proc.send_signal.assert_called_once_with(signal.SIGTERM)

    def test_cleanup_terminates_only_owned_pid_never_a_process_group(self):
        proc=Mock();proc.poll.return_value=None
        with patch.object(probe.service_prober.os,'killpg',create=True) as kill_group:
            probe.service_prober.stop_core_process(proc)
        proc.terminate.assert_called_once();proc.wait.assert_called_once()
        proc.kill.assert_not_called();kill_group.assert_not_called()

    def test_cleanup_kills_only_the_child_after_terminate_timeout(self):
        import subprocess
        proc=Mock();proc.poll.return_value=None
        proc.wait.side_effect=[subprocess.TimeoutExpired('core',2),0]
        with patch.object(probe.service_prober.os,'killpg',create=True) as kill_group:
            probe.service_prober.stop_core_process(proc)
        proc.kill.assert_called_once();kill_group.assert_not_called()

    def test_go_core_resources_are_bounded_without_affecting_parent_environment(self):
        import os
        with patch.dict(os.environ,{'GOMAXPROCS':'128'}):
            env=probe.service_prober.core_environment()
            self.assertEqual(env['GOMAXPROCS'],'1')
            self.assertEqual(env['GOMEMLIMIT'],'192MiB')
            self.assertEqual(os.environ['GOMAXPROCS'],'128')

    def test_shared_endpoint_is_checked_once_and_tries_second_ip(self):
        uris = ['trojan://'+str(i)+'@example.com:443' for i in range(3)]
        writer = Mock()
        connect = AsyncMock(side_effect=[OSError('first IP unreachable'),(Mock(),writer)])
        with patch('backend.vpn_v2.probe_prefilter.public_addresses',return_value=['2001:4860:4860::8888','8.8.8.8']) as dns, \
             patch('backend.vpn_v2.probe_prefilter.asyncio.open_connection',connect):
            retained = asyncio.run(prefilter(uris,probe.service_prober.parse_host_and_port,time.monotonic()+30))
        self.assertEqual(retained,uris)
        self.assertEqual(dns.call_count,1)
        self.assertEqual(connect.await_count,2)
        writer.close.assert_called_once()

    def test_udp_is_deferred_to_tunnel_phase(self):
        uris = ['hy2://password@example.com:443']
        with patch('backend.vpn_v2.probe_prefilter.public_addresses',return_value=['8.8.8.8']), \
             patch('backend.vpn_v2.probe_prefilter.asyncio.open_connection',new_callable=AsyncMock) as tcp:
            self.assertEqual(asyncio.run(prefilter(uris,probe.service_prober.parse_host_and_port,time.monotonic()+30)),uris)
            tcp.assert_not_called()

    def test_speed_reuses_batches_preserves_ping_and_has_no_global_patch(self):
        nodes = [{'uri':f'trojan://pass{i}@example.com:443','ping_ms':i+20,'country':'DE'} for i in range(25)]
        original = probe.service_prober.measure_tunnel
        def run(binary,batch,**kwargs):
            self.assertEqual(kwargs['measurement_workers'],1)
            self.assertIs(probe.service_prober.measure_tunnel,original)
            return [{'uri':slot[1],'speed_mbps':10} for slot in batch]
        with patch.object(probe.service_prober,'get_xray_binary_path',return_value='xray'), \
             patch.object(probe.service_prober,'run_batch_probe',side_effect=run) as engine:
            results=probe.measure_selected(nodes)
        self.assertEqual([len(c.args[1]) for c in engine.call_args_list],[12,12,1])
        self.assertEqual([n['ping_ms'] for n in results],[n['ping_ms'] for n in nodes])
        self.assertTrue(all(n['speed_status']=='measured' for n in results))

    def test_speed_deadline_prevents_new_batch(self):
        with patch.object(probe.service_prober,'get_xray_binary_path',return_value='xray'), \
             patch.object(probe.service_prober,'run_batch_probe') as engine:
            with self.assertRaises(TimeoutError):probe.measure_selected([{'uri':'x'}],deadline=0)
            engine.assert_not_called()


class CrossWindowCacheTests(unittest.TestCase):
    def test_credentials_share_tcp_across_event_loops_but_expiry_rechecks(self):
        cache=ProbeCache()
        writer=Mock()
        clock=[100.0]
        with patch('backend.vpn_v2.probe_prefilter.time.monotonic',side_effect=lambda:clock[0]), patch('backend.vpn_v2.probe_prefilter.public_addresses',return_value=['8.8.8.8']) as dns, patch('backend.vpn_v2.probe_prefilter.asyncio.open_connection',new_callable=AsyncMock,return_value=(Mock(),writer)) as tcp:
            for password in ('a','b'):
                uri=f'trojan://{password}@cache.test:443'
                self.assertEqual(asyncio.run(prefilter([uri],probe.service_prober.parse_host_and_port,1000,cache=cache)),[uri])
            self.assertEqual(dns.call_count,1);self.assertEqual(tcp.await_count,1)
            clock[0]=161
            asyncio.run(prefilter([uri],probe.service_prober.parse_host_and_port,1000,cache=cache))
            self.assertEqual(tcp.await_count,2);self.assertEqual(dns.call_count,1)
            clock[0]=401
            asyncio.run(prefilter([uri],probe.service_prober.parse_host_and_port,1000,cache=cache))
            self.assertEqual(dns.call_count,2)

    def test_negative_cache_expires_and_capacity_is_bounded(self):
        cache=ProbeCache(limit=2)
        with patch('backend.vpn_v2.probe_prefilter.time.monotonic',return_value=100):
            cache.put('a',False,10);self.assertIs(cache.get('a'),False)
            cache.put('b',True,60);cache.put('c',True,60)
            self.assertIsNone(cache.get('a'));self.assertEqual(len(cache.items),2)
        with patch('backend.vpn_v2.probe_prefilter.time.monotonic',return_value=161):
            self.assertIsNone(cache.get('b'))

    def test_udp_never_resolves_or_connects_in_phase_one(self):
        uris=['hy2://p@missing.test:443','tuic://u:p@missing.test:443']
        with patch('backend.vpn_v2.probe_prefilter.public_addresses') as dns, patch('backend.vpn_v2.probe_prefilter.asyncio.open_connection') as tcp:
            self.assertEqual(asyncio.run(prefilter(uris,probe.service_prober.parse_host_and_port,time.monotonic()+30,cache=ProbeCache())),uris)
        dns.assert_not_called();tcp.assert_not_called()

    def test_low_memory_reduces_core_count_and_batch(self):
        from backend.vpn_v2 import resources
        with patch.object(resources,'cpu_count',return_value=8), patch.object(resources,'runtime_sample',return_value={'memory_max':1024**3,'memory_current':512*1024**2}):
            profile=resources.concurrency()
        self.assertEqual((profile['probe_workers'],profile['probe_batch']),(1,8))
