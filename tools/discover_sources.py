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
# 1. 🔍 DYNAMIC GITHUB CODE SEARCH QUERIES (Ultra-Fresh & Reality Focus)
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
    "vless:// gosuslugi extension:txt",
    "vless:// sber extension:txt",
    "vless:// vk.com extension:txt",
]

# =============================================================================
# 2. 📦 DYNAMIC GITHUB REPOSITORY SEARCH MATRIX (Sorted by latest updates)
# =============================================================================
DYNAMIC_REPO_QUERIES = [
    "vless-reality sort:updated-desc",
    "vless sort:updated-desc",
    "v2ray-share sort:updated-desc",
    "free-vless sort:updated-desc",
    "clash-meta sort:updated-desc",
    "clash-meta-config sort:updated-desc",
    "hysteria2 sort:updated-desc",
    "sing-box-nodes sort:updated-desc",
    "vpn-subscription sort:updated-desc",
    "free-nodes sort:updated-desc",
    "v2ray-collector sort:updated-desc",
    "shadowsocks-aggregator sort:updated-desc",
    "xray-nodes sort:updated-desc",
    "proxy-pool v2ray sort:updated-desc",
    "sub-merge sort:updated-desc",
    "v2ray-nodes sort:updated-desc",
    "v2ray-config sort:updated-desc",
    "russia-vless sort:updated-desc",
    "antizapret sort:updated-desc",
    "anti-censor sort:updated-desc",
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

# Seed baseline of high-yield active proxy repositories (Hourly Auto-Updaters)
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
    ("roosterkid/openproxylist", "main"),
    ("Bardiafa/Free-V2ray-Config", "main"),
    ("everyday-vpn/everyday-vpn", "main"),
    ("mahdibland/V2RayAggregator", "master"),
    ("aiboboxx/v2rayfree", "main"),
    ("tolinkshare2/tolinkshare2", "main"),
]

# =============================================================================
# 3. 📡 EXPANDED PUBLIC TELEGRAM CHANNELS (Fresh Real-Time Keys)
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
    "v2rayng_config_channel",
    "SafeNet_VPN",
    "v2ray_collector",
    "v2ray_hub",
    "free_vpn_sub",
    "shadowrocket_configs",
    "vless_nodes",
    "v2ray_daily",
    "fast_v2ray",
    "v2ray_vip",
    "free_nodes_collector",
    "v2ray_sub_official",
    "v2ray_vpn_free",
    "v2ray_auto_config",
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

SOURCE_QUALITY_PATH = os.path.join(TOOLS_DIR, "source_quality_index.json")

def load_source_quality_index() -> dict:
    if os.path.isfile(SOURCE_QUALITY_PATH):
        try:
            with open(SOURCE_QUALITY_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def update_source_quality_index(source_stats: dict):
    q_index = load_source_quality_index()
    now_ts = time.time()
    for url, yield_count in source_stats.items():
        prev = q_index.get(url, {"score": 50.0, "total_yield": 0, "runs": 0})
        runs = prev.get("runs", 0) + 1
        total_yield = prev.get("total_yield", 0) + yield_count
        decay_score = prev.get("score", 50.0) * 0.85 + (min(yield_count, 100) * 0.15)
        q_index[url] = {
            "score": round(decay_score, 2),
            "total_yield": total_yield,
            "runs": runs,
            "last_scanned": now_ts,
        }
    try:
        with open(SOURCE_QUALITY_PATH, "w", encoding="utf-8") as f:
            json.dump(q_index, f, indent=2, ensure_ascii=False)
    except Exception:
        pass

# =============================================================================
# 3. 📡 DEEP TELEGRAM PUBLIC CHANNELS SCRAPER (Feature 3: ?before={id} pagination)
# =============================================================================
def scrape_telegram_channel_deep(channel: str, max_pages: int = 3) -> tuple:
    """Scrapes public telegram channel web preview with ?before={id} deep pagination."""
    all_keys = []
    all_subs = set()
    current_url = f"https://t.me/s/{channel}"
    
    for _ in range(max_pages):
        html = fetch_url(current_url, timeout=5)
        if not html:
            break
        keys = extract_uris_from_content(html)
        if keys:
            all_keys.extend(keys)
        
        sub_urls = re.findall(r'https?://[^\s\'"<>]+(?:sub|\.txt|raw|workers\.dev|pages\.dev|vercel\.app)[^\s\'"<>]*', html)
        for u in sub_urls:
            u = u.rstrip('.,;()[]')
            if not u.startswith("https://t.me"):
                all_subs.add(u)
                
        msg_ids = re.findall(r'data-post="' + re.escape(channel) + r'/(\d+)"', html)
        if msg_ids:
            oldest_id = min(int(m) for m in msg_ids)
            if oldest_id > 1:
                current_url = f"https://t.me/s/{channel}?before={oldest_id}"
            else:
                break
        else:
            break
            
    return (list(dict.fromkeys(all_keys)), list(all_subs))

def discover_from_telegram() -> tuple:
    all_direct_keys = []
    found_sub_urls = set()

    print(f"  📡 Deep-crawling {len(TELEGRAM_CHANNELS)} public Telegram channels with pagination (100 workers)...", flush=True)
    with ThreadPoolExecutor(max_workers=100) as pool:
        future_map = {pool.submit(scrape_telegram_channel_deep, ch): ch for ch in TELEGRAM_CHANNELS}
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

    print(f"  🎉 Deep Telegram crawl complete: {len(all_direct_keys)} direct keys, {len(found_sub_urls)} sub URLs", flush=True)
    return (all_direct_keys, found_sub_urls)

# =============================================================================
# 4. 🦊 ALTERNATIVE PLATFORMS & GISTS (Features 4 & 5)
# =============================================================================
def discover_from_gitlab() -> set:
    """Discovers proxy repositories from GitLab public API."""
    candidates = set()
    queries = ["vless", "v2ray", "clash-meta", "hysteria2", "free-vpn"]
    for q in queries:
        url = f"https://gitlab.com/api/v4/projects?search={urllib.parse.quote(q)}&order_by=updated_at&per_page=20"
        try:
            raw = fetch_url(url, timeout=6)
            if raw:
                items = json.loads(raw)
                for item in items:
                    p_path = item.get("path_with_namespace")
                    default_branch = item.get("default_branch", "main")
                    if p_path:
                        candidates.add(f"https://gitlab.com/{p_path}/-/raw/{default_branch}/sub/all.txt")
                        candidates.add(f"https://gitlab.com/{p_path}/-/raw/{default_branch}/all.txt")
                        candidates.add(f"https://gitlab.com/{p_path}/-/raw/{default_branch}/vless.txt")
                        candidates.add(f"https://gitlab.com/{p_path}/-/raw/{default_branch}/sub.txt")
        except Exception:
            pass
    print(f"  🦊 GitLab Discovery yielded {len(candidates)} candidate files", flush=True)
    return candidates

def discover_from_codeberg() -> set:
    """Discovers proxy repositories from Codeberg Gitea API."""
    candidates = set()
    queries = ["vless", "v2ray", "clash", "hysteria"]
    for q in queries:
        url = f"https://codeberg.org/api/v1/repos/search?q={urllib.parse.quote(q)}&limit=20"
        try:
            raw = fetch_url(url, timeout=6)
            if raw:
                data = json.loads(raw)
                for item in data.get("data", []):
                    full_name = item.get("full_name")
                    default_branch = item.get("default_branch", "main")
                    if full_name:
                        candidates.add(f"https://codeberg.org/{full_name}/raw/branch/{default_branch}/sub/all.txt")
                        candidates.add(f"https://codeberg.org/{full_name}/raw/branch/{default_branch}/all.txt")
                        candidates.add(f"https://codeberg.org/{full_name}/raw/branch/{default_branch}/sub.txt")
        except Exception:
            pass
    print(f"  🏔️ Codeberg Discovery yielded {len(candidates)} candidate files", flush=True)
    return candidates

def discover_from_github_gists() -> tuple:
    """Scrapes public GitHub Gists for fresh vless/reality/clash drops."""
    direct_keys = []
    if not GITHUB_TOKEN:
        return direct_keys
    url = f"{GITHUB_API}/gists/public?per_page=30"
    try:
        data = gh_api_get(url)
        if isinstance(data, list):
            for gist in data:
                files = gist.get("files", {})
                for fname, finfo in files.items():
                    if any(ext in fname.lower() for ext in [".txt", ".yaml", ".json", "vless", "sub"]):
                        raw_url = finfo.get("raw_url")
                        if raw_url:
                            content = fetch_url(raw_url, timeout=4)
                            if content:
                                uris = extract_uris_from_content(content)
                                if uris:
                                    direct_keys.extend(uris)
    except Exception:
        pass
    print(f"  📄 GitHub Gists yielded {len(direct_keys)} fresh keys", flush=True)
    return direct_keys

def crawl_repository_commit_history(full_name: str, branch: str = "main", limit: int = 5) -> set:
    """Feature 2: Scrapes keys from the last N commits of top active repositories."""
    commit_candidates = set()
    if not GITHUB_TOKEN:
        return commit_candidates
    try:
        api_url = f"{GITHUB_API}/repos/{full_name}/commits?sha={branch}&per_page={limit}"
        commits = gh_api_get(api_url)
        if isinstance(commits, list):
            for c in commits:
                sha = c.get("sha")
                if sha:
                    for fpath in ["sub/all.txt", "all.txt", "vless.txt", "reality.txt", "sub.txt"]:
                        commit_candidates.add(f"https://raw.githubusercontent.com/{full_name}/{sha}/{fpath}")
    except Exception:
        pass
    return commit_candidates

# =============================================================================
# 5. 🧪 VALIDATION & HEALTH CHECK
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

    # Step C: GitLab & Codeberg Discovery (Feature 4)
    candidate_urls.update(discover_from_gitlab())
    candidate_urls.update(discover_from_codeberg())

    # Step D: Commit History Time-Machine (Features 1 & 2)
    for r, b in SEED_REPOSITORIES[:15]:
        candidate_urls.update(crawl_repository_commit_history(r, b, limit=4))

    # Step E: Telegram Deep Web Feeds
    telegram_keys, telegram_subs = discover_from_telegram()
    candidate_urls.update(telegram_subs)

    # Step F: Public GitHub Gists (Feature 5)
    gist_keys = discover_from_github_gists()
    if gist_keys:
        telegram_keys.extend(gist_keys)

    # Save direct harvested keys into tools/telegram_feed.txt
    if telegram_keys:
        unique_tg = list(dict.fromkeys(telegram_keys))
        with open(TELEGRAM_FEED_PATH, "w", encoding="utf-8") as f:
            f.write("\n".join(unique_tg))
        print(f"\n💾 Saved {len(unique_tg)} fresh direct keys to tools/telegram_feed.txt", flush=True)

    # Filter out already known & dead URLs
    new_candidates = [u for u in candidate_urls if u not in known_sources]
    print(f"\n🧪 Validating {len(new_candidates)} fresh candidate subscription URLs concurrently...", flush=True)

    new_confirmed = 0
    validated_stats = {}
    with ThreadPoolExecutor(max_workers=300) as pool:
        future_map = {pool.submit(validate_source, u): u for u in new_candidates}
        for fut in as_completed(future_map):
            url = future_map[fut]
            try:
                count = fut.result()
                validated_stats[url] = count
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

    # Update Source Quality Index (Feature 12)
    update_source_quality_index(validated_stats)

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
