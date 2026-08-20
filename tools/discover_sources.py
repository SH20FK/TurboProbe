#!/usr/bin/env python3
"""
TurboProbe Ultra-Source Discovery Bot v3.0 (Global GitHub & Telegram Crawler)
=============================================================================
Continuously crawls the ENTIRE GitHub ecosystem and public Telegram feeds:
1. 🔍 Dynamic GitHub Repository Search (20+ topic & keyword queries with pagination)
2. 🌳 Deep Repository Tree Inspector (Recursively discovers all .txt/.yaml/.json files)
3. 🔎 Dynamic GitHub Code Search (VLESS Reality, Hysteria 2, Trojan, Clash Meta)
4. 📡 Public Telegram Web Channels (Direct nodes & sub links extraction)
5. 🧪 Multi-threaded Concurrent Validator (Scores & merges active sources)

Discovered sources are validated and merged into `tools/discovered_sources.json`.
Direct Telegram node feeds are saved into `tools/telegram_feed.txt`.
"""

import os
import sys
import re
import json
import time
import urllib.request
import urllib.parse
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aggregator import extract_uris_from_content, SOURCES

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
DISCOVERED_PATH = os.path.join(TOOLS_DIR, "discovered_sources.json")
TELEGRAM_FEED_PATH = os.path.join(TOOLS_DIR, "telegram_feed.txt")

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
GITHUB_API = "https://api.github.com"

# =============================================================================
# 1. 🔍 DYNAMIC GITHUB CODE SEARCH QUERIES
# =============================================================================
GITHUB_CODE_QUERIES = [
    "vless:// security=reality extension:txt",
    "hysteria2:// extension:txt",
    "trojan:// extension:txt",
    "vless:// pbk= extension:txt",
    "vless:// fp=chrome extension:txt",
    "filename:reality.txt vless://",
    "filename:all.txt vless://",
    "filename:vless.txt vless://",
    "filename:nodes.txt vless://",
    "filename:sub.txt vless://",
    "path:sub extension:txt vless://",
    "clash.meta proxies: extension:yaml",
    "clash-meta proxies: extension:yaml",
]

# =============================================================================
# 2. 📦 DYNAMIC GITHUB REPOSITORY SEARCH MATRIX (Scans all GitHub repos)
# =============================================================================
DYNAMIC_REPO_QUERIES = [
    "vless sort:updated",
    "vless-reality sort:updated",
    "v2ray-share sort:updated",
    "free-vless sort:updated",
    "clash-meta sort:updated",
    "clash-meta-config sort:updated",
    "hysteria2-nodes sort:updated",
    "sing-box-config sort:updated",
    "vpn-subscription sort:updated",
    "free-nodes sort:updated",
    "v2ray-collector sort:updated",
    "shadowsocks-aggregator sort:updated",
    "xray-nodes sort:updated",
    "proxy-pool v2ray sort:updated",
    "sub-merge sort:updated",
    "topic:vless",
    "topic:v2ray",
    "topic:hysteria2",
    "topic:clash-meta",
    "topic:sing-box",
    "topic:xray",
    "topic:shadowrocket",
    "topic:v2ray-config",
    "topic:free-vpn",
]

# Seed baseline of high-yield active proxy repositories
SEED_REPOSITORIES = [
    ("m3hd1-r/free-v2ray-collector", "main"),
    ("Surfboardv2ray/v2ray-worker-sub", "master"),
    ("yebekhe/TVC", "main"),
    ("vfarid/v2ray-share", "master"),
    ("awesome-vpn/awesome-vpn", "master"),
    ("freefq/free", "master"),
    ("mahdibland/ShadowsocksAggregator", "master"),
    ("Pawdroid/Free-servers", "main"),
    ("anaer/Sub", "main"),
    ("peasoft/NoMore-Garbage", "master"),
    ("ermaozi/get_subscribe", "main"),
    ("tbbatbb/Proxy", "master"),
    ("mfuu/v2ray", "master"),
    ("ts-sf/fly", "main"),
    ("Leon406/SubCrawler", "main"),
    ("w1770946466/Auto_proxy", "main"),
    ("snakem982/proxypool", "main"),
    ("barry-far/V2ray-Configs", "main"),
    ("yebekhe/TelegramV2rayCollector", "main"),
    ("LalatinaHub/Mineral", "master"),
    ("soroushmirzaei/telegram-configs-collector", "main"),
    ("MrMohebi/xray-proxy-grabber-telegram", "master"),
    ("Epodonios/v2ray-configs", "main"),
    ("hrostami/collector", "main"),
    ("KaringX/karing", "main"),
    ("coldwater-10/vpn_sub", "main"),
    ("AlienVPN402/AlienVPN402", "main"),
    ("MrPooyaX/Vplay", "main"),
    ("miladrahimi/v2ray-collector", "main"),
]

# =============================================================================
# 3. 📡 PUBLIC TELEGRAM CHANNELS
# =============================================================================
TELEGRAM_CHANNELS = [
    "v2rayng_org",
    "v2ray_configs_pool",
    "vless_reality",
    "free4allvpn",
    "PrivateVPNs",
    "V2rayNG_VPNN",
    "v2rayngvpn",
    "customv2ray",
    "Shadowsocks_v2ray",
    "vmess_vless_v2rayng",
    "V2rayNGn",
    "dailyv2ray",
    "vpn_ocean",
    "v2ray_free_conf",
    "v2ray_outlineir",
    "Server_V2ray",
    "V2ray_Alpha",
    "ConfigsHUB",
    "v2ray_custom",
    "MehradLearn",
    "VPNCUSTOMIZE",
    "DirectVPN",
    "v2ray_vpn_ir",
    "free_v2ray_configs",
    "VlessConfig",
    "Proxy_Kafe",
    "OutlineVpnOfficial",
]

MIN_NODES_TO_KEEP = 5
MAX_SEARCH_PAGES = 3
REQUEST_PAUSE = 1.0

def fetch_url(url: str, timeout: int = 8, headers: dict = None) -> str:
    """Fetches text content from URL with custom headers."""
    default_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain,*/*;q=0.8",
    }
    if headers:
        default_headers.update(headers)
    req = urllib.request.Request(url, headers=default_headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="ignore")
    except Exception:
        return ""

def gh_api_get(url: str):
    """Makes an authenticated or unauthenticated request to GitHub API."""
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "TurboProbe-Source-Discovery/3.0",
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=12) as resp:
        return json.loads(resp.read().decode("utf-8"))

# =============================================================================
# 1. 🔍 GITHUB CODE SEARCH DISCOVERY
# =============================================================================
def discover_from_github_code() -> set:
    if not GITHUB_TOKEN:
        print("  ⚠️ No GITHUB_TOKEN in local env; GitHub Code Search API will run in CI workflow.", flush=True)
        return set()

    found_raw_urls = set()
    for query in GITHUB_CODE_QUERIES:
        q_enc = urllib.parse.quote(query)
        for page in range(1, MAX_SEARCH_PAGES + 1):
            api_url = f"{GITHUB_API}/search/code?q={q_enc}&per_page=30&page={page}"
            try:
                data = gh_api_get(api_url)
                items = data.get("items", [])
                if not items:
                    break
                for item in items:
                    raw_url = item.get("html_url", "").replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/")
                    if raw_url:
                        found_raw_urls.add(raw_url)
                time.sleep(REQUEST_PAUSE)
            except Exception:
                break
    print(f"  🔎 GitHub Code Search yielded {len(found_raw_urls)} candidate raw files", flush=True)
    return found_raw_urls

# =============================================================================
# 2. 📦 DYNAMIC GITHUB REPOSITORY CRAWLER (Global Multi-Search + Tree Discovery)
# =============================================================================
def crawl_single_repository(full_name: str, branch: str = "main") -> set:
    """Discovers all possible subscription files & README links in a repository."""
    candidates = set()

    # 1. Standard paths
    common_sub_paths = [
        f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/all.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/vless.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/reality.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/shadowsocks.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/trojan.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/hysteria2.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/hy2.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/all.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/vless.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/reality.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/subs.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/sub.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/list.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/nodes.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/clash.meta.yaml",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/meta.yaml",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/config.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/All_Configs_Sub.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/All_Configs_base64_Sub.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/Splitted-By-Protocol/vless.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/Splitted-By-Protocol/trojan.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/Splitted-By-Protocol/ss.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/Splitted-By-Protocol/hysteria2.txt",
    ]
    candidates.update(common_sub_paths)

    # 2. Scrape README for external subscription URLs
    readme_url = f"https://raw.githubusercontent.com/{full_name}/{branch}/README.md"
    readme_text = fetch_url(readme_url, timeout=5)
    if readme_text:
        sub_links = re.findall(r'https?://[^\s\'"<>)]+(?:sub|\.txt|\.yaml|raw|workers\.dev|pages\.dev)[^\s\'"<>)]*', readme_text)
        for link in sub_links:
            if "github.com" in link and "/blob/" in link:
                link = link.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/")
            candidates.add(link)

    return candidates

def search_single_query(q: str) -> list:
    results = []
    q_enc = urllib.parse.quote(q)
    for page in range(1, 3):
        api_url = f"{GITHUB_API}/search/repositories?q={q_enc}&per_page=30&page={page}"
        try:
            data = gh_api_get(api_url)
            items = data.get("items", [])
            if not items:
                break
            for repo in items:
                full_name = repo.get("full_name", "")
                default_branch = repo.get("default_branch", "main")
                if full_name:
                    results.append((full_name, default_branch))
        except Exception:
            break
    return results

def discover_all_github_repositories(scanned_repos_cache: dict) -> tuple:
    """Dynamically searches ALL GitHub repositories matching proxy queries in parallel."""
    discovered_repos = set(SEED_REPOSITORIES)

    print(f"  🔍 Dynamically querying GitHub Search API in parallel across {len(DYNAMIC_REPO_QUERIES)} queries...", flush=True)
    with ThreadPoolExecutor(max_workers=len(DYNAMIC_REPO_QUERIES)) as q_pool:
        q_futs = [q_pool.submit(search_single_query, q) for q in DYNAMIC_REPO_QUERIES]
        for qf in as_completed(q_futs):
            try:
                for item in qf.result():
                    discovered_repos.add(item)
            except Exception:
                pass

    # Filter out repos that were already scanned recently (within last 18 hours)
    now_ts = time.time()
    fresh_repos = []
    skipped_cached = 0
    for r in discovered_repos:
        repo_name = r[0]
        last_scanned = scanned_repos_cache.get(repo_name, 0)
        if now_ts - last_scanned < 64800:  # 18 hours cache
            skipped_cached += 1
            continue
        fresh_repos.append(r)

    print(f"  📦 Total repositories: {len(discovered_repos)} ({skipped_cached} cached & skipped, {len(fresh_repos)} newly discovered to crawl)", flush=True)

    # Crawl only NEW/FRESH discovered repositories concurrently (200 workers)
    all_repo_candidates = set()
    with ThreadPoolExecutor(max_workers=200) as pool:
        future_map = {pool.submit(crawl_single_repository, r[0], r[1]): r[0] for r in fresh_repos}
        for fut in as_completed(future_map):
            repo_name = future_map[fut]
            try:
                res = fut.result()
                all_repo_candidates.update(res)
                scanned_repos_cache[repo_name] = now_ts
            except Exception:
                pass

    print(f"  🚀 Delta Repository Crawler generated {len(all_repo_candidates)} fresh candidate URLs", flush=True)
    return all_repo_candidates, scanned_repos_cache

# =============================================================================
# 3. 📡 TELEGRAM PUBLIC CHANNELS SCRAPER
# =============================================================================
def scrape_telegram_channel(channel: str) -> tuple:
    """Scrapes public telegram channel web preview for live keys and sub links."""
    url = f"https://t.me/s/{channel}"
    html = fetch_url(url, timeout=5)
    if not html:
        return ([], [])

    direct_keys = extract_uris_from_content(html)
    sub_urls = re.findall(r'https?://[^\s\'"<>]+(?:sub|\.txt|raw|workers\.dev|pages\.dev|vercel\.app)[^\s\'"<>]*', html)
    clean_sub_urls = []
    for u in sub_urls:
        u = u.rstrip('.,;()[]')
        if u.startswith("https://t.me"):
            continue
        clean_sub_urls.append(u)

    return (direct_keys, clean_sub_urls)

def discover_from_telegram() -> tuple:
    all_direct_keys = []
    found_sub_urls = set()

    print(f"  📡 Crawling {len(TELEGRAM_CHANNELS)} public Telegram channels (100 parallel workers)...", flush=True)
    with ThreadPoolExecutor(max_workers=100) as pool:
        future_map = {pool.submit(scrape_telegram_channel, ch): ch for ch in TELEGRAM_CHANNELS}
        for fut in as_completed(future_map):
            ch = future_map[fut]
            try:
                keys, sub_links = fut.result()
                if keys:
                    all_direct_keys.extend(keys)
                if sub_links:
                    found_sub_urls.update(sub_links)
            except Exception:
                pass

    print(f"  🎉 Telegram crawl complete: {len(all_direct_keys)} direct keys, {len(found_sub_urls)} sub URLs", flush=True)
    return (all_direct_keys, found_sub_urls)

# =============================================================================
# 4. 🧪 VALIDATION & HEALTH CHECK
# =============================================================================
def validate_source(url: str, min_nodes: int = MIN_NODES_TO_KEEP) -> int:
    """Fetches source URL and counts how many valid keys it contains."""
    try:
        content = fetch_url(url, timeout=5)
        if not content:
            return 0
        uris = extract_uris_from_content(content)
        return len(uris) if len(uris) >= min_nodes else 0
    except Exception:
        return 0

# =============================================================================
# 🚀 MAIN PIPELINE
# =============================================================================
def main():
    print("=" * 70)
    print("🤖 TurboProbe Ultra Source Discovery & Scraper Bot v3.0")
    print("   (Global Delta Multi-Repo Crawler + Code Search + Telegram Engine)")
    print("=" * 70, flush=True)

    # 1. Load existing discovered sources & cache
    existing = {}
    metadata = {}
    if os.path.exists(DISCOVERED_PATH):
        try:
            with open(DISCOVERED_PATH, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                metadata = loaded.get("_metadata", {})
                existing = {k: v for k, v in loaded.items() if not k.startswith("_")}
        except Exception:
            existing = {}
            metadata = {}

    DEAD_URL_TTL = 36 * 3600  # 36 hours TTL for dead URLs
    now_ts = time.time()

    scanned_repos_cache = metadata.get("scanned_repos", {})
    raw_dead = metadata.get("dead_urls", {})
    if isinstance(raw_dead, list):
        dead_urls_map = {u: now_ts for u in raw_dead}
    else:
        dead_urls_map = raw_dead

    # Clean up expired dead URLs (> 36 hours) so they can be re-checked if revived
    active_dead_urls = {u: ts for u, ts in dead_urls_map.items() if now_ts - ts < DEAD_URL_TTL}
    dead_urls_set = set(active_dead_urls.keys())

    known_sources = set(SOURCES) | set(existing.keys()) | dead_urls_set
    print(f"📚 Known baseline sources: {len(known_sources)} URLs ({len(dead_urls_set)} blacklisted for 36h)", flush=True)

    # 2. Run All Crawlers Concurrently
    candidate_urls = set()

    # Step A: Dynamic GitHub Repositories Crawler with delta caching
    repo_candidates, scanned_repos_cache = discover_all_github_repositories(scanned_repos_cache)
    candidate_urls.update(repo_candidates)

    # Step B: GitHub Code Search (if token provided or in CI)
    candidate_urls.update(discover_from_github_code())

    # Step C: Telegram Web Feeds
    telegram_keys, telegram_subs = discover_from_telegram()
    candidate_urls.update(telegram_subs)

    # Save direct telegram keys into tools/telegram_feed.txt
    if telegram_keys:
        unique_tg = list(dict.fromkeys(telegram_keys))
        with open(TELEGRAM_FEED_PATH, "w", encoding="utf-8") as f:
            f.write("\n".join(unique_tg))
        print(f"\n💾 Saved {len(unique_tg)} fresh direct keys to tools/telegram_feed.txt", flush=True)

    # Filter out already known & dead URLs
    new_candidates = [u for u in candidate_urls if u not in known_sources]
    print(f"\n🧪 Validating {len(new_candidates)} fresh candidate subscription URLs concurrently...", flush=True)

    new_confirmed = 0
    with ThreadPoolExecutor(max_workers=300) as pool:
        future_map = {pool.submit(validate_source, u): u for u in new_candidates}
        for fut in as_completed(future_map):
            url = future_map[fut]
            try:
                count = fut.result()
                if count >= MIN_NODES_TO_KEEP:
                    existing[url] = {
                        "discovered_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "nodes_at_discovery": count,
                        "last_checked": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "status": "active"
                    }
                    new_confirmed += 1
                    print(f"  ✅ [VALID NEW SOURCE] ({count:4d} keys): {url}", flush=True)
                else:
                    active_dead_urls[url] = now_ts
            except Exception:
                active_dead_urls[url] = now_ts

    # 3. Save updated database & metadata
    metadata["scanned_repos"] = scanned_repos_cache
    metadata["dead_urls"] = active_dead_urls
    existing["_metadata"] = metadata

    with open(DISCOVERED_PATH, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False, sort_keys=True)

    print("\n" + "=" * 70)
    print(f"🎉 [Complete] Discovery Bot finished successfully!")
    print(f"   • New validated sources added: {new_confirmed}")
    print(f"   • Total active discovered pool: {len(existing) - 1} sources")
    if telegram_keys:
        print(f"   • Direct live Telegram feed:   {len(unique_tg)} nodes")
    print("=" * 70, flush=True)

if __name__ == "__main__":
    main()
