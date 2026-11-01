"""Bounded-memory, sharded public checkpoints; SQLite itself stays private."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import re

from .crawler_store import public_url

TABLES = ('meta', 'repos', 'sources', 'nodes', 'source_nodes', 'observations', 'checks', 'jobs')
PART_BYTES = 16 * 1024 * 1024
MAX_ROW_BYTES = 4 * 1024 * 1024
MAX_TOTAL_BYTES = 8 * 1024 * 1024 * 1024
MAX_MANIFEST_BYTES = 8 * 1024 * 1024
SECRET_MARKERS = ('ghp_', 'github_pat_', 'bearer ', 'll_')


def columns(store, table):
    return [r[1] for r in store.db.execute('PRAGMA table_info(' + table + ')')]


def public_rows(store, table, sources):
    names = columns(store, table)
    for row in store.db.execute('SELECT * FROM ' + table):
        record = dict(zip(names, row))
        if table == 'sources' and record['id'] not in sources:
            continue
        if 'source' in record and record['source'] not in sources:
            continue
        # Diagnostics never travel, but pending-job metadata must survive.
        if table in ('checks', 'jobs'):
            record['payload'] = '{}'
        if any(marker in json.dumps(record).lower() for marker in SECRET_MARKERS):
            continue
        yield [record[c] for c in names]


def _digest(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def write_archive(store, directory):
    """Write <=16 MiB of JSON per gzip part, without building a giant JSON object."""
    directory = Path(directory)
    parts_dir = directory / 'state'
    if parts_dir.is_symlink():
        raise ValueError('unsafe state directory')
    parts_dir.mkdir(exist_ok=True)
    sources = {r[0] for r in store.db.execute('SELECT id,url FROM sources') if public_url(r[1])}
    manifest = {'version': 2, 'tables': {}}
    total = packed = 0
    for table in TABLES:
        item = {'columns': columns(store, table), 'parts': []}
        manifest['tables'][table] = item
        raw_bytes = count = 0
        stream = None
        pending = parts_dir / (table + '.pending')

        def finish():
            nonlocal stream, raw_bytes, count, packed
            if stream is None:
                return
            stream.close()
            stream = None
            name = f'state/{table}-{len(item["parts"]):06d}.jsonl.gz'
            target = directory / name
            os.replace(pending, target)
            size = target.stat().st_size
            packed += size
            item['parts'].append({'name': name, 'bytes': raw_bytes, 'rows': count,
                                  'compressed_bytes': size, 'sha256': _digest(target)})
            raw_bytes = count = 0

        try:
            for row in public_rows(store, table, sources):
                line = (json.dumps(row, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n').encode()
                if len(line) > MAX_ROW_BYTES:
                    raise ValueError('crawler state row too large')
                total += len(line)
                if total > MAX_TOTAL_BYTES:
                    raise ValueError('crawler state exceeds archive budget')
                if stream is not None and raw_bytes + len(line) > PART_BYTES:
                    finish()
                if stream is None:
                    stream = gzip.GzipFile(filename=str(pending), mode='wb', compresslevel=3, mtime=0)
                stream.write(line)
                raw_bytes += len(line)
                count += 1
            finish()
        finally:
            if stream is not None:
                stream.close()
            pending.unlink(missing_ok=True)
    manifest_bytes = json.dumps(manifest, separators=(',', ':')).encode()
    if len(manifest_bytes) > MAX_MANIFEST_BYTES:
        raise ValueError('crawler state manifest too large')
    pending_manifest = directory / 'state.json.pending'
    pending_manifest.write_bytes(manifest_bytes)
    os.replace(pending_manifest, directory / 'state.json')
    keep = {part['name'] for item in manifest['tables'].values() for part in item['parts']}
    for old in parts_dir.glob('*.jsonl.gz'):
        if 'state/' + old.name not in keep:
            old.unlink()
    (directory / 'state.json.gz').unlink(missing_ok=True)
    print(f'Crawler checkpoint: {total / 1048576:.1f} MiB JSON → {packed / 1048576:.1f} MiB gzip; '
          f'{len(keep)} parts', flush=True)
    return manifest


def _validate_row(table, names, row):
    if not isinstance(row, list) or len(row) != len(names):
        raise ValueError('invalid crawler state row')
    if any(value is not None and type(value) not in (str, int, float, bool) for value in row):
        raise ValueError('invalid crawler state value')
    if any(marker in json.dumps(row).lower() for marker in SECRET_MARKERS):
        raise ValueError('unsafe crawler state value')
    if table == 'sources' and not public_url(row[names.index('url')]):
        raise ValueError('unsafe source in remote state')
    if table in ('checks', 'jobs') and row[names.index('payload')] != '{}':
        raise ValueError('private payload in remote state')


def read_archive(store, directory):
    directory = Path(directory)
    path = directory / 'state.json'
    if path.is_symlink() or path.stat().st_size > MAX_MANIFEST_BYTES:
        raise ValueError('invalid crawler state manifest')
    manifest = json.loads(path.read_bytes())
    if manifest.get('version') != 2 or set(manifest.get('tables', {})) != set(TABLES):
        raise ValueError('unknown crawler state version or tables')
    total = 0
    for table in TABLES:
        item = manifest['tables'][table]
        if item['columns'] != columns(store, table) or not isinstance(item['parts'], list):
            raise ValueError('invalid crawler state table')
        for index, part in enumerate(item['parts']):
            if part['name'] != f'state/{table}-{index:06d}.jsonl.gz':
                raise ValueError('invalid crawler state part name')
            for field in ('bytes', 'compressed_bytes', 'rows'):
                if type(part[field]) is not int or part[field] <= 0:
                    raise ValueError('invalid crawler state part size')
            if part['bytes'] > PART_BYTES or part['compressed_bytes'] > PART_BYTES + 65536:
                raise ValueError('crawler state part too large')
            if not isinstance(part['sha256'], str) or not re.fullmatch('[0-9a-f]{64}', part['sha256']):
                raise ValueError('invalid crawler state checksum')
            total += part['bytes']
            if total > MAX_TOTAL_BYTES:
                raise ValueError('crawler state exceeds archive budget')
    if (directory / 'state').is_symlink():
        raise ValueError('unsafe state directory')
    # A bad/truncated part rolls back every table, preserving the existing database.
    with store.db:
        for table in TABLES:
            store.db.execute('DELETE FROM ' + table)
            names = manifest['tables'][table]['columns']
            insert = 'INSERT INTO ' + table + ' VALUES(' + ','.join('?' for _ in names) + ')'
            for part in manifest['tables'][table]['parts']:
                file = directory / part['name']
                if file.is_symlink() or file.stat().st_size != part['compressed_bytes'] or _digest(file) != part['sha256']:
                    raise ValueError('crawler state part missing or corrupt')
                count = size = 0
                batch = []
                batch_bytes = 0
                with gzip.open(file, 'rb') as stream:
                    while True:
                        line = stream.readline(MAX_ROW_BYTES + 1)
                        if not line:
                            break
                        size += len(line)
                        if len(line) > MAX_ROW_BYTES or size > part['bytes']:
                            raise ValueError('crawler state exceeds declared size')
                        row = json.loads(line)
                        _validate_row(table, names, row)
                        count += 1
                        batch.append(row)
                        batch_bytes += len(line)
                        if len(batch) == 500 or batch_bytes >= 1024 * 1024:
                            store.db.executemany(insert, batch)
                            batch.clear()
                            batch_bytes = 0
                if count != part['rows'] or size != part['bytes']:
                    raise ValueError('crawler state part incomplete')
                store.db.executemany(insert, batch)
    print(f'Crawler state restored: {total / 1048576:.1f} MiB JSON', flush=True)


class _LimitedReader:
    def __init__(self, stream):
        self.stream, self.total = stream, 0

    def read(self, size=-1):
        if size < 0:
            size = 65536
        data = self.stream.read(min(size, MAX_TOTAL_BYTES - self.total + 1))
        self.total += len(data)
        if self.total > MAX_TOTAL_BYTES:
            raise ValueError('crawler state exceeds archive budget')
        return data


def read_legacy(store, compressed_stream):
    """Migrate existing version-1 gzip JSON, including archives above 100 MiB."""
    import ijson

    with gzip.GzipFile(fileobj=compressed_stream) as stream:
        events = iter(ijson.basic_parse(_LimitedReader(stream), use_float=True))

        def take(event, value=None):
            actual, found = next(events, (None, None))
            if actual != event or (value is not None and found != value):
                raise ValueError('invalid legacy crawler state structure')
            return found

        with store.db:
            take('start_map')
            take('map_key', 'version')
            take('number', 1)
            take('map_key', 'tables')
            take('start_map')
            for table in TABLES:
                take('map_key', table)
                take('start_map')
                take('map_key', 'columns')
                take('start_array')
                names = columns(store, table)
                for name in names:
                    take('string', name)
                take('end_array')
                take('map_key', 'rows')
                take('start_array')
                store.db.execute('DELETE FROM ' + table)
                insert = 'INSERT INTO ' + table + ' VALUES(' + ','.join('?' for _ in names) + ')'
                batch = []
                batch_bytes = 0
                for event, value in events:
                    if event == 'end_array':
                        break
                    if event != 'start_array':
                        raise ValueError('invalid legacy crawler state row')
                    row = []
                    for _ in names:
                        kind, cell = next(events, (None, None))
                        if kind not in ('string', 'number', 'boolean', 'null'):
                            raise ValueError('invalid legacy crawler state value')
                        if isinstance(cell, str) and len(cell.encode()) > MAX_ROW_BYTES:
                            raise ValueError('legacy crawler state value too large')
                        row.append(cell)
                    take('end_array')
                    _validate_row(table, names, row)
                    row_bytes = len(json.dumps(row).encode())
                    if row_bytes > MAX_ROW_BYTES:
                        raise ValueError('legacy crawler state row too large')
                    batch.append(row)
                    batch_bytes += row_bytes
                    if len(batch) == 500 or batch_bytes >= 1024 * 1024:
                        store.db.executemany(insert, batch)
                        batch.clear()
                        batch_bytes = 0
                else:
                    raise ValueError('incomplete legacy crawler state')
                store.db.executemany(insert, batch)
                take('end_map')
            take('end_map')
            take('end_map')
            if next(events, None) is not None:
                raise ValueError('trailing legacy crawler state data')
    print('Crawler state restored from legacy archive; next checkpoint will use parts', flush=True)
