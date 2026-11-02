"""Daily Kaggle entry point: test=50/top 10; production=full crawler/top 200."""
import argparse
import subprocess
import sys
import os
import signal
from pathlib import Path


def run_cycle(command, root):
    if os.name != 'posix':
        return subprocess.run(command,cwd=root,check=True,timeout=21600)
    process = subprocess.Popen(command,cwd=root,start_new_session=True)
    try:
        result = process.wait(timeout=21600)
    except (subprocess.TimeoutExpired,KeyboardInterrupt):
        os.killpg(process.pid,signal.SIGTERM)
        try: process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid,signal.SIGKILL)
            process.wait()
        raise
    if result: raise subprocess.CalledProcessError(result,command)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--production', action='store_true')
    parser.add_argument('--cached-only',action='store_true',help='one-off verification of saved keys, with publication')
    parser.add_argument('--cached-queue',action='store_true',help='rolling verification of all saved keys with early publication')
    parser.add_argument('--candidate-limit',type=int,help='cached-only sample size; 0 checks the entire cache')
    parser.add_argument('--lab-limit', type=int, help='override final selection for a full-crawler control run')
    args = parser.parse_args()
    if args.cached_queue:
        if args.production or args.cached_only or args.candidate_limit is not None:parser.error('cached-queue is a separate mode')
        if args.lab_limit is not None and not 1<=args.lab_limit<=200:parser.error('lab-limit must be 1..200')
        root=Path(__file__).resolve().parents[2]
        run_cycle([sys.executable,'-u','-m','backend.vpn_v2.cached_queue','--select',str(args.lab_limit or 10)],root)
        return
    if args.lab_limit is not None and not 1 <= args.lab_limit <= 200:
        parser.error('lab-limit must be 1..200')
    if args.cached_only and args.production: parser.error('cached-only cannot run discovery/production')
    if args.candidate_limit is not None and (not args.cached_only or args.candidate_limit < 0):
        parser.error('candidate-limit requires cached-only and must be nonnegative')
    root = Path(__file__).resolve().parents[2]
    output = 'backend/vpn_v2/.local/' + ('cached-once' if args.cached_only else 'production' if args.production else 'test50') + '.json'
    command = [sys.executable, '-u', '-m', 'backend.vpn_v2', '--out', output,
               '--candidate-limit', str(args.candidate_limit if args.candidate_limit is not None else 0 if args.cached_only or args.production else 50),
               '--select', str(args.lab_limit or (200 if args.production else 10)), '--install-cores']
    if args.production:
        command.append('--discover')
        command.append('--crawler-state')
        command.append('--push')
    if args.cached_only:
        command.extend(['--cached-only','--push'])
    run_cycle(command,root)


if __name__ == '__main__':
    main()
