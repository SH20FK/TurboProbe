# Handoff Report — Specification Mining: Protocols, Subscriptions, Formats & E2E Plan

**Agent**: `spec_miner_survey_3`  
**Date**: 2026-08-21  
**Status**: Hard Handoff (Task Complete)  

---

## 1. Observation

1. **Protocol URI Parsing & Ingestion**:
   - `tools/aggregator.py:221-224`: Regex `(?:vless|trojan|ss|hy2|hysteria2|tuic|vmess)://[^\s<>"']+'` extracts candidate URIs.
   - `tools/aggregator.py:246-302`: `extract_proxies_from_clash_yaml` parses `proxies:` blocks for `vless`, `trojan`, `ss`, and `hy2`.
   - `tools/aggregator.py:304-318`: `recursive_decode_subscription` attempts multi-layer Base64 decoding, but line 312 stops after Depth 1 because intermediate Base64 strings lack `://`.
   - `tools/service_prober.py:210-375`: `parse_vless_uri`, `parse_trojan_uri`, and `parse_ss_uri` map candidate URIs into Xray JSON outbound structures.

2. **Classification & Sanitization Anomalies**:
   - `tools/aggregator.py:513`: Condition `elif "ss://" in low:` matches `vless://` and `vmess://` because `"vless://"` ends with `"ss://"`, mislabeling non-Reality VLESS nodes as `"Shadowsocks"`.
   - `tools/aggregator.py:484`: Country code detection for `"CO"` tests `f".{kw}" in low`, which evaluates to True on `.com` domains (`.co` inside `.com`), misclassifying `.com` hosts as Colombia (`CO`).
   - `tools/aggregator.py:525-605`: `generate_clash_meta_yaml` omits generators for `hysteria2` and `ss`.
   - `tools/service_prober.py:580-689` and `worker/index.js:281-389`: `generateClashMetaYaml` omits generators for `hysteria2`.

3. **Subprocess & Resource Management**:
   - `tools/service_prober.py:524`: Launches child Xray processes via `subprocess.Popen([xray_bin, "run", "-c", cfg_file])`. Terminated and killed in `finally` block (lines 555-564) with `shutil.rmtree(tmp_dir)`.
   - `tools/service_prober.py:730-820`: Globalping API interacts via HTTP requests to `https://api.globalping.io/v1/measurements`.

4. **Corrupted State in Repository**:
   - Multiple generated files in `sub/` and `docs/sub/` (e.g. `sub/services/index.json:2`, `sub/preview.json:2`, `sub/nodes.json:2`, `sub/all.txt:1`, `sub/clash-meta.yaml:7`) contain Git merge conflict markers (`<<<<<<< HEAD`, `=======`, `>>>>>>> 9d64e66`).

---

## 2. Logic Chain

1. From `ORIGINAL_REQUEST.md` (R1-R4), the system requires strict protocol compliance, resource leak elimination, resilient multi-threading, clean TypeScript build, Edge Worker optimization, and conflict-free CI/CD automation.
2. Direct inspection and diagnostic test runs demonstrated that:
   - Base64 recursive decoding fails on depth > 1 due to strict intermediate string validation.
   - Purpose classification in `aggregator.py` erroneously labels standard VLESS as Shadowsocks due to string containment (`"ss://"` in `"vless://"`).
   - Domain-to-country mapping produces false positives for `.com` domains matching country code `CO`.
   - Generated Clash Meta configurations miss Hysteria 2 proxy representations.
   - Output subscription files in the repository contain residual Git merge conflict markers from past pushes.
3. Therefore, resolving these discrepancies and formalizing the exact specifications, schemas, edge cases, and 4-tier E2E test plan will guide the implementation and verification phases without ambiguities.

---

## 3. Caveats

1. Real live network scanning against external endpoints in `aggregator.py` depends on network reachability and remote server availability.
2. Globalping API tests depend on external probe network availability in Russian locations (Moscow/SPb).
3. Hysteria 2 probing requires QUIC UDP client support, which is bypassed by basic TCP socket tests.

---

## 4. Conclusion

All required specifications, schemas, feed definitions, edge cases, and test plans have been mined, probed, verified, and documented in `.agents/spec_miner_survey_3/survey_report.md`. The findings provide an authoritative foundation for the architectural audit, refactoring, and test suite creation.

---

## 5. Verification Method

To independently verify the mined behaviors and findings:

1. **Verify URI Parsers & Substring Collision**:
   ```bash
   python -c "
   import sys; sys.path.insert(0, 'tools')
   from aggregator import sanitize_node_remark, detect_country_code
   u = 'vless://uuid@example.com:443?security=tls&type=ws#Node'
   print('Remark:', sanitize_node_remark(u, 20.0))
   print('Country:', detect_country_code(u))
   "
   ```
2. **Verify Multi-layer Base64 Unpacker Behavior**:
   ```bash
   python -c "
   import sys, base64; sys.path.insert(0, 'tools')
   from aggregator import recursive_decode_subscription
   raw = 'vless://uuid@1.1.1.1:443#N1'
   b64 = base64.b64encode(base64.b64encode(raw.encode()).decode().encode()).decode()
   print('Depth 2 result contains vless://:', 'vless://' in recursive_decode_subscription(b64, 5))
   "
   ```
3. **Verify Git Merge Conflict Markers in `sub/`**:
   ```bash
   git grep -n "<<<<<<< HEAD" sub/
   ```
4. **Inspect Master Specification Document**:
   View `.agents/spec_miner_survey_3/survey_report.md`.
