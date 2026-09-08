#!/usr/bin/env python3
"""Staged, high-throughput RU probing, interruptible.

Why the old triage was slow
---------------------------
The batch triage spent 1257 seconds on 150 nodes (8.4 s each) at 3 workers.
The cost was not CPU: an Xray tunnel probe is almost entirely network waiting.
Two things wasted that wait: every node got a full Xray launch even when its
TCP port refuses connections, and every node was retried three times even when
the first answer was deterministic.

Stage 1 checks raw TCP reachability with high concurrency and no Xray.
Stage 2 runs the strict tunnel verification only on survivors, and retries only
failures that are plausibly transient.

The verification policy is unchanged: measure_tunnel from verification.py still
requires 2 of 3 HTTPS endpoints plus a complete 64 KiB transfer. Nothing here
relaxes what counts as a working node.

Failure reasons
---------------
measure_tunnel reports success or nothing, so a plain "not verified" carries no
diagnosis. When it fails, this script replays the policy endpoints once through
the same live tunnel purely to capture the transport error, then classifies it
(TLS_REJECTED_EOF, TIMEOUT, and so on). That pass never turns a failure into a
pass; it only explains it.

Interrupting
------------
Ctrl+C stops scheduling new probes, kills the Xray processes this script
started, and still prints the summary and writes --json-out for the work that
finished.

Usage
-----
  python tools\\fastprobe_ru.py --limit 150 --workers 16 --json-out fast.json
  python tools\\fastprobe_ru.py --tcp-only --limit 1500
  python tools\\fastprobe_ru.py --calibrate --uri "vless://..."
"""
import argparse
import io
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import service_prober as sp  # noqa: E402

try:
    from verification import measure_tunnel
except Exception as exc:  # pragma: no cover
    print("ERROR: could not import tools/verification.py (%r)" % (exc,))
    print("Run this from the repository root so that tools/ is importable.")
    raise SystemExit(2)

# Reuse the policy's own endpoints and session builder when available so the
# diagnostic replay hits exactly what the verifier hit.
FALLBACK_ENDPOINTS = (
    "https://www.gstatic.com/generate_204",
    "https://connectivitycheck.platform.hicloud.com/generate_204",
    "https://www.cloudflare.com/cdn-cgi/trace",
)


def _endpoint_urls(raw):
    """Return plain URL strings from ENDPOINTS, whatever shape it has.

    ENDPOINTS entries are not necessarily bare strings; they may be tuples such
    as (url, expected_status). Feeding a tuple to urlparse raises
    AttributeError("'tuple' object has no attribute 'decode'"), which is what
    broke the first version of this script.
    """
    urls = []
    for item in raw or ():
        candidate = None
        if isinstance(item, str):
            candidate = item
        elif isinstance(item, dict):
            for key in ("url", "endpoint", "href"):
                if isinstance(item.get(key), str):
                    candidate = item[key]
                    break
        elif isinstance(item, (tuple, list)):
            for part in item:
                if isinstance(part, str) and part.startswith("http"):
                    candidate = part
                    break
        if candidate and candidate.startswith("http"):
            urls.append(candidate)
    return urls or list(FALLBACK_ENDPOINTS)


try:
    from verification import ENDPOINTS as _RAW_ENDPOINTS
except Exception:
    _RAW_ENDPOINTS = ()

POLICY_ENDPOINTS = _endpoint_urls(_RAW_ENDPOINTS)

DEFAULT_FEED = os.path.join(ROOT, "sub", "all.txt")

# Failures worth a second look. A stale Reality key or a closed port will not
# change its mind, so retrying those only burns the clock.
TRANSIENT = ("TIMEOUT", "CONNECTION_ERROR", "TRANSFER_INCOMPLETE")

STOP = threading.Event()
_print_lock = threading.Lock()
_procs = set()
_procs_lock = threading.Lock()


def say(message):
    with _print_lock:
        print(message)
        sys.stdout.flush()


def register_proc(proc):
    with _procs_lock:
        _procs.add(proc)


def unregister_proc(proc):
    with _procs_lock:
        _procs.discard(proc)


def kill_all_procs():
    """Kill every Xray this script started, so Ctrl+C leaves nothing behind."""
    with _procs_lock:
        pending = list(_procs)
    for proc in pending:
        try:
            proc.kill()
        except Exception:
            pass


def stop_proc(proc):
    try:
        proc.terminate()
        proc.wait(timeout=5)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def identity(uri):
    text = (uri or "").strip()
    if "://" not in text:
        return None
    scheme = text.split("://", 1)[0].strip().lower()
    if scheme not in ("vless", "trojan", "ss", "vmess", "hysteria2", "hy2", "tuic"):
        return None
    try:
        parsed = urllib.parse.urlparse(text)
        host, port = parsed.hostname, parsed.port
    except Exception:
        return None
    if not host or not port or not (0 < int(port) < 65536):
        return None
    return (scheme, (parsed.username or "").strip(), str(host).lower(), int(port))


def endpoint_of(uri):
    ident = identity(uri)
    return ("%s:%d" % (ident[2], ident[3])) if ident else "?"


def load_uris(path, limit):
    if not os.path.exists(path):
        say("feed not found: %s" % path)
        return []
    seen, out = set(), []
    with io.open(path, encoding="utf-8", errors="replace") as handle:
        for line in handle:
            ident = identity(line)
            if not ident or ident in seen:
                continue
            seen.add(ident)
            out.append(line.strip())
            if limit and len(out) >= limit:
                break
    return out


# ---------------------------------------------------------------- stage 1 ----

def tcp_reachable(uri, timeout):
    if STOP.is_set():
        return uri, "SKIPPED", 0.0
    ident = identity(uri)
    if not ident:
        return uri, "UNPARSEABLE_URI", 0.0
    host, port = ident[2], ident[3]
    started = time.monotonic()
    try:
        conn = socket.create_connection((host, port), timeout)
        conn.close()
        return uri, "TCP_OK", (time.monotonic() - started) * 1000.0
    except socket.timeout:
        return uri, "TCP_TIMEOUT", 0.0
    except socket.gaierror:
        return uri, "TCP_DNS_FAIL", 0.0
    except ConnectionRefusedError:
        return uri, "TCP_REFUSED", 0.0
    except ConnectionResetError:
        return uri, "TCP_RESET", 0.0
    except OSError:
        return uri, "TCP_ERROR", 0.0


def stage_tcp(uris, workers, timeout):
    say("\n== stage 1: TCP reachability (no Xray, %d workers, %.1fs) ==" % (workers, timeout))
    started = time.monotonic()
    verdicts = {}
    done = 0
    pool = ThreadPoolExecutor(max_workers=max(1, workers))
    try:
        futures = [pool.submit(tcp_reachable, uri, timeout) for uri in uris]
        for future in as_completed(futures):
            uri, verdict, rtt = future.result()
            verdicts[uri] = (verdict, rtt)
            done += 1
            if done % 50 == 0 or done == len(uris):
                say("   %d/%d checked" % (done, len(uris)))
    except KeyboardInterrupt:
        STOP.set()
        say("\n   interrupted during reachability check")
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
    elapsed = max(0.001, time.monotonic() - started)
    buckets = Counter(verdict for verdict, _ in verdicts.values())
    for verdict, count in buckets.most_common():
        say("   %-14s %4d  %3.0f%%" % (verdict, count, 100.0 * count / max(1, len(uris))))
    say("   stage 1 took %.1fs (%.0f nodes/min)" % (elapsed, 60.0 * max(1, done) / elapsed))
    return verdicts, elapsed


# ---------------------------------------------------------------- stage 2 ----

def classify(error_text):
    text = (error_text or "").lower()
    if "unexpected_eof" in text or "eof occurred" in text:
        return "TLS_REJECTED_EOF"
    if "timed out" in text or "timeout" in text:
        return "TIMEOUT"
    if "certificate" in text or "ssl" in text or "tls" in text:
        return "TLS_ERROR"
    if "refused" in text or "unreachable" in text or "reset" in text or "closed" in text:
        return "CONNECTION_ERROR"
    if "incomplete" in text or "short read" in text or "content-length" in text:
        return "TRANSFER_INCOMPLETE"
    if text:
        return "CONNECTION_ERROR"
    return "UNEXPECTED_RESPONSE"


def diagnostic_session(port, timeout):
    """A minimal SOCKS session for diagnosis only.

    Deliberately built here rather than borrowed from verification.make_session:
    this session must never influence the verdict, and its argument shape must
    not depend on another module's signature.
    """
    try:
        import requests
    except Exception:
        return None
    session = requests.Session()
    session.trust_env = False
    proxy = "socks5h://127.0.0.1:%d" % port
    session.proxies = {"http": proxy, "https": proxy}
    return session


def explain_failure(port, timeout):
    """Replay the policy endpoints once to capture WHY verification failed.

    This is diagnosis only. It cannot promote a failure to a pass; the verdict
    still comes from measure_tunnel.
    """
    session = diagnostic_session(port, timeout)
    if session is None:
        return "UNEXPECTED_RESPONSE", "no diagnostic session available"

    errors = []
    statuses = []
    for url in POLICY_ENDPOINTS[:3]:
        if STOP.is_set():
            break
        try:
            host = urllib.parse.urlparse(url).hostname or url
        except Exception:
            host = str(url)
        try:
            response = session.get(url, timeout=timeout, allow_redirects=False)
            statuses.append("%s->%s" % (host, response.status_code))
        except Exception as exc:
            errors.append("%s: %s" % (host, exc))
    try:
        session.close()
    except Exception:
        pass

    if errors:
        verdicts = [classify(text) for text in errors]
        ranked = Counter(verdicts).most_common(1)[0][0]
        return ranked, "; ".join(errors)[:400]
    if statuses:
        return "UNEXPECTED_RESPONSE", "endpoints answered but policy unmet: " + ", ".join(statuses)
    return "UNEXPECTED_RESPONSE", "policy not satisfied"


def build_config(port, outbound):
    return {
        "log": {"loglevel": "warning"},
        "inbounds": [{
            "tag": "in",
            "listen": "127.0.0.1",
            "port": port,
            "protocol": "socks",
            "settings": {"udp": False, "auth": "noauth"},
        }],
        "outbounds": [{"tag": "blocked", "protocol": "blackhole"}, outbound],
        "routing": {"rules": [{"type": "field", "inboundTag": ["in"], "outboundTag": "out"}]},
    }


def probe_tunnel(xray_bin, uri, timeout, diagnose=True):
    """One strict tunnel attempt. Returns (verdict, payload_or_detail)."""
    if STOP.is_set():
        return "SKIPPED", "interrupted"
    try:
        outbound = sp.uri_to_xray_outbound(uri, "out")
    except Exception as exc:
        return "UNPARSEABLE_URI", repr(exc)
    if not outbound:
        return "UNPARSEABLE_URI", "parser returned nothing"

    # Xray 26 renamed the Reality field; skipping this made every Reality node
    # fail with a stale publicKey.
    outbound = sp.prepare_outbound_for_current_xray(outbound)
    if not outbound:
        return "XRAY_CONFIG_REJECTED", "unsupported transport for reality"

    port = sp.allocate_free_socks_port()
    tmp_dir = tempfile.mkdtemp(prefix="tp_fast_")
    cfg_path = os.path.join(tmp_dir, "config.json")
    proc = None
    try:
        with io.open(cfg_path, "w", encoding="utf-8") as handle:
            json.dump(build_config(port, outbound), handle)

        popen_kwargs = {"stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
        if os.name == "nt":
            info = subprocess.STARTUPINFO()
            info.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            info.wShowWindow = subprocess.SW_HIDE
            popen_kwargs["startupinfo"] = info

        proc = subprocess.Popen([xray_bin, "run", "-c", cfg_path], **popen_kwargs)
        register_proc(proc)
        if sp.wait_for_ports_ready([port], max_wait=sp.XRAY_STARTUP_TIMEOUT):
            return "SOCKS_PORT_NEVER_BOUND", "inbound never bound"
        if STOP.is_set():
            return "SKIPPED", "interrupted"

        try:
            result = measure_tunnel(port, timeout=timeout)
        except Exception as exc:
            return classify(repr(exc)), repr(exc)

        if isinstance(result, dict) and result.get("verified"):
            return "VERIFIED", result

        detail = ""
        if isinstance(result, dict):
            detail = str(result.get("error") or result.get("reason") or "")
        if detail:
            return classify(detail), detail
        if diagnose and not STOP.is_set():
            # Diagnosis is strictly advisory: if it breaks, report the honest
            # "not verified" verdict rather than letting a helper's bug
            # masquerade as a node failure.
            try:
                return explain_failure(port, timeout)
            except Exception as exc:
                return "UNEXPECTED_RESPONSE", "policy not satisfied (diagnosis failed: %r)" % (exc,)
        return "UNEXPECTED_RESPONSE", "policy not satisfied"
    finally:
        if proc is not None:
            unregister_proc(proc)
            stop_proc(proc)
        sp.release_socks_port(port)
        shutil.rmtree(tmp_dir, ignore_errors=True)


def probe_with_retries(xray_bin, uri, timeout, attempts):
    verdict, payload, seen = "SKIPPED", "interrupted", []
    for _ in range(max(1, attempts)):
        if STOP.is_set():
            break
        verdict, payload = probe_tunnel(xray_bin, uri, timeout)
        seen.append(verdict)
        if verdict == "VERIFIED" or verdict not in TRANSIENT:
            # Deterministic verdict; further attempts cannot change it.
            break
    return verdict, payload, seen or [verdict]


def stage_tunnel(xray_bin, uris, workers, timeout, attempts):
    say("\n== stage 2: strict tunnel verification (%d workers, %.1fs, up to %d attempts) =="
        % (workers, timeout, attempts))
    say("   policy unchanged: 2 of 3 HTTPS endpoints plus a full 64 KiB transfer")
    say("   press Ctrl+C to stop early and keep the results so far")
    started = time.monotonic()
    records = []
    done = 0
    pool = ThreadPoolExecutor(max_workers=max(1, workers))
    try:
        futures = {pool.submit(probe_with_retries, xray_bin, uri, timeout, attempts): uri for uri in uris}
        for future in as_completed(futures):
            uri = futures[future]
            done += 1
            try:
                verdict, payload, seen = future.result()
            except Exception as exc:
                verdict, payload, seen = "CONNECTION_ERROR", repr(exc), ["error"]
            if verdict == "SKIPPED":
                continue
            record = {
                "uri": uri,
                "endpoint": endpoint_of(uri),
                "verdict": verdict,
                "attempts": len(seen),
            }
            if verdict == "VERIFIED" and isinstance(payload, dict):
                for key in ("ping_ms", "speed_mbps", "country"):
                    record[key] = payload.get(key)
                detail = json.dumps({key: payload.get(key) for key in ("ping_ms", "speed_mbps", "country")},
                                    ensure_ascii=False)
            else:
                record["detail"] = str(payload)[:400]
                detail = str(payload)[:90]
            records.append(record)
            say("[%4d/%d] %-22s %-34s %s" % (done, len(uris), verdict, record["endpoint"], detail))
    except KeyboardInterrupt:
        STOP.set()
        say("\n   interrupted: no new probes will start, shutting down Xray processes")
        kill_all_procs()
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
        kill_all_procs()
    elapsed = max(0.001, time.monotonic() - started)
    say("   stage 2 took %.1fs (%.1f nodes/min)" % (elapsed, 60.0 * max(1, len(records)) / elapsed))
    return records, elapsed


# -------------------------------------------------------------- calibrate ----

def calibrate(xray_bin, uri, timeout):
    """Measure how a known-good node behaves as concurrency rises."""
    say("== calibration against a known-good node ==")
    say("   a drop in success rate means your link is saturated, not that nodes died\n")
    for level in (1, 2, 4, 8, 16):
        if STOP.is_set():
            break
        started = time.monotonic()
        pool = ThreadPoolExecutor(max_workers=level)
        try:
            futures = [pool.submit(probe_tunnel, xray_bin, uri, timeout, False) for _ in range(level)]
            verdicts = [future.result()[0] for future in as_completed(futures)]
        except KeyboardInterrupt:
            STOP.set()
            kill_all_procs()
            say("   interrupted")
            break
        finally:
            pool.shutdown(wait=False, cancel_futures=True)
        elapsed = time.monotonic() - started
        good = sum(1 for verdict in verdicts if verdict == "VERIFIED")
        say("   concurrency %2d: %d/%d verified in %.1fs  %s"
            % (level, good, level, elapsed, "" if good == level else "<-- degradation"))
        if good < level:
            say("\n   Safe worker count looks like %d or below." % max(1, level // 2))
            return max(1, level // 2)
    say("\n   No degradation up to 16; try --workers 16.")
    return 16


def print_summary(records, probed, tcp_elapsed, tunnel_elapsed):
    total = tcp_elapsed + tunnel_elapsed
    verified = [record for record in records if record["verdict"] == "VERIFIED"]
    say("\n== summary (%.1fs total: %.1fs reachability + %.1fs tunnels) =="
        % (total, tcp_elapsed, tunnel_elapsed))
    if STOP.is_set():
        say("   INCOMPLETE: interrupted, covering only the probes that finished")
    for verdict, count in Counter(record["verdict"] for record in records).most_common():
        say("%-24s %4d  %3.0f%%" % (verdict, count, 100.0 * count / max(1, len(records))))
    say("\n== verified: %d/%d ==" % (len(verified), len(records)))
    for record in sorted(verified, key=lambda item: item.get("ping_ms") or 9e9):
        say("%.1fms  %s  %s" % (record.get("ping_ms") or 0.0,
                                record.get("country") or "??", record["uri"][:110]))
    if total > 0 and probed:
        say("\nthroughput: %.1f nodes/min overall" % (60.0 * probed / total))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--file", default=DEFAULT_FEED)
    parser.add_argument("--uri", action="append", default=[], help="probe explicit URIs instead of the feed")
    parser.add_argument("--limit", type=int, default=150)
    parser.add_argument("--workers", type=int, default=0, help="stage 2 concurrency (0 = auto)")
    parser.add_argument("--tcp-workers", type=int, default=64, help="stage 1 concurrency")
    parser.add_argument("--timeout", type=float, default=12.0, help="per-request tunnel timeout")
    parser.add_argument("--tcp-timeout", type=float, default=2.5)
    parser.add_argument("--attempts", type=int, default=2, help="max attempts for transient failures")
    parser.add_argument("--tcp-only", action="store_true", help="stop after reachability, skip Xray")
    parser.add_argument("--no-tcp-prefilter", action="store_true", help="probe everything, even unreachable ports")
    parser.add_argument("--no-diagnose", action="store_true", help="skip the failure-reason replay")
    parser.add_argument("--calibrate", action="store_true", help="find a safe worker count using --uri")
    parser.add_argument("--json-out", default="")
    args = parser.parse_args()

    workers = args.workers if args.workers > 0 else min(12, max(4, os.cpu_count() or 4))

    xray_bin = ""
    if not args.tcp_only:
        xray_bin = sp.get_xray_binary_path()
        if not xray_bin or not os.path.exists(xray_bin):
            say("Xray binary not found; refusing to guess results. Use --tcp-only for reachability only.")
            return 2
        say("Xray: %s" % xray_bin)

    if args.calibrate:
        if not args.uri:
            say("--calibrate needs --uri with a node you know works.")
            return 2
        try:
            calibrate(xray_bin, args.uri[0], args.timeout)
        except KeyboardInterrupt:
            STOP.set()
            kill_all_procs()
            say("interrupted")
        return 0

    uris = args.uri or load_uris(args.file, args.limit)
    if not uris:
        say("nothing to probe")
        return 2
    say("Probing %d node(s); stage 2 workers: %d" % (len(uris), workers))

    records = []
    tcp_verdicts = {}
    tcp_elapsed = 0.0
    tunnel_elapsed = 0.0
    survivors = uris

    try:
        if not args.no_tcp_prefilter:
            tcp_verdicts, tcp_elapsed = stage_tcp(uris, args.tcp_workers, args.tcp_timeout)
            survivors = [uri for uri in uris if tcp_verdicts.get(uri, ("",))[0] == "TCP_OK"]
            say("   %d node(s) skipped before Xray, %d worth probing"
                % (len(uris) - len(survivors), len(survivors)))

        if args.tcp_only:
            say("\nStopped after stage 1 as requested. Reachability is not verification.")
            return 0

        if survivors and not STOP.is_set():
            records, tunnel_elapsed = stage_tunnel(xray_bin, survivors, workers, args.timeout, args.attempts)
    except KeyboardInterrupt:
        STOP.set()
        kill_all_procs()
        say("\ninterrupted")
    finally:
        kill_all_procs()

    probed_uris = {record["uri"] for record in records}
    for uri in uris:
        if uri in survivors or uri in probed_uris:
            continue
        records.append({
            "uri": uri,
            "endpoint": endpoint_of(uri),
            "verdict": "NODE_TCP_UNREACHABLE",
            "detail": tcp_verdicts.get(uri, ("TCP_ERROR", 0.0))[0],
            "attempts": 0,
        })

    print_summary(records, len(records), tcp_elapsed, tunnel_elapsed)

    if args.json_out:
        path = args.json_out if os.path.isabs(args.json_out) else os.path.join(ROOT, args.json_out)
        with io.open(path, "w", encoding="utf-8") as handle:
            json.dump({
                "records": records,
                "seconds": tcp_elapsed + tunnel_elapsed,
                "workers": workers,
                "interrupted": STOP.is_set(),
            }, handle, ensure_ascii=False, indent=1)
        say("wrote %s" % path)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        STOP.set()
        kill_all_procs()
        print("interrupted")
        raise SystemExit(130)
