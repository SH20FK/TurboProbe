"""Private diagnostic: rank an existing 50-candidate sample, optionally check top 10 in LatencyLab."""
import argparse
import json
import socket
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from .probe import service_prober
from .latencylab import LabClient, LabError, check_candidates
from .secrets import load


def tcp_candidate(uri):
    start = time.monotonic()
    try:
        host, port, _ = service_prober.parse_host_and_port(uri)
        with socket.create_connection((host, port), timeout=2):
            return {'uri': uri, 'tcp_ms': round((time.monotonic() - start) * 1000, 1), 'verified': False}
    except (OSError, ValueError):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--latencylab', action='store_true')
    args = parser.parse_args()
    private = Path(__file__).resolve().parent / '.local'
    candidates = json.loads((private / 'test50-candidates.json').read_text(encoding='utf-8'))['uris'][:50]
    with ThreadPoolExecutor(max_workers=16) as pool:
        reached = [n for n in pool.map(tcp_candidate, candidates) if n]
    selected = sorted(reached, key=lambda n: n['tcp_ms'])[:10]
    print(f'Diagnostic only: {len(reached)}/{len(candidates)} TCP reachable; selected {len(selected)}.')
    report = {'mode': 'diagnostic-not-for-publication', 'selected': selected}
    if args.latencylab:
        tokens = [load(name) for name in ('LATENCYLAB_API_KEY_1', 'LATENCYLAB_API_KEY_2')]
        if not all(tokens):
            raise LabError('LatencyLab secrets are required; no API checks performed')
        report['passed'] = check_candidates(selected, [LabClient(token) for token in tokens])
        print(f"LatencyLab diagnostic successes: {len(report['passed'])}/{len(selected)}")
    (private / 'test10-diagnostic.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    try:
        main()
    except LabError as exc:
        raise SystemExit(str(exc)) from None
