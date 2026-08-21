# Project: TurboProbe Deep Audit & Refactoring

## Architecture
TurboProbe is an automated, high-performance proxy discovery, aggregation, multi-service probing, subscription distribution, and web visualization platform:
1. **Backend Discovery & Ingestion (`tools/discover_sources.py`, `tools/aggregator.py`)**:
   - Discovers public raw proxy subscriptions and GitHub repositories.
   - Decodes multi-layer Base64, Clash YAML, and Sing-box JSON subscriptions.
   - Performs concurrent TCP/TLS pre-validation, protocol classification, country geo-tagging, and remark sanitization.
   - Generates raw deduplicated lists (`sub/all.txt`, `sub/clash-meta.yaml`, `sub/preview.json`, `sub/nodes.json`).
2. **Multi-Service & Domestic Verification (`tools/service_prober.py`)**:
   - Manages sandboxed child Xray processes across dedicated worker ports.
   - Performs end-to-end HTTP/SOCKS5 service probing against target services (YouTube, Telegram, Discord, Instagram, OpenAI, RuServices, etc.).
   - Integrates Globalping API for domestic Russian latency and accessibility verification.
   - Generates verified service feeds (`sub/services/*.txt`, `sub/services/index.json`, `docs/sub/*`).
3. **Web Visualization Frontend (`turboprobe-web/`)**:
   - React + Vite + TypeScript single-page application.
   - High-performance filtering, search, country categorization, service toggling, and ping/speed sliders over 1000+ nodes.
   - Client-side configuration export (Clash Meta YAML, Sing-box JSON, raw URI list, QR codes).
4. **Edge Subscription Server (`worker/index.js`)**:
   - Cloudflare Worker running on Edge Runtime.
   - Multi-mirror upstream fallback fetching with edge caching.
   - Dynamic conversion of proxy lists into Clash Meta YAML, Sing-box JSON, and Base64 subscription formats.
5. **CI/CD Automation (`.github/workflows/`)**:
   - Scheduled automated workflow executions (`aggregator.yml`, `service-prober.yml`).
   - GitHub Pages deployment, git synchronization, dependency caching, and resource limit configuration (`ulimit -n 65536`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Socket & Session Leak Elimination | Ensure proper closing of all HTTP sessions, raw sockets, SSL sockets, and file descriptors with try/finally blocks across backend tools under 1000+ concurrent connections | M1 | ORIGINAL_REQUEST §R1 |
| F2 | Concurrency & Race Condition Elimination | Replace collision-prone `b_idx % NUM_XRAY_WORKERS` port allocation with safe thread-safe worker pools/queues; optimize ThreadPoolExecutor thread limits in aggregator | M1 | ORIGINAL_REQUEST §R1 |
| F3 | Protocol Parsing & Ingestion Hardening | Robust parsing and outbound generation for VLESS Reality (pbk, sid, fp), Trojan, Shadowsocks (AEAD/2022), Hysteria 2, Clash YAML, Sing-box JSON, and multi-layer Base64 | M1 | ORIGINAL_REQUEST §R1 |
| F4 | Child Xray Lifecycle & Zombie Cleanup | Ensure stderr draining, non-blocking pipe handling, and guaranteed process killing and reaping (`proc.wait()`) in finally blocks without zombie leaks | M1 | ORIGINAL_REQUEST §R1 |
| F5 | Globalping API Resilience | Resilient polling loop, proper timeout handling, TCP/ICMP probe support, and `NoneType` exception prevention on missing/empty ping metrics | M1 | ORIGINAL_REQUEST §R1 |
| F6 | Subscription Data Feed Cleanliness | Eliminate all residual Git conflict markers (`<<<<<<< HEAD`, `=======`, `>>>>>>>`) from data feeds and output generators | M1 | Survey Findings |
| F7 | Web Performance & Memoization (1000+ nodes) | Eliminate redundant re-renders, pre-index search tokens, optimize slider filter performance, and fix React list keys | M2 | ORIGINAL_REQUEST §R2 |
| F8 | Web Type Safety & Badge Rendering | Refactor `types/index.ts`, eliminate all `any` and undefined errors for `ru_verified`, `speed_mbps`, country flags, and implement valid client Clash export | M2 | ORIGINAL_REQUEST §R2 |
| F9 | Clean Web Compilation | Ensure 100% clean TypeScript build with zero errors/warnings (`npm run build` exit code 0) | M2 | ORIGINAL_REQUEST §R2 |
| F10 | Cloudflare Worker Edge Optimization | Optimize CPU/memory usage, add Hysteria 2 support to Clash generator, fix SIP002 Base64 parsing, parallelize mirror fetches with `Promise.any`, add Cache-Control headers | M3 | ORIGINAL_REQUEST §R3 |
| F11 | CI/CD Git Push & Rebase Resilience | Replace fragile push commands with robust fetch-and-rebase retry logic, add workflow concurrency locks, enable Pip/Xray caching, and configure `ulimit -n 65536` | M3 | ORIGINAL_REQUEST §R4 |
| F12 | Full 4-Tier E2E Test Suite | Comprehensive opaque-box test suite covering Tiers 1-4 (feature coverage, boundary cases, pairwise combinations, real-world scenarios) | E2E Track | ORIGINAL_REQUEST §Acceptance |
| F13 | Adversarial Coverage Hardening (Tier 5) | White-box gap analysis, edge-case stress testing, and forensic integrity verification | M4 | Quality Assurance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Suite | Test infrastructure, test runners, and Tiers 1-4 test cases | none | DONE |
| M1 | Backend Tools Audit & Refactoring | `tools/discover_sources.py`, `tools/aggregator.py`, `tools/service_prober.py`, data feeds | none | DONE |
| M2 | Web App Audit & Optimization | `turboprobe-web/` (React, TypeScript, components, types, build) | none | DONE |
| M3 | Cloudflare Worker & CI/CD Workflows | `worker/index.js`, `.github/workflows/` | none | DONE |
| M4 | Final Milestone (E2E Pass & Tier 5 Hardening) | Pass 100% E2E test suite (Tiers 1-4) & Adversarial Hardening (Tier 5) | E2E, M1, M2, M3 | DONE |

## Interface Contracts
### Backend (`tools/`) ↔ Output Feeds (`sub/`, `docs/sub/`)
- `sub/preview.json`: JSON object `{ "total_nodes": int, "updated_at": str, "nodes": [NodeItem] }`
- `sub/nodes.json`: JSON array of sanitized proxy URIs
- `sub/all.txt`: Plaintext list of unique, valid proxy URIs separated by `\n`
- `sub/clash-meta.yaml`: Valid YAML file with `proxies:` block containing valid `vless`, `trojan`, `ss`, `hysteria2` entries
- `sub/services/*.txt`: Plaintext lists of verified working URIs per service tag (e.g., `telegram.txt`, `youtube.txt`, `discord.txt`, `russia.txt`, `chatgpt.txt`)
- `sub/services/index.json`: JSON object mapping service names to counts and metadata

### Output Feeds ↔ Web Frontend (`turboprobe-web/`)
- Web fetches `sub/preview.json` (or fallback `sub/all.txt`)
- `NodeItem` format:
  ```typescript
  interface NodeItem {
    id: string;
    uri: string;
    protocol: "vless" | "trojan" | "ss" | "hysteria2" | "tuic" | "vmess";
    server: string;
    port: number;
    country: string;
    remark: string;
    ping_ms: number;
    speed_mbps?: number;
    ru_verified?: boolean;
    services?: string[];
  }
  ```

### Output Feeds ↔ Cloudflare Worker (`worker/index.js`)
- Worker fetches upstream mirrors in parallel via `Promise.any`
- Converts raw node URIs or JSON feeds into client-specific configurations:
  - `/sub?type=clash`: Clash Meta YAML with `proxies`, `proxy-groups`, and `rules`
  - `/sub?type=singbox`: Sing-box JSON config
  - `/sub?type=base64` or `/sub`: Base64-encoded URI list

## Code Layout
```
friendly-planck/
├── .agents/                    # Agent working directories and metadata
├── .github/
│   └── workflows/
│       ├── aggregator.yml      # Automated scraping & aggregation workflow
│       └── service-prober.yml  # Automated service & Russian accessibility probing workflow
├── docs/                       # GitHub Pages static documentation & subscription mirrors
│   └── sub/
├── sub/                        # Generated subscription feeds & metrics
│   ├── services/
│   ├── all.txt
│   ├── clash-meta.yaml
│   ├── nodes.json
│   └── preview.json
├── tools/                      # Python backend pipeline
│   ├── aggregator.py           # Subscription fetcher, Base64/YAML unpacker & TCP pre-filter
│   ├── discover_sources.py     # GitHub and web crawler for proxy sources
│   ├── service_prober.py       # Xray child process manager & Globalping service verifier
│   └── bin/                    # Binaries (xray)
├── turboprobe-web/             # React/TypeScript web visualization frontend
│   ├── src/
│   │   ├── components/         # UI components (FilterPanel, NodePreviewList, CountryFlags, etc.)
│   │   ├── types/              # TypeScript type definitions (index.ts)
│   │   ├── App.tsx             # Main application component & state management
│   │   └── main.tsx            # Entry point
│   ├── package.json
│   └── tsconfig.json
└── worker/                     # Cloudflare Worker subscription converter
    ├── index.js                # Edge runtime request handler & format generator
    └── wrangler.toml           # Worker deployment configuration
```
