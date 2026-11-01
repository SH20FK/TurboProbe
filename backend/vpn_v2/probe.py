"""Shadow adapter for the existing strict Xray/Mihomo verifier."""
import math
import time
from unittest.mock import patch
import shutil
import sys
from pathlib import Path

LEGACY_DIR = Path(__file__).resolve().parents[1] / 'vpn'
if str(LEGACY_DIR) not in sys.path:
    sys.path.insert(0, str(LEGACY_DIR))
import service_prober


def rank(nodes, limit=60):
    eligible = []
    for node in nodes:
        ping = node.get('ping_ms')
        if (node.get('verified') is True and node.get('verification_policy') == 'tunnel-https-v1'
                and isinstance(ping, (int, float)) and not isinstance(ping, bool)
                and math.isfinite(ping) and ping > 0):
            eligible.append(node)
    return sorted(eligible, key=lambda n: n['ping_ms'])[:limit]


def verify(uris, batch_size=12):
    # Reuse the battle-tested tunnel engine only; do not call its main/exporter.
    # UDP candidates bypass TCP prefilter in the engine. All results require the strict gate.
    for name in ('xray', 'mihomo'):
        exe = name + ('.exe' if sys.platform == 'win32' else '')
        if not shutil.which(name) and not (LEGACY_DIR / 'bin' / exe).is_file():
            raise RuntimeError(f'{name} must be installed before running the shadow probe')
    return list(service_prober.deep_verify_nodes(uris, batch_size=batch_size, return_results=True).values())


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
    return [{**n, 'speed_mbps': measurements.get(n['uri']), 'speed_transfer_bytes': 4194304,
             'speed_status': 'measured' if n['uri'] in measurements else 'unavailable'} for n in nodes]
