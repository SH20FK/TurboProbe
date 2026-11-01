"""Shadow adapter for the existing strict Xray/Mihomo verifier."""
import math
import time
import asyncio
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from unittest.mock import patch
import shutil
import sys
from pathlib import Path

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


def verify(uris, batch_size=12, workers=None):
    # Reuse the battle-tested tunnel engine only; do not call its main/exporter.
    # UDP candidates bypass TCP prefilter in the engine. All results require the strict gate.
    for name in ('xray', 'mihomo'):
        exe = name + ('.exe' if sys.platform == 'win32' else '')
        if not shutil.which(name) and not (LEGACY_DIR / 'bin' / exe).is_file():
            raise RuntimeError(f'{name} must be installed before running the shadow probe')
    workers = workers or 4
    if not 1 <= workers <= 8 or not 1 <= batch_size <= 32:
        raise ValueError('probe worker/batch limits exceeded')
    usable = []
    for uri in uris:
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
    async def prefilter():
        sem = asyncio.Semaphore(128)
        async def check(uri):
            if uri.split('://')[0].lower() in ('hy2', 'hysteria2', 'tuic'):
                return uri
            writer = None
            try:
                host, port, _ = service_prober.parse_host_and_port(uri)
                async with sem:
                    _, writer = await asyncio.wait_for(asyncio.open_connection(host, port), 1.5)
                return uri
            except (OSError, ValueError, asyncio.TimeoutError):
                return None
            finally:
                if writer:
                    writer.close()
        return [u for u in await asyncio.gather(*(check(u) for u in uris)) if u]
    reachable = asyncio.run(prefilter())
    print(f'TCP prefilter complete: {len(reachable)}/{len(uris)} retained (UDP bypasses TCP)', flush=True)
    slots = [(i, u, 0, 'GLOBAL', u.split('://')[0].lower()) for i,u in enumerate(reachable)]
    batches = [slots[i:i+batch_size] for i in range(0, len(slots), batch_size)]
    print(f'Tunnel phase: {len(batches)} batches, {workers} parallel core workers', flush=True)
    verified = {}
    started = time.monotonic()
    xray = service_prober.get_xray_binary_path()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(service_prober.run_batch_probe, xray, batch, basic_only=True): len(batch) for batch in batches}
        done = 0
        for future in as_completed(futures):
            rows = future.result()
            done += futures[future]
            for node in rows:
                if node.get('verified') is True and node.get('verification_policy') == 'tunnel-https-v1':
                    verified[node['uri'].split('#')[0]] = node
            print(f'Tunnel progress: {done}/{len(slots)} checked; {len(verified)} verified; {time.monotonic()-started:.0f}s', flush=True)
    return list(verified.values())


def measure_selected(nodes):
    """Bounded 4 MiB HTTPS measurement for selected nodes; ping stays unchanged."""
    from verification import make_session, read_response
    from requests import RequestException
    measurements = {}

    def measure(port, timeout=5):
        start = time.monotonic()
        try:
            with make_session(port) as session:
                status, body = read_response(session, 'https://speed.cloudflare.com/__down?bytes=4194304',
                                             start + 20, 5, 4194304)
            if status != 200 or len(body) != 4194304:
                return None
            speed = round(len(body) * 8 / 1_000_000 / max(time.monotonic() - start, .001), 2)
            return {'country': 'GLOBAL', 'ping_ms': 1, 'speed_mbps': speed}
        except (RequestException, OSError, ValueError):
            return None

    xray = service_prober.get_xray_binary_path()
    # Used only by this single-process CLI, after initial verification finishes.
    with patch.object(service_prober, 'measure_tunnel', measure):
        for i, node in enumerate(nodes):
            slot = (i, node['uri'], 0, node.get('country', 'GLOBAL'), node['uri'].split('://')[0])
            for row in service_prober.run_batch_probe(xray, [slot], basic_only=True):
                measurements[row['uri']] = row['speed_mbps']
            print(f'Speed progress: {i+1}/{len(nodes)}; measured {len(measurements)}', flush=True)
    return [{**n, 'speed_mbps': measurements.get(n['uri']), 'speed_transfer_bytes': 4194304,
             'speed_status': 'measured' if n['uri'] in measurements else 'unavailable'} for n in nodes]
