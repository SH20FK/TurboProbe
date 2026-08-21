# TurboProbe Comprehensive Technical Survey & Audit Report (Scope 2)

**Author:** Teamwork Explorer (`explorer_survey_2`)  
**Date:** 2026-08-21  
**Scope:**
1. `turboprobe-web/` (React 19, Vite, Tailwind CSS v4, TypeScript Web Application)
2. `worker/index.js` (Cloudflare Worker Dynamic Subscription Generator)
3. `.github/workflows/` (`aggregator.yml`, CI/CD Concurrency, Caching, Push Resilience)

---

## Executive Summary

A comprehensive, line-by-line read-only audit of the TurboProbe web application, Cloudflare Edge Worker, and GitHub Actions CI/CD workflows revealed several critical architectural flaws, data integrity issues, type safety gaps, and edge runtime scalability bottlenecks:

1. **Critical Data Integrity Issue (Merge Conflicts in Production Feeds):**
   - All subscription and preview files (`sub/preview.json`, `docs/sub/preview.json`, `sub/*.txt`, `docs/sub/*.txt`) contain unmerged Git conflict markers (`<<<<<<< HEAD`, `=======`, `>>>>>>>`).
   - This causes `fetch().json()` in both the Web UI and Cloudflare Worker to fail with `SyntaxError`, forcing them into fallback modes that parse conflict markers as invalid proxy URIs.

2. **Web Frontend (`turboprobe-web/`):**
   - **Rendering & Memoization:** In `App.tsx`, filtering 1000+ nodes performs repetitive O(N) string splitting, URL parsing, and regex evaluations on every slider tick (e.g. `maxPing`, `minHealth`) without debouncing or pre-normalized search tokens.
   - **List Virtualization:** `NodePreviewList.tsx` hard-slices results to 50 nodes (`nodes.slice(0, 50)`), preventing users from seeing remaining matches. Array index keys (`key={index}`) cause DOM reuse issues.
   - **Broken Client-Side Clash Export:** `handleDownloadClash` in `App.tsx` generates dummy proxies (`server: ...`), producing invalid Clash YAML.
   - **Missing Country Flags:** `CountryFlags.tsx` lacks SVG definitions for `dk` (Denmark), `rs` (Serbia), and `nz` (New Zealand), despite being present in `FilterPanel.tsx`.
   - **Dead Code & Loose Types:** `PresetSelector.tsx` and `Globe.tsx` are unused; `Globe.tsx` contains `any` casts.

3. **Cloudflare Worker (`worker/index.js`):**
   - **Memory & CPU Limits:** Parsing large (10MB+) JSON payloads in-memory via `await res.json()` approaches Worker 128MB RAM limits. Calling `new URL()` in loops over thousands of nodes risks exceeding the 50ms CPU limit.
   - **Clash YAML Protocol Gaps:** Lacks support for Hysteria 2 (`hy2` / `hysteria2`). Corrupts Base64 SIP002 Shadowsocks URIs due to premature `new URL()` hostname splitting.
   - **Cache Headers:** Worker responses lack `Cache-Control` headers, bypassing Cloudflare Edge caching and forcing full recomputation per request.

4. **CI/CD Automation (`.github/workflows/aggregator.yml`):**
   - **Non-Fast-Forward Push Failures:** Push fallback `git pull --rebase -X theirs` lacks conflict abort handling, which caused the corrupted merge conflict markers in committed data files.
   - **Missing Workflow Concurrency:** No `concurrency` lock allows overlapping runs to create race conditions.
   - **Missing Caching & Web Build:** Every run re-downloads Pip packages and Xray zip releases. The web frontend is not compiled during CI runs.

---

## 1. Deep Audit: `turboprobe-web/`

### 1.1 State Management & Ingestion Pipeline
- **File:** `turboprobe-web/src/App.tsx` (Lines 26–87)
- **Observations:**
  - `loadData()` uses `Promise.any()` across three mirror URLs (`sub/preview.json`, jsDelivr CDN, GitHub Raw CDN).
  - When `preview.json` fails (e.g., due to corrupt JSON syntax), it falls back to `top50.txt`.
  - The fallback parser splits lines by `\n` and blindly maps lines to `NodeItem` objects without validating whether each line is a valid URI scheme (`vless://`, `ss://`, `trojan://`, `hy2://`).
  - Lines containing Git conflict markers (e.g. `<<<<<<< HEAD`) are ingested into state as active nodes.
- **Remediation Plan:**
  1. Add runtime schema validation for ingested JSON data (ensure `Array.isArray(data.nodes)` and filter out invalid URI entries).
  2. In text fallback parsing, sanitize lines with regex `^[a-z0-9]+:\/\/` before creating node objects.

### 1.2 Filtering Performance & Bottlenecks with 1000+ Nodes
- **File:** `turboprobe-web/src/App.tsx` (Lines 174–226)
- **Observations:**
  - `filteredNodes` is memoized against 6 state variables: `allNodes`, `selectedServices`, `selectedCountries`, `selectedProtos`, `maxPing`, `minHealth`.
  - Inside the `.filter()` callback:
    - **Country Filter (Lines 185–197):** Evaluates `node.uri.split('#')[1].toLowerCase()` and tests 4 substring patterns (`[target]`, `(target)`, `-target-`, ` target `) per selected country per node.
    - **Protocol Filter (Lines 199–212):** Evaluates `nUri.includes('pbk=')`, `nUri.startsWith('hy2://')`, `nUri.startsWith('trojan://')`, `nUri.startsWith('ss://')`, `nUri.startsWith('vless://')` per selected protocol per node.
  - When users drag the `maxPing` or `minHealth` sliders in `FilterPanel.tsx`, `onChange` triggers 60+ times per second. Re-running un-indexed string splits and substring searches across 1000+ nodes causes UI frame drops on mobile and low-spec machines.
- **Remediation Plan:**
  1. **Precompute Search Indices:** When `allNodes` is loaded, normalize and attach computed fields:
     - `normalizedCountry: (node.country || '').toLowerCase()`
     - `normalizedProto: (node.protocol || extractProto(node.uri)).toLowerCase()`
     - `isReality: node.uri.includes('pbk=') || (node.protocol || '').includes('reality')`
     - `cleanTag: extractRemark(node.uri).toLowerCase()`
  2. **Debounce Sliders:** Debounce slider state updates by 50ms or use React 19 `useDeferredValue` on filter criteria.

### 1.3 List Rendering & Virtualization
- **File:** `turboprobe-web/src/App.tsx` (Line 340) & `turboprobe-web/src/components/NodePreviewList.tsx` (Lines 102–184)
- **Observations:**
  - `App.tsx` hard-slices nodes: `<NodePreviewList nodes={filteredNodes.slice(0, 50)} ... />`.
  - The user interface provides no pagination, infinite scrolling, or virtualization to view nodes beyond index 49.
  - In `NodePreviewList.tsx` (Line 119):
    `<div key={index} className="...">` uses the array index as the React key. When filters change, React reuses existing DOM nodes and misaligns animation states.
  - In `NodePreviewList.tsx` (Line 114):
    `displayTitle = displayTitle.replace(/·\s*(?:[^\w\s]{1,4}\s*)?[A-Za-z]{2}(?:\s+[A-Za-z]{2})?\b/g, ...);` runs an unmemoized RegExp on every item during every render pass.
  - In `NodePreviewList.tsx` (Line 22): `copiedIndex` uses array index, causing the "Copied" badge to shift if filter results change during the 1.5s timeout.
- **Remediation Plan:**
  1. Replace `key={index}` with `key={node.uri}`.
  2. Implement an expandable "Show More (+50)" button or windowed list to browse the entire pool.
  3. Track copied state by URI (`copiedUri: string | null`) instead of index.
  4. Memoize `displayTitle` or compute it once during ingestion.

### 1.4 Type Safety & `types/index.ts`
- **File:** `turboprobe-web/src/types/index.ts`
- **Observations:**
  - `NodeItem` defines optional fields (`ping_ms?: number`, `speed_mbps?: number`, `ru_verified?: boolean`, `ru_ping_ms?: number`, `ru_location?: string`).
  - In `NodePreviewList.tsx`:
    - Line 104: `const ping = node.ping_ms ? Math.round(node.ping_ms) : 35 + index * 2;` — if `node.ping_ms === 0`, `0` evaluates to falsy, wrongly falling back to synthetic ping.
    - Line 150: `node.speed_mbps && node.speed_mbps > 0` prints raw float numbers (e.g. `24.5678 Mbps`).
  - In `Globe.tsx`:
    - Line 234: `{ type: "Sphere" } as any`
    - Line 240: `landFeatures.features.forEach((feature: any) => {`
- **Remediation Plan:**
  1. Fix ping check to `typeof node.ping_ms === 'number' ? Math.round(node.ping_ms) : (35 + index * 2)`.
  2. Format speed to one decimal place: `node.speed_mbps.toFixed(1)`.
  3. Remove or properly type `Globe.tsx` GeoJSON interfaces.

### 1.5 Broken Client-Side Clash Export
- **File:** `turboprobe-web/src/App.tsx` (Lines 269–290)
- **Observations:**
  - `handleDownloadClash` generates:
    `return '  - {name: "' + cleanName + '", type: ' + (n.protocol || 'vless') + ', server: ...}';`
  - The literal string `server: ...` produces broken YAML syntax.
- **Remediation Plan:**
  - Either import a client-side parser to extract genuine server, port, and credentials, or direct the download to the worker endpoint `subUrl + '&format=clash'`.

### 1.6 Country Flags Gaps
- **File:** `turboprobe-web/src/components/CountryFlags.tsx`
- **Observations:**
  - `KNOWN_COUNTRIES` in `FilterPanel.tsx` includes `dk` (Denmark), `rs` (Serbia), `nz` (New Zealand).
  - `CountryFlags.tsx` does not have `case 'dk':`, `case 'rs':`, `case 'nz':`, defaulting to the generic globe icon.
- **Remediation Plan:**
  - Add SVG implementations for Denmark (`#C60C30` with white cross), Serbia (red/blue/white tricolor), and New Zealand (`#00247D` with Union Jack and Southern Cross).

---

## 2. Deep Audit: `worker/index.js` (Cloudflare Worker)

### 2.1 Edge Runtime Memory & CPU Limits
- **File:** `worker/index.js` (Lines 110–135 & 281–390)
- **Observations:**
  - **Memory:** `worker/index.js` sequentially fetches JSON mirror files and parses them into memory with `await res.json()`. If `nodes.json` reaches 50,000 nodes (~20MB JSON), V8 object allocations approach 80MB+, nearing the 128MB memory limit of Cloudflare Workers.
  - **CPU:** `generateClashMetaYaml` executes `new URL(node.uri)` and multiple string operations in a synchronous `forEach` loop. For large node counts, this risks exceeding the 50ms CPU execution budget.
  - **Sequential Network Fetching:** The worker queries 4 mirrors sequentially in a `for` loop. If raw GitHub hangs or throttles, the worker blocks until timeout.
- **Remediation Plan:**
  1. Use `Promise.any()` with `AbortController` (timeout 2000ms) to fetch mirrors in parallel.
  2. Enforce an upper bound on nodes processed in memory (e.g. max 500 nodes parsed for YAML generation).

### 2.2 Protocol Support & Parser Bugs in Clash Meta YAML Generation
- **File:** `worker/index.js` (Lines 281–390)
- **Observations:**
  1. **Missing Hysteria 2 Protocol:** `generateClashMetaYaml` only checks `vless`, `trojan`, and `ss`. It completely ignores `hy2` / `hysteria2`. Hysteria 2 nodes are omitted from generated Clash subscriptions.
  2. **Shadowsocks Base64 Parsing Bug:**
     - Line 290 calls `new URL(uri)`.
     - For standard SIP002 URIs (`ss://BASE64_USERINFO@hostname:port#Tag`), if `BASE64_USERINFO` itself does not have `@`, `new URL()` parses the whole base64 string as `hostname`!
     - In line 361, `const host = urlObj.hostname` will contain the base64 userinfo, resulting in broken configs: `server: YWVzLTI1Ni1nY20...` and `port: 443`.
- **Remediation Plan:**
  1. Add Hysteria 2 generator in `generateClashMetaYaml`:
     ```javascript
     if (proto === 'hy2' || proto === 'hysteria2') {
       const sni = urlObj.searchParams.get('sni') || host;
       const insecure = urlObj.searchParams.get('insecure') === '1';
       proxies.push([
         `  - name: "${name}"`,
         `    type: hysteria2`,
         `    server: ${host}`,
         `    port: ${port}`,
         `    password: ${user}`,
         `    sni: ${sni}`,
         `    skip-cert-verify: ${insecure}`
       ].join('\n'));
       proxyNames.push(name);
     }
     ```
  2. Correct Shadowsocks parsing by splitting `://`, `@`, and `#` before invoking `new URL()`.

### 2.3 Edge Caching & Cache-Control Headers
- **File:** `worker/index.js` (Lines 250–274)
- **Observations:**
  - Response headers include `Content-Type`, `Content-Disposition`, `Profile-Update-Interval`, and `Subscription-Userinfo`, but **no `Cache-Control` header**.
  - Every client request invokes the Worker without Cloudflare edge caching.
- **Remediation Plan:**
  - Add `Cache-Control: public, max-age=60, s-maxage=300` to worker responses.

---

## 3. Deep Audit: `.github/workflows/` (CI/CD Automation)

### 3.1 Non-Fast-Forward Push Resolution & Race Conditions
- **File:** `.github/workflows/aggregator.yml` (Lines 80–92)
- **Observations:**
  - Push step:
    `git push origin HEAD:main || (git pull --rebase -X theirs origin main && git push origin HEAD:main) || git push -f origin HEAD:main`
  - `git pull --rebase -X theirs` does not automatically resolve conflicts in non-text files or when rebase halts. When rebase stops in a conflicted state, files retain `<<<<<<< HEAD` conflict markers.
  - This command sequence is what caused the current corrupted merge markers in `sub/preview.json` and all `sub/*.txt` files.
- **Remediation Plan:**
  1. Add workflow-level concurrency control to prevent simultaneous runs:
     ```yaml
     concurrency:
       group: vpn-aggregator-job
       cancel-in-progress: false
     ```
  2. Implement an atomic fetch-and-rebase retry loop with clean rollback:
     ```bash
     for attempt in 1 2 3 4 5; do
       git fetch origin main
       git rebase origin/main || (git rebase --abort && git checkout origin/main -- sub/ docs/sub/ tools/ && git add sub/ docs/sub/ tools/)
       git push origin HEAD:main && exit 0
       sleep $((attempt * 3))
     done
     exit 1
     ```

### 3.2 Dependency & Binary Caching
- **File:** `.github/workflows/aggregator.yml` (Lines 38–45)
- **Observations:**
  - Python packages (`requests`, `urllib3`, `orjson`, `httpx`, `aiohttp`) are installed with `pip install` on every run with no pip cache.
  - Xray-core zip is downloaded from GitHub releases on every run with `curl`.
- **Remediation Plan:**
  1. Add `actions/cache@v4` for `~/.cache/pip`.
  2. Cache `/usr/local/bin/xray` keyed by Xray version.

### 3.3 Web Build & Split Prober Workflow
- **Observations:**
  - `aggregator.yml` copies `sub/*` to `docs/sub/`, but does not run `npm run build` in `turboprobe-web/`. Web assets in `docs/` are not automatically refreshed when frontend code updates.
  - A separate lightweight `service-prober.yml` workflow should be configured to run hourly for fast health checks without running the heavy 15-minute multi-platform crawler.

---

## 4. Concrete Remediation Action Plan

| Priority | Component | File | Proposed Fix |
|---|---|---|---|
| **P0** | Feed Data | `sub/` & `docs/sub/` | Clean all merge conflict markers (`<<<<<<< HEAD`, `=======`, `>>>>>>>`) from JSON and text feeds. |
| **P0** | CI/CD | `aggregator.yml` | Add `concurrency` lock and replace `git pull --rebase -X theirs` with atomic fetch-rebase retry loop. |
| **P1** | Worker | `worker/index.js` | Add Hysteria 2 parsing to `generateClashMetaYaml`, fix SIP002 Shadowsocks parsing, add `Cache-Control` headers. |
| **P1** | Frontend | `turboprobe-web/App.tsx` | Sanitize fallback lines, pre-index node search tokens, fix client Clash export dummy `server: ...`. |
| **P1** | Frontend | `NodePreviewList.tsx` | Change `key={index}` to `key={node.uri}`, fix ping `0` check, format `speed_mbps`, add "Show More" expansion. |
| **P2** | Frontend | `CountryFlags.tsx` | Add SVG flags for `dk`, `rs`, and `nz`. |
| **P2** | CI/CD | `aggregator.yml` & `service-prober.yml` | Add Pip/Xray caching, setup Node and build `turboprobe-web` to `docs/`. |
