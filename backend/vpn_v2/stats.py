"""Report the size and composition of the crawler-state pool without restoring it.

Streams the compressed shards from the data-only branch, so it works from any clone
and never needs a local SQLite copy.
"""
import argparse
import collections
import gzip
import json
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

BRANCH = 'crawler-state'
REPO = 'SH20FK/TurboProbe'
DEFAULT_PORTS = {'http': 80, 'https': 443, 'socks': 1080, 'socks5': 1080}


def api(url, token=''):
    headers = {'User-Agent': 'turboprobe-stats', 'Accept': 'application/vnd.github+json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode())


def shard_names(branch, token):
    tree = api(f'https://api.github.com/repos/{REPO}/git/trees/{branch}?recursive=1', token)
    if tree.get('truncated'):
        raise RuntimeError('GitHub tree listing was truncated; cannot enumerate shards')
    names = [item['path'] for item in tree.get('tree', [])
             if item['type'] == 'blob' and item['path'].startswith('state/') and item['path'].endswith('.jsonl.gz')]
    return sorted(names)


def rows(path, token='', branch=BRANCH):
    url = f'https://raw.githubusercontent.com/{REPO}/{branch}/{path}'
    headers = {'User-Agent': 'turboprobe-stats'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=180) as response:
        body = gzip.decompress(response.read())
    for line in body.splitlines():
        if line.strip():
            yield json.loads(line)


def endpoint(uri):
    try:
        parsed = urlsplit(uri)
        scheme = parsed.scheme.lower()
        host = (parsed.hostname or '').strip('[]').lower()
        if not host:
            return None
        port = parsed.port or DEFAULT_PORTS.get(scheme, 443)
        return f'{host}:{port}'
    except ValueError:
        return None


def collect(names, token, branch=BRANCH):
    schemes = collections.Counter()
    endpoints = collections.Counter()
    malformed = 0
    ids = set()
    total = 0
    for path in names:
        for row in rows(path, token, branch):
            total += 1
            ids.add(row[0])
            uri = row[1]
            schemes[uri.split('://', 1)[0].lower() if '://' in uri else 'bad'] += 1
            key = endpoint(uri)
            if key:
                endpoints[key] += 1
            else:
                malformed += 1
    nodes = {
        'total': total,
        'unique_ids': len(ids),
        'unique_endpoints': len(endpoints),
        'duplicate_rows': total - len(endpoints),
        'malformed_endpoints': malformed,
        'schemes': dict(schemes.most_common()),
        'configs_per_endpoint': {
            '1': sum(1 for c in endpoints.values() if c == 1),
            '2-9': sum(1 for c in endpoints.values() if 2 <= c <= 9),
            '10-99': sum(1 for c in endpoints.values() if 10 <= c <= 99),
            '100+': sum(1 for c in endpoints.values() if c >= 100),
        },
        'top_endpoints': [{'endpoint': k, 'configs': v} for k, v in endpoints.most_common(10)],
    }
    return nodes


def collect_sources(names, token, branch=BRANCH):
    statuses = collections.Counter()
    total = 0
    for path in names:
        for row in rows(path, token, branch):
            total += 1
            statuses[row[2] if len(row) > 2 else '?'] += 1
    return {'total': total, 'statuses': dict(statuses.most_common())}


def collect_pairs(names, token, branch=BRANCH):
    total = 0
    for path in names:
        for _ in rows(path, token, branch):
            total += 1
    return {'total': total}


def progress_summary(branch=BRANCH, token=''):
    url = f'https://raw.githubusercontent.com/{REPO}/{branch}/probe-progress.json.gz'
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'turboprobe-stats'}),
                                    timeout=60) as response:
            data = json.loads(gzip.decompress(response.read()))
    except Exception as error:
        return {'error': type(error).__name__}
    return {'processed': data.get('processed'), 'cycle': data.get('cycle'),
            'cursor_set': bool(data.get('cursor')), 'best': len(data.get('best', [])),
            'local': len(data.get('local', [])), 'lab': len(data.get('lab', []))}


def main():
    parser = argparse.ArgumentParser(description='Pool composition of the crawler-state branch')
    parser.add_argument('--branch', default=BRANCH)
    parser.add_argument('--token', default='', help='GitHub token for private repos and higher rate limits')
    parser.add_argument('--json', default='', help='write the report to this path')
    parser.add_argument('--full', action='store_true', help='also count source_nodes pairs (large download)')
    args = parser.parse_args()

    names = shard_names(args.branch, args.token)
    groups = collections.defaultdict(list)
    for name in names:
        stem = Path(name).name.split('-')[0]
        groups[stem].append(name)
    report = {'branch': args.branch, 'shards': {k: len(v) for k, v in groups.items()}}
    if groups.get('nodes'):
        report['nodes'] = collect(groups['nodes'], args.token, args.branch)
    if groups.get('sources'):
        report['sources'] = collect_sources(groups['sources'], args.token, args.branch)
    if args.full and groups.get('source_nodes'):
        report['source_nodes'] = collect_pairs(groups['source_nodes'], args.token, args.branch)
    report['progress'] = progress_summary(args.branch, args.token)
    text = json.dumps(report, ensure_ascii=False, indent=2)
    print(text)
    if args.json:
        Path(args.json).write_text(text, encoding='utf-8')
        print(f'\nSaved: {args.json}')


if __name__ == '__main__':
    main()
