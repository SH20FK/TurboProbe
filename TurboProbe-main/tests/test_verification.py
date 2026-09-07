import ast
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from datetime import datetime, timezone, timedelta

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import verification as v
import service_prober as prober
import aggregator

class Response:
    def __init__(self, status, body):
        self.status_code, self.body = status, body
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def iter_content(self, size):
        for i in range(0, len(self.body), size): yield self.body[i:i+size]

class Factory:
    def __init__(self, answers): self.answers, self.calls = iter(answers), []
    def __call__(self, port):
        owner = self
        class Session:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def get(self, url, **kwargs):
                owner.calls.append((port, url, kwargs))
                answer = next(owner.answers)
                if isinstance(answer, Exception): raise answer
                return Response(*answer)
        return Session()

TRACE = b'ip=8.8.8.8\nloc=DE\ntls=TLSv1.3\n'
TRANSFER = (200, b'x' * v.TRANSFER_BYTES)

class TunnelTests(unittest.TestCase):
    def test_two_https_and_complete_transfer_required(self):
        factory = Factory([(204, b''), (204, b''), (503, b''), TRANSFER])
        result = v.measure_tunnel(12345, session_factory=factory)
        self.assertTrue(result['verified'])
        self.assertGreater(result['ping_ms'], 0)
        self.assertEqual(result['https_successes'], 2)
        self.assertEqual(result['transfer_bytes'], 65536)
        for port, url, kwargs in factory.calls:
            self.assertEqual(port, 12345)
            self.assertTrue(url.startswith('https://'))
            self.assertTrue(kwargs['verify'])
            self.assertFalse(kwargs['allow_redirects'])
            self.assertTrue(kwargs['stream'])
        self.assertIn('bytes=65536', factory.calls[-1][1])

    def test_single_success_is_not_enough(self):
        f = Factory([(204,b''),(403,b''),(500,b'')])
        self.assertIsNone(v.measure_tunnel(1, session_factory=f))
        self.assertEqual(len(f.calls),3)

    def test_captive_portal_and_redirect_are_not_success(self):
        f = Factory([(200,b'<html>Login</html>'),(302,b''),(200,b'loc=RU')])
        self.assertIsNone(v.measure_tunnel(1, session_factory=f))

    def test_trace_validation(self):
        self.assertTrue(v.valid_response('trace',200,TRACE))
        self.assertFalse(v.valid_response('trace',200,b'ip=127.0.0.1\nloc=RU\ntls=TLSv1.3'))
        self.assertFalse(v.valid_response('empty204',200,b''))
        self.assertFalse(v.valid_response('empty204',204,b'fake'))

    def test_bad_tls_and_timeouts_cannot_pass(self):
        f = Factory([v.requests.exceptions.SSLError('bad certificate'), TimeoutError(), (500,b'')])
        self.assertIsNone(v.measure_tunnel(1, session_factory=f))

    def test_short_or_oversized_transfer_fails(self):
        for size in (0, 100, 65535, 65537):
            f = Factory([(204,b''),(204,b''),(200,TRACE),(200,b'x'*size)])
            self.assertIsNone(v.measure_tunnel(1, session_factory=f))

    def test_transfer_failure_does_not_get_ignored(self):
        f = Factory([(204,b''),(204,b''),(200,TRACE),TimeoutError()])
        self.assertIsNone(v.measure_tunnel(1, session_factory=f))

    def test_environment_proxy_cannot_override_socks(self):
        with patch.dict(os.environ, {'HTTPS_PROXY':'http://127.0.0.1:9'}):
            with v.make_session(10900) as session:
                self.assertFalse(session.trust_env)
                self.assertEqual(session.proxies['https'],'socks5h://127.0.0.1:10900')
                self.assertEqual(session.proxies['http'],session.proxies['https'])

    def test_deadline_rejected(self):
        with self.assertRaises(TimeoutError):
            v.read_response(None, 'https://example.com', 0, 1, 100)

class IdentityTests(unittest.TestCase):
    def test_every_connection_parameter_matters(self):
        u='tuic://User:Secret@example.com:443?sni=a&alpn=h3'
        self.assertEqual(v.node_id(u+'#one'),v.node_id(u+'#two'))
        for altered in (u.replace('Secret','secret'),u.replace('sni=a','sni=b'),u.replace(':443',':444'),u.replace('User','Other')):
            self.assertNotEqual(v.node_id(u),v.node_id(altered))
            self.assertNotEqual(aggregator.get_node_key(u),aggregator.get_node_key(altered))
        self.assertIn(':Secret@',aggregator.canonicalize_uri(u))

class RuTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026,9,7,18,0,tzinfo=timezone.utc)
        self.vantage={'id':v.RU_VANTAGE,'network':'Intersvyaz'}
        self.node={'uri':'vless://uuid@example.com:443?security=reality#name',
                   'verified':True,'verification_policy':v.POLICY,'ping_ms':60.0,
                   'checked_at':self.now.isoformat()}

    def test_no_old_future_or_naive_timestamps(self):
        for time in (self.now-timedelta(hours=2),self.now+timedelta(seconds=1),self.now.replace(tzinfo=None)):
            self.assertFalse(v.fresh(time.isoformat(),self.now))
        self.assertFalse(v.fresh(None,self.now))

    def test_deduplicates_exact_config_and_expires(self):
        result = v.ru_snapshot([self.node,self.node],self.vantage,self.now)
        self.assertEqual(len(result['nodes']),1)
        self.assertEqual(result['nodes'][0]['id'],v.node_id(self.node['uri']))
        self.assertEqual(result['nodes'][0]['expires_at'],(self.now+timedelta(hours=1)).isoformat())

    def test_rejects_unverified_old_policy_and_fake_latency(self):
        for patch_values in ({'verified':False},{'verification_policy':'legacy'},{'checked_at':None},{'ping_ms':float('nan')},{'ping_ms':float('inf')},{'ping_ms':True},{'ping_ms':0}):
            self.assertEqual(v.ru_snapshot([{**self.node,**patch_values}],self.vantage,self.now)['nodes'],[])

    def test_empty_run_replaces_previous_snapshot(self):
        with tempfile.TemporaryDirectory() as d:
            v.write_ru_snapshot(d,[],self.vantage)
            self.assertEqual(json.loads((Path(d)/'ru-verified.json').read_text())['nodes'],[])

    def test_network_metadata_does_not_expose_home_ip(self):
        data={'success':True,'country_code':'RU','ip':'8.8.8.8','connection':{'isp':'Intersvyaz-2','asn':123}}
        result=v.validate_ru_network(data)
        self.assertNotIn('8.8.8.8',json.dumps(result))
        for bad in ({**data,'country_code':'DE'},{**data,'connection':{'isp':'Other'}},{'success':False}):
            with self.assertRaises(RuntimeError): v.validate_ru_network(bad)

class IntegrationPolicyTests(unittest.TestCase):
    def test_missing_mihomo_never_returns_dns_success(self):
        with patch.object(prober,'get_mihomo_binary_path',return_value=''), patch.object(prober.socket,'getaddrinfo',side_effect=AssertionError('DNS must not be considered success')):
            self.assertEqual(prober.probe_hy2_tuic_batch([('hy2://pass@example.com:443','hy2')]),[])

    def test_missing_xray_raises(self):
        with patch.object(prober,'get_xray_binary_path',return_value=''):
            with self.assertRaises(RuntimeError): prober.deep_verify_nodes(['vless://uuid@example.com:443'])

    def test_deep_gate_returns_measured_ping_not_tcp_ping(self):
        u='vless://uuid@example.com:443?security=reality'
        n={'uri':u,'ping_ms':620,'verified':True,'verification_policy':v.POLICY}
        with patch.object(prober,'get_xray_binary_path',return_value='xray'),patch.object(prober,'run_batch_probe',return_value=[n]):
            self.assertEqual(prober.deep_verify_nodes([u],return_results=True)[v.node_id(u)]['ping_ms'],620)

    def test_globalping_cannot_set_ru_verified(self):
        nodes=[{'uri':'vless://uuid@example.com:443','ru_verified':False}]
        self.assertFalse(prober.verify_nodes_with_globalping_ru(nodes)[0]['ru_verified'])

    def test_default_xray_outbound_blocks_unmatched_traffic(self):
        source=(ROOT/'tools/service_prober.py').read_text()
        self.assertIn('"outbounds": [{"tag": "blocked", "protocol": "blackhole"}] + outbounds',source)
        self.assertIn('"outboundTag": out_tag',source)
        self.assertNotIn('"protocol": "freedom"',source)

    def test_mihomo_default_rejects_and_tuic_password_is_preserved(self):
        source=(ROOT/'tools/service_prober.py').read_text()
        self.assertIn('"rules": ["MATCH,REJECT"]',source)
        self.assertIn('"proxy": name',source)
        self.assertIn('parsed.password or q.get("password"',source)

class PublicationTests(unittest.TestCase):
    def test_zero_verified_nodes_replace_old_cloud_exports(self):
        import contextlib
        import io
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); sub=root/'sub'; sub.mkdir(); tools=root/'tools'; tools.mkdir()
            uri='vless://11111111-2222-3333-4444-555555555555@example.com:443'
            for name in ['all.txt','reality.txt','hysteria2.txt']:
                (sub/name).write_text(uri)
            with patch.multiple(prober,ROOT_DIR=str(root),SUB_DIR=str(sub),TOOLS_DIR=str(tools),SERVICES_DIR=str(sub/'services')), patch.object(prober,'get_xray_binary_path',return_value='xray'), patch.object(prober,'run_batch_probe',return_value=[]), patch.object(sys,'argv',['service_prober.py','--limit','1']), contextlib.redirect_stdout(io.StringIO()):
                prober.main()
            self.assertEqual(json.loads((sub/'nodes.json').read_text())['nodes'],[])
            for name in ['all.txt','reality.txt','hysteria2.txt']:
                self.assertEqual((sub/name).read_text(),'')

if __name__=='__main__': unittest.main()
