"""Bounded, TLS-verified source downloads and subscription normalization."""
from __future__ import annotations

import hashlib
from itertools import zip_longest
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import sys
from urllib.parse import urlsplit

import requests
import json
import shutil

LEGACY_DIR = Path(__file__).resolve().parents[1] / 'vpn'
if str(LEGACY_DIR) not in sys.path:
    sys.path.insert(0, str(LEGACY_DIR))
from aggregator import extract_uris_from_content  # legacy parser, isolated during migration

MAX_BYTES = 4 * 1024 * 1024


def discover(state_dir, token):
    import discover_sources as discovery
    state_dir.mkdir(parents=True, exist_ok=True)
    for name in ('discovered_sources.json', 'source_quality_index.json'):
        target = state_dir / name
        if not target.exists() and (LEGACY_DIR / name).exists():
            shutil.copyfile(LEGACY_DIR / name, target)
    discovery.GITHUB_TOKEN = token
    discovery.TOOLS_DIR = str(state_dir)
    discovery.DISCOVERED_PATH = str(state_dir / 'discovered_sources.json')
    discovery.SOURCE_QUALITY_PATH = str(state_dir / 'source_quality_index.json')
    discovery.TELEGRAM_FEED_PATH = str(state_dir / 'telegram_feed.txt')
    discovery.main()


def known_sources(state_dir):
    import aggregator
    import discover_sources as discovery
    urls = list(aggregator.SOURCES)
    # Union the seed registry and current discovery result; no ranking truncation.
    for path in (LEGACY_DIR / 'discovered_sources.json', state_dir / 'discovered_sources.json'):
        if path.exists():
            data = json.loads(path.read_text(encoding='utf-8'))
            urls.extend(u for u in data if not u.startswith('_'))
    urls.extend('https://t.me/s/' + channel for channel in discovery.TELEGRAM_CHANNELS)
    return list(dict.fromkeys(urls))


def collect_all(urls, workers=12):
    """Parse and discard each response as it arrives instead of retaining all bodies."""
    unique, errors = {}, []
    with ThreadPoolExecutor(max_workers=workers) as executor:
        pending = {executor.submit(fetch_source, url): i for i,url in enumerate(urls)}
        for done, future in enumerate(as_completed(pending), 1):
            source_index = pending.pop(future)
            try:
                for uri in normalize([future.result()]):
                    unique.setdefault(identity(uri), uri)
            except (requests.RequestException, OSError, ValueError) as exc:
                errors.append({'source_index': source_index, 'reason': type(exc).__name__})
            if done % 50 == 0 or done == len(urls):
                print(f'Source progress: {done}/{len(urls)}; {len(unique)} unique keys; {len(errors)} errors', flush=True)
    return list(unique.values()), errors


def identity(uri: str) -> str:
    return hashlib.sha256(uri.strip().split('#', 1)[0].encode()).hexdigest()


def normalize(contents):
    unique = {}
    parsed = [extract_uris_from_content(content) for content in contents]
    for group in zip_longest(*parsed):
        for uri in group:
            if uri is None: continue
            unique.setdefault(identity(uri), uri.strip())
    return list(unique.values())


def fetch_source(url, timeout=10, max_bytes=MAX_BYTES):
    if urlsplit(url).scheme != 'https':
        raise ValueError('only HTTPS sources are supported')
    with requests.Session() as session:
        session.trust_env = False
        with session.get(url, timeout=(timeout, timeout), stream=True, verify=True,
                         allow_redirects=False, headers={'User-Agent': 'TurboProbe/2'}) as response:
            response.raise_for_status()
            if 300 <= response.status_code < 400:
                raise ValueError('source redirects are not followed')
            chunks, size = [], 0
            for chunk in response.iter_content(65536):
                size += len(chunk)
                if size > max_bytes:
                    raise ValueError('source exceeds size limit')
                chunks.append(chunk)
    return b''.join(chunks).decode('utf-8', errors='replace')


def fetch_all(urls, workers=12):
    contents, errors = {}, []
    with ThreadPoolExecutor(max_workers=workers) as executor:
        pending = {executor.submit(fetch_source, url): i for i, url in enumerate(urls)}
        for future in as_completed(pending):
            try:
                contents[pending[future]] = future.result()
            except (requests.RequestException, ValueError, OSError) as exc:
                # Never log source URLs, which can contain tokens.
                errors.append({'source_index': pending[future], 'reason': type(exc).__name__})
    return [contents[i] for i in sorted(contents)], errors
