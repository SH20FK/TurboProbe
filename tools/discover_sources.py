#!/usr/bin/env python3
"""
TurboProbe - Source discovery crawler for GitHub and Telegram.
"""

import os
import sys
import re
import json
import time
import hashlib
import random
import asyncio
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import httpx
except ImportError:
    httpx = None

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
    "tuic:// extension:txt",
    "anytls:// extension:txt",
    "vless:// pbk= extension:txt",
    "vless:// fp=chrome extension:txt",
    "filename:reality.txt vless://",
    "filename:all.txt vless://",
    "filename:vless.txt vless://",
    "filename:nodes.txt vless://",
    "filename:sub.txt vless://",
    "filename:hysteria2.txt",
    "filename:tuic.txt",
    "path:sub extension:txt vless://",
    "path:category extension:txt",
    "path:protocols extension:txt",
    "clash.meta proxies: extension:yaml",
    "clash-meta proxies: extension:yaml",
    "vless:// gosuslugi extension:txt",
    "vless:// sber extension:txt",
    "vless:// vk.com extension:txt",
    "WHITE-CIDR-RU extension:txt",
    "WHITE-SNI-RU extension:txt",
    "vless-reality-white-lists",
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
    "tuic-v5 sort:updated-desc",
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
    "vpn-configs-for-russia sort:updated-desc",
    "goida-vpn sort:updated-desc",
    "antizapret sort:updated-desc",
    "anti-censor sort:updated-desc",
    "topic:vless",
    "topic:v2ray",
    "topic:hysteria2",
    "topic:tuic",
    "topic:clash-meta",
    "topic:sing-box",
    "topic:xray",
    "topic:shadowrocket",
    "topic:v2ray-config",
    "topic:free-vpn",
    "topic:proxy-collector",
    "topic:free-proxy",
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
    ("Argh94/V2RayAutoConfig", "main"),
    ("Argh94/Proxy-List", "main"),
    ("nikita29a/FreeProxyList", "main"),
    ("AvenCores/goida-vpn-configs", "main"),
    ("kort0881/vpn-vless-configs-russia", "main"),
    ("igareck/vpn-configs-for-russia", "main"),
    ("MhdiTaheri/V2rayCollector_Py", "main"),
    ("Kwinshadow/TelegramV2rayCollector", "main"),
    ("MatinGhanbari/v2ray-configs", "main"),
    ("mohamadfg-dev/telegram-v2ray-configs-collector", "main"),
    ("6b3478/telegram-configs-collector2", "main"),
    ("iPsycho1/Multi_Configs", "main"),
    ("rtwo2/FastNodes", "main"),
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
    "v2ray_free_config",
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
    "free_v2ray_channel",
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
    "vless_configs",
    "v2ray_daily",
    "fast_v2ray",
    "v2ray_vip",
    "free_nodes_collector",
    "v2ray_sub_official",
    "v2ray_vpn_free",
    "v2ray_auto_config",
    "v2tel",
    "proxynode",
    "v2ray_freedom",
    "FreeV2rays",
    "GozargahAzad",
    "vpn_reality",
]

MIN_NODES_TO_KEEP = 5
MAX_SEARCH_PAGES = 3
REQUEST_PAUSE = 1.0
REPOSITORY_RECHECK_SECONDS = 12 * 3600


def source_identity(url: str) -> str:
    """Returns a stable identity for a source, independent of a GitHub branch or commit SHA."""
    try:
        parsed = urllib.parse.urlparse(url.strip())
        host = parsed.netloc.lower()
        path_parts = [part for part in parsed.path.split("/") if part]
        if host == "raw.githubusercontent.com" and len(path_parts) >= 4:
            owner, repo = path_parts[0].lower(), path_parts[1].lower()
            file_start = 3
            if len(path_parts) >= 6 and path_parts[2:4] == ["refs", "heads"]:
                file_start = 5
            return f"github://{owner}/{repo}/" + "/".join(path_parts[file_start:])
        if host == "github.com" and len(path_parts) >= 5 and path_parts[2] == "blob":
            owner, repo = path_parts[0].lower(), path_parts[1].lower()
            return f"github://{owner}/{repo}/" + "/".join(path_parts[4:])
        normalized_path = parsed.path.rstrip("/") or "/"
        return urllib.parse.urlunparse((parsed.scheme.lower(), host, normalized_path, "", parsed.query, ""))
    except Exception:
        return url.strip().rstrip("/")


def is_commit_pinned_github_raw_url(url: str) -> bool:
    """Identifies raw GitHub URLs whose ref segment is an immutable 40-character commit SHA."""
    try:
        parsed = urllib.parse.urlparse(url)
        parts = [part for part in parsed.path.split("/") if part]
        return (
            parsed.netloc.lower() == "raw.githubusercontent.com"
            and len(parts) >= 3
            and re.fullmatch(r"[0-9a-fA-F]{40}", parts[2]) is not None
        )
    except Exception:
        return False


def github_repository_from_source(url: str) -> str:
    """Extracts owner/repository for GitHub raw/blob source URLs, otherwise returns an empty string."""
    try:
        parsed = urllib.parse.urlparse(url)
        path_parts = [part for part in parsed.path.split("/") if part]
        if parsed.netloc.lower() == "raw.githubusercontent.com" and len(path_parts) >= 2:
            return f"{path_parts[0].lower()}/{path_parts[1].lower()}"
        if parsed.netloc.lower() == "github.com" and len(path_parts) >= 2:
            return f"{path_parts[0].lower()}/{path_parts[1].lower()}"
    except Exception:
        pass
    return ""


SUB_URL_REGEX = re.compile(
    r'https?://[^\s\'"<>)]+?(?:'
    r'sub(?:scribe|scription)?s?|'
    r'api/v1/client/subscribe|'
    r'clash(?:-meta)?|'
    r'sing-box|'
    r'\.txt|\.yaml|\.yml|\.json|'
    r'raw\.githubusercontent\.com|'
    r'gitverse\.ru/api/repos/[^/]+/[^/]+/raw|'
    r'workers\.dev|pages\.dev|vercel\.app|koyeb\.app|deno\.dev|netlify\.app|onrender\.com|railway\.app'
    r')[^\s\'"<>)]*',
    re.IGNORECASE
)

def extract_subscription_urls_from_text(text: str) -> set:
    """Extracts all candidate subscription URLs from markdown/HTML/text with cleanup."""
    if not text:
        return set()
    found = set()
    for match in SUB_URL_REGEX.findall(text):
        u = match.rstrip('.,;()[]`"\'')
        if "t.me" in u:
            continue
        if "github.com" in u and "/blob/" in u:
            u = u.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/")
        found.add(u)
    return found


def compute_sha256(data: str) -> str:
    """Computes SHA-256 hex digest of string content."""
    return hashlib.sha256(data.encode("utf-8", errors="ignore")).hexdigest()

def calculate_source_schedule(record: dict, yield_count: int, now_ts: float) -> dict:
    """Calculates adaptive tier, failure count, exponential backoff and Thompson sampling priors."""
    rec = dict(record or {})
    prev_failures = rec.get("failures", 0)
    prev_alpha = rec.get("mab_alpha", 1)
    prev_beta = rec.get("mab_beta", 1)
    
    if yield_count >= 50:
        tier = 1
        interval = 2 * 3600  # 2 hours
        failures = 0
        new_alpha = prev_alpha + min(yield_count, 100)
        new_beta = max(1, prev_beta)
    elif yield_count >= 5:
        tier = 2
        interval = 6 * 3600  # 6 hours
        failures = 0
        new_alpha = prev_alpha + yield_count
        new_beta = max(1, prev_beta)
    elif yield_count > 0:
        tier = 3
        interval = 24 * 3600  # 24 hours
        failures = 0
        new_alpha = prev_alpha + yield_count
        new_beta = max(1, prev_beta)
    else:
        # Failure case (0 nodes or fetch error)
        failures = prev_failures + 1
        tier = 3
        backoff_multiplier = min(32, 2 ** min(failures - 1, 5))
        interval = min(7 * 86400, 6 * 3600 * backoff_multiplier)
        new_alpha = max(1, prev_alpha)
        new_beta = prev_beta + 10

    rec.update({
        "tier": tier,
        "failures": failures,
        "next_check_due": now_ts + interval,
        "mab_alpha": new_alpha,
        "mab_beta": new_beta,
    })
    return rec

def thompson_sampling_score(alpha: int, beta: int) -> float:
    """Draws a success probability sample using Beta distribution."""
    try:
        return random.betavariate(max(1, alpha), max(1, beta))
    except Exception:
        return 0.5

async def fetch_url_conditional_async(client: httpx.AsyncClient, url: str, etag: str = "", last_modified: str = "", timeout: float = 8.0) -> tuple:
    """Performs an async HTTP request with conditional ETag & If-Modified-Since headers.
    Returns: (status_code, content, new_etag, new_last_modified, content_sha256)
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain,*/*;q=0.8",
    }
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified
        
    try:
        resp = await client.get(url, headers=headers, timeout=timeout, follow_redirects=True)
        if resp.status_code == 304:
            return (304, "", etag, last_modified, "")
        if resp.status_code == 200:
            text = resp.text
            new_etag = resp.headers.get("etag", "").strip()
            new_last_mod = resp.headers.get("last-modified", "").strip()
            sha256 = compute_sha256(text)
            return (200, text, new_etag, new_last_mod, sha256)
        return (resp.status_code, "", "", "", "")
    except Exception:
        return (0, "", "", "", "")

def fetch_url(url: str, timeout: int = 8, headers: dict = None) -> str:
    """Fetches text content from URL with custom headers (synchronous fallback)."""
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
    """Discovers all possible subscription files via recursive Git Trees API and README links."""
    candidates = set()
    tree_discovered = False

    # 1. High-accuracy recursive Git Trees API (1 API call discovers 100% of repo files)
    if GITHUB_TOKEN:
        try:
            tree_data = gh_api_get(f"{GITHUB_API}/repos/{full_name}/git/trees/{branch}?recursive=1")
            tree = tree_data.get("tree", []) if isinstance(tree_data, dict) else []
            for item in tree:
                if item.get("type") == "blob":
                    fpath = item.get("path", "")
                    fpath_low = fpath.lower()
                    if fpath_low.endswith((".txt", ".yaml", ".yml", ".json")) or any(
                        keyword in fpath_low for keyword in ("sub", "config", "node", "vless", "proxy", "reality", "hysteria", "tuic", "mirror", "split", "protocol", "output")
                    ):
                        if not any(fpath_low.endswith(x) for x in ("package.json", "package-lock.json", "tsconfig.json", ".eslintrc.json", "requirements.txt")):
                            candidates.add(f"https://raw.githubusercontent.com/{full_name}/{branch}/{fpath}")
                            tree_discovered = True
        except Exception:
            pass

    # 2. Fallback common paths if tree API was not used or failed
    if not tree_discovered:
        common_sub_paths = [
            f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/all.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/vless.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/reality.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/shadowsocks.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/trojan.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/hysteria2.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/hy2.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/sub/tuic.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/all.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/all",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/vless.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/reality.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/subs.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/sub.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/list.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/nodes.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/clash.meta.yaml",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/meta.yaml",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/config.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/configs.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/All_Configs_Sub.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/All_Configs_base64_Sub.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/Splitted-By-Protocol/vless.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/Splitted-By-Protocol/trojan.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/Splitted-By-Protocol/ss.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/Splitted-By-Protocol/hysteria2.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/category/vless.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/category/hysteria2.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/category/xhttp.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/category/httpupgrade.txt",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/protocols/hysteria2",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/protocols/tuic",
            f"https://raw.githubusercontent.com/{full_name}/{branch}/protocols/vl.txt",
            *[f"https://raw.githubusercontent.com/{full_name}/{branch}/mirror/{i}.txt" for i in range(1, 27)],
            *[f"https://raw.githubusercontent.com/{full_name}/{branch}/githubmirror/{i}.txt" for i in range(1, 27)],
        ]
        candidates.update(common_sub_paths)

    # 3. Scrape README for external subscription URLs
    readme_url = f"https://raw.githubusercontent.com/{full_name}/{branch}/README.md"
    readme_text = fetch_url(readme_url, timeout=5)
    if readme_text:
        candidates.update(extract_subscription_urls_from_text(readme_text))

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
                pushed_at = repo.get("pushed_at", "")
                if full_name:
                    results.append((full_name, default_branch, pushed_at))
        except Exception:
            break
    return results


def fetch_repository_state(full_name: str, fallback_branch: str) -> tuple:
    """Returns GitHub's current default branch and push timestamp for a tracked seed repository."""
    if not GITHUB_TOKEN:
        return full_name, fallback_branch, ""
    try:
        data = gh_api_get(f"{GITHUB_API}/repos/{full_name}")
        return full_name, data.get("default_branch", fallback_branch), data.get("pushed_at", "")
    except Exception:
        return full_name, fallback_branch, ""


def repository_changed_recently(pushed_at: str, previous_pushed_at: str, now_ts: float) -> bool:
    """Returns true only for a new GitHub push inside the configured recheck window."""
    if not pushed_at or pushed_at == previous_pushed_at:
        return False
    try:
        pushed_ts = datetime.strptime(pushed_at, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()
        return 0 <= now_ts - pushed_ts <= REPOSITORY_RECHECK_SECONDS
    except Exception:
        return False


def discover_all_github_repositories(scanned_repos_cache: dict) -> tuple:
    """Crawls only new repositories or repositories with a new push within 12 hours."""
    repo_map = {name.lower(): (name, branch, "") for name, branch in SEED_REPOSITORIES}

    # Seed repositories remain observable even if a particular query no longer returns them.
    if GITHUB_TOKEN:
        with ThreadPoolExecutor(max_workers=min(16, len(SEED_REPOSITORIES) or 1)) as seed_pool:
            seed_futures = [seed_pool.submit(fetch_repository_state, name, branch) for name, branch in SEED_REPOSITORIES]
            for future in as_completed(seed_futures):
                try:
                    full_name, branch, pushed_at = future.result()
                    repo_map[full_name.lower()] = (full_name, branch, pushed_at)
                except Exception:
                    pass

    print(f"  🔍 Dynamically querying GitHub Search API in parallel across {len(DYNAMIC_REPO_QUERIES)} queries...", flush=True)
    with ThreadPoolExecutor(max_workers=len(DYNAMIC_REPO_QUERIES)) as q_pool:
        q_futs = [q_pool.submit(search_single_query, q) for q in DYNAMIC_REPO_QUERIES]
        for qf in as_completed(q_futs):
            try:
                for full_name, branch, pushed_at in qf.result():
                    repo_map[full_name.lower()] = (full_name, branch, pushed_at)
            except Exception:
                pass

    now_ts = time.time()
    fresh_repos = []
    skipped_cached = 0
    repo_state = {}
    for repo_name, branch, pushed_at in repo_map.values():
        previous = scanned_repos_cache.get(repo_name.lower(), {})
        if isinstance(previous, (int, float)):
            previous = {"last_scanned": previous, "pushed_at": ""}
        previous_push = previous.get("pushed_at", "") if isinstance(previous, dict) else ""
        last_scanned = previous.get("last_scanned", 0) if isinstance(previous, dict) else 0
        changed = repository_changed_recently(pushed_at, previous_push, now_ts)
        if last_scanned and not changed:
            skipped_cached += 1
            repo_state[repo_name.lower()] = {"pushed_at": previous_push, "last_scanned": last_scanned}
            continue
        fresh_repos.append((repo_name, branch, pushed_at))

    print(f"  📦 Total repositories: {len(repo_map)} ({skipped_cached} unchanged & skipped, {len(fresh_repos)} new/updated to crawl)", flush=True)

    all_repo_candidates = set()
    with ThreadPoolExecutor(max_workers=200) as pool:
        future_map = {
            pool.submit(crawl_single_repository, repo_name, branch): (repo_name, pushed_at)
            for repo_name, branch, pushed_at in fresh_repos
        }
        for fut in as_completed(future_map):
            repo_name, pushed_at = future_map[fut]
            try:
                all_repo_candidates.update(fut.result())
                repo_state[repo_name.lower()] = {"pushed_at": pushed_at, "last_scanned": now_ts}
            except Exception:
                pass

    print(f"  🚀 Delta Repository Crawler generated {len(all_repo_candidates)} source candidates", flush=True)
    return all_repo_candidates, repo_state

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
        
        all_subs.update(extract_subscription_urls_from_text(html))
                
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
# 4. 🇷🇺 / 🦊 ALTERNATIVE PLATFORMS & GISTS (GitVerse, GitLab, Codeberg, Gists)
# =============================================================================
def discover_from_gitverse() -> set:
    """Discovers proxy repositories from Russian GitVerse public API (gitverse.ru)."""
    candidates = set()
    queries = ["vpn", "vless", "xray", "reality", "hysteria", "clash", "singbox", "antizapret"]
    for q in queries:
        url = f"https://gitverse.ru/api/repos/search?q={urllib.parse.quote(q)}&limit=40"
        try:
            raw = fetch_url(url, timeout=7)
            if raw:
                data = json.loads(raw)
                for item in data.get("data", []):
                    full_name = item.get("fullName") or (f"{item.get('owner', {}).get('username')}/{item.get('name')}")
                    default_branch = item.get("defaultBranch", "master")
                    if full_name:
                        for branch in [default_branch, "master", "main"]:
                            candidates.add(f"https://gitverse.ru/api/repos/{full_name}/raw/branch/{branch}/all.txt")
                            candidates.add(f"https://gitverse.ru/api/repos/{full_name}/raw/branch/{branch}/all")
                            candidates.add(f"https://gitverse.ru/api/repos/{full_name}/raw/branch/{branch}/vless.txt")
                            candidates.add(f"https://gitverse.ru/api/repos/{full_name}/raw/branch/{branch}/configs.txt")
                            candidates.add(f"https://gitverse.ru/api/repos/{full_name}/raw/branch/{branch}/sub.txt")
                            candidates.add(f"https://gitverse.ru/api/repos/{full_name}/raw/branch/{branch}/sub/all.txt")
                            candidates.add(f"https://gitverse.ru/api/repos/{full_name}/raw/branch/{branch}/KvRuVPN/KvRuVPN.txt")
                            candidates.add(f"https://gitverse.ru/api/repos/{full_name}/raw/branch/{branch}/AetrisVPN.txt")
        except Exception:
            pass
    print(f"  🇷🇺 GitVerse Discovery yielded {len(candidates)} candidate files", flush=True)
    return candidates
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
    print("TurboProbe Source Discovery & Scraper")
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

    # Index older entries lazily: missing identity metadata is derived in memory and
    # written back only when that specific source is newly validated or revalidated.
    existing_by_identity = {}
    for source_url, record in existing.items():
        record = record if isinstance(record, dict) else {}
        identity = record.get("source_id") or source_identity(source_url)
        existing_by_identity.setdefault(identity, (source_url, record))

    baseline_source_ids = {source_identity(url) for url in SOURCES}
    known_source_ids = baseline_source_ids | set(existing_by_identity) | {source_identity(url) for url in dead_urls_set}
    print(f"📚 Known source identities: {len(known_source_ids)} ({len(dead_urls_set)} blacklisted for 36h)", flush=True)

    # 2. Run All Crawlers Concurrently
    candidate_urls = set()

    # Step A: Dynamic GitHub Repositories Crawler with change-aware cache
    repo_candidates, scanned_repos_cache = discover_all_github_repositories(scanned_repos_cache)
    candidate_urls.update(repo_candidates)

    # Step B: GitHub Code Search (if token provided or in CI)
    candidate_urls.update(discover_from_github_code())

    # Step C: GitVerse, GitLab & Codeberg Discovery (Feature 4)
    candidate_urls.update(discover_from_gitverse())
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

    # Validate genuinely new identities, plus known GitHub sources only when the
    # repository has a new push inside the last 12 hours. Commit URLs and branches
    # of the same file collapse to one stable identity before any download happens.
    # Collapse duplicate representations of the same new file deterministically.
    # A live branch URL is preferred over a commit-pinned snapshot so later runs can
    # observe repository changes instead of freezing on whichever set item appeared first.
    candidate_groups = {}
    for candidate_url in candidate_urls:
        candidate_groups.setdefault(source_identity(candidate_url), []).append(candidate_url)

    selected_candidates = {}
    for identity, urls in candidate_groups.items():
        ordered_urls = sorted(set(urls))
        live_urls = [url for url in ordered_urls if not is_commit_pinned_github_raw_url(url)]
        selected_candidates[identity] = live_urls[0] if live_urls else ordered_urls[0]

    candidates_to_validate = {}
    candidate_reasons = {}
    for identity, candidate_url in selected_candidates.items():
        prior = existing_by_identity.get(identity)
        repository = github_repository_from_source(candidate_url)
        repo_info = scanned_repos_cache.get(repository.lower(), {}) if repository else {}
        pushed_at = repo_info.get("pushed_at", "") if isinstance(repo_info, dict) else ""

        if identity not in known_source_ids:
            candidates_to_validate[identity] = candidate_url
            candidate_reasons[identity] = "new"
        elif prior:
            prior_rec = prior[1]
            next_due = prior_rec.get("next_check_due", 0)
            repo_changed = repository_changed_recently(pushed_at, prior_rec.get("repo_pushed_at", ""), now_ts)
            # Check if source is due for recheck based on its adaptive health tier or repo changed
            if repo_changed or now_ts >= next_due:
                candidates_to_validate[identity] = prior[0]
                candidate_reasons[identity] = "repo-updated" if repo_changed else "adaptive-due"

    # Multi-Armed Bandit / Thompson Sampling priority sorting
    sorted_candidate_items = sorted(
        candidates_to_validate.items(),
        key=lambda item: thompson_sampling_score(
            (existing_by_identity.get(item[0], [None, {}])[1]).get("mab_alpha", 1),
            (existing_by_identity.get(item[0], [None, {}])[1]).get("mab_beta", 1)
        ),
        reverse=True
    )
    candidates_to_validate = dict(sorted_candidate_items)

    print(f"\n🧪 Validating {len(candidates_to_validate)} source identities (Adaptive Due & Delta Priority)...", flush=True)

    async def _async_validation_pipeline():
        limits = httpx.Limits(max_connections=120, max_keepalive_connections=30) if httpx else None
        sem = asyncio.Semaphore(64)
        results = []

        if httpx:
            try:
                client_ctx = httpx.AsyncClient(http2=True, timeout=8.0, limits=limits, verify=False)
            except Exception:
                client_ctx = httpx.AsyncClient(http2=False, timeout=8.0, limits=limits, verify=False)
            async with client_ctx as client:
                async def _task(identity, url):
                    prior = existing_by_identity.get(identity)
                    prior_rec = prior[1] if prior else {}
                    async with sem:
                        etag = prior_rec.get("etag", "")
                        last_mod = prior_rec.get("last_modified", "")
                        cached_sha = prior_rec.get("content_sha256", "")
                        cached_count = prior_rec.get("nodes_at_discovery", 0)
                        
                        code, content, new_etag, new_last_mod, new_sha = await fetch_url_conditional_async(
                            client, url, etag=etag, last_modified=last_mod, timeout=7.0
                        )
                        if code == 304:
                            return (identity, url, cached_count, {"etag": etag, "last_modified": last_mod, "content_sha256": cached_sha, "reused": True})
                        if code == 200:
                            if new_sha and cached_sha and new_sha == cached_sha and cached_count > 0:
                                return (identity, url, cached_count, {"etag": new_etag or etag, "last_modified": new_last_mod or last_mod, "content_sha256": new_sha, "reused": True})
                            uris = extract_uris_from_content(content)
                            count = len(uris)
                            return (identity, url, count if count >= MIN_NODES_TO_KEEP else 0, {"etag": new_etag, "last_modified": new_last_mod, "content_sha256": new_sha, "reused": False})
                        return (identity, url, 0, {"etag": "", "last_modified": "", "content_sha256": "", "reused": False})

                tasks = [_task(ident, url) for ident, url in candidates_to_validate.items()]
                results = await asyncio.gather(*tasks, return_exceptions=True)
        else:
            # Synchronous fallback with ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=min(64, len(candidates_to_validate) or 1)) as pool:
                def _sync_worker(ident, url):
                    count = validate_source(url)
                    return (ident, url, count, {"etag": "", "last_modified": "", "content_sha256": "", "reused": False})
                futs = [pool.submit(_sync_worker, ident, url) for ident, url in candidates_to_validate.items()]
                for f in futs:
                    try:
                        results.append(f.result())
                    except Exception as e:
                        results.append(e)
        return results

    validation_results = asyncio.run(_async_validation_pipeline())

    new_confirmed = 0
    refreshed_confirmed = 0
    reused_count = 0
    validated_stats = {}

    for res in validation_results:
        if isinstance(res, Exception) or not isinstance(res, tuple):
            continue
        identity, url, count, meta = res
        prior = existing_by_identity.get(identity)
        reason = candidate_reasons.get(identity, "unknown")
        repository = github_repository_from_source(url)
        repo_info = scanned_repos_cache.get(repository.lower(), {}) if repository else {}
        is_reused = meta.get("reused", False)
        
        validated_stats[url] = count
        if count >= MIN_NODES_TO_KEEP:
            prior_record = dict(prior[1]) if prior else {}
            # Update adaptive schedule and Thompson Sampling metrics
            sched = calculate_source_schedule(prior_record, count, now_ts)
            record = {
                "discovered_at": prior_record.get("discovered_at") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "nodes_at_discovery": count,
                "last_checked": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "status": "active",
                "source_id": identity,
                "repository": repository,
                "repo_pushed_at": repo_info.get("pushed_at", "") if isinstance(repo_info, dict) else "",
                "etag": meta.get("etag") or prior_record.get("etag", ""),
                "last_modified": meta.get("last_modified") or prior_record.get("last_modified", ""),
                "content_sha256": meta.get("content_sha256") or prior_record.get("content_sha256", ""),
                "tier": sched["tier"],
                "failures": sched["failures"],
                "next_check_due": sched["next_check_due"],
                "mab_alpha": sched["mab_alpha"],
                "mab_beta": sched["mab_beta"],
            }
            existing[url] = record
            existing_by_identity[identity] = (url, record)
            if is_reused:
                reused_count += 1
            if reason == "new":
                new_confirmed += 1
                label = "VALID NEW SOURCE"
            else:
                refreshed_confirmed += 1
                label = "REVALIDATED (304 / SHA-CACHED)" if is_reused else "REVALIDATED UPDATED"
            print(f"  ✅ [{label}] (T{sched['tier']}, {count:4d} keys): {url}", flush=True)
        else:
            active_dead_urls[url] = now_ts
            if prior:
                sched = calculate_source_schedule(prior[1], 0, now_ts)
                existing[url]["failures"] = sched["failures"]
                existing[url]["next_check_due"] = sched["next_check_due"]
                existing[url]["mab_beta"] = sched["mab_beta"]

    # Update Source Quality Index (Feature 12)
    update_source_quality_index(validated_stats)

    # Drop inactive records whose own last observation is older than the dead-URL TTL.
    pruned_inactive = 0
    retained_existing = {}
    for source_url, record in existing.items():
        if not isinstance(record, dict) or record.get("status", "active") == "active":
            retained_existing[source_url] = record
            continue
        timestamp_text = record.get("last_checked") or record.get("discovered_at")
        try:
            checked_ts = datetime.strptime(timestamp_text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()
        except Exception:
            retained_existing[source_url] = record
            continue
        if now_ts - checked_ts <= DEAD_URL_TTL:
            retained_existing[source_url] = record
        else:
            pruned_inactive += 1
    if pruned_inactive:
        print(f"  🧹 Pruned {pruned_inactive} expired inactive source record(s)", flush=True)
    existing = retained_existing

    # 3. Save updated database & metadata
    metadata["scanned_repos"] = scanned_repos_cache
    metadata["dead_urls"] = active_dead_urls
    existing["_metadata"] = metadata

    with open(DISCOVERED_PATH, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False, sort_keys=True)

    print("\n" + "=" * 70)
    print(f"🎉 [Complete] Discovery Bot finished successfully!")
    print(f"   • New validated sources added: {new_confirmed}")
    print(f"   • Updated sources revalidated: {refreshed_confirmed}")
    print(f"   • Total active discovered pool: {len(existing) - 1} sources")
    if telegram_keys:
        print(f"   • Direct live Telegram feed:   {len(unique_tg)} nodes")
    print("=" * 70, flush=True)

if __name__ == "__main__":
    main()
