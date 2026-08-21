# Plan — TurboProbe Deep Audit and Refactoring

## Objectives
Execute thorough audit, bug fixes, performance optimization, resource leak elimination, robust typing, and comprehensive testing across all TurboProbe components.

## Phase 0: Survey & Scope Mapping
- Spawn 3 parallel Explorers to map full repository details:
  1. Explorer 1 (Backend Specialist): Audit tools/discover_sources.py, tools/aggregator.py, tools/service_prober.py for FD/socket leaks, concurrency/race conditions, protocol parsers, Xray child process cleanup, and Globalping API resilience.
  2. Explorer 2 (Frontend & Edge/CI Specialist): Audit turboprobe-web/ (React/TS, re-renders, types/index.ts, build errors), worker/index.js (Edge runtime memory/CPU, fallbacks, Clash YAML & text generation), and .github/workflows/ (git rebase, ulimit, caching).
  3. Explorer 3 / Spec Miner (Protocols, Formats & Test Specs): Comprehensive inventory of all subscription formats (VLESS, Trojan, Shadowsocks, Hysteria2, Clash YAML, Sing-box JSON, Base64), service feeds, outputs, and requirements for acceptance criteria.

## Phase 1: Architecture & Milestone Decomposition
- Aggregate survey findings into `PROJECT.md` (Feature Inventory, Architecture, Milestones, Interface Contracts, Code Layout).
- Spawn E2E Testing Track Orchestrator to establish `TEST_INFRA.md` and build opaque-box test suites (Tiers 1-4).

## Phase 2: Execution of Milestones
- Milestone 1: Backend Tools Audit & Refactoring (tools/)
- Milestone 2: Web App Audit & Optimization (turboprobe-web/)
- Milestone 3: Cloudflare Worker & CI/CD (.github/workflows/, worker/)

## Phase 3: Verification & Hardening
- Complete Phase 1 E2E testing (Tiers 1-4) against TEST_READY.md.
- Run Phase 2 Adversarial Coverage Hardening (Tier 5) with Challengers & Reviewers.
- Independent Forensic Audit verification.

## Phase 4: Delivery
- Victory claim and comprehensive human report.
