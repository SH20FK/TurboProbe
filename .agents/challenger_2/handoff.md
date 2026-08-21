# Handoff Report — challenger_2 (Adversarial Empirical Challenger)

**Verdict**: **REQUEST_CHANGES**  
**Date**: 2026-08-21T14:43:00+05:00  
**Scope**: Adversarial stress testing and empirical challenge of Web performance, Edge Worker resilience, and Clash Meta configuration formats.

---

## 1. Observation

### Observation 1.1: Web Frontend Scale (5,000 & 10,000 Synthetic Nodes)
Executed `node --experimental-strip-types tests/stress_web_scale.ts`:
- **5,000 Nodes**:
  - Indexing time: `33.85 ms` (`148 nodes/ms`), Heap delta: `3.83 MB`
  - Dynamic counts calculation: `1.43 ms`
  - Filter latency (100 iterations/query):
    - Preset All: `0.004 ms` (`255,363 ops/sec`)
    - Single Service (`youtube`): `0.212 ms` (`4,719 ops/sec`, 1,667 matches)
    - Multi-Service (`chatgpt + gemini + claude`): `0.286 ms` (`3,492 ops/sec`, 5,000 matches)
    - Multi-Country (`de + nl + us`): `0.348 ms` (`2,875 ops/sec`, 1,002 matches)
    - Multi-Dimension (`yt + de + reality + ping<150 + health>50`): `0.105 ms` (`9,481 ops/sec`, 16 matches)
  - Clash Meta Export Generation (top 200): `12.49 ms` (77,303 bytes)
- **10,000 Nodes**:
  - Indexing time: `39.62 ms` (`252 nodes/ms`), Heap delta: `10.02 MB`
  - Dynamic counts calculation: `3.73 ms`
  - Filter latency (100 iterations/query):
    - Single Service (`youtube`): `0.433 ms` (`2,311 ops/sec`, 3,334 matches)
    - Multi-Service (`chatgpt + gemini + claude`): `0.464 ms` (`2,153 ops/sec`, 10,000 matches)
    - Multi-Country (`de + nl + us`): `0.392 ms` (`2,549 ops/sec`, 2,001 matches)
    - Multi-Dimension (`yt + de + reality + ping<150 + health>50`): `0.151 ms` (`6,615 ops/sec`, 35 matches)
  - Clash Meta Export Generation (top 200): `4.36 ms` (77,303 bytes)
- Result: **PASS** (Zero frame drops, all 10k filtering operations execute in < 0.5 ms, well under the 16.6ms 60fps budget).

---

### Observation 1.2: Cloudflare Edge Worker Upstream Resilience
Executed `node tests/stress_worker_resilience.mjs`:
- Test 1 (Normal Operation): JSON 200 OK + Clash Format -> `PASS` (Status 200, Len 1,058 chars)
- Test 2 (HTTP 500 on all JSON mirrors): Seamless Fallback to `top50.txt` -> `PASS` (4 nodes extracted, zero merge conflict markers)
- Test 3 (Upstream Latency Racing): `Promise.any` vs 10s hang -> `PASS` (Resolved in `45.4 ms` against hung upstream)
- Test 4 (Corrupted / HTML 502 / Truncated JSON on all mirrors): Fallback to text feed -> `PASS` (Parsed proxies into valid Clash YAML)
- Test 5 (Catastrophic Outage - all upstreams fail): Clean HTTP 503 -> `PASS` (Status 503, body: `"No active nodes available."`, `Cache-Control: no-cache, no-store`, zero unhandled exceptions)
- Test 6 (Format Auto-Detection on Fallback): Clash UA, Singbox JSON, Base64 -> `PASS` (All 3 formats generated seamlessly)
- Test 7 (CORS Preflight): OPTIONS -> `PASS` (`Access-Control-Allow-Origin: *`)
- Test 8 (Health Check): `/health` -> `PASS` (`{"status": "ok"}`)
- Result: **PASS** (8/8 tests passed).

---

### Observation 1.3: Clash Meta YAML Parser & Schema Validation Failures
Executed `python tests/test_clash_meta_parsers.py`:
```
======================================================================
FAIL: test_04_web_frontend_clash_export_generator (__main__.TestClashMetaYamlValidation.test_04_web_frontend_clash_export_generator)
Validate turboprobe-web/src/utils/clashExport.ts via Node execution
----------------------------------------------------------------------
Traceback (most recent call last):
  File "tests/test_clash_meta_parsers.py", line 212, in test_04_web_frontend_clash_export_generator
    metrics = validate_mihomo_clash_yaml(res.stdout, "turboprobe-web clashExport.ts")
  File "tests/test_clash_meta_parsers.py", line 67, in validate_mihomo_clash_yaml
    assert not (server_str.startswith("[") and server_str.endswith("]")), f"[{source_name}] Server '{server_str}' has unstripped brackets"
AssertionError: [turboprobe-web clashExport.ts] Server '[2001:db8::1]' has unstripped brackets

======================================================================
FAIL: test_05_worker_clash_generator (__main__.TestClashMetaYamlValidation.test_05_worker_clash_generator)
Validate worker/index.js generateClashMetaYaml via Node execution
----------------------------------------------------------------------
yaml.parser.ParserError: while parsing a block mapping
  in "<unicode string>", line 47, column 5:
      - name: "Trojan Special Pass #4"
        ^
expected <block end>, but found '<scalar>'
  in "<unicode string>", line 51, column 22:
        password: "Tr:oj"an#Pass123"
                         ^
AssertionError: [worker/index.js] PyYAML Scanner/Parser error: while parsing a block mapping ... expected <block end>, but found '<scalar>'
```

Verbatim code inspection of defects:
1. In `worker/index.js` lines 567-688:
   - Line 573: `password: "${ss.password}"`
   - Line 641: `password: "${user}"`
   - Line 674: `password: "${pass}"`
   - Line 684: `obfs-password: "${obfsPassword}"`
   Double quotes (`"`) and backslashes (`\`) inside decoded passwords and credentials are NOT escaped when formatting YAML strings. When a proxy password contains `"`, it produces unescaped double quotes inside double-quoted YAML scalars (`password: "Tr:oj"an#Pass123"`), crashing strict YAML parsers (PyYAML, Mihomo).
2. In `turboprobe-web/src/utils/clashExport.ts` line 177:
   ```typescript
   const fakeUrl = new URL(`http://${rest}`);
   const host = fakeUrl.hostname;
   ```
   For IPv6 addresses (e.g. `[2001:db8::1]:443`), `fakeUrl.hostname` retains the outer brackets (`"[2001:db8::1]"`). In `turboprobe-web/src/utils/clashExport.ts`, `host` is NOT stripped with `.replace(/^\[|\]$/g, '')`, unlike `aggregator.py` line 716 (`host_port.split(':')[0].strip('[]')`), `service_prober.py` line 735 (`parsed.hostname.strip('[]')`), and `worker/index.js` line 584 (`urlObj.hostname.replace(/^\[|\]$/g, '')`). Consequently, `server: "[2001:db8::1]"` is emitted into the exported Clash YAML, causing Mihomo / Clash Meta DNS resolution failures.

---

## 2. Logic Chain

1. **Step 1 (Web Performance Invariant)**:
   - The UI specification demands smooth 60fps rendering and search/filter responsiveness over 1,000+ nodes.
   - Observation 1.1 demonstrates that indexing 10,000 nodes takes `39.62 ms` (`~10 MB` heap overhead), and filtering 10,000 nodes takes `0.10 ms` to `0.46 ms` per query across all multi-select and numerical range filters.
   - Therefore, the Web frontend indexing and filtering architecture easily satisfies and surpasses the scale requirements.

2. **Step 2 (Edge Worker Resilience Invariant)**:
   - The Edge subscription service must survive upstream 500 errors, network timeouts, malformed JSON feeds, and catastrophic outages without unhandled 500 crashes.
   - Observation 1.2 demonstrates that `Promise.any` racing against hung upstreams resolves in `45.4 ms`, and complete JSON upstream failures gracefully fall back to `top50.txt` with sanitization of conflict markers. Total catastrophic failure correctly produces an HTTP 503 response with `Cache-Control: no-cache, no-store`.
   - Therefore, Edge Worker upstream resilience is verified.

3. **Step 3 (Configuration Validity & Parser Invariant)**:
   - All generated Clash Meta YAML subscriptions must be strictly valid YAML that parses under standard YAML engines (PyYAML) and Mihomo clients without syntax or schema errors.
   - Observation 1.3 empirically proves two distinct failures:
     a. `worker/index.js` outputs unescaped double quotes in proxy passwords/credentials, causing fatal `yaml.parser.ParserError`.
     b. `turboprobe-web/src/utils/clashExport.ts` does not strip outer brackets from IPv6 hostnames, producing `server: "[2001:db8::1]"`.
   - Therefore, configuration generation fails strict parser validation and requires code correction.

---

## 3. Caveats

- Benchmark latency measurements were executed under Node.js v22.20.0 on Windows 11 x64. Exact sub-millisecond figures may vary slightly depending on host CPU load, but the O(N) linear zero-allocation filter characteristics remain invariant.
- Static YAML files (`sub/clash.yaml`, `sub/clash-meta.yaml`, `sub/clash.meta.yaml`) passed schema validation; the defects are in the dynamic runtime generators (`worker/index.js` and `turboprobe-web/src/utils/clashExport.ts`).

---

## 4. Conclusion

- **Verdict**: **REQUEST_CHANGES**
- Required Implementation Fixes:
  1. In `worker/index.js`: Add a YAML string escape helper (e.g. `const escapeYaml = (s) => (s || '').toString().replace(/\\/g, '\\\\').replace(/"/g, '\\"');`) and apply it to all interpolated fields (`password`, `user`, `pass`, `obfsPassword`, `wsPath`, `wsHost`, `sName`, `pbk`, `sid`, `sni`) in `generateClashMetaYaml`.
  2. In `turboprobe-web/src/utils/clashExport.ts`: Line 177, strip outer square brackets from IPv6 hostnames: `const host = fakeUrl.hostname.replace(/^\[|\]$/g, '');`.

---

## 5. Verification Method

To independently reproduce and verify all observations and metrics:

1. **Web Frontend Scale Test**:
   ```bash
   node --experimental-strip-types tests/stress_web_scale.ts
   ```
   *Expected*: Passes with 10k nodes indexed in < 50ms and filtering in < 0.5ms.

2. **Edge Worker Upstream Resilience Test**:
   ```bash
   node tests/stress_worker_resilience.mjs
   ```
   *Expected*: 8/8 test scenarios pass.

3. **Clash Meta YAML Parser & Schema Validation**:
   ```bash
   python tests/test_clash_meta_parsers.py
   ```
   *Expected*: Reproduces the 2 test failures described in Observation 1.3 until the implementation fixes are applied.
