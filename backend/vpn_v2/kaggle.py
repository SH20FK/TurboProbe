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
    parser.add_argument('--lab-limit', type=int, help='override final selection for a full-crawler control run')
    args = parser.parse_args()
    if args.lab_limit is not None and not 1 <= args.lab_limit <= 200:
        parser.error('lab-limit must be 1..200')
    root = Path(__file__).resolve().parents[2]
    output = 'backend/vpn_v2/.local/' + ('production' if args.production else 'test50') + '.json'
    command = [sys.executable, '-m', 'backend.vpn_v2', '--out', output,
               '--candidate-limit', '0' if args.production else '50',
               '--select', str(args.lab_limit or (200 if args.production else 10)), '--install-cores']
    if args.production:
        command.append('--discover')
        command.append('--crawler-state')
        command.append('--push')
    run_cycle(command,root)


if __name__ == '__main__':
    main()
