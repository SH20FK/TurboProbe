"""Bounded, TLS-verified source downloads and subscription normalization."""
from __future__ import annotations

import hashlib
from itertools import zip_longest
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import sys
from urllib.parse import urlsplit

import requests

LEGACY_DIR = Path(__file__).resolve().parents[1] / 'vpn'
if str(LEGACY_DIR) not in sys.path:
    sys.path.insert(0, str(LEGACY_DIR))
from aggregator import extract_uris_from_content  # legacy parser, isolated during migration

MAX_BYTES = 4 * 1024 * 1024


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
