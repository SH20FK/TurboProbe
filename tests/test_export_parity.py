import base64
import json
import unittest
from datetime import datetime, timedelta, timezone

from backend.vpn_v2.export import render

# The v1 exporter publishes these names; v2 must not drop any of them when it
# takes over the schedule, otherwise clients keep stale files or get 404s.
REQUIRED = {
    'nodes.json', 'preview.json', 'all.txt', 'top20.txt', 'top50.txt', 'base64.txt',
    'reality.txt', 'hysteria2.txt', 'trojan.txt', 'shadowsocks.txt',
    'clash.yaml', 'clash-meta.yaml', 'clash.meta.yaml', 'stats.json',
    'latencylab.txt', 'latencylab/base64.txt', 'latencylab/nodes.json', 'latencylab/clash.yaml',
    'countries/index.json', 'chunks/index.json', 'services/index.json', 'services/ai-bundle.txt',
}


def snapshot():
    now = datetime.now(timezone.utc)
    nodes = [
        {'uri': 'trojan://pass@example.com:443?sni=example.com', 'ping_ms': 50,
         'verified': True, 'verification_policy': 'tunnel-https-v1', 'country': 'DE',
         'latencylab_verified': True, 'latencylab_checked_at': now.isoformat(),
         'expires_at': (now + timedelta(hours=24)).isoformat()},
        {'uri': 'ss://YWVzLTI1Ni1nY206cGFzcw==@example.org:8388', 'ping_ms': 80,
         'verified': True, 'verification_policy': 'tunnel-https-v1', 'country': 'NL',
         'latencylab_verified': True, 'latencylab_checked_at': now.isoformat(),
         'expires_at': (now + timedelta(hours=24)).isoformat()},
    ]
    return {'schema_version': 1, 'updated_at': now.isoformat(),
            'publication_profile': 'tunnel-and-latencylab', 'nodes': nodes}


class ExportParityTests(unittest.TestCase):
    def setUp(self):
        self.files = render(snapshot())

    def test_required_outputs_exist(self):
        missing = REQUIRED - set(self.files)
        self.assertEqual(missing, set())

    def test_global_country_is_never_published(self):
        data = snapshot()
        data['nodes'][0]['country'] = 'GLOBAL'
        files = render(data)
        self.assertEqual(files['all.txt'].count('\n'), 0)  # exactly one node left
        self.assertNotIn('"DE"', files['countries/index.json'])
        data['nodes'][1]['country'] = 'GLOBAL'
        with self.assertRaises(ValueError):
            render(data)

    def test_clash_aliases_are_identical(self):
        self.assertEqual(self.files['clash.yaml'], self.files['clash-meta.yaml'])
        self.assertEqual(self.files['clash.yaml'], self.files['clash.meta.yaml'])

    def test_preview_matches_nodes(self):
        self.assertEqual(self.files['preview.json'], self.files['nodes.json'])

    def test_base64_decodes_to_all(self):
        self.assertEqual(base64.b64decode(self.files['base64.txt']).decode(), self.files['all.txt'])

    def test_country_and_chunk_manifests(self):
        countries = json.loads(self.files['countries/index.json'])
        self.assertEqual([c['code'] for c in countries['countries']], ['DE', 'NL'])
        self.assertEqual(countries['countries'][0]['file'], 'countries/de.txt')
        chunks = json.loads(self.files['chunks/index.json'])
        self.assertEqual(chunks['chunk_size'], 500)
        self.assertEqual(chunks['total_nodes'], 2)

    def test_every_v1_bucket_is_cleared_when_stale(self):
        stale = {'us.txt', 'clean-ip.txt', 'youtube-discord.txt'}
        files = render(snapshot(), existing=stale)
        for name in ('us.txt', 'clean-ip.txt', 'youtube-discord.txt'):
            self.assertEqual(files[name], '')


if __name__ == '__main__':
    unittest.main()
