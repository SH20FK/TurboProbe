#!/usr/bin/env python3
"""
TurboProbe Source Discovery Bot
================================
Finds NEW public sources of VPN subscription keys (vless/trojan/vmess/ss/
hysteria2/tuic) that aren't already in aggregator.py's seed SOURCES list,
so the pool of sources grows on its own instead of being hand-maintained
forever.

How it works:
  1. Runs a handful of GitHub code-search queries for files that look like
     subscription dumps (raw config lines, not source code that merely
     mentions the protocol).
  2. Resolves each hit to its raw download URL via the Contents API.
  3. Actually fetches the candidate and re-uses aggregator.py's own
     extractor — a candidate is only kept if it yields a real number of
     parseable keys (junk/one-off mentions are filtered out for free here).
  4. Confirmed URLs are merged into tools/discovered_sources.json, which
     aggregator.py reads on every run in addition to its static SOURCES list.

Needs a GitHub token for the search API (unauthenticated code search is
blocked). In GitHub Actions this is just the built-in GITHUB_TOKEN — no
extra secret to configure. Run locally with:
    GITHUB_TOKEN=ghp_xxx python3 tools/discover_sources.py
"""

import os
import sys
import json
import time
import urllib.request
import urllib.parse
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aggregator import extract_uris_from_content, SOURCES  # reuse the proven extractor

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
DISCOVERED_PATH = os.path.join(TOOLS_DIR, "discovered_sources.json")

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
API = "https://api.github.com"

# Each query targets plain-text dumps rather than application source code.
QUERIES = [
    "vless:// extension:txt",
    "trojan:// extension:txt",
    "vmess:// extension:txt",
    "hysteria2:// extension:txt",
    "ss:// extension:txt NOT extension:py NOT extension:go",
]

PAGES_PER_QUERY = 2       # 30 results/page -> up to 60 candidates per query
MIN_NODES_TO_KEEP = 5     # candidate must yield at least this many real keys
REQUEST_PAUSE = 2.0       # seconds between search calls (stay under rate limits)


def gh_get(url: str):
    req = urllib.request.Request(url, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "TurboProbe-Source-Discovery",
        **({"Authorization": f"Bearer {GITHUB_TOKEN}"} if GITHUB_TOKEN else {}),
    })
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def search_candidates(query: str, pages: int = PAGES_PER_QUERY) -> list:
    """Returns Contents-API URLs (item['url']) for files matching the query."""
    urls = []
    q = urllib.parse.quote(query)
    for page in range(1, pages + 1):
        api_url = f"{API}/search/code?q={q}&per_page=30&page={page}"
        try:
            data = gh_get(api_url)
        except urllib.error.HTTPError as e:
            print(f"  [!] search failed for '{query}' page {page}: HTTP {e.code}")
            break
        except Exception as e:
            print(f"  [!] search failed for '{query}' page {page}: {e}")
            break
        items = data.get("items", [])
        if not items:
            break
        urls.extend(item.get("url") for item in items if item.get("url"))
        time.sleep(REQUEST_PAUSE)
    return urls


def resolve_download_url(contents_api_url: str):
    """Contents API -> raw.githubusercontent.com download_url for the file."""
    try:
        meta = gh_get(contents_api_url)
        return meta.get("download_url")
    except Exception:
        return None


def validate_source(url: str, min_nodes: int = MIN_NODES_TO_KEEP) -> int:
    """Fetches the candidate and returns how many keys it parses to (0 = reject)."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            content = resp.read().decode("utf-8", errors="ignore")
        uris = extract_uris_from_content(content)
        return len(uris) if len(uris) >= min_nodes else 0
    except Exception:
        return 0


def main():
    if not GITHUB_TOKEN:
        print("⚠️  No GITHUB_TOKEN in the environment — GitHub code search requires "
              "auth, so nothing can be discovered this run. In Actions this is "
              "provided automatically; locally, export GITHUB_TOKEN=<a token>.")

    known = set(SOURCES)
    existing = {}
    if os.path.exists(DISCOVERED_PATH):
        try:
            with open(DISCOVERED_PATH, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = {}
    known |= set(existing.keys())

    print(f"🔎 [Source Discovery] {len(QUERIES)} query patterns, "
          f"{len(known)} sources already known...")

    candidate_api_urls = set()
    for q in QUERIES:
        found = search_candidates(q)
        print(f"  [+] '{q}' -> {len(found)} candidate files")
        candidate_api_urls.update(found)

    print(f"📊 {len(candidate_api_urls)} unique candidate files to resolve + validate.")

    new_count = 0
    for api_url in candidate_api_urls:
        download_url = resolve_download_url(api_url)
        if not download_url or download_url in known:
            continue
        node_count = validate_source(download_url)
        if node_count:
            existing[download_url] = {
                "discovered_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "nodes_at_discovery": node_count,
            }
            known.add(download_url)
            new_count += 1
            print(f"  ✅ new source confirmed ({node_count} keys): {download_url}")
        time.sleep(0.3)

    with open(DISCOVERED_PATH, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False, sort_keys=True)

    print(f"\n🎉 [Discovery complete] {new_count} new sources added this run. "
          f"Total auto-discovered pool: {len(existing)}")


if __name__ == "__main__":
    main()
