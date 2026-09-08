#!/usr/bin/env python3
"""Fetch a fresh candidate list from the upstream sources, safely.

Why this is separate from aggregator.py
---------------------------------------
aggregator.py both collects candidates and publishes results. After the strict
verification work it only publishes nodes that passed a real tunnel check, and
a run that verifies nothing clears the published files. Running it from a
Russian ISP therefore risks emptying sub/ instead of refreshing it.

This script does one thing: download the sources, extract and deduplicate the
candidate URIs, and write them to a separate file. It never publishes and never
touches sub/all.txt unless you explicitly point --out at it. It needs no Xray
and performs no verification, so a candidate appearing here is NOT a working
node; it is only something worth probing.

Usage
-----
  python tools\\refresh_candidates.py
  python tools\\refresh_candidates.py --sources ru --workers 24
  python tools\\refresh_candidates.py --out sub\\all.txt      # overwrite the feed
"""
import argparse
import collections
import io
import os
import shutil
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import aggregator  # noqa: E402  (reuses the proven fetch/decode/extract helpers)

DEFAULT_OUT = os.path.join(ROOT, "sub", "fresh-candidates.txt")
EXISTING_FEED = os.path.join(ROOT, "sub", "all.txt")

SUPPORTED_SCHEMES = ("vless", "trojan", "ss", "vmess", "hysteria2", "hy2", "tuic")


def identity(uri):
    """Return (scheme, credential, host, port) or None when unusable.

    urllib is used rather than string splitting because credentials and paths
    legitimately contain '@' and '?' characters.
    """
    text = (uri or "").strip()
    if "://" not in text:
        return None
    scheme = text.split("://", 1)[0].strip().lower()
    if scheme not in SUPPORTED_SCHEMES:
        return None
    try:
        parsed = urllib.parse.urlparse(text)
        host = parsed.hostname
        port = parsed.port
    except Exception:
        return None
    if not host or not port or not (0 < int(port) < 65536):
        return None
    return (scheme, (parsed.username or "").strip(), str(host).strip().lower(), int(port))


def select_sources(kind, cap):
    seed = list(getattr(aggregator, "SOURCES", []))
    ru_direct = list(getattr(aggregator, "RU_DIRECT_SOURCES", {}) or [])

    if kind == "ru":
        chosen = ru_direct
    elif kind == "tier1":
        chosen = seed[:45]
    else:
        discovered = []
        try:
            discovered = list(aggregator.load_discovered_sources() or [])
        except Exception as exc:
            print("  note: discovered sources unavailable (%r)" % (exc,))
        chosen = seed + discovered

    chosen = list(dict.fromkeys(url for url in chosen if isinstance(url, str) and url.strip()))
    if cap and cap > 0:
        chosen = chosen[:cap]
    return chosen


def fetch_one(url, timeout):
    try:
        content = aggregator.fetch_url(url, timeout=timeout)
    except Exception as exc:
        return url, [], "fetch failed: %s" % type(exc).__name__
    if not content:
        return url, [], "empty response"
    try:
        uris = aggregator.extract_uris_from_content(content) or []
    except Exception as exc:
        return url, [], "parse failed: %s" % type(exc).__name__
    return url, uris, None


def load_existing(path):
    known = set()
    if not os.path.exists(path):
        return known
    with io.open(path, encoding="utf-8", errors="replace") as handle:
        for line in handle:
            ident = identity(line)
            if ident:
                known.add(ident)
    return known


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--sources", choices=("tier1", "all", "ru"), default="tier1",
                        help="which source set to pull (default: tier1)")
    parser.add_argument("--cap", type=int, default=0, help="max number of sources to query (0 = no cap)")
    parser.add_argument("--workers", type=int, default=16, help="parallel downloads")
    parser.add_argument("--timeout", type=int, default=10, help="per-source HTTP timeout in seconds")
    parser.add_argument("--out", default=DEFAULT_OUT, help="output file for candidates")
    parser.add_argument("--compare", default=EXISTING_FEED, help="existing feed to diff against")
    parser.add_argument("--show", type=int, default=12, help="how many per-source rows to print")
    parser.add_argument("--force", action="store_true",
                        help="write even when the harvest looks like a collection failure")
    args = parser.parse_args()

    sources = select_sources(args.sources, args.cap)
    if not sources:
        print("no sources selected")
        return 2

    print("== refresh candidates ==")
    print("  source set: %s (%d urls)" % (args.sources, len(sources)))
    print("  workers: %d, timeout: %ds" % (args.workers, args.timeout))
    print("  output: %s" % args.out)
    print("  NOTE: this collects candidates only; nothing here is verified.\n")

    started = time.monotonic()
    per_source = {}
    failures = collections.Counter()
    unique = {}

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = {pool.submit(fetch_one, url, args.timeout): url for url in sources}
        done = 0
        for future in as_completed(futures):
            done += 1
            url, uris, error = future.result()
            if error:
                failures[error] += 1
                per_source[url] = 0
                print("  [%3d/%d] %-22s %s" % (done, len(sources), error, url[:78]))
                continue
            accepted = 0
            for uri in uris:
                ident = identity(uri)
                if not ident:
                    continue
                accepted += 1
                unique.setdefault(ident, (uri.strip(), url))
            per_source[url] = accepted
            print("  [%3d/%d] %5d uris          %s" % (done, len(sources), accepted, url[:78]))

    elapsed = time.monotonic() - started
    known = load_existing(args.compare)
    fresh = [ident for ident in unique if ident not in known]
    gone = [ident for ident in known if ident not in unique]

    print("\n== summary (%.1fs) ==" % elapsed)
    print("  sources queried:      %d" % len(sources))
    print("  sources with content: %d" % sum(1 for count in per_source.values() if count))
    print("  unique candidates:    %d" % len(unique))
    print("  already in %s: %d" % (os.path.basename(args.compare), len(known)))
    print("  NEW vs existing feed: %d" % len(fresh))
    print("  in feed but now gone upstream: %d" % len(gone))

    if failures:
        print("\n  source failures:")
        for reason, count in failures.most_common():
            print("    %4d  %s" % (count, reason))

    contributors = collections.Counter()
    for ident in fresh:
        contributors[unique[ident][1]] += 1
    if contributors:
        print("\n  sources contributing NEW candidates:")
        for url, count in contributors.most_common(args.show):
            print("    %5d  %s" % (count, url[:96]))

    top = sorted(per_source.items(), key=lambda item: item[1], reverse=True)[: args.show]
    print("\n  highest-yield sources overall:")
    for url, count in top:
        print("    %5d  %s" % (count, url[:96]))

    # Safety rail: a network or DNS failure must never be able to erase a feed.
    # Test runs with all sources unreachable produced an empty harvest, which
    # would silently truncate sub/all.txt if --out pointed there.
    if not unique:
        print("\nREFUSING TO WRITE: zero candidates collected.")
        print("  Every source failed, which means a network problem, not an empty internet.")
        print("  %s was left untouched." % args.out)
        return 1

    if known and len(unique) < len(known) // 2 and not args.force:
        print("\nREFUSING TO WRITE: harvest is suspiciously small.")
        print("  collected %d candidates but the existing feed has %d." % (len(unique), len(known)))
        print("  Most sources probably failed. Re-run, or pass --force if this is expected.")
        print("  %s was left untouched." % args.out)
        return 1

    out_dir = os.path.dirname(os.path.abspath(args.out))
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir)
    if os.path.exists(args.out):
        backup = args.out + ".bak_refresh"
        if not os.path.exists(backup):
            shutil.copyfile(args.out, backup)
            print("\n  backup written: %s" % backup)

    ordered = [unique[ident][0] for ident in unique]
    with io.open(args.out, "w", encoding="utf-8", newline="\n") as handle:
        handle.write("\n".join(ordered) + "\n")
    print("  wrote %d candidates to %s" % (len(ordered), args.out))

    print("\nNext: probe them, since none of this is verified yet.")
    print("  python tools\\triage_ru.py --file %s --limit 150 --workers 3 --timeout 12 --json-out triage4.json"
          % os.path.relpath(args.out, ROOT).replace("/", "\\"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
