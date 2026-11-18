"""Canonical, client-portable publication of verified keys.

The pipeline verifies a key by parsing its URI into an Xray outbound and dialling
through it.  Crawlers, however, spray the same server with dozens of URI variants
carrying junk parameters (``host=Join---i10VPN---``, ``path=/XIXVPN?ed=2560``,
``headerType=none``, ``packetEncoding=none``, ``type=raw`` ...).  Our parser ignores
what does not matter, so every variant "verifies" — while a real client parses the
query strictly, rejects the link or dials the wrong SNI/transport.  A subscription
built from such variants looks alive on the runner and dead on a phone.

This module republishes each verified key as the minimal URI a stock client needs
to reproduce the exact outbound we dialled:

* the URI is regenerated from the parsed outbound, never copied from the crawler;
* variants that parse to the same outbound collapse to one entry (best fingerprint);
* no endpoint can flood the feed: round-robin spread with a per-endpoint cap, so
  ``limit=50`` yields ~50 distinct servers instead of 17 copies of one.
"""
import base64
import copy
import json
import urllib.parse

from .probe import service_prober as sp

# Preference order for REALITY/uTLS fingerprints: exotic values are not understood
# by every client build, chrome is.
FP_RANK = {'chrome': 0, 'firefox': 1, 'safari': 2, 'ios': 3, 'android': 4,
           'edge': 5, 'random': 6, 'randomized': 6, '360': 7, 'qq': 8}
PASS_THROUGH = ('hysteria2', 'hy2', 'tuic')
DROP_KEYS = ('packetencoding',)


def _quote(value):
    return urllib.parse.quote(str(value), safe='/:,@!$&()*+=~[]-._')


def _query(pairs):
    return '&'.join(f'{key}={_quote(val)}' for key, val in pairs if val not in (None, ''))


def _remark(uri, fallback='TurboProbe'):
    tail = uri.split('#', 1)[1].strip() if '#' in uri else ''
    return tail or fallback


def _authority(address, port):
    return f'[{address}]:{port}' if ':' in str(address) else f'{address}:{port}'


def _tls_pairs(stream, security):
    pairs = []
    if security == 'none':
        return security, pairs
    block = (stream.get('realitySettings') if security == 'reality' else stream.get('tlsSettings')) or {}
    if block.get('serverName'):
        pairs.append(('sni', block['serverName']))
    if block.get('fingerprint'):
        pairs.append(('fp', block['fingerprint']))
    if block.get('alpn'):
        pairs.append(('alpn', ','.join(block['alpn'])))
    if security == 'reality':
        pairs.append(('pbk', block.get('publicKey') or block.get('password')))
        if block.get('shortId'):
            pairs.append(('sid', block['shortId']))
        if block.get('spiderX') not in (None, '', '/'):
            pairs.append(('spx', block['spiderX']))
        if block.get('mldsa65Verify'):
            pairs.append(('mldsa65Verify', block['mldsa65Verify']))
    elif block.get('pinnedPeerCertSha256'):
        pairs.append(('pinnedPeerCertSha256', block['pinnedPeerCertSha256']))
    # allowInsecure was removed from Xray-core; never republish it.
    return security, pairs


def _transport_pairs(stream, pairs):
    network = stream.get('network') or 'tcp'
    network = 'tcp' if network == 'raw' else network
    pairs.append(('type', network))
    if network == 'ws':
        ws = stream.get('wsSettings') or {}
        pairs.append(('path', ws.get('path') or '/'))
        pairs.append(('host', ws.get('host') or (ws.get('headers') or {}).get('Host')))
    elif network == 'grpc':
        pairs.append(('serviceName', (stream.get('grpcSettings') or {}).get('serviceName')))
    elif network == 'xhttp':
        xhttp = stream.get('xhttpSettings') or {}
        pairs.append(('path', xhttp.get('path') or '/'))
        pairs.append(('host', xhttp.get('host')))
        mode = xhttp.get('mode')
        if mode and mode != 'auto':
            pairs.append(('mode', mode))
    elif network == 'httpupgrade':
        upgrade = stream.get('httpupgradeSettings') or {}
        pairs.append(('path', upgrade.get('path') or '/'))
        pairs.append(('host', upgrade.get('host')))
    elif network == 'kcp':
        kcp = stream.get('kcpSettings') or {}
        header = (kcp.get('header') or {}).get('type')
        if header and header != 'none':
            pairs.append(('headerType', header))
        pairs.append(('seed', kcp.get('seed')))
    elif network == 'tcp':
        header = ((stream.get('tcpSettings') or {}).get('header') or {}).get('type')
        if header == 'http':
            pairs.append(('headerType', 'http'))
    return network


def _vless(uri, outbound):
    server = outbound['settings']['vnext'][0]
    user = server['users'][0]
    stream = outbound.get('streamSettings') or {}
    security, tls_pairs = _tls_pairs(stream, stream.get('security') or 'none')
    pairs = [('encryption', 'none'), ('security', security)]
    network = _transport_pairs(stream, pairs)
    if user.get('flow') and network == 'tcp' and security in ('tls', 'reality'):
        pairs.append(('flow', user['flow']))
    pairs.extend(tls_pairs)
    return f'vless://{user["id"]}@{_authority(server["address"], server["port"])}?{_query(pairs)}#{_remark(uri)}'


def _trojan(uri, outbound):
    server = outbound['settings']['servers'][0]
    stream = outbound.get('streamSettings') or {}
    security, tls_pairs = _tls_pairs(stream, stream.get('security') or 'none')
    pairs = [('security', security)]
    _transport_pairs(stream, pairs)
    pairs.extend(tls_pairs)
    password = urllib.parse.quote(str(server['password']), safe='')
    return f'trojan://{password}@{_authority(server["address"], server["port"])}?{_query(pairs)}#{_remark(uri)}'


def _vmess(uri, outbound):
    server = outbound['settings']['vnext'][0]
    user = server['users'][0]
    stream = outbound.get('streamSettings') or {}
    security = stream.get('security') or 'none'
    network = stream.get('network') or 'tcp'
    network = 'tcp' if network == 'raw' else network
    block = {}
    if security != 'none':
        block = (stream.get('realitySettings') if security == 'reality' else stream.get('tlsSettings')) or {}
    data = {'v': '2', 'ps': _remark(uri), 'add': server['address'], 'port': str(server['port']),
            'id': user['id'], 'aid': '0', 'scy': user.get('security') or 'auto', 'net': network,
            'type': 'none', 'host': '', 'path': '', 'tls': '' if security == 'none' else security,
            'sni': block.get('serverName') or '', 'alpn': ','.join(block.get('alpn') or []),
            'fp': block.get('fingerprint') or ''}
    if security == 'reality':
        data.update({'pbk': block.get('publicKey') or '', 'sid': block.get('shortId') or '',
                     'spx': block.get('spiderX') or '/'})
    if user.get('flow'):
        data['flow'] = user['flow']
    if network == 'ws':
        ws = stream.get('wsSettings') or {}
        data['path'] = ws.get('path') or '/'
        data['host'] = ws.get('host') or (ws.get('headers') or {}).get('Host') or ''
    elif network == 'grpc':
        data['path'] = (stream.get('grpcSettings') or {}).get('serviceName') or ''
    elif network == 'xhttp':
        xhttp = stream.get('xhttpSettings') or {}
        data['path'] = xhttp.get('path') or '/'
        data['host'] = xhttp.get('host') or ''
        data['mode'] = xhttp.get('mode') or 'auto'
    elif network == 'httpupgrade':
        upgrade = stream.get('httpupgradeSettings') or {}
        data['path'] = upgrade.get('path') or '/'
        data['host'] = upgrade.get('host') or ''
    elif network == 'kcp':
        kcp = stream.get('kcpSettings') or {}
        data['type'] = (kcp.get('header') or {}).get('type') or 'none'
        data['seed'] = kcp.get('seed') or ''
    elif network == 'tcp':
        if ((stream.get('tcpSettings') or {}).get('header') or {}).get('type') == 'http':
            data['type'] = 'http'
    return 'vmess://' + base64.b64encode(json.dumps(data, ensure_ascii=False).encode()).decode()


def _ss(uri, outbound):
    server = outbound['settings']['servers'][0]
    userinfo = f'{server["method"]}:{server["password"]}'
    plain = all(ch.isalnum() or ch in '-._~' for ch in userinfo)
    token = userinfo if plain else base64.b64encode(userinfo.encode()).decode()
    return f'ss://{urllib.parse.quote(token, safe=":+=/")}@{_authority(server["address"], server["port"])}#{_remark(uri)}'


BUILDERS = {'vless': _vless, 'trojan': _trojan, 'vmess': _vmess, 'shadowsocks': _ss}


def _parse(uri):
    outbound = sp.uri_to_xray_outbound(uri, 'canonical')
    if not outbound:
        return None
    return sp.prepare_outbound_for_current_xray(copy.deepcopy(outbound))


def canonical_uri(uri):
    """Return the minimal client-portable URI for this key, or None when unsupported."""
    if not isinstance(uri, str) or '://' not in uri:
        return None
    scheme = uri.split('://', 1)[0].strip().lower()
    if scheme in PASS_THROUGH:
        head, _, query = uri.partition('?')
        head = head.split('#', 1)[0]
        kept = [kv for kv in query.split('#', 1)[0].split('&')
                if kv and kv.split('=', 1)[0].strip().lower() not in DROP_KEYS]
        return head + ('?' + '&'.join(kept) if kept else '') + '#' + _remark(uri)
    outbound = _parse(uri)
    if not outbound:
        return None
    builder = BUILDERS.get(outbound.get('protocol', ''))
    if not builder:
        return None
    try:
        return builder(uri, outbound)
    except (KeyError, IndexError, TypeError):
        return None


def _identity(uri):
    """Same identity == same server-side account and transport; fp and remark do not count."""
    outbound = _parse(uri)
    if not outbound:
        return uri.split('#', 1)[0].strip().lower()
    cleaned = copy.deepcopy(outbound)
    cleaned.pop('tag', None)
    stream = cleaned.get('streamSettings') or {}
    stream['network'] = 'tcp' if stream.get('network') == 'raw' else stream.get('network')
    for block in ('realitySettings', 'tlsSettings'):
        if isinstance(stream.get(block), dict):
            stream[block].pop('fingerprint', None)
            stream[block].pop('alpn', None)
    cleaned['streamSettings'] = stream
    return json.dumps(cleaned, sort_keys=True, ensure_ascii=False)


def _fp_score(uri):
    try:
        query = urllib.parse.parse_qs(urllib.parse.urlparse(uri).query)
    except ValueError:
        return 99
    fp = (query.get('fp') or [''])[0].strip().lower()
    return FP_RANK.get(fp, 9 if fp else 10)


def _endpoint(uri):
    try:
        parsed = urllib.parse.urlparse(uri)
        return (parsed.hostname or '').lower(), parsed.port or 443
    except ValueError:
        return '', 0


def publishable(nodes, per_endpoint=3):
    """Canonicalise, deduplicate by identity, spread across endpoints, cap each endpoint."""
    best = {}
    for node in nodes:
        uri = canonical_uri(node.get('uri', ''))
        if not uri:
            continue
        candidate = {**node, 'uri': uri}
        key = _identity(uri)
        current = best.get(key)
        if current is None:
            best[key] = candidate
            continue
        rank_new = (_fp_score(uri), candidate.get('ping_ms') or 1e9)
        rank_old = (_fp_score(current['uri']), current.get('ping_ms') or 1e9)
        if candidate.get('latencylab_verified') and not current.get('latencylab_verified'):
            best[key] = candidate
        elif candidate.get('latencylab_verified') == current.get('latencylab_verified') and rank_new < rank_old:
            best[key] = candidate
    ordered = sorted(best.values(), key=lambda n: (n.get('ping_ms') or 1e9, n.get('uri', '')))
    cap = max(1, int(per_endpoint))
    buckets = {}
    for node in ordered:
        buckets.setdefault(_endpoint(node['uri']), []).append(node)
    spread = []
    depth = 0
    while True:
        added = False
        for bucket in buckets.values():
            if depth < len(bucket) and depth < cap:
                spread.append(bucket[depth])
                added = True
        if not added:
            break
        depth += 1
    return spread
