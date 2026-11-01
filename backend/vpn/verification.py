"""Strict tunnel verification policy. No TCP/DNS-only success, no synthetic latency."""
from __future__ import annotations

import hashlib
import ipaddress
import json
import math
import os
import statistics
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

POLICY = "tunnel-https-v1"
RU_VANTAGE = "ru-chelyabinsk-intersvyaz"
MAX_AGE_SECONDS = 3600
TRANSFER_BYTES = 65536
ENDPOINTS = (
    ("https://www.gstatic.com/generate_204", "empty204"),
    ("https://connectivitycheck.platform.hicloud.com/generate_204", "empty204"),
    ("https://www.cloudflare.com/cdn-cgi/trace", "trace"),
)


def node_id(uri: str) -> str:
    # Credentials, public keys, transport, SNI, path and port all matter.
    # Deliberately do not lowercase credentials or discard query parameters.
    return hashlib.sha256(uri.strip().split("#", 1)[0].encode()).hexdigest()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def fresh(timestamp, now=None, max_age=MAX_AGE_SECONDS):
    try:
        dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            return False
        age = ((now or utcnow()) - dt).total_seconds()
        return 0 <= age <= max_age
    except (ValueError, TypeError, AttributeError):
        return False


def make_session(port):
    if not isinstance(port, int) or not 1 <= port <= 65535:
        raise ValueError("A local SOCKS port is required")
    session = requests.Session()
    session.trust_env = False
    proxy = f"socks5h://127.0.0.1:{port}"
    session.proxies = {"http": proxy, "https": proxy}
    session.headers.update({"User-Agent": "TurboProbe/strict-1", "Cache-Control": "no-cache", "Accept-Encoding": "identity", "Connection": "close"})
    return session


def read_response(session, url, deadline, timeout, max_bytes):
    """Bound response bytes and check the wall-clock budget while streaming.

    requests connect/read timeouts are inactivity timeouts, not a hard OS deadline;
    callers must also cap the containing job. No redirects, env proxies or TLS bypass.
    """
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError("probe budget exhausted")
    request_timeout = max(0.1, min(timeout, remaining))
    with session.get(url, timeout=(request_timeout, request_timeout), verify=True,
                     allow_redirects=False, stream=True) as response:
        body = bytearray()
        for chunk in response.iter_content(4096):
            if time.monotonic() > deadline:
                raise TimeoutError("probe budget exhausted")
            body.extend(chunk)
            if len(body) > max_bytes:
                raise ValueError("unexpected response size")
        if time.monotonic() > deadline:
            raise TimeoutError("probe budget exhausted")
        return response.status_code, bytes(body)


def valid_response(kind, status, body):
    if kind == "empty204":
        return status == 204 and not body
    if kind != "trace" or status != 200:
        return False
    fields = dict(line.split("=", 1) for line in body.decode("utf-8", "replace").splitlines() if "=" in line)
    try:
        return bool(ipaddress.ip_address(fields.get("ip", "")).is_global and
                    len(fields.get("loc", "")) == 2 and fields.get("tls", "").startswith("TLS"))
    except ValueError:
        return False


def measure_tunnel(port, timeout=5.0, session_factory=make_session):
    """Require 2 of 3 independent HTTPS targets plus a complete 64 KiB transfer.

    Each target uses a fresh SOCKS session. HTTPS timings include tunnel setup,
    remote DNS and TLS, not an ICMP/TCP RTT. Service access is a separate claim.
    """
    deadline = time.monotonic() + max(20.0, timeout * 8)
    samples, passed = [], []
    country = "GLOBAL"
    for endpoint, kind in ENDPOINTS:
        start = time.monotonic()
        try:
            with session_factory(port) as session:
                status, body = read_response(session, endpoint, deadline, timeout, 16384)
            if not valid_response(kind, status, body):
                continue
            samples.append(max(0.1, round((time.monotonic() - start) * 1000, 1)))
            passed.append(endpoint)
            if kind == "trace":
                fields = dict(line.split("=", 1) for line in body.decode().splitlines() if "=" in line)
                country = fields["loc"].upper()
        except (requests.RequestException, OSError, ValueError):
            continue
    if len(samples) < 2:
        return None
    start = time.monotonic()
    try:
        with session_factory(port) as session:
            status, body = read_response(session, "https://speed.cloudflare.com/__down?bytes=" + str(TRANSFER_BYTES), deadline, timeout, TRANSFER_BYTES)
        if status != 200 or len(body) != TRANSFER_BYTES:
            return None
    except (requests.RequestException, OSError, ValueError):
        return None
    seconds = max(time.monotonic() - start, 0.001)
    return {"ping_ms": round(statistics.median(samples), 1), "ping_kind": "https_tunnel",
            "speed_mbps": round(TRANSFER_BYTES * 8 / 1_000_000 / seconds, 2),
            "country": country, "checked_at": utcnow().isoformat(),
            "verification_policy": POLICY, "verified": True,
            "https_successes": len(samples), "https_attempts": len(ENDPOINTS),
            "transfer_bytes": TRANSFER_BYTES, "probe_targets": passed}


def validate_ru_network(data):
    if not isinstance(data, dict) or data.get("success") is not True or data.get("country_code") != "RU":
        raise RuntimeError("RU vantage requires an observed Russian public egress")
    connection = data.get("connection") or {}
    provider = str(connection.get("isp", "")) + " " + str(connection.get("org", ""))
    if not any(word in provider.lower() for word in ("intersvyaz", "интерсвязь")):
        raise RuntimeError("Observed network is not Intersvyaz; disable other VPNs or check ISP metadata")
    # Do not publish the user's residential public IP.
    return {"id": RU_VANTAGE, "country": "RU", "city": "Chelyabinsk",
            "network": "Intersvyaz", "observed_asn": connection.get("asn"),
            "observed_provider": provider.strip(), "network_checked_at": utcnow().isoformat()}


def check_ru_network():
    # Explicit direct request used ONLY to attest the measuring network, never
    # as a fallback for a failed tunnel. OS-level VPNs still require user control.
    with requests.Session() as session:
        session.trust_env = False
        response = session.get("https://ipwho.is/", timeout=(5, 5), verify=True, allow_redirects=False)
        response.raise_for_status()
        return validate_ru_network(response.json())


def ru_snapshot(nodes, vantage, now=None):
    now = now or utcnow()
    accepted = []
    if vantage.get("id") != RU_VANTAGE:
        raise ValueError("Unknown RU vantage")
    for n in nodes:
        if not n.get("uri") or n.get("verification_policy") != POLICY or n.get("verified") is not True:
            continue
        ping = n.get("ping_ms")
        if not isinstance(ping, (int, float)) or isinstance(ping, bool) or not math.isfinite(ping) or ping <= 0 or not fresh(n.get("checked_at"), now):
            continue
        checked = datetime.fromisoformat(n["checked_at"].replace("Z", "+00:00"))
        accepted.append({**n, "id": node_id(n["uri"]), "ru_verified": True,
                         "vantage_id": RU_VANTAGE,
                         "expires_at": (checked + timedelta(seconds=MAX_AGE_SECONDS)).isoformat()})
    unique = {n["id"]: n for n in accepted}
    return {"schema_version": 2, "verification_policy": POLICY,
            "updated_at": now.isoformat(), "max_age_seconds": MAX_AGE_SECONDS,
            "vantage": vantage, "nodes": sorted(unique.values(), key=lambda n: n["ping_ms"])}


def write_ru_snapshot(sub_dir, nodes, vantage):
    payload = ru_snapshot(nodes, vantage)
    root = Path(sub_dir)
    root.mkdir(parents=True, exist_ok=True)
    # A single atomic JSON snapshot is the source of truth. No static RU TXT:
    # a static file cannot revoke stale confirmations while this PC is offline.
    temp = root / "ru-verified.json.tmp"
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temp, root / "ru-verified.json")
    return payload
