"""Publish artifacts from an isolated checkout; credentials stay out of URLs."""
import base64
import os
import subprocess
import tempfile
from pathlib import Path
from .export import publish

REPOSITORY = 'https://github.com/SH20FK/TurboProbe.git'


def push_snapshot(snapshot, token):
    if not token:
        raise RuntimeError('GITHUB_TOKEN is required for push')
    env = {**os.environ, 'GIT_TERMINAL_PROMPT': '0', 'GIT_CONFIG_COUNT': '1',
           'GIT_CONFIG_KEY_0': 'http.https://github.com/.extraheader',
           'GIT_CONFIG_VALUE_0': 'AUTHORIZATION: basic ' + base64.b64encode(('x-access-token:' + token).encode()).decode()}
    def git(args, cwd):
        return subprocess.run(['git', *args], cwd=cwd, env=env, capture_output=True, timeout=180)
    for attempt in range(3):
        with tempfile.TemporaryDirectory(prefix='turboprobe_publish_') as tmp:
            clone = Path(tmp) / 'repo'
            if git(['clone', '--quiet', '--depth', '1', '--branch', 'main', REPOSITORY, str(clone)], tmp).returncode:
                raise RuntimeError('GitHub checkout failed; credentials and remote output are redacted')
            files = publish(snapshot, clone)
            if git(['add', '--', *files], clone).returncode:
                raise RuntimeError('GitHub artifact staging failed')
            if git(['diff', '--cached', '--quiet'], clone).returncode == 0:
                return
            result = git(['-c', 'user.name=TurboProbe', '-c', 'user.email=turboprobe@users.noreply.github.com',
                          'commit', '-m', 'chore(sub): publish LatencyLab verified VPN snapshot'], clone)
            if result.returncode:
                raise RuntimeError('GitHub artifact commit failed')
            if git(['push', 'origin', 'HEAD:main'], clone).returncode == 0:
                return
    raise RuntimeError('GitHub push failed after three fresh checkout attempts')
