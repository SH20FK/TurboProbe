#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TurboProbe TGProxy - Discovery crawler for GitHub, GitLab, Codeberg and Telegram.
"""

import asyncio
import base64
import json
import os
import re
import sys
import time
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple
import aiohttp

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

TG_DIR = os.path.dirname(os.path.abspath(__file__))
DISCOVERED_TG_PATH = os.path.join(TG_DIR, "discovered_tg_sources.json")

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
if not GITHUB_TOKEN:
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.isfile(env_path):
        with open(env_path, "r", encoding="utf-8") as _ef:
            for _line in _ef:
                if _line.startswith("GITHUB_TOKEN="):
                    GITHUB_TOKEN = _line.split("=", 1)[1].strip()
                    os.environ["GITHUB_TOKEN"] = GITHUB_TOKEN
                    break
GITHUB_API = "https://api.github.com"

FORGE_QUERIES = [
    "mtproto",
    "telegram proxy",
    "tgproxy",
    "mtproto-proxy",
    "tg-proxy",
    "telegram-mtproto",
    "tg-socks5",
    "telegram-proxies",
    "mtg-proxy",
    "socks5-proxy-list",
    "v2ray-collector",
    "free-proxy-list",
]

GITHUB_TG_CODE_QUERIES = [
    '"tg://proxy?server=" extension:txt',
    '"https://t.me/proxy?server=" extension:txt',
    '"tg://socks?server=" extension:txt',
    '"https://t.me/socks?server=" extension:txt',
    'filename:mtproto.txt',
    'filename:tgproxy.txt',
    'filename:proxies.txt "secret="',
    'path:sub "tg://proxy"',
    'path:proxies "tg://proxy"',
]

SEED_CHANNELS = [
    "ProxyMTProto", "TelMTProto", "MTProto", "TgProxies", "mtprotorus",
    "MTProto_TG", "proxy_socks5_tg", "MTP_ro", "free_tg_proxy", "proxyme",
    "FreeMTProxies", "DailyProxy", "ProxyCenter", "MTProxy_Channel", "Telegram_Proxies",
    "TG_Proxy_Channel", "MTProxies", "TgProxyMTProto", "Proxy_MTProto_Telegram", "TelProxy",
    "V2rayNG_VPNN", "proxy_mtproto_free", "mtproto_iran", "mtproto_free", "proxies_free",
    "tg_proxy_mtproto", "proxy_for_tg", "mtp_free", "tg_socks5", "socks5_proxy",
    "MTG_Proxies", "Free_TG_MTProto", "MTProto_Pool", "TgProxyHub", "Shadowsocks_Proxy",
    "VPNCenter", "TGProxiesFree", "FastMTProto", "BestTGProxies", "MTProtoRu",
    "TgSocksProxy", "proxy_collector", "MTProto_Daily", "Proxy_List_TG", "TgProxyServer",
    "MTProto_World", "MTProto_Free_TG", "MTProto_Proxy_RU", "TG_VPN_Proxy", "BestMTProto",
    "ProxyHub_TG", "Fast_TG_Proxy", "TG_Free_Proxy", "MTProto_Nodes", "MTProto_VIP",
    "Proxy_Station", "TG_Proxy_World", "MTProto_Direct", "TG_Bypass_RU", "Telegram_MTProto",
]

SEED_RAW_SOURCES = [
    "https://raw.githubusercontent.com/iwh3n/tg-proxy/main/proxy.txt",
    "https://raw.githubusercontent.com/iwh3n/tg-proxy/main/all_proxies.txt",
    "https://raw.githubusercontent.com/Leon406/SubCrawler/main/sub/share/tg_proxy",
    "https://raw.githubusercontent.com/MrMohebi/xray-proxy-grabber-telegram/master/collected-proxies/mtproto.txt",
    "https://raw.githubusercontent.com/MrMohebi/xray-proxy-grabber-telegram/master/collected-proxies/socks5.txt",
    "https://raw.githubusercontent.com/soroushmirzaei/telegram-proxies-collector/main/mtproto",
    "https://raw.githubusercontent.com/soroushmirzaei/telegram-proxies-collector/main/socks5",
    "https://raw.githubusercontent.com/soroushmirzaei/telegram-proxies-collector/main/proxies",
    "https://raw.githubusercontent.com/Bardiafa/Proxy-Collector/main/sub/telegram/mtproto",
    "https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/telegram/mtproto",
    "https://raw.githubusercontent.com/IranianCypherpunks/sub/main/mtproto",
    "https://raw.githubusercontent.com/Surfboardv2ray/TGParse/main/config",
    "https://raw.githubusercontent.com/mftg/tgproxy/main/mtproto.txt",
    "https://raw.githubusercontent.com/vfarid/v2ray-share/main/mtproto.txt",
    "https://raw.githubusercontent.com/ALIILAPRO/v2rayNG-Config/main/sub.txt",
    "https://raw.githubusercontent.com/Awesome-TGProxy/MTProxy/master/mtproto.txt",
    "https://raw.githubusercontent.com/ErcinDedeoglu/proxies/main/proxies/mtproto.txt",
    "https://raw.githubusercontent.com/roosterkid/openproxylist/main/MTPROTO_RAW.txt",
    "https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/master/mtproto.txt",
    "https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt",
    "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt",
    "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt",
    "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/master/socks5.txt",
    "https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.txt",
    "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt",
    "https://raw.githubusercontent.com/prxchk/proxy-list/main/socks5.txt",
    "https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/socks5_proxies.txt",
    "https://raw.githubusercontent.com/ErcinDedeoglu/proxies/main/proxies/socks5.txt",
    "https://raw.githubusercontent.com/MuRongPIG/Proxy-Master/main/socks5.txt",
    "https://raw.githubusercontent.com/OfficialPutuid/KangProxy/KangProxy/socks5.txt",
    "https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/generated/socks5_proxies.txt",
    "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt",
    "https://raw.githubusercontent.com/shiftytr/proxy-list/master/socks5.txt",
    "https://raw.githubusercontent.com/B4RC0D3-YT/custom_proxy_list/main/socks5.txt",
    "https://raw.githubusercontent.com/tuanminpay/live-proxy/master/socks5.txt",
    "https://raw.githubusercontent.com/zevtyardt/proxy-list/main/socks5.txt",
    "https://raw.githubusercontent.com/r00tee/Proxy-List/main/Socks5.txt",
    "https://raw.githubusercontent.com/Tsprnay/Proxy-lists/master/proxies/socks5.txt",
    "https://raw.githubusercontent.com/yemixzy/proxy-list/main/proxies/socks5.txt",
    "https://raw.githubusercontent.com/andigwandi/free-proxy/main/proxy_list.txt",
    "https://raw.githubusercontent.com/rdavydov/proxy-list/main/proxies/socks5.txt",
    "https://raw.githubusercontent.com/elliottophellia/yakumo/master/results/socks5/global/socks5_checked.txt",
    "https://raw.githubusercontent.com/hendrikbgr/Free-Proxy-Repo/master/proxy_list.txt",
    "https://raw.githubusercontent.com/almroot/proxylist/master/list.txt",
    "https://raw.githubusercontent.com/asdaqq/proxy-list/main/socks5.txt",
    "https://raw.githubusercontent.com/hanwaytech/free-proxy-list/main/socks5.txt",
    "https://raw.githubusercontent.com/HyperBeats/proxy-list/main/socks5.txt",
    "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks5.txt",
    "https://raw.githubusercontent.com/mmpx12/proxy-list/master/socks5.txt",
    "https://raw.githubusercontent.com/ObcbO/getproxy/master/socks5.txt",
    "https://raw.githubusercontent.com/proxy4parsing/proxy-list/main/socks5.txt",
    "https://raw.githubusercontent.com/saisuiu/Lion-proxy/main/socks5.txt",
    "https://raw.githubusercontent.com/UptimerBot/proxy-list/main/proxies/socks5.txt",
    "https://raw.githubusercontent.com/casals-ar/proxy-list/main/socks5",
    "https://raw.githubusercontent.com/proxy-list-org/proxy-list/main/socks5.txt",
    "https://raw.githubusercontent.com/im-Justin/free-proxy-list/main/socks5.txt",
    "https://raw.githubusercontent.com/zloi-user/hideip.me/master/socks5.txt",
    "https://raw.githubusercontent.com/mahdibland/ShadowsocksAggregator/master/sub/sub_merge.txt",
    "https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub",
]

PROXY_KEYWORDS = ["proxy", "mtp", "socks", "tg", "vpn", "free", "node", "channel", "server", "fast", "bypass"]


async def fetch_json_async(url: str, session: aiohttp.ClientSession, headers: dict) -> Optional[dict]:
    try:
        async with session.get(url, headers=headers, timeout=4.0) as resp:
            if resp.status == 200:
                return await resp.json()
    except Exception:
        pass
    return None


async def discover_github(session: aiohttp.ClientSession) -> List[str]:
    print("🐙 [GitHub Engine] Searching repositories & code...", flush=True)
    gh_headers = {"User-Agent": "TurboProbe-TGProxy-Discovery/3.0", "Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        gh_headers["Authorization"] = f"token {GITHUB_TOKEN}"

    search_tasks = [
        fetch_json_async(f"{GITHUB_API}/search/repositories?q={urllib.parse.quote(q + ' sort:updated-desc')}&per_page=15", session, gh_headers)
        for q in FORGE_QUERIES
    ]
    results = await asyncio.gather(*search_tasks, return_exceptions=True)

    tree_tasks = []
    for res in results:
        if isinstance(res, dict) and "items" in res:
            for repo in res["items"]:
                owner = repo.get("owner", {}).get("login")
                name = repo.get("name")
                branch = repo.get("default_branch", "main")
                if owner and name:
                    tree_tasks.append(inspect_github_tree(owner, name, branch, session, gh_headers))

    discovered = []
    if tree_tasks:
        tree_results = await asyncio.gather(*tree_tasks, return_exceptions=True)
        for tr in tree_results:
            if isinstance(tr, list):
                discovered.extend(tr)

    print(f"  └─ GitHub: found {len(discovered)} raw endpoints.", flush=True)
    return discovered


async def inspect_github_tree(owner: str, name: str, branch: str, session: aiohttp.ClientSession, gh_headers: dict) -> List[str]:
    tree_url = f"{GITHUB_API}/repos/{owner}/{name}/git/trees/{branch}?recursive=1"
    data = await fetch_json_async(tree_url, session, gh_headers)
    found = []
    if data and "tree" in data:
        for item in data["tree"]:
            p = item.get("path", "").lower()
            if item.get("type") == "blob" and any(k in p for k in ["mtproto", "tg", "telegram", "proxy", "socks", "nodes", "conf"]):
                if p.endswith((".txt", ".json", ".yaml", ".conf", ".list")):
                    found.append(f"https://raw.githubusercontent.com/{owner}/{name}/{branch}/{item.get('path')}")
    return found


async def discover_gitlab(session: aiohttp.ClientSession) -> List[str]:
    print("🦊 [GitLab Engine] Searching projects & trees...", flush=True)
    headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
    found_urls = []
    for q in FORGE_QUERIES[:6]:
        url = f"https://gitlab.com/api/v4/projects?search={urllib.parse.quote(q)}&per_page=15"
        data = await fetch_json_async(url, session, headers)
        if isinstance(data, list):
            for p in data:
                pid = p.get("id")
                ns = p.get("path_with_namespace")
                branch = p.get("default_branch", "main") or "main"
                if pid and ns:
                    tree_url = f"https://gitlab.com/api/v4/projects/{pid}/repository/tree?recursive=true"
                    tree_data = await fetch_json_async(tree_url, session, headers)
                    if isinstance(tree_data, list):
                        for item in tree_data:
                            path = item.get("path", "").lower()
                            if item.get("type") == "blob" and path.endswith((".txt", ".json", ".yaml", ".conf", ".list")):
                                if any(k in path for k in ["mtproto", "tg", "proxy", "socks"]):
                                    found_urls.append(f"https://gitlab.com/{ns}/-/raw/{branch}/{item.get('path')}")
    print(f"  └─ GitLab: found {len(found_urls)} raw endpoints.", flush=True)
    return found_urls


async def discover_gitverse(session: aiohttp.ClientSession) -> List[str]:
    print("🇷🇺 [GitVerse Engine] Searching repositories...", flush=True)
    headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
    found_urls = []
    for q in FORGE_QUERIES[:6]:
        url = f"https://gitverse.ru/api/v1/repos/search?q={urllib.parse.quote(q)}&limit=15"
        data = await fetch_json_async(url, session, headers)
        if isinstance(data, dict) and "data" in data:
            for r in data["data"]:
                full_name = r.get("full_name")
                branch = r.get("default_branch", "main") or "main"
                if full_name:
                    found_urls.append(f"https://gitverse.ru/api/v1/repos/{full_name}/raw/branch/{branch}/proxies.txt")
                    found_urls.append(f"https://gitverse.ru/api/v1/repos/{full_name}/raw/branch/{branch}/mtproto.txt")
    print(f"  └─ GitVerse: found {len(found_urls)} potential endpoints.", flush=True)
    return found_urls


async def discover_codeberg(session: aiohttp.ClientSession) -> List[str]:
    print("🏔️ [Codeberg Engine] Searching repositories...", flush=True)
    headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
    found_urls = []
    for q in FORGE_QUERIES[:6]:
        url = f"https://codeberg.org/api/v1/repos/search?q={urllib.parse.quote(q)}&limit=15"
        data = await fetch_json_async(url, session, headers)
        if isinstance(data, dict) and "data" in data:
            for r in data["data"]:
                full_name = r.get("full_name")
                branch = r.get("default_branch", "main") or "main"
                if full_name:
                    found_urls.append(f"https://codeberg.org/{full_name}/raw/branch/{branch}/proxy.txt")
                    found_urls.append(f"https://codeberg.org/{full_name}/raw/branch/{branch}/mtproto.txt")
    print(f"  └─ Codeberg: found {len(found_urls)} potential endpoints.", flush=True)
    return found_urls


async def scrape_channel_with_discovery(ch: str, session: aiohttp.ClientSession) -> Tuple[str, List[str], List[str]]:
    url = f"https://t.me/s/{ch}"
    proxies = []
    new_channels = []
    try:
        current_url = url
        for _ in range(5):
            async with session.get(current_url, timeout=3.5) as resp:
                if resp.status != 200:
                    break
                html = await resp.text()
                m_px = re.findall(r'(?:https?://t\.me/proxy\?|tg://proxy\?|tg://socks\?|https?://t\.me/socks\?)([^\s<>"\'\)]+)', html)
                proxies.extend(m_px)
                mentions = re.findall(r'(?:@|t\.me/s?/)([a-zA-Z0-9_]{4,32})', html)
                for m in mentions:
                    m_low = m.lower()
                    if any(kw in m_low for kw in PROXY_KEYWORDS) and m not in SEED_CHANNELS:
                        new_channels.append(m)
                before_ids = re.findall(r'/s/' + ch + r'\?before=(\d+)', html)
                if not before_ids:
                    break
                current_url = f"https://t.me/s/{ch}?before={before_ids[0]}"
    except Exception:
        pass
    return ch, proxies, new_channels


async def test_endpoint_async(url: str, session: aiohttp.ClientSession) -> Tuple[str, int]:
    try:
        async with session.get(url, timeout=4.5) as resp:
            if resp.status == 200:
                text = await resp.text()
                try:
                    cleaned = re.sub(r'[^A-Za-z0-9+/=]', '', text)
                    if len(cleaned) > 50 and len(cleaned) % 4 == 0:
                        text = text + "\n" + base64.b64decode(cleaned).decode('utf-8', errors='ignore')
                except Exception:
                    pass
                tg_links = len(re.findall(r'(?:tg://proxy\?|https?://t\.me/proxy\?|tg://socks\?|https?://t\.me/socks\?)', text))
                if tg_links > 0:
                    return url, tg_links
                socks_lines = 0
                for line in text.splitlines()[:500]:
                    parts = line.strip().split(":")
                    if len(parts) in (2, 4) and parts[1].isdigit():
                        socks_lines += 1
                if socks_lines >= 5:
                    return url, socks_lines
    except Exception:
        pass
    return url, 0


async def run_discovery():
    print("🚀 [TGProxy Discovery Bot] Launching Multi-Forge Global Discovery (GitHub, GitLab, GitVerse, Codeberg, Telegram)...", flush=True)
    t0 = time.time()

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }
    connector = aiohttp.TCPConnector(limit=100, ssl=False)

    existing = set()
    if os.path.exists(DISCOVERED_TG_PATH):
        try:
            with open(DISCOVERED_TG_PATH, "r", encoding="utf-8") as f:
                d = json.load(f)
                existing = set(d.get("sources", []))
        except Exception:
            pass

    async with aiohttp.ClientSession(connector=connector, headers=headers) as session:
        # Multi-Forge Concurrent Discovery
        gh_tasks = discover_github(session)
        gl_tasks = discover_gitlab(session)
        gv_tasks = discover_gitverse(session)
        cb_tasks = discover_codeberg(session)
        ch_tasks = [scrape_channel_with_discovery(ch, session) for ch in SEED_CHANNELS]

        gh_res, gl_res, gv_res, cb_res, ch_res = await asyncio.gather(
            gh_tasks, gl_tasks, gv_tasks, cb_tasks, asyncio.gather(*ch_tasks), return_exceptions=True
        )

        discovered_channels = set()
        if isinstance(ch_res, list):
            for r in ch_res:
                if isinstance(r, tuple):
                    for nc in r[2]:
                        discovered_channels.add(nc)

        all_forge_endpoints = []
        for r in [gh_res, gl_res, gv_res, cb_res]:
            if isinstance(r, list):
                all_forge_endpoints.extend(r)

        all_candidates = set(SEED_RAW_SOURCES) | set(all_forge_endpoints) | existing
        for ch in SEED_CHANNELS + list(discovered_channels):
            all_candidates.add(f"https://t.me/s/{ch}")

        print(f"📊 Benchmarking {len(all_candidates)} candidates across all forges for active proxy payload...", flush=True)
        test_tasks = [test_endpoint_async(u, session) for u in all_candidates]
        test_results = await asyncio.gather(*test_tasks, return_exceptions=True)

        verified = []
        for r in test_results:
            if isinstance(r, tuple) and r[1] > 0:
                verified.append(r[0])

    verified = sorted(list(set(verified)))
    data = {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "total_sources": len(verified),
        "sources": verified,
    }

    with open(DISCOVERED_TG_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    elapsed = round(time.time() - t0, 1)
    print(f"✨ [TGProxy Discovery Bot] Complete in {elapsed}s! Saved {len(verified)} verified multi-forge sources to {DISCOVERED_TG_PATH}", flush=True)


if __name__ == "__main__":
    asyncio.run(run_discovery())
