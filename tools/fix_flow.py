"""Applies the XTLS Vision flow fix to tools/service_prober.py. No git needed.

    python tools/fix_flow.py

Safe to run twice: it detects an already-fixed file and does nothing.
"""
from __future__ import annotations

import os
import sys

OLD = (
    '        flow = query.get("flow", [""])[0]\n'
    '        if flow and not (security in ("tls", "reality") and net_type == "tcp"):\n'
    '            flow = ""\n'
)

NEW = (
    '        flow = query.get("flow", [""])[0]\n'
    '        # XTLS Vision is valid on the raw transport, which Xray renamed from\n'
    '        # "tcp" to "raw". Accepting only "tcp" silently dropped the flow for\n'
    '        # every type=raw REALITY node, so the server rejected our handshake.\n'
    '        if flow and not (security in ("tls", "reality") and net_type in ("tcp", "raw")):\n'
    '            flow = ""\n'
)


def main() -> int:
    target = os.path.join(os.path.dirname(os.path.abspath(__file__)), "service_prober.py")
    if not os.path.isfile(target):
        print(f"Not found: {target}")
        return 2

    with open(target, encoding="utf-8") as handle:
        source = handle.read()

    if NEW in source:
        print("Already fixed; nothing to do.")
        return 0

    if source.count(OLD) != 1:
        print(f"Expected the original line exactly once, found {source.count(OLD)}.")
        print("Edit it by hand instead: in parse_vless_uri, change")
        print('  net_type == "tcp"   ->   net_type in ("tcp", "raw")')
        return 2

    backup = target + ".bak"
    with open(backup, "w", encoding="utf-8") as handle:
        handle.write(source)

    with open(target, "w", encoding="utf-8") as handle:
        handle.write(source.replace(OLD, NEW))

    print(f"Patched {target}")
    print(f"Backup  {backup}")

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        from service_prober import uri_to_xray_outbound
        probe = (
            "vless://f9c9fac6-48cc-46b0-af2c-d175718b7cdf@127.0.0.1:443"
            "?encryption=none&flow=xtls-rprx-vision&fp=qq"
            "&pbk=lh3qj3VX335HGH2T3xQ8RHZ4v3zEStbz6ENiPwkILSg"
            "&security=reality&sid=cf43c0c197cd464a&sni=example.com&type=raw"
        )
        flow = uri_to_xray_outbound(probe, "out")["settings"]["vnext"][0]["users"][0]["flow"]
        print(f"Self-check: type=raw node now keeps flow={flow!r}")
        return 0 if flow == "xtls-rprx-vision" else 2
    except Exception as exc:
        print(f"Self-check could not run: {type(exc).__name__}: {exc}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
