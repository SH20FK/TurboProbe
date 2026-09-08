"""Diagnostics for a single node: shows the real reason a tunnel check fails.

Unlike the batch prober, this prints Xray's own log and every HTTPS error
instead of counting a node as failed. Run from the repository root:

    python tools/diagnose_ru.py            # first candidate
    python tools/diagnose_ru.py 3          # 4th candidate
    python tools/diagnose_ru.py "vless://..."
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import requests

import verification as v
from service_prober import (
    SUB_DIR,
    allocate_free_socks_port,
    get_xray_binary_path,
    prepare_outbound_for_current_xray,
    run_xray_config_test,
    uri_to_xray_outbound,
    wait_for_ports_ready,
)


def load_candidate(argument: str | None) -> str:
    if argument and "://" in argument:
        return argument.strip()
    index = int(argument) if argument else 0
    for name in ("all.txt", "top50.txt", "top20.txt", "reality.txt", "anti-whitelist.txt"):
        path = os.path.join(SUB_DIR, name)
        if not os.path.isfile(path):
            continue
        with open(path, encoding="utf-8") as handle:
            uris = [line.strip() for line in handle if "://" in line]
        if len(uris) > index:
            print(f"Candidate #{index} from sub/{name}")
            return uris[index]
    raise SystemExit("No candidate found. Pass a node URI as the argument.")


def check_direct_reachability() -> None:
    print("\n== Direct reachability (no tunnel), for context only ==")
    for url, _ in v.ENDPOINTS + (("https://speed.cloudflare.com/__down?bytes=1024", "transfer"),):
        session = requests.Session()
        session.trust_env = False
        try:
            response = session.get(url, timeout=6, allow_redirects=False)
            print(f"  OK   {response.status_code} {len(response.content):>6}B  {url}")
        except Exception as exc:
            print(f"  FAIL {type(exc).__name__}: {str(exc)[:120]}  {url}")
        finally:
            session.close()


def main() -> int:
    uri = load_candidate(sys.argv[1] if len(sys.argv) > 1 else None)
    print(f"Node: {uri[:110]}")

    xray_bin = get_xray_binary_path()
    print(f"\n== Xray ==\n  path: {xray_bin or 'NOT FOUND'}")
    if not xray_bin:
        print("  Xray is unavailable, so no tunnel can be verified.")
        return 2
    try:
        version = subprocess.run([xray_bin, "version"], capture_output=True, text=True, timeout=15)
        print(f"  version: {version.stdout.strip().splitlines()[0] if version.stdout.strip() else version.stderr.strip()[:200]}")
    except Exception as exc:
        print(f"  version check failed: {exc}")

    try:
        outbound = uri_to_xray_outbound(uri, "out")
        # Current Xray renamed the REALITY publicKey field to password. Without
        # this converter every REALITY node fails its handshake, which is
        # indistinguishable from a dead node.
        prepared = prepare_outbound_for_current_xray(outbound) if outbound else None
        if not prepared:
            print("\nThe REALITY field validator rejected this node (bad public key or short id).")
            return 2
        outbound = prepared
    except Exception as exc:
        print(f"\nURI could not be converted into an Xray outbound: {type(exc).__name__}: {exc}")
        return 2
    print("\n== Outbound sent to Xray ==")
    print(json.dumps(outbound.get("streamSettings", {}), indent=1)[:900])
    print(f"  vless flow: {outbound.get('settings', {}).get('vnext', [{}])[0].get('users', [{}])[0].get('flow', 'n/a')!r}")

    port = allocate_free_socks_port()
    config = {
        # Debug level is essential here: REALITY handshake failures are logged
        # at info/debug, so "warning" hides the very reason we are looking for.
        "log": {"loglevel": "debug"},
        "inbounds": [{
            "tag": "in", "listen": "127.0.0.1", "port": port, "protocol": "socks",
            "settings": {"udp": True, "auth": "noauth"},
        }],
        "outbounds": [{"tag": "blocked", "protocol": "blackhole"}, outbound],
        "routing": {"rules": [{"type": "field", "inboundTag": ["in"], "outboundTag": "out"}]},
    }
    directory = tempfile.mkdtemp(prefix="tp_diag_")
    config_path = os.path.join(directory, "config.json")
    with open(config_path, "w", encoding="utf-8") as handle:
        json.dump(config, handle, indent=1)
    print(f"\n== Config ==\n  {config_path}\n  SOCKS port: {port}")

    code, output = run_xray_config_test(xray_bin, config_path)
    print(f"  validator exit {code}: {output[:600] or 'no output'}")
    if code != 0:
        print("\nXray rejected this configuration, so the node was never contacted.")
        return 2

    process = subprocess.Popen(
        [xray_bin, "run", "-c", config_path],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    try:
        pending = wait_for_ports_ready([port])
        print(f"\n== Startup ==\n  port bound: {'no' if pending else 'yes'}")
        if pending:
            time.sleep(0.5)
            process.terminate()
            print(f"  Xray output:\n{process.communicate(timeout=10)[0][:1500]}")
            return 2

        print("\n== HTTPS checks through the tunnel ==")
        deadline = time.monotonic() + 60
        successes = 0
        for url, kind in v.ENDPOINTS:
            start = time.monotonic()
            try:
                with v.make_session(port) as session:
                    status, body = v.read_response(session, url, deadline, 8.0, 16384)
                elapsed = round((time.monotonic() - start) * 1000)
                accepted = v.valid_response(kind, status, body)
                successes += accepted
                print(f"  {'PASS' if accepted else 'REJECT'} {status} {len(body):>6}B {elapsed:>5}ms  {url}")
                if kind == "trace" and body:
                    fields = dict(l.split("=", 1) for l in body.decode(errors="replace").splitlines() if "=" in l)
                    print(f"         exit country={fields.get('loc')} tls={fields.get('tls')} ip={fields.get('ip')}")
                elif not accepted and body:
                    print(f"         body starts: {body[:100]!r}")
            except Exception as exc:
                print(f"  ERROR {type(exc).__name__}: {str(exc)[:160]}  {url}")
        print(f"  {successes}/3 accepted (2 required)")

        print("\n== 64 KiB transfer through the tunnel ==")
        start = time.monotonic()
        try:
            with v.make_session(port) as session:
                status, body = v.read_response(
                    session, "https://speed.cloudflare.com/__down?bytes=" + str(v.TRANSFER_BYTES),
                    deadline, 8.0, v.TRANSFER_BYTES,
                )
            seconds = max(time.monotonic() - start, 0.001)
            complete = status == 200 and len(body) == v.TRANSFER_BYTES
            print(f"  {'PASS' if complete else 'FAIL'} status={status} bytes={len(body)}/{v.TRANSFER_BYTES}"
                  f" {round(v.TRANSFER_BYTES * 8 / 1_000_000 / seconds, 2)} Mbps")
        except Exception as exc:
            print(f"  ERROR {type(exc).__name__}: {str(exc)[:200]}")

        result = v.measure_tunnel(port, timeout=8.0)
        print(f"\n== Verdict ==\n  {'VERIFIED: ' + json.dumps(result) if result else 'NOT verified by the strict policy'}")

        process.terminate()
        logs = process.communicate(timeout=10)[0]
        interesting = [
            line for line in logs.splitlines()
            if any(word in line.lower() for word in (
                "reality", "handshake", "failed", "error", "refused", "reset",
                "timeout", "eof", "rejected", "invalid",
            ))
        ]
        if interesting:
            print("\n== Xray log: failure lines ==")
            for line in interesting[:40]:
                print(f"  {line[:220]}")
        print(f"\n== Xray log (full) ==\n{logs[:6000] or '  (empty)'}")
    finally:
        if process.poll() is None:
            process.kill()

    check_direct_reachability()
    return 0


if __name__ == "__main__":
    sys.exit(main())
