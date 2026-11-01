import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from backend.vpn_v2 import crawler_archive as archive
from backend.vpn_v2.crawler_state import StateBranch, encode, restore
from backend.vpn_v2.crawler_store import Store

URI = 'vless://11111111-2222-3333-4444-555555555555@example.com:443?security=tls&sni=example.com'


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.store = Store(self.root / 'source.sqlite')
        self.target = Store(self.root / 'target.sqlite')
        self.out = self.root / 'archive'
        self.out.mkdir()
        for host in ('example.com', 'example.org'):
            self.store.add(f'https://{host}/sub.txt')
        for row in self.store.due():
            self.store.success(row, [URI + str(i) for i in range(12)], {'etag': 'version-1'})
        self.target.add('https://existing.example/keep.txt')

    def tearDown(self):
        self.store.close()
        self.target.close()
        self.temp.cleanup()

    def write(self):
        # Real sharding is exercised with a small part budget, not millions of fixtures.
        with patch.object(archive, 'PART_BYTES', 512):
            manifest = archive.write_archive(self.store, self.out)
        return manifest

    def assert_original(self):
        self.assertEqual([row['url'] for row in self.target.due()], ['https://existing.example/keep.txt'])
        self.assertEqual(self.target.db.execute('SELECT count(*) FROM nodes').fetchone()[0], 0)

    def test_sharded_roundtrip_preserves_cache_and_all_mirror_links(self):
        manifest = self.write()
        self.assertGreater(len(manifest['tables']['nodes']['parts']), 1)
        self.assertTrue(all(p['bytes'] <= 512 for t in manifest['tables'].values() for p in t['parts']))
        archive.read_archive(self.target, self.out)
        self.assertEqual(self.target.db.execute('SELECT count(*) FROM nodes').fetchone()[0], 12)
        self.assertEqual(self.target.db.execute('SELECT count(*) FROM source_nodes').fetchone()[0], 24)
        for row in self.target.due():
            self.assertEqual(row['etag'], 'version-1')
            self.assertEqual(len(self.target.cached(row['id'])), 12)
        first = {p.name: p.read_bytes() for p in (self.out / 'state').glob('*.gz')}
        self.assertEqual(self.write(), manifest)
        self.assertEqual(first, {p.name: p.read_bytes() for p in (self.out / 'state').glob('*.gz')})

    def test_secret_filter_keeps_pending_job_metadata_without_diagnostics(self):
        node = hashlib.sha256(URI.encode()).hexdigest()
        self.store.db.execute('INSERT INTO meta VALUES(?,?)', ('private', 'Bearer must-not-travel'))
        self.store.db.execute('INSERT INTO jobs VALUES(?,?,?,?,?,?)',
                              ('run', node, 'request', 0, 'pending', '{"token":"ghp_do-not-publish"}'))
        self.store.db.commit()
        self.write()
        text = b''.join(gzip.decompress(p.read_bytes()) for p in (self.out / 'state').glob('*.gz'))
        self.assertNotIn(b'must-not-travel', text)
        self.assertNotIn(b'do-not-publish', text)
        archive.read_archive(self.target, self.out)
        self.assertEqual(tuple(self.target.db.execute('SELECT request_id,status,payload FROM jobs').fetchone()),
                         ('request', 'pending', '{}'))

    def test_corrupt_late_part_rolls_back_the_entire_restore(self):
        manifest = self.write()
        part = self.out / manifest['tables']['source_nodes']['parts'][-1]['name']
        body = part.read_bytes()
        part.write_bytes(body[:-1] + bytes([body[-1] ^ 1]))
        with self.assertRaisesRegex(ValueError, 'corrupt'):
            archive.read_archive(self.target, self.out)
        self.assert_original()

    def test_truncated_gzip_with_updated_checksum_still_rolls_back(self):
        manifest = self.write()
        part = manifest['tables']['source_nodes']['parts'][-1]
        file = self.out / part['name']
        body = file.read_bytes()[:-6]
        file.write_bytes(body)
        part['sha256'] = hashlib.sha256(body).hexdigest()
        part['compressed_bytes'] = len(body)
        (self.out / 'state.json').write_text(json.dumps(manifest))
        with self.assertRaises((ValueError, EOFError, gzip.BadGzipFile)):
            archive.read_archive(self.target, self.out)
        self.assert_original()

    def test_missing_part_and_path_escape_fail_without_replacing_database(self):
        manifest = self.write()
        item = manifest['tables']['nodes']['parts'][0]
        file = self.out / item['name']
        body = file.read_bytes()
        file.unlink()
        with self.assertRaises(FileNotFoundError):
            archive.read_archive(self.target, self.out)
        self.assert_original()
        file.write_bytes(body)
        item['name'] = '../outside.jsonl.gz'
        (self.out / 'state.json').write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'part name'):
            archive.read_archive(self.target, self.out)
        self.assert_original()

    def test_expansion_and_row_limits_fail_closed(self):
        manifest = self.write()
        part = manifest['tables']['nodes']['parts'][0]
        part['bytes'] = 1
        (self.out / 'state.json').write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'declared size'):
            archive.read_archive(self.target, self.out)
        self.assert_original()
        self.write()
        with patch.object(archive, 'MAX_ROW_BYTES', 32):
            with self.assertRaisesRegex(ValueError, 'declared size'):
                archive.read_archive(self.target, self.out)
        self.assert_original()

    def test_shrinking_checkpoint_removes_obsolete_parts(self):
        self.write()
        before = set((self.out / 'state').glob('*.gz'))
        self.store.db.execute('DELETE FROM source_nodes')
        self.store.db.execute('DELETE FROM nodes')
        self.store.db.commit()
        manifest = self.write()
        after = set((self.out / 'state').glob('*.gz'))
        self.assertLess(len(after), len(before))
        self.assertEqual(manifest['tables']['nodes']['parts'], [])
        archive.read_archive(self.target, self.out)
        self.assertEqual(self.target.db.execute('SELECT count(*) FROM nodes').fetchone()[0], 0)

    def test_legacy_streaming_restore_and_corruption_rollback(self):
        blob = encode(self.store)
        restore(self.target, blob)
        self.assertEqual(self.target.db.execute('SELECT count(*) FROM source_nodes').fetchone()[0], 24)
        before = list(self.target.db.execute('SELECT url FROM sources'))
        with self.assertRaises((ValueError, EOFError, gzip.BadGzipFile)):
            restore(self.target, blob[:-5])
        self.assertEqual(list(self.target.db.execute('SELECT url FROM sources')), before)
        with patch.object(archive, 'MAX_TOTAL_BYTES', 128):
            with self.assertRaisesRegex(ValueError, 'archive budget'):
                restore(self.target, blob)
        self.assertEqual(list(self.target.db.execute('SELECT url FROM sources')), before)

    def test_legacy_branch_migrates_to_parts_and_reopens_with_job_journal(self):
        bare = self.root / 'remote.git'
        subprocess.run(['git', 'init', '--bare', str(bare)], capture_output=True, check=True)
        with patch('backend.vpn_v2.crawler_state.REMOTE', str(bare)):
            branch = StateBranch('unused')
            try:
                branch.open(self.store)
                (branch.path / 'state.json.gz').write_bytes(encode(self.store))
                branch.git('add', 'state.json.gz')
                commit = branch.git('-c', 'user.name=Test', '-c', 'user.email=test@example.com',
                                    'commit', '-m', 'legacy checkpoint')
                self.assertEqual(commit.returncode, 0)
                self.assertEqual(branch.git('push', 'origin', 'HEAD:crawler-state').returncode, 0)
            finally:
                branch.close()
            branch = StateBranch('unused')
            try:
                branch.open(self.target)
                branch.save(self.target)
                tree = branch.git('ls-tree', '--name-only', 'HEAD').stdout.decode().splitlines()
                self.assertNotIn('state.json.gz', tree)
                self.assertIn('state.json', tree)
                node = hashlib.sha256(URI.encode()).hexdigest()
                self.target.db.execute('INSERT INTO jobs VALUES(?,?,?,?,?,?)',
                                       ('run', node, 'request', 0, 'pending', '{}'))
                self.target.db.commit()
                branch.save_jobs(self.target)
                branch.save(self.target)
                head = branch.git('rev-parse', 'HEAD').stdout
                branch.save(self.target)
                self.assertEqual(branch.git('rev-parse', 'HEAD').stdout, head)
            finally:
                branch.close()
            other = Store(self.root / 'clean.sqlite')
            branch = StateBranch('unused')
            try:
                branch.open(other)
                self.assertEqual(other.db.execute('SELECT count(*) FROM source_nodes').fetchone()[0], 24)
                self.assertEqual(other.db.execute('SELECT request_id FROM jobs').fetchone()[0], 'request')
            finally:
                branch.close()
                other.close()
