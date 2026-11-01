import asyncio
import time
import unittest
from unittest.mock import AsyncMock, Mock, patch
from backend.vpn_v2.probe_prefilter import prefilter
from backend.vpn_v2 import probe


class ProbeOptimizationTests(unittest.TestCase):
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
