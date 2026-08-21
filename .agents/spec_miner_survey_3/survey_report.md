# TurboProbe Protocols, Subscriptions, Formats, and E2E Specification Mining Report

**Date**: 2026-08-21  
**Author**: Specification Mining Specialist (`spec_miner_survey_3`)  
**Scope**: Protocols, Subscriptions, Output Feed Schemas, Edge Worker Engine, Edge Cases & 4-Tier E2E Test Plan  

---

## 1. Executive Summary & Authoritative Spec Sources

This document establishes the formal specification and behavioral contracts for the **TurboProbe** system, reverse-engineered and extracted from the codebase (`tools/aggregator.py`, `tools/service_prober.py`, `tools/discover_sources.py`, `worker/index.js`, `turboprobe-web/src/types/index.ts`, and CI workflows in `.github/workflows/aggregator.yml`), as well as authoritative protocol standards (Xray-core, Mihomo/Clash.Meta, Sing-box, RFC 4648, SIP002, and Hysteria 2).

### Authoritative Specification Sources:
1. **Xray-core Outbound & StreamSettings Specification**: VLESS v0 protocol, XTLS-Vision flow, Reality TLS masquerading, WebSocket, gRPC, and Trojan stream transports.
2. **Clash Meta / Mihomo Proxy & Rule Configuration Specification**: YAML schemas for proxies (`vless`, `trojan`, `ss`, `hysteria2`), `proxy-groups` (`url-test`, `select`), and `rules` (DOMAIN-SUFFIX, GEOIP, MATCH).
3. **Sing-box Outbound JSON Specification**: Universal proxy outbound definitions.
4. **Shadowsocks SIP002 & Shadowsocks-2022 AEAD Specification**: URI encoding schemes, base64 userinfo, ciphers (`aes-256-gcm`, `chacha20-ietf-poly1305`, `2022-blake3-aes-128-gcm`).
5. **Hysteria 2 Protocol Specification**: QUIC transport, auth strings, SNI, ports hopping (`mport`), and Salamander/obfs.
6. **RFC 4648 & Base64 Subscriptions**: Base64/Base64URL encoding rules, padding invariants, and newline normalization.
7. **Cloudflare Worker Runtime Specifications**: V8 isolate memory (128MB) & CPU execution limits (50ms), Web Standards (`Request`, `Response`, `URL`, `fetch`).

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Protocols | VLESS Reality | High-resilience DPI circumvention using real SNI masquerading & public key authentication | `vless://{uuid}@{host}:{port}?security=reality&sni={sni}&pbk={pbk}&sid={sid}&fp={fp}&type={net}#{tag}` | Xray outbound / Clash YAML proxy / Sing-box JSON outbound | If pbk is missing, falls back to TLS or standard VLESS | `tools/aggregator.py:267`, `tools/service_prober.py:210`, `worker/index.js:308` |
| 2 | Protocols | VLESS WebSocket (WS) | HTTP/1.1 WebSocket tunneling with custom path and host headers | Query: `type=ws&path={path}&host={host}` | StreamSettings `wsSettings: {path, headers: {Host}}`, Clash `ws-opts: {path, headers: {Host}}` | URL-decodes path; falls back to host=sni if host header empty | `tools/aggregator.py:280`, `tools/service_prober.py:247`, `worker/index.js:333` |
| 3 | Protocols | VLESS gRPC | gRPC transport mode (Gun / Multi-mode) with service name | Query: `type=grpc&serviceName={name}` | StreamSettings `grpcSettings: {serviceName}`, Clash `grpc-opts: {grpc-service-name}` | Empty service name defaults to `""` | `tools/service_prober.py:252`, `worker/index.js:340` |
| 4 | Protocols | Trojan TLS / WS / gRPC | Password-authenticated TLS proxy tunneling | `trojan://{password}@{host}:{port}?sni={sni}&type={net}#{tag}` | Xray outbound / Clash Trojan proxy / Sing-box Trojan outbound | Password missing returns `None` parse failure | `tools/aggregator.py:287`, `tools/service_prober.py:276`, `worker/index.js:347` |
| 5 | Protocols | Shadowsocks SIP002 & Legacy | AEAD encrypted stream proxy with Base64 userinfo (`method:password`) | `ss://{b64_userinfo}@{host}:{port}#{tag}` or `ss://{b64_full}#{tag}` | Xray Shadowsocks outbound (`uot: true`), Clash `type: ss, cipher, password` | Missing padding fixed with `=` modulo 4; fallback to plain text if b64 fails | `tools/aggregator.py:291`, `tools/service_prober.py:322`, `worker/index.js:360` |
| 6 | Protocols | Shadowsocks-2022 | Blake3-based modern AEAD encryption for Shadowsocks | `cipher: 2022-blake3-aes-128-gcm`, `2022-blake3-aes-256-gcm` | Clash YAML / Sing-box / Xray 2022 outbound | Unrecognized cipher passed as-is to core | SIP002 spec & `tools/aggregator.py:291` |
| 7 | Protocols | Hysteria 2 (hy2) | High-speed UDP QUIC proxy with port-hopping and Salamander obfuscation | `hysteria2://{auth}@{host}:{port}?sni={sni}&insecure={0\|1}&obfs={type}&obfs-password={pass}#{tag}` | Sub feed `sub/hysteria2.txt`, Clash `type: hysteria2`, Sing-box outbound | Unsupported by basic Xray-core; tested via TCP prefilter / native core | `tools/aggregator.py:296`, `tools/service_prober.py:869`, `sub/hysteria2.txt` |
| 8 | Protocols | TUIC | QUIC-based congestion control proxy protocol (BBR/Cubic) | `tuic://{uuid}:{pass}@{host}:{port}?sni={sni}#{tag}` | Ingested into aggregator candidate pool | Preserved in raw sub feeds; bypasses TCP latency test if UDP-only | `tools/aggregator.py:221`, `tools/service_prober.py:956` |
| 9 | Ingestion | Multi-Layer Base64 Unpacker | Unpacks nested Base64 subscriptions up to 5 layers | Encoded Base64 string | Decoded plain text containing proxy URIs or Clash YAML | Halts recursion when decoded string does not change or starts with protocol schemes | `tools/aggregator.py:304` |
| 10 | Ingestion | Clash YAML Ingestion | Extracts proxy nodes from `proxies:` or `Proxy:` blocks in YAML files | Raw YAML string | List of normalized URI strings (`vless://`, `trojan://`, `ss://`, `hysteria2://`) | Safe YAML parser catches YAML syntax errors and skips malformed proxy entries | `tools/aggregator.py:246` |
| 11 | Ingestion | Telegram Web Channel Scraper | Extracts proxy keys from public Telegram preview HTML | Telegram web page HTML (`<div class="tgme_widget_message_text">`) | List of regex-matched URIs | Gracefully ignores non-HTML responses and non-URI text blocks | `tools/aggregator.py:337`, `tools/discover_sources.py:140` |
| 12 | Ingestion | GitHub Code & Repo Discovery | Automated GitHub API code & tree search across 30+ keywords | GitHub Search API query results | Dynamic list of raw GitHub URLs merged into `discovered_sources.json` | Respects API rate limits; runs in CI or with `GITHUB_TOKEN` | `tools/discover_sources.py:44` |
| 13 | Processing | Strict URI Deduplication | Deduplicates servers based on `scheme://user@host:port` invariant | Candidate URI strings | Deduplicated unique candidate pool | Ignores varying query params / fragments on identical host+port+user | `tools/aggregator.py:354` |
| 14 | Processing | Ultra-Speed TCP/TLS RTT Latency Benchmark | Concurrent non-blocking async socket & TLS handshake latency tester | Host, Port, SNI (timeout 0.85s, 5000 sockets) | Measured RTT latency in milliseconds (`ping_ms`) | Timeout or connection refused returns `999.0` / `9999.0` (dropped) | `tools/aggregator.py:367`, `tools/aggregator.py:648` |
| 15 | Processing | Persistent Dead Nodes Blacklist | Tracks consecutive fail counts across crawls; purges nodes failing >= 3 times | `tools/dead_nodes.json` | Filtered crawl candidate list | Capped at 10,000 dead nodes with auto-cleanup when node revives | `tools/aggregator.py:88`, `tools/aggregator.py:759` |
| 16 | Processing | Node Health History Tracking | Computes cumulative reliability % (`success_checks / total_checks`) | `tools/node_history.json` | `health` percentage float (0.0 to 100.0) | Capped at 50,000 records; oldest evicted by lowest check count | `tools/aggregator.py:67`, `tools/aggregator.py:800` |
| 17 | Processing | Ascending Latency Strict Sorting | Orders all output nodes strictly by lowest measured ping | Array of alive node records | Sorted array where `ping[i] <= ping[i+1]` | Empty array generates fallback response | `tools/aggregator.py:832`, `tools/service_prober.py:1059` |
| 18 | Processing | Russian Whitelist & Anti-Censorship Filter | Identifies nodes utilizing genuine domestic Russian SNIs (Gosuslugi, Sber, VK, Yandex, etc.) | Node URI, SNI, hostname | `sub/anti-whitelist.txt` feed | Case-insensitive keyword matching | `tools/aggregator.py:112`, `tools/aggregator.py:850` |
| 19 | Processing | Country Code & Emoji Badge Detection | Extracts ISO 3166-1 alpha-2 code from host, SNI, remark and formats emoji flags | Node URI string | 2-letter Country Code (`US`, `DE`, etc.) and Emoji Flag (`🇺🇸`, `🇩🇪`) | Non-matching defaults to `"GLOBAL"` / `"🌐"` | `tools/aggregator.py:409`, `tools/aggregator.py:471` |
| 20 | Processing | Node Remark Sanitizer | Cleans marketing/spam tags and formats standardized label | Raw URI, ping, purpose, country, index | Sanitized URI: `{base}#TurboProbe · [Flag] [CC] · [Purpose] #[Idx]` | Escapes invalid characters (`:`, `"`, `'`, `[`, `]`) | `tools/aggregator.py:497`, `tools/service_prober.py:573` |
| 21 | Verification | Deep Xray SOCKS5 Multi-Inbound Prober | Verifies real end-to-end tunnel connectivity via isolated Xray instances | Batch of 75 nodes mapped to local SOCKS5 ports (10900+) | Confirmed alive status, real outgoing IP, real GeoIP location | Child Xray process killed in `finally` block; temp dirs purged | `tools/service_prober.py:460` |
| 22 | Verification | Target Service Accessibility Matrix | Probes 11 target web services through live SOCKS5h remote DNS tunnel | SOCKS5 proxy session to 11 endpoints | Boolean flags in `services: {chatgpt, claude, gemini, youtube, ...}` | Invalid HTTP status or timeout marks service as `false` | `tools/service_prober.py:101`, `tools/service_prober.py:379` |
| 23 | Verification | Micro-burst Bandwidth Benchmark | Downloads 200KB payload from Cloudflare speed endpoint | Live proxy connection | Measured throughput in Mbps (`speed_mbps`) | Errors or slow tunnels report `0.0` Mbps | `tools/service_prober.py:429` |
| 24 | Verification | Globalping Russian Domestic In-Country Prober | Measures ping and connectivity from physical probe nodes inside Russia (Moscow/SPb) | Host/IP target submitted to `api.globalping.io/v1/measurements` | `ru_verified: true`, `ru_ping_ms`, `ru_location` metadata | API errors or timeouts skip domestic tagging without failing build | `tools/service_prober.py:730` |
| 25 | Output Feeds | Paginated Ping Chunks | Splits sorted pool into 500-node chunks with JSON manifest | All alive nodes (e.g. 56,000 nodes) | `sub/chunks/chunk-001.txt`, `...`, `sub/chunks/index.json` | Deletes stale chunk files before regenerating | `tools/aggregator.py:911` |
| 26 | Output Feeds | Dedicated Country Feeds | Generates separate subscription files for every active worldwide country | Country-grouped nodes | `sub/countries/{cc}.txt`, `sub/countries/index.json`, root `{cc}.txt` | Manifest provides country code, emoji flag, count, and file path | `tools/aggregator.py:953`, `tools/service_prober.py:1213` |
| 27 | Output Feeds | Dedicated Target Service Feeds | Generates verified subscription feeds for 11 specific platforms | Verified service-matching nodes | `sub/services/{chatgpt,claude,gemini,perplexity,youtube,discord,instagram,twitter,spotify,github,ai-bundle}.txt` | Empty service pool produces empty file without failing build | `tools/aggregator.py:970`, `tools/service_prober.py:1098` |
| 28 | Output Feeds | Clash Meta YAML Config Generator | Creates complete Clash Meta / Mihomo configuration with auto url-test group | Node list (capped at 500 nodes) | `sub/clash-meta.yaml`, `sub/clash.yaml`, `sub/clash.meta.yaml` | Duplicate proxy names suffixed with unique index | `tools/aggregator.py:525`, `tools/service_prober.py:580`, `worker/index.js:281` |
| 29 | Output Feeds | JSON Database & Preview Feeds | Serializes full node records for web app and edge worker caching | Verified node records list | `sub/nodes.json`, `sub/preview.json`, `docs/sub/preview.json` | Fast serialization via `orjson` with fallback to `json` | `tools/aggregator.py:1017`, `tools/service_prober.py:1068` |
| 30 | Output Feeds | Pipeline Statistics Feed | Outputs metrics summary of the aggregation cycle | Aggregator and prober state counters | `sub/stats.json` | Contains timestamp, source counts, node counts by protocol, ping metrics | `tools/aggregator.py:1071` |
| 31 | Edge Engine | Dynamic Cloudflare Worker Subscriptions | On-the-fly filtering by service, country, protocol, max ping, min health, format | HTTP Request (`/sub`, query params, User-Agent) | Dynamic plain text or Clash YAML response | Fallback mirrors (GitHub Raw, jsDelivr CDN, local TXT) ensure 100% uptime | `worker/index.js:18` |
| 32 | Edge Engine | Client Auto-Detection & Headers | Auto-detects Clash/Mihomo clients via User-Agent and injects sub headers | `User-Agent: ClashMeta/Mihomo/FlClash/Stash` | Auto-switches response to YAML; sets `Profile-Update-Interval` & `Subscription-Userinfo` | Non-Clash clients receive plain text URI list | `worker/index.js:150`, `worker/index.js:243` |

---

## 3. Edge Cases & Observed Behavioral Anomalies

| # | Feature | Input / Condition | Observed Behavior | Root Cause & Mitigation Requirement |
|---|---------|-------------------|-------------------|-------------------------------------|
| 1 | Purpose Classification | `vless://uuid@host:443?security=tls...#Remark` (Non-Reality VLESS) | Labeled as `"Shadowsocks"` instead of `"VLESS"` or `"Ultra-Fast"` | **Bug in `aggregator.py:513`**: `"ss://" in low` evaluates to True on `"vless://"` because `"vless://"` ends with `"ss://"`. Must match exact scheme prefix `low.startswith("ss://")` or check `vless://` first. |
| 2 | Purpose Classification | `vmess://base64...#Remark` | Labeled as `"Shadowsocks"` instead of `"VMess"` | **Bug in `aggregator.py:513`**: `"vmess://"` also ends with `"ss://"`. Must use exact `startswith("ss://")`. |
| 3 | Country Code Detection | `trojan://pass@example.com:443#Tag` or `google.com` | Classified as Country `"CO"` (Colombia) | **Bug in `aggregator.py:484`**: For 2-letter keyword `"co"`, `f".{kw}" in low` matches `".co"` inside `".com"`. Must use strict domain suffix check (`low.endswith(".co")` or `.co/` or regex `\bco\b`). |
| 4 | Country Code Detection | Query params containing `&it=` or `&type=...` | Classified as Country `"IT"` (Italy) | **Bug in `aggregator.py:484`**: `re.search(r'(?:^|[^a-z0-9])it(?:[^a-z0-9]|$)', low)` matches `it` bounded by delimiters in URL queries. Country search must prioritize Hostname and Fragment tag before query string. |
| 5 | Recursive Base64 Unpacker | Nested Base64 string at Depth >= 2 (`b64(b64(raw))`) | Decoding stops at Depth 1; fails to unpack | **Bug in `aggregator.py:312`**: Condition `("://" in dec or "proxies:" in dec)` is False on intermediate Base64 strings. Unpacker must test if `dec` is itself valid Base64 and continue unpacking. |
| 6 | Clash Meta Generation | Hysteria 2 nodes in candidate pool | Hysteria 2 nodes omitted from Clash YAML output | `generate_clash_meta_yaml` in `aggregator.py`, `service_prober.py`, and `worker/index.js` lacked `type: hysteria2` generator branch. Must generate valid Clash Meta Hysteria2 block. |
| 7 | Clash Meta Generation | Shadowsocks nodes in `aggregator.py` | Shadowsocks nodes omitted from Clash YAML output in `aggregator.py` | `aggregator.py` only had `vless` and `trojan` branches in `generate_clash_meta_yaml`. Must support `ss`, `trojan`, `vless`, `hysteria2`. |
| 8 | URI Parsing | IPv6 address with brackets `[2001:db8::1]:8443` | Extracted host contains brackets `[2001:db8::1]` | Xray JSON `vnext.address` requires clean IP without brackets `2001:db8::1`; socket connection requires clean IP. `strip("[]")` must be consistently applied. |
| 9 | Shadowsocks Userinfo | Base64 userinfo missing `=` padding (e.g. length not multiple of 4) | Base64 decode error in strict parsers | `parse_ss_uri` in `service_prober.py` adds `pad = 4 - (len(userinfo) % 4)`. Must ensure padding recovery is applied everywhere before decoding. |
| 10 | Git Merge State | Concurrent CI workflow execution or manual commit | Conflict markers (`<<<<<<< HEAD`, `=======`, `>>>>>>>`) injected into JSON/YAML/TXT files | Line 91 of `aggregator.yml` uses `git pull --rebase -X theirs` or unhandled conflict state. CI workflow must clean conflicted files, validate JSON/YAML syntax before committing, and use atomic push logic. |
| 11 | Globalping API | Network timeout / 429 Rate Limit / Empty probe list | Potential unhandled exception crashing prober | Prober must catch all `requests` exceptions, validate response schema, and return unmutated node list on failure. |
| 12 | Subprocess Management | Crash or SIGINT during `service_prober.py` batch probe | Xray subprocesses left running in background; temp directories leaked | `run_batch_probe` must use `try ... finally` to terminate/kill `proc` and call `shutil.rmtree(tmp_dir, ignore_errors=True)`. |
| 13 | Edge Worker Latency | Client requests 500+ nodes with Clash format conversion | Edge compute CPU timeout (> 50ms) | Worker must limit default slice (e.g. 50-100 nodes for Clash), stream responses, and leverage Edge KV / Cache API (`cacheTtl: 60`). |
| 14 | Web UI Performance | Rendering 5,000+ unfiltered nodes with country flags and badges | DOM thrashing, dropped frames, UI freeze | Web frontend (`turboprobe-web`) must use virtualized list (`react-window` or pagination) and memoized filter selectors (`useMemo`). |

---

## 4. Exact Protocol Specifications & Schemas

### 4.1 VLESS Protocol Specification

#### URI Format:
```
vless://{uuid}@{server}:{port}?security={security}&sni={sni}&fp={fp}&type={network}&pbk={pbk}&sid={sid}&spx={spx}&flow={flow}&path={path}&host={host}&serviceName={serviceName}&encryption=none#{remark}
```

#### Parameter Requirements:
- **UUID** (Required): Standard RFC 4122 UUID format (e.g. `83afd88f-200f-4d89-bfc7-66eff160c1d8`).
- **Server / Port** (Required): IPv4, IPv6 (bracketed in URI), or FQDN. Port integer between `1` and `65535` (default: `443`).
- **Security**:
  - `reality`: Requires `pbk` (32-byte Base64/Base64URL public key). Optional: `sid` (up to 16 hex chars), `spx` (SpiderX path, e.g. `/`), `sni` (destination server name), `fp` (fingerprint: `chrome`, `firefox`, `safari`, `ios`, `edge`, `random`).
  - `tls`: Standard TLS handshake. Optional: `sni`, `alpn` (`h2,http/1.1`), `fp`, `allowInsecure` (`0` or `1`).
  - `none`: Plain unencrypted TCP or WebSocket.
- **Network (`type`)**:
  - `tcp`: Standard TCP.
  - `ws`: WebSocket. Requires `path` (URL-encoded string, default `/`) and `host` (Host header, defaults to SNI).
  - `grpc`: gRPC. Requires `serviceName` (gRPC Gun/Multi service name).
  - `xhttp` / `h2`: Modern multiplexed HTTP transport.
- **Flow**: `xtls-rprx-vision` (optional for Reality/TLS TCP) or empty.
- **Encryption**: Must be `"none"`.

#### Clash Meta YAML Schema:
```yaml
- name: "TurboProbe · 🇩🇪 DE · Reality #01"
  type: vless
  server: 198.51.100.1
  port: 443
  uuid: 83afd88f-200f-4d89-bfc7-66eff160c1d8
  udp: true
  tls: true
  servername: www.microsoft.com
  client-fingerprint: chrome
  network: tcp
  flow: xtls-rprx-vision
  reality-opts:
    public-key: "ABCD1234..."
    short-id: "1234abcd"
```

#### Sing-box JSON Schema:
```json
{
  "type": "vless",
  "tag": "vless-reality-01",
  "server": "198.51.100.1",
  "server_port": 443,
  "uuid": "83afd88f-200f-4d89-bfc7-66eff160c1d8",
  "flow": "xtls-rprx-vision",
  "tls": {
    "enabled": true,
    "server_name": "www.microsoft.com",
    "utls": {
      "enabled": true,
      "fingerprint": "chrome"
    },
    "reality": {
      "enabled": true,
      "public_key": "ABCD1234...",
      "short_id": "1234abcd"
    }
  },
  "packet_encoding": "xudp"
}
```

---

### 4.2 Trojan Protocol Specification

#### URI Format:
```
trojan://{password}@{server}:{port}?security=tls&sni={sni}&type={network}&path={path}&host={host}&allowInsecure={0|1}#{remark}
```

#### Parameter Requirements:
- **Password** (Required): UTF-8 string or hex token.
- **Server / Port** (Required): Host and port (default: `443`).
- **Security**: Always `tls`.
- **SNI**: Server Name Indication domain.
- **Network**: `tcp` (default), `ws` (`path`, `host`), or `grpc` (`serviceName`).

#### Clash Meta YAML Schema:
```yaml
- name: "TurboProbe · 🇳🇱 NL · Trojan #01"
  type: trojan
  server: 198.51.100.2
  port: 443
  password: "SecretPassword123"
  udp: true
  sni: speed.cloudflare.com
  skip-cert-verify: false
  network: tcp
```

---

### 4.3 Shadowsocks Specification (SIP002 & 2022)

#### URI Formats:
- **SIP002**: `ss://{base64(cipher:password)}@{server}:{port}#{remark}`
- **Legacy**: `ss://{base64(cipher:password@server:port)}#{remark}`

#### Supported Ciphers:
- **AEAD**: `aes-128-gcm`, `aes-256-gcm`, `chacha20-ietf-poly1305`, `xchacha20-ietf-poly1305`
- **Shadowsocks-2022**: `2022-blake3-aes-128-gcm`, `2022-blake3-aes-256-gcm`, `2022-blake3-chacha20-poly1305`

#### Clash Meta YAML Schema:
```yaml
- name: "TurboProbe · 🇫🇮 FI · Shadowsocks #01"
  type: ss
  server: 198.51.100.3
  port: 8388
  cipher: aes-256-gcm
  password: "SecretPassword123"
  udp: true
```

---

### 4.4 Hysteria 2 Protocol Specification

#### URI Format:
```
hysteria2://{password}@{server}:{port}?sni={sni}&insecure={0|1}&obfs={type}&obfs-password={password}&ports={ports}#{remark}
```

#### Parameter Requirements:
- **Password** (Required): Authentication string.
- **Server / Port** (Required): Host/IP and UDP port (default: `443`).
- **SNI**: TLS SNI domain for QUIC handshake.
- **insecure**: `1` or `true` to skip certificate validation.
- **obfs**: Obfuscation mode (e.g. `salamander`).
- **obfs-password**: Obfuscation secret.
- **ports / mport**: Port hopping ranges (e.g. `443,10000-20000`).

#### Clash Meta YAML Schema:
```yaml
- name: "TurboProbe · 🇰🇿 KZ · Hy2-Speed #01"
  type: hysteria2
  server: 198.51.100.4
  port: 443
  password: "Hy2SecretPassword"
  sni: test.domain.com
  skip-cert-verify: true
  ports: 443,10000-20000
```

---

## 5. Output Feed Schemas & Directory Structure

```
sub/
├── all.txt                     # All alive verified nodes (ascending ping order)
├── top20.txt                   # Top 20 lowest-latency verified nodes
├── top50.txt                   # Top 50 lowest-latency verified nodes
├── anti-whitelist.txt          # Russian domestic whitelist SNIs & Reality/Hy2 anti-DPI nodes
├── reality.txt                 # VLESS Reality nodes only
├── hysteria2.txt               # Hysteria 2 nodes only
├── trojan.txt                  # Trojan nodes only
├── shadowsocks.txt             # Shadowsocks nodes only
├── clean-ip.txt                # Anti-fraud clean IP reputation nodes
├── youtube-discord.txt         # Low-ping streaming & gaming nodes
├── base64.txt                  # Base64 encoded subscription of all.txt
├── clash.yaml                  # Clash Meta / Mihomo configuration with URL-test & rules
├── clash.meta.yaml             # Mirror of clash.yaml
├── clash-meta.yaml             # Mirror of clash.yaml
├── nodes.json                  # Complete verified database with full service flags & metadata
├── preview.json                # Compact JSON preview payload for instant web UI loading
├── stats.json                  # Aggregator and Prober metrics & statistics
├── chunks/
│   ├── index.json              # Chunk pagination manifest (chunk size, counts, min/max ping)
│   ├── chunk-001.txt           # Paginated nodes 1 - 500
│   ├── chunk-002.txt           # Paginated nodes 501 - 1000
│   └── ...
├── countries/
│   ├── index.json              # Country manifest (code, emoji flag, count, path)
│   ├── de.txt                  # Germany feed
│   ├── nl.txt                  # Netherlands feed
│   ├── us.txt                  # United States feed
│   ├── kz.txt                  # Kazakhstan feed
│   ├── fi.txt                  # Finland feed
│   └── ... (all ISO countries)
└── services/
    ├── index.json              # Service feeds manifest (counts and timestamp)
    ├── chatgpt.txt             # OpenAI ChatGPT verified nodes
    ├── claude.txt              # Anthropic Claude verified nodes
    ├── gemini.txt              # Google Gemini verified nodes
    ├── perplexity.txt          # Perplexity AI verified nodes
    ├── ai-bundle.txt           # Combined AI services verified nodes
    ├── youtube.txt             # YouTube 4K CDN verified nodes
    ├── discord.txt             # Discord gateway verified nodes
    ├── instagram.txt           # Instagram Meta gateway verified nodes
    ├── twitter.txt             # X / Twitter verified nodes
    ├── spotify.txt             # Spotify media verified nodes
    └── github.txt              # GitHub developer verified nodes
```

### 5.1 Schema for `sub/nodes.json` and `sub/preview.json`
```json
{
  "version": "2.0",
  "updated_at": "2026-08-21T12:00:00.000000+00:00",
  "total_nodes": 250,
  "nodes": [
    {
      "uri": "vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@198.51.100.1:443?security=reality&sni=google.com&pbk=abcd...&type=tcp#TurboProbe%20%C2%B7%20%F0%9F%87%A9%F0%9F%87%AA%20DE%20%C2%B7%20Reality%20%2301",
      "ping_ms": 28.5,
      "speed_mbps": 42.1,
      "country": "DE",
      "protocol": "vless",
      "health": 99.5,
      "ru_verified": true,
      "ru_ping_ms": 34.2,
      "ru_location": "Moscow (Rostelecom)",
      "services": {
        "chatgpt": true,
        "claude": true,
        "gemini": true,
        "perplexity": true,
        "youtube": true,
        "discord": true,
        "instagram": true,
        "twitter": true,
        "spotify": true,
        "github": true
      }
    }
  ]
}
```

### 5.2 Schema for `sub/stats.json`
```json
{
  "updated_at": "2026-08-21T12:00:00.000000+00:00",
  "total_sources": 115,
  "seed_sources": 115,
  "discovered_sources": 24,
  "active_sources": 102,
  "raw_fetched": 215000,
  "unique_nodes": 45000,
  "purged_dead_blacklist": 3200,
  "alive_verified_nodes": 1250,
  "best_ping_ms": 4.2,
  "avg_ping_ms": 45.8,
  "anti_whitelist_nodes": 350,
  "reality_nodes": 680,
  "trojan_nodes": 220,
  "hysteria2_nodes": 85,
  "shadowsocks_nodes": 265
}
```

---

## 6. Cloudflare Edge Worker Specification

### 6.1 Supported Routing Matrix:
- `GET /health` -> JSON health check status
- `GET /sub` or `GET /` -> Plain text list of verified nodes (or Clash YAML if client is Clash)
- `GET /sub?services=chatgpt,claude` -> Filter nodes accessible to both/either service
- `GET /sub?country=de,nl` -> Filter nodes located in Germany or Netherlands
- `GET /sub?proto=reality,hy2` -> Filter by protocol
- `GET /sub?max_ping=100` -> Filter nodes with ping <= 100ms
- `GET /sub?min_health=90` -> Filter nodes with historical reliability >= 90%
- `GET /sub?limit=50` -> Limit output count to 50 nodes
- `GET /sub?format=clash` -> Force Clash Meta YAML format
- `GET /sub/ai` or `GET /ai` -> Shorthand for ChatGPT + Claude + Gemini
- `GET /sub/youtube` -> Shorthand for YouTube + Discord
- `GET /sub/reality` -> Shorthand for Reality protocol
- `GET /sub/clash` -> Shorthand for Clash YAML

### 6.2 Standard HTTP Subscription Headers:
- `Content-Type: text/plain; charset=utf-8` or `text/yaml; charset=utf-8`
- `Content-Disposition: inline; filename="TurboProbe_Sub.txt"` or `"TurboProbe_Clash.yaml"`
- `Access-Control-Allow-Origin: *`
- `Profile-Update-Interval: 6` (Updates client subscription every 6 hours)
- `Subscription-Userinfo: upload=0; download=0; total=1073741824000; expire=0` (Reports 1TB quota to client apps)

---

## 7. Comprehensive 4-Tier E2E Test Plan

```
================================================================================
                    TURBOPROBE 4-TIER E2E TEST MATRIX
================================================================================
  Tier 1: Feature Coverage (Core Protocols, Parsers, Feeds, Schemas)
  Tier 2: Boundary & Corner Cases (Malformed URLs, Encodings, Extremes)
  Tier 3: Cross-Feature Combinations (Worker Filtering, Invariants, Sorter)
  Tier 4: Real-World Scenarios (Full E2E Pipeline, CI/CD Rebase, Subprocesses)
================================================================================
```

### Tier 1: Feature Coverage (Core Protocols & Outputs)
- **T1.1 — Protocol URI Parsing & Outbound Generation**:
  - Test VLESS Reality (TCP, WS, gRPC with `pbk`, `sid`, `spx`, `sni`, `fp`).
  - Test VLESS TLS (TCP, WS, gRPC with custom paths and host headers).
  - Test Trojan TLS (TCP, WS, gRPC).
  - Test Shadowsocks SIP002 (AEAD `aes-256-gcm`, `chacha20-ietf-poly1305`).
  - Test Shadowsocks Legacy format (`ss://base64(method:password@host:port)`).
  - Test Hysteria 2 / hy2 protocol extraction.
- **T1.2 — Output Feed Generation & Syntax Validation**:
  - Validate syntax of `clash.yaml` using strict YAML parser; assert valid `proxies`, `proxy-groups`, `rules`.
  - Validate JSON schema of `sub/nodes.json`, `sub/preview.json`, `sub/stats.json`, `sub/chunks/index.json`, `sub/countries/index.json`, `sub/services/index.json`.
  - Validate that `sub/all.txt`, `sub/top20.txt`, `sub/top50.txt`, `sub/base64.txt` contain valid URI lines.
  - Validate all 11 dedicated service files in `sub/services/*.txt`.
- **T1.3 — Web Frontend Compilation & Types**:
  - Execute `npm run build` in `turboprobe-web/`; assert exit code 0 with zero TypeScript errors.
  - Validate TypeScript interfaces in `turboprobe-web/src/types/index.ts` match backend JSON payloads.

### Tier 2: Boundary & Corner Cases (Malformed & Extreme Inputs)
- **T2.1 — Base64 Padding & Decoding Resilience**:
  - Test unpadded Base64 strings (length % 4 == 1, 2, 3) in Shadowsocks and subscription feeds.
  - Test Base64URL characters (`-` and `_`) versus standard Base64 (`+` and `/`).
  - Test multi-layer recursive decoding with Depth = 1, 2, 3, 4, 5.
- **T2.2 — Network & Address Corner Cases**:
  - Test IPv6 addresses in hostnames with brackets `[2001:db8::1]:443` and without brackets.
  - Test domain names ending with `.co`, `.com`, `.org`, `.net` asserting correct country classification (no false `CO` Colombia matches).
  - Test non-standard ports (e.g. `80`, `8080`, `2053`, `8443`, `65535`).
- **T2.3 — String Sanitization & Encodings**:
  - Test URL-encoded Russian/Cyrillic characters, Chinese characters, and Emoji flags in remark fragment.
  - Test fragment tags containing reserved YAML/JSON characters (`:`, `"`, `'`, `[`, `]`, `{`, `}`, `#`, `,`).
- **T2.4 — Extreme Data Volumes & Empty Fallbacks**:
  - Test empty input candidate pool (0 nodes) asserting graceful fallback generation.
  - Test large candidate pools (100,000+ nodes) asserting memory usage stays below limits and execution terminates without crashing.

### Tier 3: Cross-Feature Combinations
- **T3.1 — Cloudflare Worker Multi-Dimensional Filter**:
  - Test simultaneous query: `services=chatgpt,claude&country=de,nl&proto=reality&max_ping=100&min_health=90&limit=10&format=clash`.
  - Verify that every returned node satisfies all specified criteria.
- **T3.2 — Client Auto-Detection & Fallback Protocol**:
  - Simulate request with `User-Agent: ClashMeta/1.18.0` -> verify response is valid YAML with Clash headers.
  - Simulate request with `User-Agent: v2rayNG/1.8.5` -> verify response is plain text URI list.
  - Simulate failure of GitHub raw mirrors -> verify automatic fallback to secondary jsDelivr CDN and local raw txt.
- **T3.3 — Latency Monotonicity & Chunk Invariants**:
  - Verify that for `sub/all.txt`, ping is strictly monotonic: `ping[i] <= ping[i+1]`.
  - Verify for `sub/chunks/`: sum of chunk counts equals `total_nodes`; `chunk[i].ping_max <= chunk[i+1].ping_min`.

### Tier 4: Real-World Scenarios
- **T4.1 — End-to-End Pipeline Execution**:
  - Execute `python tools/aggregator.py --fast` followed by `python tools/service_prober.py --limit 50`.
  - Assert all files in `sub/` are generated, valid, and contain no conflict markers (`<<<<<<<`).
- **T4.2 — Subprocess & File Descriptor Stress Test**:
  - Run multi-threaded Xray prober with 4 parallel instances and 1000+ socket connections.
  - Verify all Xray processes terminate cleanly in `finally` block with 0 zombie processes.
  - Verify no socket leaks / unclosed socket warnings.
- **T4.3 — CI/CD Concurrency & Conflict-Free Git Push**:
  - Simulate concurrent GitHub Actions runners pushing subscription updates.
  - Verify rebase logic does not leave unmerged files or conflict markers in tracked files.
- **T4.4 — Globalping Live Resilience**:
  - Simulate Globalping API network timeout / HTTP 429 / empty measurement results.
  - Verify pipeline finishes successfully and logs clear warning without terminating.
