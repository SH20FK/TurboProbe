# TurboProbe 4-Tier E2E Test Infrastructure & Test Architecture

**Author**: Test Writer (`test_writer_e2e`)  
**Scope**: Requirement-Driven, Opaque-Box Comprehensive 4-Tier Test Suite  
**Project Root**: `friendly-planck/`  
**Framework**: Python `unittest` standard framework + Node.js Web Standards Edge Runtime Tester  
**Master Runner**: `python tests/run_all_e2e.py`

---

## 1. Executive Summary & Architecture

The TurboProbe testing infrastructure is designed as an **opaque-box, requirement-driven 4-tier test suite**. It validates the complete end-to-end operational pipeline of TurboProbe — from subscription scraping, protocol decoding, and deduplication, to concurrent TCP socket benchmarking, isolated Xray multi-inbound probing, Globalping domestic Russian latency verification, web visualization filtering, and Cloudflare Worker dynamic edge distribution.

```
================================================================================
                    TURBOPROBE 4-TIER E2E TEST MATRIX
================================================================================
  Tier 1: Feature Coverage (Core Protocols, Parsers, Feeds, Schemas)
  Tier 2: Boundary & Corner Cases (Malformed URLs, Encodings, Extremes)
  Tier 3: Cross-Feature Combinations (Worker Filtering, Invariants, Sorter)
  Tier 4: Real-World Workload Scenarios (Full E2E Pipeline, CI/CD Rebase, Subprocesses)
================================================================================
```

---

## 2. Directory Layout & Test Suite Catalog

```
friendly-planck/
├── tests/
│   ├── __init__.py                      # Python test package marker
│   ├── run_all_e2e.py                   # Master test runner with per-tier & per-feature summary
│   ├── test_formats.py                  # Protocol parsers, Base64 unpacking, YAML/JSON schemas, feed cleanliness
│   ├── test_backend_e2e.py              # Aggregator pipeline, socket safety, concurrency, Globalping resilience
│   ├── test_web_and_worker.py           # Web frontend compilation, type safety, Cloudflare worker routing
│   ├── test_stress_and_lifecycle.py     # Subprocess lifecycle, zombie reaping, temp dir cleanup, socket stress
│   ├── test_tier3_combinations.py       # Pairwise cross-feature combinations and monotonic sorting invariants
│   └── test_tier4_scenarios.py          # Real-world end-to-end simulations, client distribution, disaster recovery
├── TEST_INFRA.md                        # Test architecture documentation (this file)
└── TEST_READY.md                        # Test readiness declaration and audit catalog
```

---

## 3. Feature Coverage Matrix (Tiers 1–4)

| Feature | Description | Primary Test Suite | Key Test Cases |
|---|---|---|---|
| **F1** | **Socket & Session Leak Elimination** | `tests/test_backend_e2e.py`<br>`tests/test_stress_and_lifecycle.py` | `test_f1_01_tcp_socket_closed_on_success`<br>`test_f1_02_socket_closed_on_connection_refused`<br>`test_f1_03_socket_closed_on_timeout`<br>`test_f1_04_http_fetch_context_closing`<br>`test_f1_05_rapid_connect_disconnect_stress`<br>`test_t2_concurrent_100_socket_connections` |
| **F2** | **Concurrency & Race Condition Elimination** | `tests/test_backend_e2e.py`<br>`tests/test_stress_and_lifecycle.py` | `test_f2_01_threadpool_concurrent_pings`<br>`test_f2_02_strict_uri_deduplication`<br>`test_f2_03_concurrent_history_state_mutation`<br>`test_f2_04_dead_nodes_blacklist_lifecycle`<br>`test_f2_05_prober_batch_chunking_concurrency`<br>`test_f4_04_port_isolation_across_parallel_workers` |
| **F3** | **Protocol Parsing & Ingestion Hardening** | `tests/test_formats.py` | `test_f3_01_vless_reality_outbound_generation`<br>`test_f3_02_vless_websocket_and_grpc_transports`<br>`test_f3_03_trojan_tls_parsing`<br>`test_f3_04_shadowsocks_sip002_and_legacy_parsing`<br>`test_f3_05_hysteria2_extraction_from_content`<br>`test_f3_06_clash_yaml_proxy_extraction`<br>`test_f3_07_multilayer_base64_recursive_unpacking`<br>`test_t2_01_unpadded_base64_decoding_resilience`<br>`test_t2_02_base64url_safe_characters_decoding`<br>`test_t2_03_ipv6_bracketed_host_extraction` |
| **F4** | **Child Xray Lifecycle & Zombie Cleanup** | `tests/test_stress_and_lifecycle.py` | `test_f4_01_xray_config_generation_multi_inbound`<br>`test_f4_02_temp_directory_purged_in_finally`<br>`test_f4_03_child_process_termination_and_reap`<br>`test_f4_04_port_isolation_across_parallel_workers`<br>`test_f4_05_stderr_drain_preventing_pipe_deadlock` |
| **F5** | **Globalping API Resilience** | `tests/test_backend_e2e.py` | `test_f5_01_globalping_happy_path_measurement`<br>`test_f5_02_globalping_rate_limit_429`<br>`test_f5_03_globalping_network_timeout`<br>`test_f5_04_globalping_missing_stats_none_safety`<br>`test_f5_05_globalping_empty_node_list` |
| **F6** | **Subscription Data Feed Cleanliness** | `tests/test_formats.py` | `test_f6_01_no_git_conflict_markers_in_sub_files`<br>`test_f6_02_json_feeds_syntax_and_schema_validation`<br>`test_f6_03_clash_meta_yaml_syntax_and_schema`<br>`test_f6_04_plaintext_feeds_line_integrity`<br>`test_f6_05_chunks_pagination_consistency` |
| **F7** | **Web Performance & Memoization** | `tests/test_web_and_worker.py`<br>`tests/test_tier3_combinations.py` | `test_f7_01_simulate_1000_nodes_filter_performance`<br>`test_c3_web_frontend_preset_and_filter_interactions` |
| **F8** | **Web Type Safety & Badge Rendering** | `tests/test_web_and_worker.py` | `test_f8_01_types_definition_file_validity`<br>`test_f8_02_nodeitem_schema_conformance_with_backend_json`<br>`test_f9_02_web_dist_assets_integrity` |
| **F9** | **Clean Web Compilation** | `tests/test_web_and_worker.py` | `test_f9_01_typescript_clean_build`<br>`test_f9_02_web_dist_assets_integrity` |
| **F10** | **Cloudflare Worker Edge Optimization** | `tests/test_web_and_worker.py`<br>`tests/test_tier3_combinations.py` | `test_f10_01_worker_health_endpoint`<br>`test_f10_02_worker_sub_plain_text_routing`<br>`test_f10_03_worker_clash_yaml_conversion`<br>`test_f10_04_worker_useragent_auto_detection`<br>`test_f10_05_worker_shorthand_routes`<br>`test_t2_worker_cors_options_preflight`<br>`test_c4_worker_multidimensional_filter_and_clash_export` |
| **F11** | **CI/CD Git Push & Rebase Resilience** | `tests/test_web_and_worker.py` | `test_f11_01_aggregator_workflow_syntax`<br>`test_f11_02_ulimit_configured_in_workflows`<br>`test_f11_03_git_push_rebase_resilience_logic` |

---

## 4. Expected Output Derivation & Invariant Rules

Every test case derives its expected values from authoritative protocol specifications and mathematical invariants:

1. **VLESS Reality StreamSettings**:
   - Source: Xray-core VLESS Protocol Specification & `XTLS/Xray-core`.
   - Invariant: Reality requires `publicKey` (`pbk`), `serverName` (`sni`), `fingerprint` (`fp`), and encryption `"none"`.

2. **Shadowsocks Userinfo Padding**:
   - Source: RFC 4648 §4 & Shadowsocks SIP002.
   - Invariant: Userinfo length modulo 4 must be padded with `=` before Base64 decoding (`pad = 4 - (len % 4)`).

3. **Ascending Latency Monotonicity**:
   - Source: `aggregator.py` & `service_prober.py` contract.
   - Invariant: For all sorted node lists, $\forall i: \text{ping}[i] \le \text{ping}[i+1]$.

4. **Chunk Pagination Invariant**:
   - Source: Feed schema specification.
   - Invariant: $\sum \text{len}(\text{chunk}_k) = \text{total\_nodes}$, and $\max(\text{chunk}_k) \le \min(\text{chunk}_{k+1})$.

5. **Edge Worker User-Agent Auto-Switch**:
   - Source: Clash Meta subscription contract.
   - Invariant: If `User-Agent` contains `ClashMeta`, `Mihomo`, `FlClash`, or `Stash`, response format MUST be `text/yaml` with valid `proxies:` mapping.

---

## 5. How to Run the Test Suite

### Full Test Suite Execution:
```bash
python tests/run_all_e2e.py
```

### Run Specific Test Tier:
```bash
python tests/run_all_e2e.py --tier 1
python tests/run_all_e2e.py --tier 2
python tests/run_all_e2e.py --tier 3
python tests/run_all_e2e.py --tier 4
```

### Verbose Mode with Detailed Test Case Names:
```bash
python tests/run_all_e2e.py --verbose
```

### Standard Python Unittest Runner:
```bash
python -m unittest discover -s tests -p "test_*.py"
```

---

## 6. Implementation Bugs Detected (Escalation to Implementing Agents)

The test suite accurately caught 5 concrete implementation defects currently present in the codebase:

1. **Residual Git Conflict Markers in Data Feeds**:
   - Files: `sub/all.txt`, `sub/anti-whitelist.txt`, `sub/base64.txt`, `sub/clean-ip.txt`, `sub/nodes.json`, `sub/preview.json`, etc.
   - Defect: Unresolved conflict markers (`<<<<<<< HEAD`, `=======`, `>>>>>>>`) exist in 24 subscription data feed files.
   - Action for M1: Re-generate all subscription feeds cleanly via `aggregator.py` and `service_prober.py`.

2. **YAML Scanner Error in `sub/clash.yaml`**:
   - Defect: Special characters (`%`) and conflict markers in `sub/clash.yaml` prevent YAML parsers from loading the configuration.
   - Action for M1: Fix YAML character escaping in `generate_clash_meta_yaml`.

3. **Country Keyword False Positive on `.com` Domains**:
   - File: `tools/aggregator.py` (Line 484)
   - Defect: Keyword `"co"` (Colombia) matches `".co"` inside `".com"`, classifying `example.com` as country `"CO"`.
   - Action for M1: Replace naive substring check with strict domain suffix matching (`low.endswith(".co")` or delimiter boundaries).

4. **Missing Hysteria 2 in `generate_clash_meta_yaml`**:
   - Files: `tools/aggregator.py`, `tools/service_prober.py`
   - Defect: Hysteria 2 proxy type was omitted from the Clash Meta YAML output generator.
   - Action for M1: Add `type: hysteria2` block generation branch.
