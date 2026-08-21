# TurboProbe Backend Codebase Deep Technical Audit & Survey Report

**Author**: Explorer Survey Agent (`explorer_survey_1`)  
**Date**: 2026-08-21  
**Scope**: `tools/discover_sources.py`, `tools/aggregator.py`, `tools/service_prober.py`  
**Repository**: SH20FK/TurboProbe

---

## 1. Executive Summary

A comprehensive, line-by-line technical audit was performed across all Python backend tools (`tools/discover_sources.py`, `tools/aggregator.py`, and `tools/service_prober.py`). The audit targeted five critical architectural and stability dimensions:
1. **Socket and Session Leaks / File Descriptor Exhaustion**
2. **Race Conditions & Concurrency Hazards**
3. **Protocol Parsing Vulnerabilities & Missing Formats**
4. **Child Process Lifecycle & Zombie Process Prevention**
5. **Globalping API Integration Resilience**

### Critical Findings Overview
- **High Severity (Port Collision Race Condition)**: In `service_prober.py` (lines 1037–1046), batch port allocation is indexed by `b_idx % NUM_XRAY_WORKERS`. As batches complete at variable durations, new batches immediately collide on the same SOCKS5 port with still-running batches (`EADDRINUSE`), resulting in corrupted probe results and dropped nodes.
- **High Severity (Silent Exclusion of Hysteria 2 in Service Prober)**: In `service_prober.py` (lines 367–374), `uri_to_xray_outbound` returns `None` for `hy2://` and `hysteria2://`. Because nodes without outbounds are skipped from active probe slots, **100% of Hysteria 2 nodes are excluded from `verified_alive_nodes`**, leaving `sub/services/youtube.txt` and `sub/hysteria2.txt` empty of verified Hysteria 2 nodes.
- **High Severity (Socket & Session Leaks)**: `requests.Session` instances created in `service_prober.py` (lines 386 and 752) are **never closed** (neither via `with` nor `session.close()` in `finally`), leaking connection pools and SOCKS5 adapters across thousands of probe iterations. In `aggregator.py` (lines 389–405) and `service_prober.py` (lines 1000–1005), socket connections lack `try...finally` cleanup on TLS handshake errors or DNS resolution exceptions, leaking raw OS file descriptors under high load.
- **Medium Severity (Process Pipe Deadlocks & Zombie Reaping)**: In `service_prober.py` (lines 524–564), `subprocess.Popen(..., stderr=subprocess.PIPE)` is spawned without draining `stderr`. If 75 inbounds emit connection error logs exceeding OS pipe buffers (64KB), Xray deadlocks indefinitely. Furthermore, on timeout, `proc.kill()` is called without a subsequent `proc.wait()`, leaving zombie processes in POSIX process tables.
- **Medium Severity (Globalping Fragility & Type Crash)**: In `service_prober.py` (lines 785–814), a fixed 2.0s sleep causes false negatives when measurements take >2s, and `stats.get("avg")` can return `None` (on 100% packet loss), crashing `round(ping_ms, 1)` with `TypeError`.

---

## 2. Deep Technical Audit by Dimension

---

### Dimension 1: Socket and Session Leaks & File Descriptor Exhaustion

#### 1.1 Unclosed `requests.Session` in `service_prober.py`
- **Location**: `tools/service_prober.py:386`, `tools/service_prober.py:752`
- **Observation**:
  ```python
  def probe_node_liveness_and_services(port: int, uri: str) -> tuple:
      proxy_url = f"socks5h://127.0.0.1:{port}"
      session = requests.Session()
      session.proxies = {"http": proxy_url, "https": proxy_url}
      # ... network requests ...
      # session is returned / exited without session.close()
  ```
- **Impact**: Each probed node creates a new `requests.Session` with internal `urllib3.HTTPConnectionPool` and `SOCKSProxyManager`. Under a 1,000+ candidate workload, thousands of abandoned connection pools remain in memory waiting for Python's garbage collector, retaining open underlying sockets and file descriptors.
- **Remediation**: Wrap all session usage in `with requests.Session() as session:` or explicit `try...finally: session.close()`.

#### 1.2 Socket Descriptor Leak on TLS Handshake Failure in `aggregator.py`
- **Location**: `tools/aggregator.py:388–406`
- **Observation**:
  ```python
  sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
  sock.settimeout(timeout)
  sock.connect((host, port))

  if is_tls:
      ctx = ssl.create_default_context()
      ctx.check_hostname = False
      ctx.verify_mode = ssl.CERT_NONE
      ssock = ctx.wrap_socket(sock, server_hostname=sni)
      ssock.close()
  else:
      sock.close()
  ```
- **Impact**: If `ctx.wrap_socket` raises an exception (`ssl.SSLError`, `ssl.SSLEOFError`, `socket.timeout`, `ConnectionResetError`), control jumps to `except Exception:` on line 405. Neither `ssock.close()` nor `sock.close()` is executed. In the fallback thread pool (3,500 threads), thousands of unclosed sockets stay in the OS kernel until garbage collected, quickly hitting `ulimit -n` limits (`EMFILE`).
- **Remediation**: Enclose socket operations in `try...finally: sock.close()`. Additionally, reuse a global `ssl.SSLContext` instance instead of allocating a new context on every thread connection.

#### 1.3 Socket Leak on DNS Resolution Failure in `service_prober.py`
- **Location**: `tools/service_prober.py:1000–1006`
- **Observation**:
  ```python
  sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
  sock.settimeout(0.85)
  res = sock.connect_ex((host, port))
  sock.close()
  return res == 0
  ```
- **Impact**: If `host` is an unresolvable hostname, `sock.connect_ex` invokes `getaddrinfo` which raises `socket.gaierror`. The exception skips `sock.close()`, leaking the socket file descriptor.
- **Remediation**: Use `with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:`.

#### 1.4 Async Socket Cancellation Handling in `aggregator.py` & `service_prober.py`
- **Location**: `tools/aggregator.py:660–668`, `tools/service_prober.py:968–976`
- **Observation**:
  ```python
  conn = asyncio.open_connection(host, port)
  reader, writer = await asyncio.wait_for(conn, timeout=timeout)
  rtt = round((time.perf_counter() - t0) * 1000.0, 1)
  writer.close()
  try:
      await writer.wait_closed()
  except Exception:
      pass
  ```
- **Impact**: If `asyncio.wait_for` succeeds but an exception occurs before `writer.wait_closed()` or during teardown, writer is not guaranteed to be closed. In `asyncio`, unclosed stream writers trigger `ResourceWarning: unclosed <socket.socket>` and unreleased file descriptors.
- **Remediation**: Place `writer.close()` and `await writer.wait_closed()` in a `try...finally` block immediately after unpacking `reader, writer`.

---

### Dimension 2: Race Conditions & Concurrency Hazards

#### 2.1 Critical Port Collision in Multi-Worker Batching
- **Location**: `tools/service_prober.py:1036–1051`
- **Observation**:
  ```python
  def process_batch_worker(b_idx: int, batch: list) -> tuple:
      worker_slot = b_idx % NUM_XRAY_WORKERS
      worker_base_port = BASE_SOCKS_PORT + (worker_slot * PORT_STEP)
      res = run_batch_probe(xray_bin, batch, base_port=worker_base_port)
      return b_idx, len(batch), res

  with ThreadPoolExecutor(max_workers=NUM_XRAY_WORKERS) as batch_pool:
      batch_futs = {
          batch_pool.submit(process_batch_worker, b, all_batches[b]): b
          for b in range(num_batches)
      }
  ```
- **Root Cause & Hazard**:
  1. `NUM_XRAY_WORKERS = 4`.
  2. If `num_batches = 10`, Batch 0 gets port `10900`, Batch 1 gets `11050`, Batch 2 gets `11200`, Batch 3 gets `11350`.
  3. If Batch 1 finishes in 2s while Batch 0 takes 12s, worker thread 2 picks up Batch 4 (`b_idx = 4`).
  4. `4 % 4 = 0` -> Batch 4 attempts to bind port `10900`, which is **still actively held by Batch 0**.
  5. Xray fails to bind with `EADDRINUSE` or binds to an already running instance with different routing rules.
  6. All candidate nodes in Batch 4 fail or test against the wrong Xray outbounds.
- **Remediation**: Use a thread-safe `queue.Queue` of worker slots `[0, 1, 2, 3]` (or a resource pool context manager). A worker acquires an idle slot from the queue, runs its batch, and puts the slot back in `finally`.

#### 2.2 Unbounded Thread Pool Allocation in `aggregator.py`
- **Location**: `tools/aggregator.py:787`
- **Observation**:
  ```python
  with ThreadPoolExecutor(max_workers=3500) as checker:
      future_to_node = {checker.submit(check_node_ping, node, 0.85): node for node in candidate_uris}
  ```
- **Impact**: If `asyncio` benchmark raises an exception, the fallback creates `ThreadPoolExecutor(max_workers=3500)`. On Linux/macOS/Windows, spawning 3,500 native OS threads allocates gigabytes of stack memory and frequently triggers `RuntimeError: can't start new thread` (EAGAIN), crashing the aggregator.
- **Remediation**: Cap worker threads to a sane limit (e.g. `max_workers=min(256, len(candidate_uris))`) or fix the asyncio latency engine so fallbacks are never forced to oversaturate the OS.

#### 2.3 Shared `requests.Session` Multi-Threading inside `probe_node_liveness_and_services`
- **Location**: `tools/service_prober.py:443–456`
- **Observation**:
  ```python
  with ThreadPoolExecutor(max_workers=len(TARGET_SERVICES)) as s_pool:
      s_futs = [s_pool.submit(check_single_service, k, v) for k, v in TARGET_SERVICES.items()]
  ```
  `check_single_service` calls `session.get(...)` concurrently on the same `session` object across 10 threads.
- **Impact**: `requests.Session` is not thread-safe for mutable attributes (cookie jars, session hooks, redirect histories). Concurrent mutations can cause race conditions or cookie cross-contamination.
- **Remediation**: Use independent `requests.get(...)` calls or a scoped session per request.

---

### Dimension 3: Protocol Parsing Vulnerabilities

#### 3.1 Silent Dropping of Hysteria 2 in `service_prober.py`
- **Location**: `tools/service_prober.py:367–374`, `tools/service_prober.py:488–490`
- **Observation**:
  ```python
  def uri_to_xray_outbound(uri: str, tag: str) -> dict:
      low = uri.lower()
      if low.startswith("vless://"):
          return parse_vless_uri(uri, tag)
      elif low.startswith("trojan://"):
          return parse_trojan_uri(uri, tag)
      elif low.startswith("ss://"):
          return parse_ss_uri(uri, tag)
      return None
  ```
  In `run_batch_probe`:
  ```python
  outbound = uri_to_xray_outbound(uri, out_tag)
  if not outbound:
      continue
  ```
- **Impact**: Hysteria 2 (`hysteria2://`, `hy2://`), TUIC (`tuic://`), and VMess (`vmess://`) return `None`. They are skipped from Xray batch probing. Because `verified_alive_nodes` only collects nodes that pass `run_batch_probe`, **all Hysteria 2 nodes are completely missing from verified service outputs (`sub/services/youtube.txt`, `sub/hysteria2.txt`)**.
- **Remediation**: Implement a direct UDP/HTTP/3 probe or fallback socket verification for Hysteria 2 / TUIC / VMess nodes so they are validated and preserved in verified feeds.

#### 3.2 VLESS Reality Missing Parameter Crash Protection
- **Location**: `tools/service_prober.py:229–240`
- **Observation**:
  ```python
  if security == "reality":
      pbk = query.get("pbk", [""])[0]
      sid = query.get("sid", [""])[0]
      spx = query.get("spx", ["/"])[0]
      stream_settings["realitySettings"] = {
          "serverName": sni,
          "fingerprint": fp,
          "publicKey": pbk,
          "shortId": sid,
          "spiderX": spx,
      }
  ```
- **Impact**: If `pbk` (public key) is empty or missing in a `vless://` URI with `security=reality`, Xray rejects the generated `config.json` on startup (`failed to build reality config: empty public key`). The entire batch of 75 nodes fails to probe because Xray immediately exits.
- **Remediation**: Validate that `pbk` is non-empty before constructing `realitySettings`. If invalid, drop or return `None` for that specific outbound rather than crashing the entire Xray instance.

#### 3.3 Missing Network / Transport Options in `aggregator.py` Clash Meta YAML
- **Location**: `tools/aggregator.py:552–574`
- **Observation**:
  `aggregator.py`'s `generate_clash_meta_yaml` omits `network: ws`, `network: grpc`, `ws-opts`, and `grpc-opts` for VLESS nodes, defaulting everything to TCP.
- **Impact**: Any WebSocket or gRPC VLESS node written to `sub/clash-meta.yaml` by `aggregator.py` fails to connect in Clash Meta / Mihomo clients.
- **Remediation**: Align `aggregator.py`'s `generate_clash_meta_yaml` with `service_prober.py` and `worker/index.js` to emit `network`, `ws-opts`, and `grpc-opts`.

#### 3.4 Shadowsocks URL-Safe Base64 & Padding Gaps
- **Location**: `tools/service_prober.py:328–348`, `tools/aggregator.py:308–316`
- **Observation**:
  `base64.b64decode` is called without converting URL-safe base64 characters (`-` -> `+`, `_` -> `/`) and skips decoding if `len % 4 != 0`.
- **Impact**: Unpadded or URL-safe Base64 subscriptions and Shadowsocks keys fail with `binascii.Error: Incorrect padding` or are silently skipped.
- **Remediation**: Apply URL-safe normalization and dynamic padding `clean += "=" * ((4 - len(clean) % 4) % 4)` before decoding.

#### 3.5 Missing Sing-box JSON Outbounds Extractor
- **Location**: `tools/aggregator.py:320–352`
- **Observation**: `extract_uris_from_content` parses Clash YAML, Telegram HTML, and Base64, but has no parser for Sing-box JSON format (`{"outbounds": [...]}`).
- **Remediation**: Add a Sing-box JSON parser function that extracts `vless`, `trojan`, `shadowsocks`, and `hysteria2` outbounds into standard URI strings.

---

### Dimension 4: Child Process Management & Zombie Reaping

#### 4.1 Stderr Pipe Deadlock in `subprocess.Popen`
- **Location**: `tools/service_prober.py:524–531`
- **Observation**:
  ```python
  proc = subprocess.Popen([xray_bin, "run", "-c", cfg_file], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
  ready = wait_for_port_ready(base_port, max_wait=3.0)
  ```
- **Impact**: `stderr=subprocess.PIPE` creates an OS pipe buffer. When 75 outbound connections log errors/warnings simultaneously, the 64KB OS pipe fills. Xray blocks on `write(stderr)` while the Python process is waiting in `ThreadPoolExecutor`. Both processes hang until timeout.
- **Remediation**: Set `stderr=subprocess.DEVNULL` or `stderr=subprocess.STDOUT` redirected to a temporary log file, or read `proc.stderr` asynchronously.

#### 4.2 Zombie Process Cleanup on Timeout
- **Location**: `tools/service_prober.py:555–564`
- **Observation**:
  ```python
  finally:
      if proc:
          try:
              proc.terminate()
              proc.wait(timeout=1.5)
          except Exception:
              try:
                  proc.kill()
              except Exception:
                  pass
  ```
- **Impact**: If `proc.wait(timeout=1.5)` times out, `proc.kill()` is called, but `proc.wait()` is **never called again**. In POSIX environments (Linux/macOS), killing a process without reaping it leaves a `<defunct>` zombie process in the OS process table.
- **Remediation**: Ensure `proc.wait()` is always called after `proc.kill()`, and close `proc.stderr` / `proc.stdout` streams.

---

### Dimension 5: Globalping API Integration Resilience

#### 5.1 Fixed 2.0s Sleep & False-Negative Tagging
- **Location**: `tools/service_prober.py:784–817`
- **Observation**:
  ```python
  # Wait for Russian domestic probes to complete
  time.sleep(2.0)

  def fetch_single_result(m_id, idx):
      resp = session.get(f"https://api.globalping.io/v1/measurements/{m_id}", timeout=5)
      if resp.status_code == 200:
          data = resp.json()
          results = data.get("results", [])
          if results:
              p_res = results[0]
              res_body = p_res.get("result", {})
              if res_body.get("status") == "finished":
                  # process result
  ```
- **Impact**: Globalping measurements often take 2.5s–5.0s depending on probe availability in Moscow/SPb. Because `fetch_single_result` is queried exactly once after 2.0s, any measurement still `"in-progress"` is permanently discarded as failed.
- **Remediation**: Implement a polling loop (poll every 1.0s up to 6.0s max until status is `"finished"`).

#### 5.2 NoneType Crash on `avg_ping`
- **Location**: `tools/service_prober.py:799–815`
- **Observation**:
  ```python
  stats = res_body.get("stats", {})
  avg_ping = stats.get("avg", 0)  # if stats is {"avg": None}, avg_ping becomes None
  # ...
  test_slice[idx]["ru_ping_ms"] = round(ping_ms, 1)  # TypeError: type NoneType doesn't define __round__ method
  ```
- **Impact**: If the target host drops ICMP packets, Globalping reports `status: "finished"` with `packetLoss: 100` and `stats: {"avg": null}`. `stats.get("avg", 0)` returns `None`, causing `round(None, 1)` to crash the result loop.
- **Remediation**: Use `avg_ping = stats.get("avg") or 0.0` and ensure `isinstance(ping_ms, (int, float))`.

#### 5.3 ICMP Ping vs TCP Port Probing
- **Observation**: Globalping is queried with `"type": "ping"`. Many VPS firewall configurations drop ICMP ping while keeping proxy TCP ports (443, 8443, 2053) open.
- **Remediation**: Use `"type": "tcp"` with target port for accurate VPN reachability measurements.

---

## 3. Comprehensive File-by-File Remediation Plan

### 3.1 `tools/discover_sources.py`
| Item | Issue | Proposed Remediation |
|---|---|---|
| 1 | GitHub API Rate Limit resilience | Add check for `X-RateLimit-Remaining` header and 403 handling with exponential backoff |
| 2 | Clean URI sanitization | Strip trailing punctuation (`.,;()[]'"` and `&amp;`) from all extracted regex matches |
| 3 | Source Quality Index atomic save | Write `source_quality_index.json` and `discovered_sources.json` atomically via `.tmp` file and `os.replace` |
| 4 | URL-safe Base64 and Sing-box support | Import enhanced `extract_uris_from_content` from `aggregator.py` |

### 3.2 `tools/aggregator.py`
| Item | Issue | Proposed Remediation |
|---|---|---|
| 1 | Socket leak in `check_node_ping` | Wrap `sock` in `try...finally: sock.close()`; share reusable global `SSLContext` |
| 2 | Thread pool explosion (3,500 workers) | Limit fallback thread pool to 200 workers max |
| 3 | Clash Meta YAML missing transports | Add `network: ws/grpc`, `ws-opts`, `grpc-opts` to `generate_clash_meta_yaml` |
| 4 | Base64 decoding unpadded / URL-safe | Fix padding calculation and `-`/`_` character replacement |
| 5 | Sing-box JSON Outbound parser | Add `extract_proxies_from_singbox_json()` to `extract_uris_from_content()` |
| 6 | Atomic subscription export | Write all `sub/*.txt` and `sub/chunks/*.txt` atomically to prevent truncated files on interruption |

### 3.3 `tools/service_prober.py`
| Item | Issue | Proposed Remediation |
|---|---|---|
| 1 | Port collision race condition | Replace `b_idx % NUM_XRAY_WORKERS` with `queue.Queue` of available worker slots `[0, 1, 2, 3]` |
| 2 | Hysteria 2 omission from output | Implement direct TCP/UDP probe fallback for Hysteria 2 / TUIC / VMess so they are retained in verified feeds |
| 3 | `requests.Session` leaks | Use `with requests.Session() as session:` in both `probe_node_liveness_and_services` and `verify_nodes_with_globalping_ru` |
| 4 | Child process pipe deadlock & zombies | Use `stderr=subprocess.DEVNULL`, guarantee `proc.wait()` after `proc.kill()` in `finally` |
| 5 | Globalping polling & NoneType crash | Add retry polling loop (up to 6s) and `avg_ping = (stats.get("avg") or 0.0)`; switch to TCP port probe |
| 6 | VLESS Reality validation | Ensure `publicKey` (`pbk`) is valid and non-empty before creating reality settings |

---

## 4. Risk Matrix & Implementation Priority

| Risk / Bug | Severity | Likelihood | Impact Area | Priority |
|---|---|---|---|---|
| Xray Batch SOCKS5 Port Collisions | **Critical** | High | Multi-core probing failures, corrupted probe results | **P0** |
| Hysteria 2 Silent Exclusion from Verified Feeds | **Critical** | 100% | Loss of all Hy2 keys from verified service feeds | **P0** |
| `requests.Session` & Socket Descriptor Leaks | **High** | High | FD exhaustion (`EMFILE`), memory leak under 1000+ concurrency | **P0** |
| Xray Stderr Pipe Buffer Deadlock | **High** | Medium | Silent process hangs during batch probing | **P1** |
| Globalping Fixed Sleep & NoneType Crash | **Medium** | High | False negatives in RU verification, potential crash | **P1** |
| Clash Meta YAML Missing Transport Options | **Medium** | 100% | Broken WS/gRPC proxies in Clash clients | **P1** |
| Unpadded / URL-safe Base64 Parsing | **Low** | Medium | Dropped subscription keys from certain feeds | **P2** |
| Sing-box JSON Missing Parser | **Low** | Low | Inability to ingest raw Sing-box subscription JSON | **P2** |

---

## 5. Verification & Testing Strategy

1. **Static Code Analysis & Linting**:
   - Validate Python syntax across all scripts: `python -m py_compile tools/*.py`
   - Run type checking / linter if available.
2. **Concurrency & Leak Stress Test**:
   - Run `tools/aggregator.py --fast` under high connection pressure.
   - Run `tools/service_prober.py --limit 150 --batch-size 25` with 4 concurrent workers to verify that no port collisions, zombie processes, or unclosed file descriptors occur.
3. **Protocol Parsing Test Suite**:
   - Verify parsing of VLESS Reality (with/without pbk), Trojan, Shadowsocks (standard and URL-safe base64), Hysteria 2, Clash Meta YAML, and Sing-box JSON.
4. **Subscription Output Verification**:
   - Verify that generated `sub/all.txt`, `sub/preview.json`, `sub/nodes.json`, `sub/clash-meta.yaml`, and `sub/services/*.txt` contain valid, non-empty, deduplicated configurations.
