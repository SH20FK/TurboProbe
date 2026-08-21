# Handoff Report — Explorer Survey 2

## 1. Observation
- **Git Merge Conflict Markers in Live Feeds:**
  - `grep_search` for `<<<<<<<` returned 48 matches across `sub/` and `docs/sub/` (e.g., `sub/preview.json:2`, `sub/all.txt`, `sub/top50.txt`, `docs/sub/preview.json:2`).
  - Verbatim lines from `sub/preview.json`:
    - Line 2: `<<<<<<< HEAD`
    - Line 49: `=======`
    - Line 51: `"total_nodes": 56449,`
  - In `turboprobe-web/src/App.tsx:53`, `const data = await Promise.any(...)` fails with `SyntaxError` when parsing `preview.json` due to these conflict markers, immediately dropping to text fallback.
  - In text fallback (`App.tsx:60-76`), `lines.map(...)` treats `<<<<<<< HEAD` as proxy URIs.

- **Web Frontend (`turboprobe-web/`):**
  - In `src/App.tsx:269-290`, `handleDownloadClash` contains:
    `return '  - {name: "' + cleanName + '", type: ' + (n.protocol || 'vless') + ', server: ...}';`
    The literal text `server: ...` exports non-functional Clash YAML.
  - In `src/App.tsx:185-197`, filtering iterates through `node.uri.split('#')[1].toLowerCase()` and tests 4 substrings for every selected country on every slider movement without throttling or indexing.
  - In `src/components/NodePreviewList.tsx:119`, `<div key={index}>` uses array index for dynamic list items.
  - In `src/components/NodePreviewList.tsx:104`, `node.ping_ms ? Math.round(node.ping_ms) : 35 + index * 2` fails for `node.ping_ms === 0`.
  - In `src/components/CountryFlags.tsx`, switch cases miss `dk`, `rs`, and `nz` which exist in `FilterPanel.tsx:KNOWN_COUNTRIES`.
  - `npm run build` succeeds (exit code 0, 436ms, bundle size 415.24 kB JS / 32.74 kB CSS).

- **Cloudflare Worker (`worker/index.js`):**
  - In `worker/index.js:111-134`, 4 mirrors are fetched sequentially in a loop.
  - In `worker/index.js:281-390`, `generateClashMetaYaml` handles `vless`, `trojan`, and `ss`, but lacks any handler for `hy2` / `hysteria2`.
  - In `worker/index.js:361-387`, Shadowsocks SIP002 Base64 URIs are corrupted because `new URL(uri)` sets `urlObj.hostname` to the un-decoded Base64 userinfo.
  - In `worker/index.js:250-274`, responses lack `Cache-Control` headers.

- **CI/CD Automation (`.github/workflows/aggregator.yml`):**
  - Line 91: `git push origin HEAD:main || (git pull --rebase -X theirs origin main && git push origin HEAD:main) || git push -f origin HEAD:main` lacks conflict abort handling, allowing unmerged conflict markers to be pushed to `main`.
  - No `concurrency` property is defined on `aggregator.yml`.
  - Dependencies (`pip install`, `Xray-core` zip) are downloaded on every run without caching.
  - No frontend build step exists in `aggregator.yml`.

## 2. Logic Chain
1. **From Observation 1:** Conflict markers in `sub/preview.json` cause JSON parsers in `App.tsx` and `worker/index.js` to reject with `SyntaxError`.
2. **From Observation 1 & 2:** When JSON parsing fails, the fallback text parser ingests lines from `top50.txt` without validating URI format (`^[a-z0-9]+:\/\/`), leading to `NodeItem` objects with `uri: "<<<<<<< HEAD"`.
3. **From Observation 2:** Client-side Clash export creates placeholder strings (`server: ...`) rather than parsing connection parameters, misleading users who attempt to download client YAML directly from the browser.
4. **From Observation 3:** In `worker/index.js`, missing Hysteria 2 parsing drops high-speed UDP proxies from Clash subscriptions, while premature `new URL()` hostname parsing breaks SIP002 Shadowsocks configs.
5. **From Observation 4:** In `aggregator.yml`, `git pull --rebase -X theirs` leaves conflict markers on disk when rebasing non-trivial file modifications. When followed by unconditional git push commands, corrupt conflict markers get committed into production branches.

## 3. Caveats
- No live Cloudflare Worker deployment was executed (read-only audit). Worker behavior was evaluated via static source code analysis against Edge Runtime v8 specifications.
- `tools/` scripts (`discover_sources.py`, `aggregator.py`, `service_prober.py`) were analyzed solely in the context of their interaction with JSON/TXT feeds and CI/CD workflow invocations.

## 4. Conclusion
The repository's web application and Cloudflare Worker have clean core designs, but suffer from 4 actionable categories of issues:
1. **Critical:** Production feeds in `sub/` and `docs/sub/` contain Git conflict markers and must be cleaned.
2. **CI/CD:** `aggregator.yml` requires concurrency locks, atomic fetch-rebase retry logic, and Pip/Xray caching.
3. **Edge Worker:** `worker/index.js` must implement Hysteria 2 YAML generation, fix Base64 Shadowsocks URI decoding, parallelize mirror fetches, and add `Cache-Control`.
4. **Web Frontend:** `turboprobe-web` requires URI validation on fallback ingestion, pre-indexed search tokens for 1000+ node scaling, fix for client Clash YAML export, `key={node.uri}` in `NodePreviewList`, and missing SVG flags (`dk`, `rs`, `nz`).

## 5. Verification Method
- **Verify Conflict Markers:**
  Run `rg "<<<<<<<" .` — Must return 0 matches after data feeds are regenerated.
- **Verify Web Build:**
  Run `npm run build` in `turboprobe-web/` — Must complete with exit code 0.
- **Verify Worker Syntax & Formatting:**
  Execute `npx oxlint` or `node --check worker/index.js` — Must pass without syntax errors.
- **Inspect Detailed Report:**
  Review `.agents/explorer_survey_2/survey_report.md` for exact line-by-line remediation proposals.
