"""One accepted snapshot supplies all VPN subscription formats and mirrors."""
import base64
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from collections import Counter

from .probe import service_prober
from .snapshot import is_fresh


def render(snapshot, existing=()):
    if not is_fresh(snapshot):
        raise ValueError('snapshot is expired or invalid')
    nodes = snapshot['nodes']
    mixed = snapshot.get('publication_profile') == 'tunnel-and-latencylab'
    if any((not mixed and n.get('latencylab_verified') is not True) or n.get('verified') is not True or
           n.get('verification_policy') != 'tunnel-https-v1' for n in nodes):
        raise ValueError('LatencyLab verification is required for publication')
    now = datetime.now(timezone.utc)
    for node in nodes:
        if mixed and node.get('latencylab_verified') is not True:
            checked = datetime.fromisoformat(node['checked_at'])
            expires = datetime.fromisoformat(node['expires_at'])
            if (node.get('verification_scope') != 'tunnel_daily' or checked.tzinfo is None
                    or not 0 <= (now-checked).total_seconds() < 86400
                    or expires <= now or not 0 < (expires-checked).total_seconds() <= 86400):
                raise ValueError('Tunnel measurement expired or invalid')
            continue
        checked = datetime.fromisoformat(node['latencylab_checked_at'])
        expires = datetime.fromisoformat(node['expires_at'])
        if checked > now or expires <= now or (expires - checked).total_seconds() > 86400:
            raise ValueError('Node confirmation expired or invalid')
    nodes = [{**n,'uri':service_prober.format_verified_remark(n['uri'],n.get('country','GLOBAL'),'',0)}
             for n in sorted(nodes,key=lambda n:n['ping_ms'])]
    def lines(items): return '\n'.join(n['uri'] for n in items)
    def js(data): return json.dumps(data, ensure_ascii=False, indent=2)
    payload = {**snapshot, 'mode': 'published', 'schema_version': 2,
               'verification_policy': 'tunnel-https-v1', 'total_nodes': len(nodes), 'nodes': nodes}
    files = {'nodes.json': js(payload), 'preview.json': js(payload), 'all.txt': lines(nodes),
             'top50.txt': lines(nodes[:50]), 'top20.txt': lines(nodes[:20]),
             'base64.txt': base64.b64encode(lines(nodes).encode()).decode()}
    # Clear obsolete buckets too, so a removed node cannot remain in an old file.
    for name in existing:
        if name.endswith('.txt') and not name.startswith('tg/') and name != 'ru-verified.json':
            files[name] = ''
    files.update({'all.txt': lines(nodes), 'top50.txt': lines(nodes[:50]), 'top20.txt': lines(nodes[:20]),
                  'base64.txt': base64.b64encode(lines(nodes).encode()).decode()})
    protocols = {'reality': lambda n: 'security=reality' in n['uri'].lower(),
                 'hysteria2': lambda n: n['uri'].startswith(('hy2://', 'hysteria2://')),
                 'trojan': lambda n: n['uri'].startswith('trojan://'),
                 'shadowsocks': lambda n: n['uri'].startswith('ss://')}
    for name, pred in protocols.items(): files[name + '.txt'] = lines([n for n in nodes if pred(n)])
    lab = [n for n in nodes if n.get('latencylab_verified') is True]
    files['latencylab.txt'] = lines(lab)
    files['latencylab/base64.txt'] = base64.b64encode(lines(lab).encode()).decode()
    files['latencylab/nodes.json'] = js({**payload,'nodes':lab,'total_nodes':len(lab)})
    files['latencylab/clash.yaml'] = service_prober.generate_clash_meta_yaml(lab)
    countries = sorted({n.get('country', '').lower() for n in nodes} - {'', 'global'})
    for cc in countries:
        if len(cc) != 2 or not cc.isalpha(): continue
        value = lines([n for n in nodes if n.get('country', '').lower() == cc])
        files['countries/' + cc + '.txt'] = files[cc + '.txt'] = value
    files['countries/index.json'] = js({'updated_at': snapshot['updated_at'], 'total_countries': len(countries),
        'countries': [{'code': cc.upper(), 'flag': service_prober.country_code_to_flag(cc.upper()),
                       'count': sum(n.get('country', '').lower() == cc for n in nodes),
                       'file': 'countries/' + cc + '.txt'} for cc in countries]})
    for service in service_prober.TARGET_SERVICES:
        files['services/' + service + '.txt'] = lines([n for n in nodes if n.get('services', {}).get(service) is True])
    files['services/ai-bundle.txt'] = ''
    files['services/index.json'] = js({'updated_at': snapshot['updated_at'],
        'services': {name.split('/')[-1]: len(value.splitlines()) for name,value in files.items() if name.startswith('services/')}})
    chunks = []
    files['chunks/chunk-001.txt'] = ''
    for offset in range(0,len(nodes),500):
        part = nodes[offset:offset+500]
        name = f'chunks/chunk-{offset//500+1:03d}.txt'
        files[name] = lines(part)
        chunks.append({'file':name,'count':len(part),'ping_min_ms':part[0]['ping_ms'],'ping_max_ms':part[-1]['ping_ms']})
    files['chunks/index.json'] = js({'chunk_size':500,'total_nodes':len(nodes),'chunks':chunks})
    yaml = service_prober.generate_clash_meta_yaml(nodes)
    for name in ('clash.yaml', 'clash-meta.yaml', 'clash.meta.yaml'): files[name] = yaml
    files['stats.json'] = js({'updated_at': snapshot['updated_at'], 'total_nodes': len(nodes),
                             'alive_verified_nodes': len(nodes), 'latencylab_verified_nodes': len(lab),
                             'best_ping_ms': nodes[0]['ping_ms'] if nodes else None,
                             'avg_ping_ms': sum(n['ping_ms'] for n in nodes) / len(nodes) if nodes else None,
                             'countries': dict(Counter(n.get('country', 'GLOBAL') for n in nodes))})
    return files


def publish(snapshot, root):
    root = Path(root)
    existing = {p.relative_to(root / directory).as_posix() for directory in ('sub', 'docs/sub')
                for p in (root / directory).rglob('*') if p.is_file()}
    files = render(snapshot, existing)
    previous = {}
    try:
        for directory in ('sub', 'docs/sub'):
            # Authoritative JSON is replaced last, each file replacement is atomic.
            for name in sorted(files, key=lambda n: n in ('nodes.json', 'preview.json')):
                path = root / directory / name
                previous[path] = path.read_bytes() if path.exists() else None
                path.parent.mkdir(parents=True, exist_ok=True)
                temp = path.with_name(path.name + '.tmp')
                temp.write_text(files[name], encoding='utf-8')
                os.replace(temp, path)
    except BaseException:
        for path, data in previous.items():
            if data is None: path.unlink(missing_ok=True)
            else: path.write_bytes(data)
        raise
    return [directory + '/' + name for directory in ('sub', 'docs/sub') for name in files]
