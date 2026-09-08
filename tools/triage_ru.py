"""Triage many candidates and report WHY each one fails, with a summary.

The batch prober only counts pass/fail. This tool classifies every failure so
you can tell "the feed is stale" apart from "our harness is broken".

    python tools/triage_ru.py                  # first 40 candidates of sub/all.txt
    python tools/triage_ru.py --limit 200
    python tools/triage_ru.py --file sub/reality.txt --limit 60 --workers 8
    python tools/triage_ru.py --uri "vless://..."   # positive control

Each node gets its own Xray process and its own SOCKS port, so a single bad
node cannot poison the others.
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import verification as v
from service_prober import (
    ROOT_DIR,
    SUB_DIR,
    allocate_free_socks_port,
    get_xray_binary_path,
    prepare_outbound_for_current_xray,
    release_socks_port,
    uri_to_xray_outbound,
    wait_for_ports_ready,
)

PRINT_LOCK = threading.Lock()

# Failure classes, ordered from "our side" to "their side".
UNPARSEABLE = "UNPARSEABLE_URI"          # URI cannot become an Xray outbound
CONFIG_REJECTED = "XRAY_CONFIG_REJECTED"  # Xray refused to start with it
NO_PORT = "SOCKS_PORT_NEVER_BOUND"       # Xray died during startup
OUTBOUND_UNREACHABLE = "NODE_TCP_UNREACHABLE"  # Xray could not reach the server
TLS_EOF = "TLS_REJECTED_EOF"             # server accepted TCP, killed the session
TLS_OTHER = "TLS_ERROR"
TIMEOUT = "TIMEOUT"
BAD_RESPONSE = "UNEXPECTED_RESPONSE"     # reachable but content failed policy
TRANSFER_FAILED = "TRANSFER_INCOMPLETE"  # HTTPS ok, 64 KiB download failed
OK = "VERIFIED"


def classify(exc: BaseException) -> str:
    name = type(exc).__name__
    text = str(exc).lower()
    if "unexpected_eof" in text or "ssleoferror" in text:
        return TLS_EOF
    if "timed out" in text or "timeout" in name.lower():
        return TIMEOUT
    if any(marker in text for marker in (
        "host unreachable", "connection not allowed", "network unreachable",
        "connection refused", "ttl expired", "general socks server failure",
        "connection closed unexpectedly", "remote end closed",
    )):
        return OUTBOUND_UNREACHABLE
    if "ssl" in name.lower() or "ssl" in text:
        return TLS_OTHER
    return name


def load_uris(path: str, limit: int) -> list:
    if not os.path.isfile(path):
        raise SystemExit(f"No such file: {path}")
    with open(path, encoding="utf-8") as handle:
        uris = [line.strip() for line in handle if "://" in line]
    return uris[:limit] if limit > 0 else uris


def probe_one(xray_bin: str, uri: str, timeout: float) -> dict:
    record = {"uri": uri, "outcome": None, "detail": "", "ping_ms": None}
    try:
        outbound = uri_to_xray_outbound(uri, "out")
        # Current Xray renamed the REALITY publicKey field to password, and the
        # batch prober relies on this converter. Skipping it makes every REALITY
        # node fail its handshake, which looks exactly like a dead node.
        outbound = prepare_outbound_for_current_xray(outbound) if outbound else None
        if not outbound:
            record["outcome"] = UNPARSEABLE
            record["detail"] = "rejected by the REALITY field validator"
            return record
    except Exception as exc:
        record["outcome"] = UNPARSEABLE
        record["detail"] = f"{type(exc).__name__}: {exc}"
        return record

    port = allocate_free_socks_port()
    directory = tempfile.mkdtemp(prefix="tp_triage_")
    config_path = os.path.join(directory, "config.json")
    config = {
        "log": {"loglevel": "warning"},
        "inbounds": [{
            "tag": "in", "listen": "127.0.0.1", "port": port, "protocol": "socks",
            "settings": {"udp": True, "auth": "noauth"},
        }],
        "outbounds": [{"tag": "blocked", "protocol": "blackhole"}, outbound],
        "routing": {"rules": [{"type": "field", "inboundTag": ["in"], "outboundTag": "out"}]},
    }
    with open(config_path, "w", encoding="utf-8") as handle:
        json.dump(config, handle)

    process = None
    try:
        process = subprocess.Popen(
            [xray_bin, "run", "-c", config_path],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
        )
        if wait_for_ports_ready([port]):
            record["outcome"] = NO_PORT if process.poll() is None else CONFIG_REJECTED
            process.terminate()
            try:
                record["detail"] = (process.communicate(timeout=5)[0] or "").strip()[-200:]
            except Exception:
                pass
            return record

        deadline = time.monotonic() + max(20.0, timeout * 8)
        accepted = 0
        failures = []
        for url, kind in v.ENDPOINTS:
            try:
                with v.make_session(port) as session:
                    status, body = v.read_response(session, url, deadline, timeout, 16384)
                if v.valid_response(kind, status, body):
                    accepted += 1
                else:
                    failures.append(f"{BAD_RESPONSE}(status={status},bytes={len(body)})")
            except Exception as exc:
                failures.append(classify(exc))

        if accepted < 2:
            counts = collections.Counter(failures)
            record["outcome"] = counts.most_common(1)[0][0].split("(")[0] if counts else BAD_RESPONSE
            record["detail"] = ", ".join(f"{k}x{n}" for k, n in counts.items())
            return record

        result = v.measure_tunnel(port, timeout=timeout)
        if result:
            record["outcome"] = OK
            record["ping_ms"] = result.get("ping_ms") if isinstance(result, dict) else None
            record["detail"] = json.dumps(result)[:200]
        else:
            record["outcome"] = TRANSFER_FAILED
            record["detail"] = f"{accepted}/3 HTTPS accepted, strict policy still refused"
        return record
    except Exception as exc:
        record["outcome"] = classify(exc)
        record["detail"] = f"{type(exc).__name__}: {exc}"
        return record
    finally:
        if process is not None and process.poll() is None:
            process.kill()
        release_socks_port(port)
        shutil.rmtree(directory, ignore_errors=True)


MARKDOWN_LINK = re.compile(r"\[([^\]]*)\]\((?:[^)]*)\)")


def clean_markdown_uri(uri: str) -> tuple[str, bool]:
    """Undoes chat/markdown auto-linking inside a pasted URI.

    Chat clients turn `&sni=example.com&` into `&[sni=example.com](http://...)&`.
    That renames the query key to `[sni`, so the real `sni` disappears and the
    Reality handshake ends up using the bare IP as its server name, which any
    sane server answers with silence. Unwrap `[text](url)` back to `text`.
    """
    cleaned = MARKDOWN_LINK.sub(lambda match: match.group(1), uri.strip())
    cleaned = cleaned.strip("<>\u201c\u201d\u2018\u2019")
    return cleaned, cleaned != uri.strip()


def describe_uri(uri: str) -> str:
    """Summarizes the parameters that actually reach Xray, for --uri runs."""
    try:
        outbound = prepare_outbound_for_current_xray(uri_to_xray_outbound(uri, "out"))
        if not outbound:
            return "  effective config: rejected before Xray"
        stream = outbound.get("streamSettings", {})
        reality = stream.get("realitySettings") or {}
        tls = stream.get("tlsSettings") or {}
        user = outbound.get("settings", {}).get("vnext", [{}])[0].get("users", [{}])[0]
        return (
            f"  effective: network={stream.get('network')!r} security={stream.get('security')!r} "
            f"sni={(reality.get('serverName') or tls.get('serverName'))!r} "
            f"flow={user.get('flow')!r} shortId={reality.get('shortId')!r}"
        )
    except Exception as exc:
        return f"  effective config: {type(exc).__name__}: {exc}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", default=os.path.join(SUB_DIR, "all.txt"))
    parser.add_argument("--limit", type=int, default=40)
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--timeout", type=float, default=6.0)
    parser.add_argument("--uri", action="append", default=[],
                        help="Probe explicit URIs instead of a file (repeatable).")
    parser.add_argument("--json-out", default="")
    args = parser.parse_args()

    xray_bin = get_xray_binary_path()
    if not xray_bin:
        print("Xray is unavailable; nothing can be verified.")
        return 2
    print(f"Xray: {xray_bin}")

    if args.uri:
        uris = []
        for candidate in args.uri:
            cleaned, repaired = clean_markdown_uri(candidate)
            if "://" not in cleaned:
                continue
            if repaired:
                print("! The URI contained markdown auto-linking and was repaired.")
                print("  Copy URIs from a plain-text source; chat apps corrupt query parameters.")
                print(f"  using: {cleaned[:160]}")
            uris.append(cleaned)
        print(f"Probing {len(uris)} explicit URI(s)")
        for candidate in uris:
            print(describe_uri(candidate))
    else:
        path = args.file if os.path.isabs(args.file) else os.path.join(ROOT_DIR, args.file)
        uris = load_uris(path, args.limit)
        print(f"Probing {len(uris)} candidate(s) from {path}")
    if not uris:
        print("Nothing to probe.")
        return 2

    print(f"Workers: {args.workers}, per-request timeout: {args.timeout}s\n")
    started = time.monotonic()
    records = []
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = {pool.submit(probe_one, xray_bin, uri, args.timeout): uri for uri in uris}
        for index, future in enumerate(as_completed(futures), start=1):
            record = future.result()
            records.append(record)
            host = record["uri"].split("@")[-1].split("?")[0][:34]
            with PRINT_LOCK:
                print(f"[{index:>3}/{len(uris)}] {record['outcome']:<24} {host:<34} {record['detail'][:90]}")

    counts = collections.Counter(record["outcome"] for record in records)
    print(f"\n== Summary ({round(time.monotonic() - started, 1)}s) ==")
    for outcome, total in counts.most_common():
        print(f"  {total:>4}  {round(100 * total / len(records)):>3}%  {outcome}")

    verified = [record for record in records if record["outcome"] == OK]
    print(f"\n== Verified nodes: {len(verified)}/{len(records)} ==")
    for record in sorted(verified, key=lambda r: r["ping_ms"] or 1e9):
        print(f"  {record['ping_ms']}ms  {record['uri'][:120]}")

    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as handle:
            json.dump(records, handle, ensure_ascii=False, indent=1)
        print(f"\nWrote {args.json_out}")

    print("\nHow to read this:")
    print(f"  {TLS_EOF:<26} server killed the session: wrong Reality keys or a dead/expired node")
    print(f"  {OUTBOUND_UNREACHABLE:<26} the server itself is not reachable from your ISP")
    print(f"  {TIMEOUT:<26} node is too slow or silently dropped, common under RU throttling")
    print(f"  {UNPARSEABLE:<26} the feed line is malformed; that is an aggregator bug")
    print(f"  {CONFIG_REJECTED:<26} our generated config is wrong; that is our bug")
    return 0


if __name__ == "__main__":
    sys.exit(main())
