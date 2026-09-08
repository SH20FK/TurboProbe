#!/usr/bin/env python3
"""Feed hygiene: deduplicate, reject malformed lines, quarantine stale history.

Why this exists
---------------
The RU triage runs showed 0 verified nodes out of 150 while an external control
node verified fine from the same machine with the same settings. Two structural
problems make that worse than it needs to be:

1. sub/all.txt carries the same endpoint many times over, so a probe budget is
   spent re-testing identical dead servers instead of covering new ones.
2. node_history.json records tens of thousands of "successes" that were
   produced by the old fail-open verification. Those successes did not prove a
   working tunnel, so any ranking built on them is fiction.

By default this script only reports. Nothing is written unless you pass --apply
or --quarantine-history.

Usage
-----
  python tools\\feed_hygiene.py                        # report only
  python tools\\feed_hygiene.py --apply                # rewrite the feed file
  python tools\\feed_hygiene.py --quarantine-history   # distrust old successes
"""
import argparse
import collections
import datetime
import io
import json
import os
import shutil
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEFAULT_FEED = os.path.join(ROOT, "sub", "all.txt")
HISTORY = os.path.join(HERE, "node_history.json")

# The strict tunnel-verification policy landed on this date. Successes recorded
# before it came from the fail-open checker and cannot be trusted.
DEFAULT_EPOCH = "2026-09-08T00:00:00+00:00"

SUPPORTED_SCHEMES = ("vless", "trojan", "ss", "vmess", "hysteria2", "hy2", "tuic")


def parse_endpoint(uri):
    """Return (scheme, credential, host, port) or None when unusable.

    urllib is used rather than string splitting because credentials and paths
    legitimately contain '@' and '?' characters.
    """
    text = uri.strip()
    if not text or text.startswith("#"):
        return None
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
    if not host or not port:
        return None
    if not (0 < int(port) < 65536):
        return None
    credential = (parsed.username or "").strip()
    return (scheme, credential, str(host).strip().lower(), int(port))


def load_lines(path):
    with io.open(path, encoding="utf-8", errors="replace") as handle:
        return [line.rstrip("\n").rstrip("\r") for line in handle]


def analyse(lines):
    kept = []
    malformed = []
    duplicates = []
    seen = {}
    endpoints = collections.Counter()

    for index, line in enumerate(lines, 1):
        if not line.strip():
            continue
        parsed = parse_endpoint(line)
        if parsed is None:
            malformed.append((index, line))
            continue
        scheme, credential, host, port = parsed
        endpoints["%s:%d" % (host, port)] += 1
        # Identity is the full credential pair: the same server can legitimately
        # host several distinct accounts.
        key = (scheme, credential, host, port)
        if key in seen:
            duplicates.append((index, line, seen[key]))
            continue
        seen[key] = index
        kept.append(line)

    return kept, malformed, duplicates, endpoints


def parse_iso(value):
    if not value:
        return None
    text = str(value).strip().replace("Z", "+00:00")
    try:
        stamp = datetime.datetime.fromisoformat(text)
    except ValueError:
        return None
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=datetime.timezone.utc)
    return stamp


def quarantine_history(path, epoch, apply_changes):
    if not os.path.exists(path):
        print("history file not found: %s" % path)
        return
    with io.open(path, encoding="utf-8") as handle:
        history = json.load(handle)
    if not isinstance(history, dict):
        print("unexpected history shape: %s" % type(history).__name__)
        return

    cutoff = parse_iso(epoch)
    touched = 0
    cleared_successes = 0
    cleared_deep = 0
    trusted = 0

    for key, record in history.items():
        if not isinstance(record, dict):
            continue
        alive_at = parse_iso(record.get("last_seen_alive"))
        deep_at = parse_iso(record.get("deep_checked_at"))
        newest = max([stamp for stamp in (alive_at, deep_at) if stamp], default=None)
        if newest and cutoff and newest >= cutoff:
            trusted += 1
            continue

        successes = int(record.get("success_checks") or 0)
        has_deep = record.get("deep_alive") is not None
        if not successes and not has_deep:
            continue

        touched += 1
        if successes:
            cleared_successes += successes
            record["untrusted_successes"] = successes
            record["success_checks"] = 0
        if has_deep:
            cleared_deep += 1
            record["untrusted_deep_alive"] = record.get("deep_alive")
            record["deep_alive"] = None
        record["quarantined_by"] = "feed_hygiene"
        record["quarantine_reason"] = "success predates strict tunnel-https-v1 policy"

    print("\n== history quarantine ==")
    print("  policy epoch:            %s" % epoch)
    print("  entries total:           %d" % len(history))
    print("  entries kept as trusted: %d" % trusted)
    print("  entries quarantined:     %d" % touched)
    print("  success records voided:  %d" % cleared_successes)
    print("  deep_alive flags voided: %d" % cleared_deep)

    if not apply_changes:
        print("  (report only; pass --quarantine-history to write)")
        return

    backup = path + ".bak_hygiene"
    if not os.path.exists(backup):
        shutil.copyfile(path, backup)
        print("  backup written: %s" % backup)
    with io.open(path, "w", encoding="utf-8") as handle:
        json.dump(history, handle, ensure_ascii=False, indent=1)
    print("  updated: %s" % path)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--file", default=DEFAULT_FEED, help="feed file to inspect")
    parser.add_argument("--apply", action="store_true", help="rewrite the feed without duplicates and malformed lines")
    parser.add_argument("--quarantine-history", action="store_true", help="void pre-policy successes in node_history.json")
    parser.add_argument("--epoch", default=DEFAULT_EPOCH, help="strict policy start timestamp (ISO-8601)")
    parser.add_argument("--show", type=int, default=10, help="how many example lines to print")
    args = parser.parse_args()

    if not os.path.exists(args.file):
        print("feed not found: %s" % args.file)
        return 2

    lines = load_lines(args.file)
    kept, malformed, duplicates, endpoints = analyse(lines)
    non_empty = len([line for line in lines if line.strip()])

    print("== feed hygiene: %s ==" % args.file)
    print("  non-empty lines:      %d" % non_empty)
    print("  unique node identity: %d" % len(kept))
    print("  exact duplicates:     %d" % len(duplicates))
    print("  malformed / skipped:  %d" % len(malformed))
    print("  distinct endpoints:   %d" % len(endpoints))
    if endpoints:
        redundancy = float(non_empty) / max(1, len(endpoints))
        print("  lines per endpoint:   %.2f" % redundancy)

    if malformed:
        print("\n  malformed examples:")
        for index, line in malformed[: args.show]:
            print("    line %-5d %s" % (index, line[:110]))

    if duplicates:
        print("\n  duplicate examples (line -> first occurrence):")
        for index, line, first in duplicates[: args.show]:
            print("    %-5d -> %-5d %s" % (index, first, line[:90]))

    if endpoints:
        print("\n  most repeated endpoints:")
        for endpoint, count in endpoints.most_common(args.show):
            if count < 2:
                break
            print("    %3d x %s" % (count, endpoint))

    if args.apply:
        removed = non_empty - len(kept)
        backup = args.file + ".bak_hygiene"
        if not os.path.exists(backup):
            shutil.copyfile(args.file, backup)
            print("\n  backup written: %s" % backup)
        with io.open(args.file, "w", encoding="utf-8", newline="\n") as handle:
            handle.write("\n".join(kept) + "\n")
        print("  rewrote %s: %d lines kept, %d removed" % (args.file, len(kept), removed))
    else:
        print("\n  (report only; pass --apply to rewrite the feed)")

    if args.quarantine_history:
        quarantine_history(HISTORY, args.epoch, True)
    else:
        quarantine_history(HISTORY, args.epoch, False)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
