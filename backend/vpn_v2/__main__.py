"""Collect, verify and optionally publish VPN subscriptions; shadow by default."""
import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from .latencylab import LabClient, LabError, check_candidates
from .probe import rank, verify, measure_selected, service_prober
from .sources import fetch_all, normalize
from .secrets import load
from .export import publish


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources', help='UTF-8 file containing one source URL per line; default: curated sources')
    parser.add_argument('--from-candidates', help='resume collection checkpoint without fetching again')
    parser.add_argument('--out', required=True, help='private shadow report path')
    parser.add_argument('--candidate-limit', type=int, default=5000)
    parser.add_argument('--select', type=int, default=200)
    parser.add_argument('--collect-only', action='store_true')
    parser.add_argument('--install-cores', action='store_true', help='install missing Xray/Mihomo into local bin')
    parser.add_argument('--publish', action='store_true', help='write accepted artifacts to sub and docs/sub')
    parser.add_argument('--push', action='store_true', help='publish snapshot through a fresh GitHub checkout')
    args = parser.parse_args()
    private_dir = (Path(__file__).resolve().parent / '.local').resolve()
    target = Path(args.out).resolve()
    if not target.is_relative_to(private_dir):
        parser.error('shadow output must be inside backend/vpn_v2/.local')
    if not 1 <= args.candidate_limit <= 10000:
        parser.error('candidate limit must be between 1 and 10000')
    if not 1 <= args.select <= 200:
        parser.error('select must be between 1 and 200')
    if args.collect_only and (args.publish or args.push):
        parser.error('collection cannot publish')
    if args.sources:
        source_urls = [line.strip() for line in Path(args.sources).read_text(encoding='utf-8').splitlines()
                       if line.strip() and not line.lstrip().startswith('#')]
    else:
        import aggregator
        source_urls = aggregator.SOURCES[:45]
    if not source_urls:
        parser.error('source list is empty')
    if args.from_candidates:
        candidates = json.loads(Path(args.from_candidates).read_text(encoding='utf-8'))['uris'][:args.candidate_limit]
        if not isinstance(candidates, list) or not all(isinstance(u, str) for u in candidates):
            parser.error('invalid candidate checkpoint')
        errors = []
    else:
        contents, errors = fetch_all(source_urls)
        candidates = normalize(contents)[:args.candidate_limit]
    if not candidates:
        raise LabError('No candidates retrieved; shadow output was not replaced')
    target.parent.mkdir(parents=True, exist_ok=True)
    candidate_path = target.with_name(target.stem + '-candidates.json')
    candidate_path.write_text(json.dumps({'candidate_count': len(candidates), 'uris': candidates}), encoding='utf-8')
    print(f'Collected {len(candidates)} unique candidates; {len(errors)} source errors.')
    if args.collect_only:
        return
    tokens = [load(name) for name in ('LATENCYLAB_API_KEY_1', 'LATENCYLAB_API_KEY_2')]
    if not all(tokens):
        raise LabError('Candidates saved. Set LATENCYLAB_API_KEY_1 and LATENCYLAB_API_KEY_2 in Kaggle Secrets or environment.')
    if args.install_cores:
        service_prober.get_xray_binary_path()
        service_prober.get_mihomo_binary_path()
    verified = rank(verify(candidates), args.select)
    if not verified:
        raise LabError('No tunnel-verified candidates; shadow output was not replaced')
    verified = measure_selected(verified)
    print(f'LatencyLab phase: checking {len(verified)} selected nodes', flush=True)
    lab_summary = {}
    try:
        passed = check_candidates(verified, [LabClient(token) for token in tokens], allow_partial=True, summary=lab_summary)
        if lab_summary.get('agent_errors'):
            raise LabError('LatencyLab agent errors: publication withheld; inspect private failure report')
    except LabError:
        failure = {'mode': 'failed-not-for-publication', 'selected': verified, 'latencylab': lab_summary}
        target.with_name(target.stem + '-failed.json').write_text(json.dumps(failure, ensure_ascii=False, indent=2), encoding='utf-8')
        print('Private failure report saved; previous publication preserved.', flush=True)
        raise
    report = {'schema_version': 1, 'mode': 'shadow', 'updated_at': datetime.now(timezone.utc).isoformat(),
              'source_count': len(source_urls), 'source_errors': errors, 'candidate_count': len(candidates),
              'selected_count': len(verified), 'nodes': passed, 'latencylab': lab_summary,
              'speed_measurement': 'bounded 4 MiB HTTPS download through selected tunnels'}
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(target.name + '.tmp')
    try:
        temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)
    print(f'Run completed: {len(passed)}/{len(verified)} nodes passed all operators.')
    if lab_summary.get('quota_exhausted'):
        print(f"Daily quota exhausted after {lab_summary['attempted']} checks; unchecked nodes excluded.")
    if args.publish:
        publish(report, Path(__file__).resolve().parents[2])
    if args.push:
        from .github import push_snapshot
        push_snapshot(report, load('GITHUB_TOKEN'))


if __name__ == '__main__':
    try:
        main()
    except LabError as error:
        raise SystemExit(str(error)) from None
