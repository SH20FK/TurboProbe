"""Daily crawler and strict VPN verification; publication requires a complete run."""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from .latencylab import LabClient, LabError, check_candidates
from .probe import rank, verify, measure_selected, service_prober
from .sources import fetch_all, normalize, known_sources
from .secrets import load
from .export import publish
from .crawler_run import CrawlRun
from .resources import concurrency


def write_report(path, data):
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary = path.with_name(path.name+'.tmp')
    try:
        temporary.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
        os.replace(temporary,path)
    finally:
        temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources')
    parser.add_argument('--from-candidates')
    parser.add_argument('--cached-only',action='store_true',help='verify stored keys without discovery/source downloads')
    parser.add_argument('--out',required=True)
    parser.add_argument('--candidate-limit',type=int,default=0,help='0 = all active sources and keys; positive = limited test')
    parser.add_argument('--select',type=int,default=200)
    parser.add_argument('--discover',action='store_true')
    parser.add_argument('--crawler-state',action='store_true',help='restore/checkpoint the public crawler-state branch')
    parser.add_argument('--budget-seconds',type=int,default=21600)
    parser.add_argument('--download-workers',type=int,help='1..64; default adapts to available CPUs')
    parser.add_argument('--probe-workers',type=int,help='1..8 core processes; default adapts to available CPUs')
    parser.add_argument('--probe-batch-size',type=int,default=8,help='1..32 tunnels per core batch')
    parser.add_argument('--collect-only',action='store_true')
    parser.add_argument('--install-cores',action='store_true')
    parser.add_argument('--publish',action='store_true')
    parser.add_argument('--push',action='store_true')
    args = parser.parse_args()
    private = (Path(__file__).resolve().parent/'.local').resolve()
    target = Path(args.out).resolve()
    if not target.is_relative_to(private): parser.error('output must be inside backend/vpn_v2/.local')
    if args.candidate_limit < 0 or not 1 <= args.select <= 200: parser.error('invalid candidate/select limit')
    if not 5401 <= args.budget_seconds <= 21600: parser.error('budget must be 5401..21600 seconds')
    if args.download_workers is not None and not 1 <= args.download_workers <= 64: parser.error('download-workers must be 1..64')
    if args.probe_workers is not None and not 1 <= args.probe_workers <= 8: parser.error('probe-workers must be 1..8')
    if not 1 <= args.probe_batch_size <= 32: parser.error('probe-batch-size must be 1..32')
    if args.collect_only and (args.publish or args.push): parser.error('collection cannot publish')
    if args.discover and args.from_candidates: parser.error('discovery cannot use a candidate checkpoint')
    if args.cached_only and (args.discover or args.sources or args.from_candidates): parser.error('cached-only cannot collect new sources')
    run = None
    started = time.monotonic()
    deadline = started+args.budget_seconds
    local_deadline = deadline-5400
    run_id = datetime.now(timezone.utc).isoformat()
    metrics,summary = {},{}
    profile = concurrency()
    print(f"Runtime: {profile['cpus']} available CPUs; downloads={args.download_workers or profile['downloads']}; "
          f"core workers={args.probe_workers or profile['probe_workers']}; tunnels/core={args.probe_batch_size}",flush=True)
    try:
        urls = [l.strip() for l in Path(args.sources).read_text(encoding='utf-8').splitlines() if l.strip() and not l.lstrip().startswith('#')] if args.sources else None
        if args.cached_only:
            run = CrawlRun(private/'cached-state',load('GITHUB_TOKEN'),True,args.budget_seconds,persist_checkpoints=False)
            deadline,local_deadline = run.deadline,run.local_deadline
            candidates,errors,metrics = run.cached_candidates(args.candidate_limit)
        elif args.from_candidates:
            candidates = json.loads(Path(args.from_candidates).read_text(encoding='utf-8'))['uris']
            if not isinstance(candidates,list) or not all(isinstance(u,str) for u in candidates): parser.error('invalid checkpoint')
            errors = []
        elif args.candidate_limit == 0 or args.crawler_state or args.discover:
            run = CrawlRun(private/'state',load('GITHUB_TOKEN'),args.crawler_state,args.budget_seconds)
            deadline,local_deadline = run.deadline,run.local_deadline
            candidates,errors,metrics = run.collect(args.discover,load('GITHUB_TOKEN'),urls,workers=args.download_workers)
        else:
            urls = urls or known_sources(private/'state')[:45]
            contents,errors = fetch_all(urls)
            candidates = normalize(contents)
        if args.candidate_limit: candidates = candidates[:args.candidate_limit]
        if not candidates: raise LabError('No candidates available; previous publication preserved')
        write_report(target.with_name(target.stem+'-candidates.json'),{'candidate_count':len(candidates),'uris':candidates})
        print(f'Collected {len(candidates)} unique candidates; {len(errors)} source errors.',flush=True)
        if args.collect_only: return
        tokens = [load(n) for n in ('LATENCYLAB_API_KEY_1','LATENCYLAB_API_KEY_2')]
        if not all(tokens): raise LabError('Candidates saved; LatencyLab secrets are required')
        if args.install_cores:
            service_prober.get_xray_binary_path()
            service_prober.get_mihomo_binary_path()
        if time.monotonic() >= local_deadline: raise TimeoutError('local verification budget exhausted')
        checkpoint = None
        if run:
            def checkpoint(batch, rows):
                run.store.record_checks(run_id,[item[1] for item in batch],rows,update_scores=False)
        all_verified = verify(candidates,batch_size=args.probe_batch_size,workers=args.probe_workers,deadline=local_deadline,checkpoint=checkpoint)
        if run:
            run.store.record_checks(run_id,candidates,all_verified,update_scores=not args.cached_only)
            run.checkpoint()
        selected = rank(all_verified,args.select)
        if not selected: raise LabError('No tunnel-verified candidates; previous publication preserved')
        if time.monotonic() >= local_deadline: raise TimeoutError('full local pool was not completed before API reserve')
        selected = measure_selected(selected,deadline=deadline)
        print(f'LatencyLab phase: checking {len(selected)} selected nodes',flush=True)
        clients = [LabClient(token) for token in tokens]
        if run:
            for i,client in enumerate(clients): client.attach_store(run.store,run_id,i,run.checkpoint_jobs)
        try:
            passed = check_candidates(selected,clients,allow_partial=False,summary=summary,deadline=deadline)
            if summary.get('agent_errors'): raise LabError('Agent errors; publication withheld')
            if not passed and (args.push or args.publish): raise LabError('No nodes passed LatencyLab; previous subscription preserved')
        except LabError:
            write_report(target.with_name(target.stem+'-failed.json'),{'mode':'failed-not-for-publication','selected':selected,'latencylab':summary})
            raise
        report = {'schema_version':1,'mode':'shadow','updated_at':datetime.now(timezone.utc).isoformat(),
                  'source_count':metrics.get('urls',len(urls or [])),'source_errors':errors,'candidate_count':len(candidates),
                  'selected_count':len(selected),'nodes':passed,'latencylab':summary,'crawler':metrics}
        write_report(target,report)
        if time.monotonic() >= deadline: raise TimeoutError('publication deadline exceeded')
        if run: run.checkpoint()
        if args.publish: publish(report,Path(__file__).resolve().parents[2])
        if args.push:
            from .github import push_snapshot
            push_snapshot(report,load('GITHUB_TOKEN'))
        print(f'Run completed: {len(passed)}/{len(selected)} passed all operators; {time.monotonic()-started:.0f}s',flush=True)
    except TimeoutError:
        write_report(target.with_name(target.stem+'-incomplete.json'),{'status':'incomplete','crawler':metrics,'latencylab':summary})
        raise LabError('Six-hour run budget exhausted; checkpoints saved, publication withheld') from None
    finally:
        if run:
            original_error = sys.exc_info()[1]
            try:
                run.close()
            except Exception as checkpoint_error:
                if original_error is None: raise
                print(f'Checkpoint on exit failed: {checkpoint_error}; preserving original {type(original_error).__name__}',flush=True)


if __name__ == '__main__':
    try: main()
    except (LabError,RuntimeError,ValueError) as error: raise SystemExit(str(error)) from None
