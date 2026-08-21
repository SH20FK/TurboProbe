# Empirical Adversarial Challenge Handoff Report

**Agent**: `challenger_1` (EMPIRICAL CHALLENGER / critic, specialist)  
**Date**: 2026-08-21  
**Working Directory**: `c:\Users\Александр\Documents\antigravity\friendly-planck\.agents\challenger_1`  
**Verdict**: **`REQUEST_CHANGES`**

---

## 1. Observation

### Empirical Test Execution Matrix
We executed the full adversarial stress test suite (`tests/test_adversarial_stress.py`), master test runner (`tests/run_all_e2e.py`), and full unittest discovery (`python -m unittest discover -s tests -p "test_*.py"`).

| Test Suite / Area | Tested Operations | Empirical Metrics / Result | Status |
|---|---|---|---|
| **High Concurrency Socket Safety** | 250 concurrent TCP/TLS `check_node_ping` connections, 500 AsyncIO connection churn cycles | 250/250 ping queries resolved, 0 unclosed socket handles, 0 FD leaks | **PASS** |
| **Worker Port Allocation Stress** | 50 concurrent batches processed by 8 threads across 4 Xray worker slots with random jitter | 50/50 batches completed, 0 concurrent port overlaps, 100% slots recycled on crash | **PASS** |
| **Subprocess Lifecycle Stress** | 50 rapid spawn/terminate cycles, 4MB stdout + 4MB stderr bursts on `DEVNULL` | 0 zombies, 0 pipe deadlocks, 100% temp directories purged in `finally` | **PASS** |
| **Adversarial URI Fuzzing** | Extreme URL encoding (`%00`, `%ff`, `%25%25`), 5-layer Base64, ReDoS strings (50k chars) | 0 crashes, 0 infinite loops, execution time < 0.05s | **PASS** |
| **IPv6 Shadowsocks Protocol Parsing** | `parse_ss_uri` with IPv6 host `[2001:db8::1]:8388` | `AssertionError: unexpectedly None` | **FAIL** |
| **IPv6 Aggregator Ping Parsing** | `check_node_ping` with IPv6 host `[::1]:80` | `ValueError: invalid literal for int() with base 10: ''` (yields 9999.0) | **FAIL** |
| **IPv6 Prober Prefilter & Target Parsing** | `extract_host_port`, `async_probe_candidate_socket`, `probe_direct_hy2_tuic` | String left-split on `:` splits inside IPv6 address | **FAIL** |
| **Worker Clash Meta YAML Escaping** | `worker/index.js` `generateClashMetaYaml` on password with quotes `Tr:oj"an#Pass123` | `yaml.parser.ParserError: while parsing a block mapping ... expected <block end>` | **FAIL** |
| **Web Frontend Clash Export IPv6 Brackets** | `turboprobe-web/src/utils/clashExport.ts` on `[2001:db8::1]` | `AssertionError: [turboprobe-web clashExport.ts] Server '[2001:db8::1]' has unstripped brackets` | **FAIL** |
| **Module Encapsulation in `service_prober.py`** | `run_async_syn_prefilter` and `async_probe_candidate_socket` | Nested inside `main()`, not exposed at module level | **DEFECT** |

---

### Verbatim Defect Observations

#### Defect 1: IPv6 Shadowsocks Parsing Failure in `tools/service_prober.py`
- **Location**: `tools/service_prober.py:357` and `tools/service_prober.py:366`
- **Code**:
  ```python
  host, port_str = hostport.split(":", 1)
  port = int(port_str.split("?")[0].split("/")[0])
  ```
- **Error**: When `hostport` is `[2001:db8::1]:8388` or `[::ffff:192.0.2.128]:8388`, `hostport.split(":", 1)` splits on the *first* colon, yielding `host = "["` and `port_str = "2001:db8::1]:8388"`. `int(...)` raises `ValueError`, causing `parse_ss_uri` to return `None`.

#### Defect 2: IPv6 Host/Port Parsing Crash in `tools/aggregator.py`
- **Location**: `tools/aggregator.py:505-508`
- **Code**:
  ```python
  if ':' in netloc:
      parts = netloc.split(':')
      host = parts[0].strip('[]')
      port = int(parts[1])
  ```
- **Error**: For IPv6 netloc `[::1]:80`, `netloc.split(':')` returns `['[', '', '1]', '80']`. `parts[0]` is `'['`, `parts[1]` is `''`. Calling `int(parts[1])` raises `ValueError: invalid literal for int() with base 10: ''`. Sockets for all IPv6 endpoints fail and default to `9999.0`.

#### Defect 3: IPv6 Host Extraction in Prober & Globalping in `tools/service_prober.py`
- **Location**:
  - `tools/service_prober.py:451` (`probe_direct_hy2_tuic`): `host, port_str = netloc.split(':', 1)`
  - `tools/service_prober.py:921` (`verify_nodes_with_globalping_ru`): `host, port_str = netloc.split(':', 1)`
  - `tools/service_prober.py:1146` (`async_probe_candidate_socket`): `host, port_str = host_port.split(':', 1)`
  - `tools/service_prober.py:1182` (`check_candidate_reachability`): `host, port_str = host_port.split(':', 1)`
- **Error**: Naive `split(':', 1)` on IPv6 strings causes host to be corrupted to `'['` and port extraction to crash.

#### Defect 4: Unescaped Quotes in Cloudflare Worker Clash Meta Generator
- **Location**: `worker/index.js:573, 602, 641, 673`
- **Code**:
  ```javascript
  ` password: "${pass}"`
  ```
- **Error**: When a password or remark contains double quotes `"` or backslashes `\`, the generated YAML is corrupted, raising `yaml.parser.ParserError: while parsing a block mapping ... expected <block end>, but found '<scalar>'`.

#### Defect 5: Unstripped IPv6 Brackets in Web Frontend Clash Export
- **Location**: `turboprobe-web/src/utils/clashExport.ts`
- **Error**: IPv6 host strings like `[2001:db8::1]` retain bracket wrappers in generated `server:` fields, causing validation errors in `tests/test_clash_meta_parsers.py`.

#### Defect 6: Missing Module-Level Exports in `tools/service_prober.py`
- **Location**: `tools/service_prober.py:1136-1170`
- **Observation**: `async_probe_candidate_socket` and `run_async_syn_prefilter` are defined as inner functions inside `def main()`. They are not importable or unit-testable from outside modules.

---

## 2. Logic Chain

1. **Step 1 (Concurrency & Resource Safety)**: Sockets, file descriptors, and worker queues were subjected to high-concurrency stress (250-500 connections, 50 batches, 4MB pipe bursts). The queue pool correctly isolates worker ports `[10900, 11050, 11200, 11350]` with zero overlap, and sockets are cleanly closed in `finally` blocks. This satisfies requirements for resource safety under heavy load.
2. **Step 2 (Protocol & Address Robustness)**: When testing edge cases with IPv6 addresses, standard Python `urllib.parse.urlparse` sets `parsed.hostname` and `parsed.port`. However, several backend scripts bypass `parsed.hostname` and perform naive string splitting on `:` (`netloc.split(':')` or `hostport.split(':', 1)`).
3. **Step 3 (Failure Induction)**: Because IPv6 addresses contain multiple colons (e.g. `2001:db8::1`), splitting from the left produces empty strings or truncated hex components instead of valid integers for the port number. This directly breaks Shadowsocks IPv6 parsing, Aggregator TCP ping checks, and Globalping target resolution.
4. **Step 4 (YAML Generator Sanitization)**: In `worker/index.js`, string template interpolation does not escape inner quotes in passwords and remarks, resulting in malformed YAML when processing real-world complex keys.

---

## 3. Caveats

- **Network Availability**: Outbound Globalping API live network calls depend on external API availability; the local mocks and error handlers were validated.
- **Xray Binary Execution**: Full binary execution was tested on Windows with local `tools/bin/xray.exe`; POSIX zombie testing was verified via `subprocess.Popen` lifecycle emulation on the active environment.

---

## 4. Conclusion & Actionable Verdict

### Verdict: **`REQUEST_CHANGES`**

The backend concurrency, socket lifecycle, and process management architectures are robust and pass stress testing. However, the implementation must resolve the following six defects before final release:

1. **Fix IPv6 Address Parsing in `tools/service_prober.py`**:
   - In `parse_ss_uri`: Use `parsed.hostname` and `parsed.port` or handle bracketed IPv6 with `rsplit(':', 1)`.
   - In `probe_direct_hy2_tuic`, `verify_nodes_with_globalping_ru`, and socket probes: Use `parsed.hostname.strip('[]')` and `parsed.port or 443`.
2. **Fix IPv6 Address Parsing in `tools/aggregator.py`**:
   - In `check_node_ping` (line 505): Replace `parts = netloc.split(':')` with `host = (parsed.hostname or "").strip('[]')` and `port = parsed.port or 443`.
3. **Escape Quotes in `worker/index.js` Clash Generator**:
   - Add a helper `escapeYamlVal(str)` to escape `\` and `"` in passwords, servernames, and remarks.
4. **Strip IPv6 Brackets in `turboprobe-web/src/utils/clashExport.ts`**:
   - Strip leading/trailing `[` and `]` from `server` fields.
5. **Promote Inner Functions to Module Level in `tools/service_prober.py`**:
   - Move `async_probe_candidate_socket` and `run_async_syn_prefilter` outside `main()` to module scope.

---

## 5. Verification Method

To verify the defects and validate fixes independently:

```bash
# 1. Run the adversarial stress test suite
python -m unittest tests/test_adversarial_stress.py -v

# 2. Run the Clash Meta YAML validator suite (exposes worker and web export issues)
python -m unittest tests/test_clash_meta_parsers.py -v

# 3. Run full test discovery
python -m unittest discover -s tests -p "test_*.py"

# 4. Direct IPv6 reproduction command
python -c "import tools.aggregator as agg; print(agg.check_node_ping('vless://uuid@[::1]:80?security=none#IPv6'))"
```
