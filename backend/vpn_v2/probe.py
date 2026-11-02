"""Shadow adapter for the existing strict Xray/Mihomo verifier."""
import math
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor
import shutil
import sys
from pathlib import Path
from .parallel import completed
from .resources import concurrency

LEGACY_DIR = Path(__file__).resolve().parents[1] / 'vpn'
if str(LEGACY_DIR) not in sys.path:
    sys.path.insert(0, str(LEGACY_DIR))
import service_prober


def rank(nodes, limit=200):
    eligible = []
    for node in nodes:
        ping = node.get('ping_ms')
        if (node.get('verified') is True and node.get('verification_policy') == 'tunnel-https-v1'
                and isinstance(ping, (int, float)) and not isinstance(ping, bool)
                and math.isfinite(ping) and ping > 0):
            eligible.append(node)
    return sorted(eligible, key=lambda n: n['ping_ms'])[:limit]


def verify(uris, batch_size=None, workers=None, *, deadline=float('inf'), checkpoint=None):
    # Reuse the battle-tested tunnel engine only; do not call its main/exporter.
    # UDP candidates bypass TCP prefilter in the engine. All results require the strict gate.
    for name in ('xray', 'mihomo'):
        exe = name + ('.exe' if sys.platform == 'win32' else '')
        if not shutil.which(name) and not (LEGACY_DIR / 'bin' / exe).is_file():
            raise RuntimeError(f'{name} must be installed before running the shadow probe')
    profile = concurrency()
    workers = workers if workers is not None else profile['probe_workers']
    batch_size = batch_size if batch_size is not None else profile['probe_batch']
    if not 1 <= workers <= 8 or not 1 <= batch_size <= 32:
        raise ValueError('probe worker/batch limits exceeded')
    usable = []
    for uri in uris:
        if time.monotonic() >= deadline: raise TimeoutError('verification deadline')
        if uri.split('://')[0].lower() in ('hy2', 'hysteria2', 'tuic'):
            usable.append(uri)
            continue
        outbound = service_prober.uri_to_xray_outbound(uri, 'preflight')
        if not outbound:
            continue
        if outbound.get('protocol') == 'vless' and outbound.get('streamSettings', {}).get('security') not in ('tls', 'reality'):
            continue
        if service_prober.prepare_outbound_for_current_xray(outbound) is not None:
            usable.append(uri)
    print(f'Config preflight: {len(usable)}/{len(uris)} usable; {len(uris)-len(usable)} unsupported', flush=True)
    uris = usable
    print(f'TCP prefilter: {len(uris)} candidates', flush=True)
    from .probe_prefilter import prefilter
    reachable = asyncio.run(prefilter(uris,service_prober.parse_host_and_port,deadline))
    print(f'TCP prefilter complete: {len(reachable)}/{len(uris)} retained (UDP bypasses TCP)', flush=True)
    slots = [(i, u, 0, 'GLOBAL', u.split('://')[0].lower()) for i,u in enumerate(reachable)]
    batches = (slots[i:i+batch_size] for i in range(0, len(slots), batch_size))
    print(f'Tunnel phase: {math.ceil(len(slots)/batch_size)} batches, {workers} parallel core workers, '
          f'up to {workers*batch_size} simultaneous tunnels', flush=True)
    verified = {}
    started = time.monotonic()
    xray = service_prober.get_xray_binary_path()
    def batch_probe(batch):
        if time.monotonic() >= deadline: raise TimeoutError('verification deadline')
        return service_prober.run_batch_probe(xray,batch,basic_only=True)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        done = 0
        for batch,future in completed(pool,batches,batch_probe,workers,deadline):
            rows = future.result()
            done += len(batch)
            if checkpoint: checkpoint(batch,rows)
            for node in rows:
                if node.get('verified') is True and node.get('verification_policy') == 'tunnel-https-v1':
                    verified[node['uri'].split('#')[0]] = node
            elapsed = time.monotonic()-started
            print(f'Tunnel progress: {done}/{len(slots)} checked; {len(verified)} verified; '
                  f'{elapsed:.0f}s; {done/max(elapsed,.001):.1f} keys/s', flush=True)
            if time.monotonic() >= deadline:
                raise TimeoutError('full candidate pool did not complete within budget')
    return list(verified.values())


def measure_selected(nodes, *, deadline=float('inf')):
    """Bounded 4 MiB HTTPS measurement for selected nodes; ping stays unchanged."""
    from verification import make_session, read_response
    from requests import RequestException
    from .geolocation import country_through_tunnel
    measurements = {}

    def measure(port, timeout=5):
        start = time.monotonic()
        country, speed = 'GLOBAL', None
        try:
            with make_session(port) as session:
                country = country_through_tunnel(session,min(deadline,start+10))
                start = time.monotonic()  # Geolocation is not part of the speed measurement.
                status, body = read_response(session, 'https://speed.cloudflare.com/__down?bytes=4194304',
                                             min(deadline,start + 20), 5, 4194304)
            if status == 200 and len(body) == 4194304:
                speed = round(len(body) * 8 / 1_000_000 / max(time.monotonic() - start, .001), 2)
        except (RequestException, OSError, ValueError):
            pass
        return {'country':country,'ping_ms':1,'speed_mbps':speed}

    xray = service_prober.get_xray_binary_path()
    for start in range(0,len(nodes),12):
        if time.monotonic() >= deadline: raise TimeoutError('speed measurement deadline')
        batch = [(start+i,n['uri'],0,n.get('country','GLOBAL'),n['uri'].split('://')[0]) for i,n in enumerate(nodes[start:start+12])]
        for row in service_prober.run_batch_probe(xray,batch,basic_only=True,measurement=measure,measurement_workers=1):
            measurements[row['uri']] = row
        print(f'Speed progress: {min(start+12,len(nodes))}/{len(nodes)}; measured {len(measurements)}',flush=True)
    result = []
    for node in nodes:
        measured = measurements.get(node['uri'],{})
        country = measured.get('country','GLOBAL')
        if country == 'GLOBAL': country = node.get('country','GLOBAL')
        speed = measured.get('speed_mbps')
        result.append({**node,'country':country,'country_source':'tunnel_https' if country!='GLOBAL' else 'unknown',
                       'speed_mbps':speed,'speed_transfer_bytes':4194304,
                       'speed_status':'measured' if speed is not None else 'unavailable'})
    return result
