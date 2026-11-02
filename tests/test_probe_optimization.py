import asyncio
import time
import unittest
from unittest.mock import AsyncMock, Mock, patch
from backend.vpn_v2.probe_prefilter import prefilter
from backend.vpn_v2 import probe


class ProbeOptimizationTests(unittest.TestCase):
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

    def test_udp_requires_public_dns_but_never_tcp_connect(self):
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
