#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
⚡ TurboProbe TGProxy Ultra-Hardcore Discovery Bot v2.0
Recursively searches GitHub, Telegram, and public proxy mirrors:
1. 🔍 Deep GitHub Code & Repo Matrix (50+ queries across topics, code & repositories)
2. 🌳 Deep Git Tree Inspector (Recursively extracts all raw blob URLs)
3. 📡 Recursive Telegram Channel Discovery (Crawls 80+ seeds & auto-discovers mentioned channels)
4. 🧪 High-Speed Concurrent Validator (Tests payloads and saves to `discovered_tg_sources.json`)
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
GITHUB_API = "https://api.github.com"

GITHUB_TG_REPO_QUERIES = [
    "mtproto sort:updated-desc",
    "telegram-proxy sort:updated-desc",
    "tgproxy sort:updated-desc",
    "mtproto-proxy sort:updated-desc",
    "tg-proxy sort:updated-desc",
    "telegram-mtproto sort:updated-desc",
    "mtproto-secret sort:updated-desc",
    "tg-socks5 sort:updated-desc",
    "telegram-proxies sort:updated-desc",
    "mtg-proxy sort:updated-desc",
    "telegram-v2ray-collector sort:updated-desc",
    "mtproto-collector sort:updated-desc",
    "free-mtproto sort:updated-desc",
    "socks5-proxy-list sort:updated-desc",
    "free-proxy-list sort:updated-desc",
    "proxy-list-socks5 sort:updated-desc",
]

GITHUB_TG_CODE_QUERIES = [
    '"tg://proxy?server=" extension:txt',
    '"https://t.me/proxy?server=" extension:txt',
    '"tg://socks?server=" extension:txt',
    '"https://t.me/socks?server=" extension:txt',
    'filename:mtproto.txt',
    'filename:tgproxy.txt',
    'filename:telegram.txt',
    'filename:proxies.txt "secret="',
    'path:sub "tg://proxy"',
    'path:proxies "tg://proxy"',
    'filename:socks5.txt',
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


async def inspect_repo_tree(owner: str, name: str, branch: str, session: aiohttp.ClientSession, gh_headers: dict) -> List[str]:
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


async def discover_github_ecosystem(session: aiohttp.ClientSession) -> List[str]:
    print("🔍 [GitHub Discovery] Deep searching MTProto & Telegram proxy repositories and code...", flush=True)
    gh_headers = {
        "User-Agent": "TurboProbe-TGProxy-Discovery-Bot/2.0",
        "Accept": "application/vnd.github.v3+json",
    }
    if GITHUB_TOKEN:
        gh_headers["Authorization"] = f"token {GITHUB_TOKEN}"

    # 1. Search Repositories
    search_repo_tasks = [
        fetch_json_async(f"{GITHUB_API}/search/repositories?q={urllib.parse.quote(q)}&per_page=20", session, gh_headers)
        for q in GITHUB_TG_REPO_QUERIES
    ]
    repo_results = await asyncio.gather(*search_repo_tasks, return_exceptions=True)

    tree_tasks = []
    for res in repo_results:
        if isinstance(res, dict) and "items" in res:
            for repo in res["items"]:
                owner = repo.get("owner", {}).get("login")
                name = repo.get("name")
                branch = repo.get("default_branch", "main")
                if owner and name:
                    tree_tasks.append(inspect_repo_tree(owner, name, branch, session, gh_headers))

    # 2. Search Code Directly
    code_tasks = [
        fetch_json_async(f"{GITHUB_API}/search/code?q={urllib.parse.quote(q)}&per_page=20", session, gh_headers)
        for q in GITHUB_TG_CODE_QUERIES
    ]
    code_results = await asyncio.gather(*code_tasks, return_exceptions=True)
    direct_code_urls = []
    for cr in code_results:
        if isinstance(cr, dict) and "items" in cr:
            for item in cr["items"]:
                owner = item.get("repository", {}).get("owner", {}).get("login")
                name = item.get("repository", {}).get("name")
                path = item.get("path")
                if owner and name and path:
                    direct_code_urls.append(f"https://raw.githubusercontent.com/{owner}/{name}/HEAD/{path}")

    discovered = list(direct_code_urls)
    if tree_tasks:
        tree_results = await asyncio.gather(*tree_tasks, return_exceptions=True)
        for tr in tree_results:
            if isinstance(tr, list):
                discovered.extend(tr)

    print(f"  └─ Inspected {len(tree_tasks)} repos, found {len(discovered)} raw GitHub endpoints.", flush=True)
    return discovered


async def scrape_channel_with_discovery(ch: str, session: aiohttp.ClientSession) -> Tuple[str, List[str], List[str]]:
    """Crawls a channel and extracts both proxies and newly mentioned proxy channels."""
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
                # Extract proxies
                m_px = re.findall(r'(?:https?://t\.me/proxy\?|tg://proxy\?|tg://socks\?|https?://t\.me/socks\?)([^\s<>"\'\)]+)', html)
                proxies.extend(m_px)
                # Extract mentioned channels
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
                # Base64 check
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
    print("🚀 [TGProxy Discovery Bot] Launching Ultra-Hardcore Global Sleuth Engine...", flush=True)
    t0 = time.time()

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
        # 1. GitHub Deep Discovery
        gh_endpoints = await discover_github_ecosystem(session)

        # 2. Telegram Recursive Channel Discovery (Hop 1 & Hop 2)
        print(f"📡 [Telegram Crawler] Crawling {len(SEED_CHANNELS)} seed channels with recursive discovery...", flush=True)
        ch_tasks = [scrape_channel_with_discovery(ch, session) for ch in SEED_CHANNELS]
        ch_results = await asyncio.gather(*ch_tasks, return_exceptions=True)

        discovered_channels = set()
        for r in ch_results:
            if isinstance(r, tuple):
                for nc in r[2]:
                    discovered_channels.add(nc)

        print(f"  └─ Auto-discovered {len(discovered_channels)} NEW Telegram proxy channels in Hop 1!", flush=True)

        all_candidates = set(SEED_RAW_SOURCES) | set(gh_endpoints) | existing
        for ch in SEED_CHANNELS + list(discovered_channels):
            all_candidates.add(f"https://t.me/s/{ch}")

        # 3. Parallel Validation
        print(f"📊 Benchmarking {len(all_candidates)} total candidates for active payload...", flush=True)
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
    print(f"✨ [TGProxy Discovery Bot] Finished in {elapsed}s! Saved {len(verified)} active sources to {DISCOVERED_TG_PATH}", flush=True)


if __name__ == "__main__":
    asyncio.run(run_discovery())
