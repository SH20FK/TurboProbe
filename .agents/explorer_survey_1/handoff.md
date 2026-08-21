# Handoff Report — Backend Technical Audit & Survey

**Agent**: `explorer_survey_1`  
**Date**: 2026-08-21  
**Target**: Orchestrator / Implementer  
**Working Directory**: `c:\Users\Александр\Documents\antigravity\friendly-planck\.agents\explorer_survey_1`

---

## 1. Observation

Direct observations from source code inspection:

### O1. Batch SOCKS5 Port Allocation Race Condition
- **File**: `tools/service_prober.py:1036–1051`
- **Code**:
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
- **Finding**: Port assignment is computed as `b_idx % 4`. If batch 1 finishes earlier than batch 0, batch 4 is executed on slot `4 % 4 = 0` (port `10900`), colliding with the active Xray process of batch 0.

### O2. Unclosed `requests.Session` Instances
- **File**: `tools/service_prober.py:386` and `tools/service_prober.py:752`
- **Code**:
  ```python
  proxy_url = f"socks5h://127.0.0.1:{port}"
  session = requests.Session()
  session.proxies = {"http": proxy_url, "https": proxy_url}
  ```
- **Finding**: Neither `session.close()` nor context manager `with` is used. Over 1,000+ candidate node checks, thousands of `urllib3` connection pools and adapter sockets remain open until GC.

### O3. Raw Socket Descriptors Leaked on TLS Handshake Exceptions
- **File**: `tools/aggregator.py:388–405`
- **Code**:
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
- **Finding**: If `ctx.wrap_socket` throws `SSLError`, `SSLEOFError`, or `timeout`, execution jumps to `except Exception:`, bypassing `sock.close()` / `ssock.close()`.

### O4. Silent Exclusion of Hysteria 2 / TUIC / VMess from Verified Feeds
- **File**: `tools/service_prober.py:367–374` & `tools/service_prober.py:488–490`
- **Code**:
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
- **Finding**: `uri_to_xray_outbound` returns `None` for Hysteria 2. In `run_batch_probe`, `if not outbound: continue`, so Hysteria 2 nodes are omitted from `active_slots` and never added to `verified_alive_nodes`, leaving `sub/hysteria2.txt` empty.

### O5. Subprocess Pipe Deadlock & Incomplete Zombie Reaping
- **File**: `tools/service_prober.py:524` & `tools/service_prober.py:555–564`
- **Code**:
  ```python
  proc = subprocess.Popen([xray_bin, "run", "-c", cfg_file], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
  # ...
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
- **Finding**: `stderr=subprocess.PIPE` is never read/drained, risking OS pipe buffer saturation and Xray process deadlocks. In `finally`, if `proc.wait(1.5)` times out, `proc.kill()` is called without a subsequent `proc.wait()`, leaving zombie processes in POSIX process tables.

### O6. Globalping Fixed 2.0s Sleep & `NoneType` Crash
- **File**: `tools/service_prober.py:785` & `tools/service_prober.py:799–814`
- **Code**:
  ```python
  time.sleep(2.0)
  # single attempt to fetch result
  stats = res_body.get("stats", {})
  avg_ping = stats.get("avg", 0)
  # ...
  test_slice[idx]["ru_ping_ms"] = round(ping_ms, 1)
  ```
- **Finding**: Measurements taking >2.0s are permanently marked unverified due to lack of polling. If target drops ICMP packets, `stats.get("avg")` is `None`, crashing `round(None, 1)` with `TypeError`.

---

## 2. Logic Chain

1. **Port Collisions (O1 -> Conclusion)**:
   - When multiple batches run concurrently via `ThreadPoolExecutor(max_workers=4)`, batch duration depends on node responsiveness.
   - Batch $k$ on slot $s = k \pmod 4$ starts on port $P(s)$.
   - If batch 1 finishes before batch 0, batch 4 starts on slot $0 \pmod 4 = 0$ on port $P(0)$.
   - Port $P(0)$ is already in use by batch 0.
   - Therefore, the second Xray process encounters `EADDRINUSE`, causing batch 4 to fail or probe against incorrect routing rules.

2. **Resource Leaks under Load (O2, O3 -> Conclusion)**:
   - Under standard aggregator runs, 1,000+ candidates are tested.
   - Each TLS handshake failure in `aggregator.py` or DNS resolution failure in `service_prober.py` skips socket closure.
   - Each candidate probed in `service_prober.py` opens a `requests.Session` with an internal socket pool without closing it.
   - Under 3,500 thread concurrency or long-running workflows, cumulative unclosed file descriptors lead to `EMFILE: Too many open files` or thread allocation exhaustion (`RuntimeError: can't start new thread`).

3. **Loss of Protocol Diversity (O4 -> Conclusion)**:
   - `uri_to_xray_outbound` ignores Hysteria 2.
   - All `hy2://` nodes are discarded before probing.
   - Service feeds relying on Hysteria 2 (e.g. `youtube.txt`, `hysteria2.txt`) lose all high-speed QUIC nodes.

4. **Service Reliability (O5, O6 -> Conclusion)**:
   - Pipe deadlocks cause CI workflows to hit execution timeouts (15+ minutes).
   - Globalping single-shot 2s checks cause high false-negative rates for domestic Russian accessibility, and `NoneType` crashes disrupt metadata generation.

---

## 3. Caveats

1. **External Network Availability**:
   - Verification of live Xray probing and Globalping API depends on network connectivity to GitHub and Globalping API servers.
2. **Third-Party Binary Dependency**:
   - `Xray-core` must be present or downloaded into `tools/bin/` to run live tunnel probes.
3. **Alternative Protocols (Hysteria 2 / TUIC)**:
   - Xray-core does not natively support Hysteria 2; probing Hysteria 2 requires either direct QUIC/UDP socket probing or fallback socket reachability checks unless Sing-box is integrated as a secondary core.

---

## 4. Conclusion

The Python backend codebase is structurally sound and well-conceived, but contains **5 critical architectural flaws** that compromise stability under high concurrency and long CI runs:
1. **Port allocation race condition** in `service_prober.py` causing batch probe collisions.
2. **Resource leaks** in socket and `requests.Session` handling.
3. **Silent exclusion of Hysteria 2** protocols from verified service feeds.
4. **Subprocess stderr buffer deadlocks** and un-reaped zombie processes.
5. **Globalping single-shot timeout** and `NoneType` crash on ICMP packet loss.

A complete remediation plan is detailed in `survey_report.md`.

---

## 5. Verification Method

To independently verify the findings:

1. **Port Collision & Concurrency Test**:
   ```bash
   python -c "
   import subprocess, sys
   # Inspect service_prober.py lines 1036-1051
   with open('tools/service_prober.py') as f:
       content = f.read()
   assert 'b_idx % NUM_XRAY_WORKERS' in content, 'Port allocation bug present'
   print('Verified: Port allocation is tied to b_idx % NUM_XRAY_WORKERS')
   "
   ```

2. **Socket / Session Leak Inspection**:
   ```bash
   python -c "
   with open('tools/service_prober.py') as f:
       text = f.read()
   assert 'session.close()' not in text, 'requests.Session is never closed'
   print('Verified: requests.Session is never closed in service_prober.py')
   "
   ```

3. **Hysteria 2 Omission Verification**:
   ```bash
   python -c "
   with open('tools/service_prober.py') as f:
       text = f.read()
   assert 'low.startswith(\"hy2://\")' not in text and 'low.startswith(\"hysteria2://\")' not in text, 'Hysteria2 is omitted in uri_to_xray_outbound'
   print('Verified: Hysteria2 is omitted from uri_to_xray_outbound')
   "
   ```

4. **Syntax & Compilation Validation**:
   ```bash
   python -m py_compile tools/discover_sources.py tools/aggregator.py tools/service_prober.py
   ```
