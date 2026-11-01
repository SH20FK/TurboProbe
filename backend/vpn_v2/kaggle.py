"""Kaggle entry point: test=50 candidates/top 10; production=5000/top 60."""
import argparse
import subprocess
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--production', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    output = 'backend/vpn_v2/.local/' + ('production' if args.production else 'test50') + '.json'
    command = [sys.executable, '-m', 'backend.vpn_v2', '--out', output,
               '--candidate-limit', '5000' if args.production else '50',
               '--select', '60' if args.production else '10', '--install-cores']
    if args.production:
        command.append('--push')
    subprocess.run(command, cwd=root, check=True)


if __name__ == '__main__':
    main()
