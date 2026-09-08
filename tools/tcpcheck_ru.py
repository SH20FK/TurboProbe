"""Raw TCP + TLS reachability check WITHOUT Xray.

This separates two very different causes of failure:
  * the server is unreachable from your ISP (TCP never completes)
  * the server is reachable and even speaks TLS, but rejects our session
    (then the credentials in the feed are stale, or our config is wrong)

    python tools/tcpcheck_ru.py --limit 150
    python tools/tcpcheck_ru.py --file sub/reality.txt --limit 100 --workers 40

No proxy, no Xray, no tunnel: just sockets. Fast (seconds, not minutes).
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import socket
import ssl
import sys
import threading
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from service_prober import (
    ROOT_DIR,
    SUB_DIR,
    _uri_expects_tls,
    _uri_tls_sni_hint,
    parse_host_and_port,
)

PRINT_LOCK = threading.Lock()

TCP_OK = "TCP_OK"
TCP_TIMEOUT = "TCP_TIMEOUT"
TCP_REFUSED = "TCP_REFUSED"
TCP_RESET = "TCP_RESET"
TCP_DNS_FAIL = "TCP_DNS_FAIL"
TCP_ERROR = "TCP_ERROR"


def classify_socket_error(exc: BaseException) -> str:
    if isinstance(exc, socket.timeout):
        return TCP_TIMEOUT
    if isinstance(exc, socket.gaierror):
        return TCP_DNS_FAIL
    text = str(exc).lower()
    errno = getattr(exc, "errno", None)
    if errno in (10061, 111) or "refused" in text or "\u043e\u0442\u0432\u0435\u0440\u0433" in text:
        return TCP_REFUSED
    if errno in (10054, 104) or "reset" in text or "\u0441\u0431\u0440\u043e\u0448\u0435\u043d" in text:
        return TCP_RESET
    if errno in (10060, 110) or "timed out" in text:
        return TCP_TIMEOUT
    return TCP_ERROR


def check_endpoint(uri: str, timeout: float) -> dict:
    host, port, _ = parse_host_and_port(uri)
    record = {
        "uri": uri, "host": host, "port": port,
        "tcp": None, "tcp_ms": None, "tls": "skipped", "tls_detail": "",
    }
    if not host:
        record["tcp"] = TCP_ERROR
        record["tls_detail"] = "could not parse host from URI"
        return record

    started = time.monotonic()
    sock = None
    try:
        sock = socket.create_connection((host, port), timeout=timeout)
        record["tcp"] = TCP_OK
        record["tcp_ms"] = round((time.monotonic() - started) * 1000)
    except Exception as exc:
        record["tcp"] = classify_socket_error(exc)
        record["tcp_ms"] = round((time.monotonic() - started) * 1000)
        record["tls_detail"] = f"{type(exc).__name__}: {str(exc)[:90]}"
        return record

    try:
        parsed = urllib.parse.urlparse(uri)
        proto = (parsed.scheme or "").lower()
        if not _uri_expects_tls(uri, proto, parsed):
            return record
        sni = _uri_tls_sni_hint(uri, parsed) or host
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        sock.settimeout(timeout)
        handshake_started = time.monotonic()
        with context.wrap_socket(sock, server_hostname=sni) as tls_sock:
            sock = None
            certificate = tls_sock.getpeercert(binary_form=False) or {}
            issuer = ""
            for part in certificate.get("issuer", ()):  # tuple of tuples
                for key, value in part:
                    if key in ("organizationName", "commonName"):
                        issuer = value
                        break
                if issuer:
                    break
            record["tls"] = "TLS_OK"
            record["tls_detail"] = (
                f"{tls_sock.version()} sni={sni} issuer={issuer or 'n/a'} "
                f"{round((time.monotonic() - handshake_started) * 1000)}ms"
            )
    except Exception as exc:
        record["tls"] = "TLS_FAIL"
        record["tls_detail"] = f"{type(exc).__name__}: {str(exc)[:90]}"
    finally:
        if sock is not None:
            try:
                sock.close()
            except Exception:
                pass
    return record


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", default=os.path.join(SUB_DIR, "all.txt"))
    parser.add_argument("--limit", type=int, default=150)
    parser.add_argument("--workers", type=int, default=40)
    parser.add_argument("--timeout", type=float, default=5.0)
    parser.add_argument("--json-out", default="")
    args = parser.parse_args()

    path = args.file if os.path.isabs(args.file) else os.path.join(ROOT_DIR, args.file)
    if not os.path.isfile(path):
        raise SystemExit(f"No such file: {path}")
    with open(path, encoding="utf-8") as handle:
        uris = [line.strip() for line in handle if "://" in line]
    if args.limit > 0:
        uris = uris[: args.limit]
    if not uris:
        print("Nothing to check.")
        return 2

    print(f"Checking {len(uris)} endpoint(s) from {path}")
    print(f"No Xray, no proxy: plain TCP connect + optional TLS handshake, timeout {args.timeout}s\n")

    started = time.monotonic()
    records = []
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = [pool.submit(check_endpoint, uri, args.timeout) for uri in uris]
        for index, future in enumerate(as_completed(futures), start=1):
            record = future.result()
            records.append(record)
            with PRINT_LOCK:
                print(f"[{index:>3}/{len(uris)}] {record['tcp']:<12} {str(record['tcp_ms']) + 'ms':>8}"
                      f"  {record['host'] + ':' + str(record['port']):<26} {record['tls']:<8} {record['tls_detail'][:70]}")

    tcp_counts = collections.Counter(record["tcp"] for record in records)
    print(f"\n== TCP summary ({round(time.monotonic() - started, 1)}s) ==")
    for outcome, total in tcp_counts.most_common():
        print(f"  {total:>4}  {round(100 * total / len(records)):>3}%  {outcome}")

    reachable = [record for record in records if record["tcp"] == TCP_OK]
    tls_counts = collections.Counter(record["tls"] for record in reachable)
    print(f"\n== TLS summary for the {len(reachable)} reachable endpoint(s) ==")
    for outcome, total in tls_counts.most_common():
        print(f"  {total:>4}  {outcome}")

    tls_ok = [record for record in reachable if record["tls"] == "TLS_OK"]
    if tls_ok:
        print(f"\n== Alive servers that completed a TLS handshake: {len(tls_ok)} ==")
        for record in sorted(tls_ok, key=lambda r: r["tcp_ms"] or 0)[:40]:
            print(f"  {record['tcp_ms']:>5}ms  {record['host']}:{record['port']}  {record['tls_detail'][:80]}")

    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as handle:
            json.dump(records, handle, ensure_ascii=False, indent=1)
        print(f"\nWrote {args.json_out}")

    print("\nHow to read this against the triage run:")
    print("  Mostly TCP_TIMEOUT        -> your ISP/DPI is dropping these servers, or they are gone.")
    print("                               A 0-verified result is then the honest answer.")
    print("  Many TCP_OK + TLS_OK but  -> the servers are alive; the feed's keys/UUIDs are stale")
    print("  0 verified in triage         or our outbound config is wrong. That is worth fixing.")
    print("  Many TCP_REFUSED          -> the port is closed: the node was decommissioned.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
