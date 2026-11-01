import base64
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from backend.vpn_v2 import __main__ as cli, latencylab, probe, snapshot, sources
from backend.vpn_v2.export import publish


class SourceTests(unittest.TestCase):
    def test_identity_preserves_credentials_and_parameters(self):
        self.assertEqual(sources.identity('vless://A@example.com:443?x=1#one'),
                         sources.identity('vless://A@example.com:443?x=1#two'))
        self.assertNotEqual(sources.identity('vless://A@example.com:443?x=1'),
                            sources.identity('vless://a@example.com:443?x=1'))
        self.assertNotEqual(sources.identity('vless://A@example.com:443?x=1'),
                            sources.identity('vless://A@example.com:443?x=2'))

    def test_plain_and_base64_deduplicate(self):
        uri = 'vless://d342d11e-d424-4583-b36e-524ab1f0afa4@example.com:443?security=tls'
        data = base64.b64encode(uri.encode()).decode()
        self.assertEqual(len(sources.normalize([uri, data])), 1)

    def test_scheme_rejected(self):
        with self.assertRaises(ValueError):
            sources.fetch_source('file:///etc/passwd')

    def test_fetch_has_verified_tls_and_bounded_body(self):
        class Response:
            status_code = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def raise_for_status(self): pass
            def iter_content(self, size): return iter([b'12', b'34'])
        with patch('backend.vpn_v2.sources.requests.Session') as session_class:
            session = session_class.return_value.__enter__.return_value
            session.get.return_value = Response()
            with self.assertRaises(ValueError):
                sources.fetch_source('https://example.com/sub', max_bytes=3)
            self.assertTrue(session.get.call_args.kwargs['verify'])
            self.assertFalse(session.get.call_args.kwargs['allow_redirects'])


class RankingTests(unittest.TestCase):
    def test_rejected_outbound_is_removed_from_retested_xray_config(self):
        prober = probe.service_prober
        inspected = []
        def check(binary, filename):
            config = json.loads(Path(filename).read_text())
            tags = [o['tag'] for o in config['outbounds']]
            inspected.append(tags)
            return (1, 'failed outbound config with tag out_0') if 'out_0' in tags else (0, '')
        def outbound(uri, tag):
            return {'tag': tag, 'protocol': 'trojan', 'settings': {'servers': []}}
        batch = [(i, 'trojan://pass@example.com:443', 0, 'GLOBAL', 'trojan') for i in range(2)]
        with patch.object(prober, 'uri_to_xray_outbound', side_effect=outbound), \
             patch.object(prober, 'run_xray_config_test', side_effect=check), \
             patch.object(prober.subprocess, 'Popen', side_effect=OSError('test stops before networking')):
            prober.run_batch_probe('xray', batch, basic_only=True)
        self.assertEqual(inspected, [['blocked', 'out_0', 'out_1'], ['blocked', 'out_1']])

    def test_invalid_reality_path_rejected_before_core_start(self):
        outbound = {'streamSettings': {'security': 'reality', 'network': 'tcp', 'realitySettings': {'spiderX': '%25252F'}}}
        self.assertIsNone(probe.service_prober.prepare_outbound_for_current_xray(outbound))

    def test_daily_ranking_selects_best_200(self):
        nodes = [{'uri': str(i), 'ping_ms': i + 1, 'verified': True,
                  'verification_policy': 'tunnel-https-v1'} for i in range(250)]
        ranked = probe.rank(list(reversed(nodes)))
        self.assertEqual(len(ranked), 200)
        self.assertEqual([n['ping_ms'] for n in ranked], list(range(1, 201)))

    def test_only_verified_finite_tunnel_latency_sorted_by_ping(self):
        nodes = [{'uri': str(i), 'verified': True, 'verification_policy': 'tunnel-https-v1',
                  'ping_ms': p, 'speed_mbps': speed} for i, (p, speed) in enumerate([(20, 100), (10, 1), (float('nan'), 5)])]
        nodes.append({'uri': 'unverified', 'ping_ms': 1})
        self.assertEqual([x['uri'] for x in probe.rank(nodes, 2)], ['1', '0'])

    def test_freshness_fails_closed_at_24_hours(self):
        now = datetime(2026, 1, 2, tzinfo=timezone.utc)
        data = {'schema_version': 1, 'nodes': [], 'updated_at': (now - timedelta(hours=23)).isoformat()}
        self.assertTrue(snapshot.is_fresh(data, now))
        data['updated_at'] = (now - timedelta(hours=24)).isoformat()
        self.assertFalse(snapshot.is_fresh(data, now))
        data['updated_at'] = (now + timedelta(seconds=1)).isoformat()
        self.assertFalse(snapshot.is_fresh(data, now))


class LabTests(unittest.TestCase):
    def test_daily_budget_uses_100_from_each_account(self):
        class Account:
            def __init__(self, user): self.user, self.used = user, 0
            def stats(self): return self.user, 100 - self.used
            def operators(self): return ['mts']
            def check(self, uri, operators): self.used += 1; return True
        a, b = Account(1), Account(2)
        summary = {}
        passed = latencylab.check_candidates([{'uri': str(i)} for i in range(201)], [a, b],
                                            allow_partial=True, summary=summary)
        self.assertEqual((a.used, b.used, len(passed)), (100, 100, 200))
        self.assertEqual(summary, {'attempted': 200, 'quota_exhausted': True})

    def test_kaggle_modes_keep_small_test_and_daily_production(self):
        from backend.vpn_v2 import kaggle
        for production, expected in [(False, '10'), (True, '200')]:
            with patch('sys.argv', ['kaggle'] + (['--production'] if production else [])), \
                 patch.object(kaggle.subprocess, 'run') as run:
                kaggle.main()
                command = run.call_args.args[0]
                self.assertEqual(command[command.index('--select') + 1], expected)
                self.assertEqual('--push' in command, production)

    def test_all_operators_must_be_present_and_successful(self):
        ops = ['mts', 't2']
        good = {'results': [{'operator': 'mts', 'ok': True}, {'operator': 't2', 'ok': True}]}
        self.assertTrue(latencylab.passes_all(good, ops))
        self.assertFalse(latencylab.passes_all({'results': good['results'][:1]}, ops))
        self.assertFalse(latencylab.passes_all({'results': [good['results'][0], {'operator': 't2', 'ok': False}]}, ops))
        self.assertFalse(latencylab.passes_all({'results': good['results'] + [good['results'][0]]}, ops))

    def test_quota_switch_and_repeated_second_account(self):
        class Fake:
            def __init__(self, account, remaining): self.account, self.remaining = account, remaining
            def stats(self): return self.account, self.remaining
            def operators(self): return ['mts']
            def check(self, uri, operators): self.remaining -= 1; return True
        a, b = Fake(1, 1), Fake(2, 3)
        result = latencylab.check_candidates([{'uri': str(x)} for x in range(3)], [a, b])
        self.assertEqual(len(result), 3)
        self.assertEqual((a.remaining, b.remaining), (0, 1))

    def test_same_account_and_exhaustion_fail_closed(self):
        class Fake:
            def __init__(self, account): self.account = account
            def stats(self): return self.account, 0
        with self.assertRaises(latencylab.LabError):
            latencylab.check_candidates([{'uri': 'x'}], [Fake(1), Fake(1)])

    def test_ambiguous_post_not_retried(self):
        client = latencylab.LabClient('unused')
        with patch.object(client, 'request', side_effect=latencylab.LabError('timeout')) as request:
            with self.assertRaises(latencylab.LabError):
                client.check('secret-uri', ['mts'])
            self.assertEqual(request.call_count, 1)

    def test_async_job_poll_and_status_error(self):
        client = latencylab.LabClient('unused', sleep=lambda _: None)
        responses = [
            {'ok': True, 'status': 'pending', 'req_id': 'job'},
            {'ok': True, 'status': 'pending'},
            {'ok': True, 'status': 'done', 'result': {'results': [{'operator': 'mts', 'ok': True}]}},
        ]
        with patch.object(client, 'request', side_effect=responses):
            self.assertTrue(client.check('uri', ['mts']))
        with patch.object(client, 'request', return_value={'ok': True, 'status': 'cancelled'}):
            with self.assertRaises(latencylab.LabError):
                client.check('uri', ['mts'])


class ShadowTests(unittest.TestCase):
    def test_failed_lab_check_preserves_previous_report(self):
        private_dir = Path(cli.__file__).resolve().parent / '.local'
        private_dir.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=private_dir) as tmp:
            root = Path(tmp)
            source_file, report = root / 'sources.txt', root / 'report.json'
            source_file.write_text('https://example.com/sub\n', encoding='utf-8')
            report.write_text('{"old": true}', encoding='utf-8')
            with patch('sys.argv', ['vpn_v2', '--sources', str(source_file), '--out', str(report)]), \
                 patch.dict('os.environ', {'LATENCYLAB_API_KEY_1': 'one', 'LATENCYLAB_API_KEY_2': 'two'}), \
                 patch.object(cli, 'fetch_all', return_value=(['x'], [])), \
                 patch.object(cli, 'normalize', return_value=['x']), \
                 patch.object(cli, 'verify', return_value=[{'uri': 'x', 'ping_ms': 1, 'verified': True, 'verification_policy': 'tunnel-https-v1'}]), \
                 patch.object(cli, 'measure_selected', side_effect=lambda n: n), \
                 patch.object(cli, 'check_candidates', side_effect=latencylab.LabError('offline')):
                with self.assertRaises(latencylab.LabError):
                    cli.main()
            self.assertEqual(json.loads(report.read_text(encoding='utf-8')), {'old': True})

    def test_publication_mirrors_and_clears_stale_buckets_preserving_ru_and_tg(self):
        now = datetime.now(timezone.utc)
        node = {'uri': 'trojan://pass@example.com:443?sni=example.com', 'ping_ms': 50,
                'verified': True, 'verification_policy': 'tunnel-https-v1', 'country': 'DE',
                'latencylab_verified': True, 'latencylab_checked_at': now.isoformat(),
                'expires_at': (now + timedelta(hours=24)).isoformat()}
        data = {'schema_version': 1, 'updated_at': now.isoformat(), 'nodes': [node]}
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root/'sub/tg').mkdir(parents=True)
            (root/'sub/tg/all.txt').write_text('telegram')
            (root/'sub/ru-verified.json').write_text('ru')
            (root/'sub/us.txt').write_text('old')
            publish(data, root)
            self.assertEqual((root/'sub/all.txt').read_bytes(), (root/'docs/sub/all.txt').read_bytes())
            self.assertEqual((root/'sub/us.txt').read_text(), '')
            self.assertEqual((root/'sub/ru-verified.json').read_text(), 'ru')
            self.assertEqual((root/'sub/tg/all.txt').read_text(), 'telegram')
            node['latencylab_verified'] = False
            with self.assertRaises(ValueError): publish(data, root)


if __name__ == '__main__':
    unittest.main()
