#!/usr/bin/env python3
"""Idempotent fixup: make URI query-parameter parsing case-insensitive.

The URI parsers in service_prober.py read query parameters with exact case,
e.g. query.get("headerType"). Real-world feed lines use "headertype",
"allowinsecure", "Host", "packetencoding" and similar spellings. Those nodes
silently lose their transport settings and can never verify.

This script inserts a canonicalisation helper and wraps every
urllib.parse.parse_qs(parsed.query) call with it. Running it twice is safe.

Usage:  python tools\\fix_query_case.py
"""
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, "service_prober.py")

HELPER_MARKER = "def canonicalize_query_keys("

HELPER = '''
# --- canonical query-key handling (case-insensitive URI params) ---
# Feeds spell parameters inconsistently: headertype, allowinsecure, Host,
# packetencoding. The parsers below look up exact camelCase names, so without
# this normalisation those nodes lose their transport settings entirely.
CANONICAL_QUERY_KEYS = {
    "type": "type",
    "security": "security",
    "encryption": "encryption",
    "flow": "flow",
    "sni": "sni",
    "fp": "fp",
    "pbk": "pbk",
    "sid": "sid",
    "spx": "spx",
    "alpn": "alpn",
    "host": "host",
    "path": "path",
    "mode": "mode",
    "seed": "seed",
    "extra": "extra",
    "key": "key",
    "headertype": "headerType",
    "servicename": "serviceName",
    "quicsecurity": "quicSecurity",
    "allowinsecure": "allowInsecure",
    "allow_insecure": "allowInsecure",
    "insecure": "insecure",
    "packetencoding": "packetEncoding",
    "packet-encoding": "packetEncoding",
    "mldsa65verify": "mldsa65Verify",
    "pinnedpeercertsha256": "pinnedPeerCertSha256",
    "pin": "pin",
    "verifypeercertbyname": "verifyPeerCertByName",
    "vpcn": "vpcn",
    "ech": "ech",
    "obfs": "obfs",
    "obfs-password": "obfs-password",
    "auth": "auth",
    "peer": "peer",
    "congestion_control": "congestion_control",
    "udp_relay_mode": "udp_relay_mode",
}


def canonicalize_query_keys(query):
    """Add canonical camelCase aliases for case-variant query keys.

    Original keys are preserved; aliases are only added when the canonical
    spelling is absent, so an explicit correct value always wins.
    """
    if not isinstance(query, dict):
        return query
    for raw_key in list(query.keys()):
        lowered = str(raw_key).strip().lower()
        # Strip HTML-escaped separators such as "amp;type".
        if lowered.startswith("amp;"):
            lowered = lowered[4:]
        canonical = CANONICAL_QUERY_KEYS.get(lowered)
        if not canonical or canonical == raw_key:
            continue
        if canonical not in query and query.get(raw_key):
            query[canonical] = query[raw_key]
    return query

'''

OLD_CALL = "urllib.parse.parse_qs(parsed.query)"
NEW_CALL = "canonicalize_query_keys(urllib.parse.parse_qs(parsed.query))"


def main():
    if not os.path.exists(TARGET):
        print("ERROR: not found: %s" % TARGET)
        print("Run this from the repository root: python tools\\fix_query_case.py")
        return 2

    with io.open(TARGET, encoding="utf-8") as handle:
        src = handle.read()

    already_helper = HELPER_MARKER in src
    remaining = src.count(OLD_CALL) - src.count(NEW_CALL)

    if already_helper and remaining <= 0:
        print("Already fixed; nothing to do.")
        return 0

    updated = src

    if not already_helper:
        # Insert the helper just before the first URI parser that needs it.
        anchor = re.search(r"^def parse_vless_uri\(", updated, re.MULTILINE)
        if not anchor:
            anchor = re.search(r"^def normalize_stream_security\(", updated, re.MULTILINE)
        if not anchor:
            print("ERROR: could not find an insertion point in service_prober.py")
            return 3
        at = anchor.start()
        updated = updated[:at] + HELPER.lstrip("\n") + "\n" + updated[at:]

    # Wrap the raw parse_qs calls, without double-wrapping.
    parts = updated.split(NEW_CALL)
    parts = [part.replace(OLD_CALL, NEW_CALL) for part in parts]
    updated = NEW_CALL.join(parts)

    if updated == src:
        print("Nothing changed; the file may have been modified already.")
        return 0

    backup = TARGET + ".bak_querycase"
    if not os.path.exists(backup):
        with io.open(backup, "w", encoding="utf-8", newline="") as handle:
            handle.write(src)
        print("Backup written: %s" % backup)

    with io.open(TARGET, "w", encoding="utf-8", newline="") as handle:
        handle.write(updated)

    print("Patched %s" % TARGET)
    print("  wrapped parse_qs call sites: %d" % updated.count(NEW_CALL))

    # Self-check: a lowercase headertype must now reach the parser.
    sys.path.insert(0, HERE)
    for stale in ("service_prober",):
        sys.modules.pop(stale, None)
    try:
        import service_prober  # noqa: E402
    except Exception as exc:  # pragma: no cover
        print("WARNING: self-check import failed: %r" % (exc,))
        return 0

    probe = (
        "vless://11111111-2222-3333-4444-555555555555@example.com:443"
        "?type=tcp&security=tls&headertype=http&Host=cdn.example.com"
    )
    try:
        outbound = service_prober.parse_vless_uri(probe, "out")
    except Exception as exc:
        print("WARNING: self-check parse failed: %r" % (exc,))
        return 0

    stream = (outbound or {}).get("streamSettings", {})
    header = (
        stream.get("tcpSettings", {})
        .get("header", {})
        .get("type")
    )
    if header == "http":
        print("Self-check: lowercase 'headertype=http' is now honoured.")
    else:
        print("Self-check: header type resolved to %r (inspect manually)." % (header,))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
