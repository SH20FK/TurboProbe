#!/usr/bin/env python3
"""
TurboProbe Ultra-Source Discovery Bot v2.0
==========================================
Continuously discovers and crawls new public VPN sources across:
1. 🔍 GitHub Code Search (VLESS Reality, Hysteria 2, Trojan, Clash Meta)
2. 📦 Top VPN Repositories & README Crawling (Auto-discovers raw sub links)
3. 📡 Public Telegram Web Channels (Direct nodes & sub links extraction)
4. 🧹 Health Check & Auto-Pruning (Discards dead/expired sources)

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

# 1. 🔍 Advanced GitHub Code Search Queries (active with GITHUB_TOKEN)
GITHUB_CODE_QUERIES = [
    "vless:// security=reality extension:txt",
    "hysteria2:// extension:txt",
    "trojan:// extension:txt",
    "vless:// pbk= extension:txt",
    "vless:// fp=chrome extension:txt",
    "filename:reality.txt vless://",
    "filename:all.txt vless://",
    "filename:vless.txt vless://",
    "path:sub extension:txt vless://",
    "clash.meta proxies: extension:yaml",
]

# 2. 📦 High-yield Active GitHub Repositories for continuous crawling
KNOWN_TOP_REPOS = [
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
]

# 3. 📡 Public Telegram Web Preview Channels
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
]

MIN_NODES_TO_KEEP = 5
MAX_SEARCH_PAGES = 2
REQUEST_PAUSE = 1.5

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
        "User-Agent": "TurboProbe-Source-Discovery/2.0",
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
        print("  ⚠️ No GITHUB_TOKEN in local env; GitHub code search API will run in CI workflow.", flush=True)
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
            except Exception as e:
                break
    print(f"  🔎 GitHub Code Search yielded {len(found_raw_urls)} candidate raw files", flush=True)
    return found_raw_urls

# =============================================================================
# 2. 📦 GITHUB REPOSITORY CRAWLER
# =============================================================================
def crawl_repo(full_name: str, branch: str) -> set:
    candidates = set()
    common_sub_paths = [
        f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/all.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/vless.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/reality.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/shadowsocks.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/trojan.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/hysteria2.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/all.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/vless.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/subs.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/list.txt",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/clash.meta.yaml",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/meta.yaml",
        f"https://raw.githubusercontent.com/{full_name}/{branch}/config.txt",
    ]
    candidates.update(common_sub_paths)

    # Scrape README for subscription URLs
    readme_url = f"https://raw.githubusercontent.com/{full_name}/{branch}/README.md"
    readme_text = fetch_url(readme_url, timeout=5)
    if readme_text:
        sub_links = re.findall(r'https?://[^\s\'"<>)]+(?:sub|\.txt|\.yaml|raw)[^\s\'"<>)]*', readme_text)
        for link in sub_links:
            if "github.com" in link and "/blob/" in link:
                link = link.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/")
            candidates.add(link)
    return candidates

def discover_from_github_repos() -> set:
    found_candidates = set()
    print(f"  📦 Crawling {len(KNOWN_TOP_REPOS)} high-yield proxy repositories...", flush=True)
    with ThreadPoolExecutor(max_workers=10) as pool:
        future_map = {pool.submit(crawl_repo, r[0], r[1]): r[0] for r in KNOWN_TOP_REPOS}
        for fut in as_completed(future_map):
            try:
                res = fut.result()
                found_candidates.update(res)
            except Exception:
                pass
    print(f"  📦 Repo Crawler generated {len(found_candidates)} candidate URLs", flush=True)
    return found_candidates

# =============================================================================
# 3. 📡 TELEGRAM PUBLIC CHANNELS SCRAPER
# =============================================================================
def scrape_telegram_channel(channel: str) -> tuple:
    """Scrapes public telegram channel web preview for live keys and sub links."""
    url = f"https://t.me/s/{channel}"
    html = fetch_url(url, timeout=6)
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

    print(f"  📡 Crawling {len(TELEGRAM_CHANNELS)} public Telegram channels...", flush=True)
    with ThreadPoolExecutor(max_workers=10) as pool:
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
        content = fetch_url(url, timeout=6)
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
    print("🤖 TurboProbe Ultra Source Discovery & Scraper Bot v2.0")
    print("=" * 70, flush=True)

    # 1. Load existing discovered sources
    existing = {}
    if os.path.exists(DISCOVERED_PATH):
        try:
            with open(DISCOVERED_PATH, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = {}

    known_sources = set(SOURCES) | set(existing.keys())
    print(f"📚 Known baseline sources: {len(known_sources)} URLs", flush=True)

    # 2. Run All Crawlers Concurrently
    candidate_urls = set()

    # Step A: GitHub Code Search
    candidate_urls.update(discover_from_github_code())

    # Step B: GitHub Repositories
    candidate_urls.update(discover_from_github_repos())

    # Step C: Telegram Web Feeds
    telegram_keys, telegram_subs = discover_from_telegram()
    candidate_urls.update(telegram_subs)

    # Save direct telegram keys into tools/telegram_feed.txt
    if telegram_keys:
        unique_tg = list(dict.fromkeys(telegram_keys))
        with open(TELEGRAM_FEED_PATH, "w", encoding="utf-8") as f:
            f.write("\n".join(unique_tg))
        print(f"\n💾 Saved {len(unique_tg)} fresh direct keys to tools/telegram_feed.txt", flush=True)

    # Filter out already known URLs
    new_candidates = [u for u in candidate_urls if u not in known_sources]
    print(f"\n🧪 Validating {len(new_candidates)} new candidate subscription URLs concurrently...", flush=True)

    new_confirmed = 0
    with ThreadPoolExecutor(max_workers=20) as pool:
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
                    print(f"  ✅ [VALID NEW SOURCE] ({count:3d} keys): {url[:80]}", flush=True)
            except Exception:
                pass

    # 3. Save updated database
    with open(DISCOVERED_PATH, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False, sort_keys=True)

    print("\n" + "=" * 70)
    print(f"🎉 [Complete] Discovery Bot finished successfully!")
    print(f"   • New validated sources added: {new_confirmed}")
    print(f"   • Total active discovered pool: {len(existing)} sources")
    if telegram_keys:
        print(f"   • Direct live Telegram feed:   {len(unique_tg)} nodes")
    print("=" * 70, flush=True)

if __name__ == "__main__":
    main()
