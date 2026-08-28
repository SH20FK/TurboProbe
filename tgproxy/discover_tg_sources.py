#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
⚡ TurboProbe TGProxy Discovery Bot (Global GitHub & Telegram Crawler)
Continuously discovers hundreds of Telegram proxy sources across:
1. 🔍 Dynamic GitHub Repository Search (MTProto, SOCKS5, tg-proxy, mtg, etc.)
2. 🌳 Deep Git Tree Inspector (Recursively discovers all raw MTProto/SOCKS5 files)
3. 📡 Public Telegram Web Channel Scraper (50+ channels)
4. 🧪 Concurrent Validator (Validates and persists to `tgproxy/discovered_tg_sources.json`)
"""

import asyncio
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
]

TELEGRAM_CHANNELS = [
    "https://t.me/s/ProxyMTProto",
    "https://t.me/s/TelMTProto",
    "https://t.me/s/MTProto",
    "https://t.me/s/TgProxies",
    "https://t.me/s/mtprotorus",
    "https://t.me/s/MTProto_TG",
    "https://t.me/s/proxy_socks5_tg",
    "https://t.me/s/MTP_ro",
    "https://t.me/s/free_tg_proxy",
    "https://t.me/s/proxyme",
    "https://t.me/s/FreeMTProxies",
    "https://t.me/s/DailyProxy",
    "https://t.me/s/ProxyCenter",
    "https://t.me/s/MTProxy_Channel",
    "https://t.me/s/Telegram_Proxies",
    "https://t.me/s/TG_Proxy_Channel",
    "https://t.me/s/MTProxies",
    "https://t.me/s/TgProxyMTProto",
    "https://t.me/s/Proxy_MTProto_Telegram",
    "https://t.me/s/TelProxy",
    "https://t.me/s/V2rayNG_VPNN",
    "https://t.me/s/proxy_mtproto_free",
    "https://t.me/s/mtproto_iran",
    "https://t.me/s/mtproto_free",
    "https://t.me/s/proxies_free",
    "https://t.me/s/tg_proxy_mtproto",
    "https://t.me/s/proxy_for_tg",
    "https://t.me/s/mtp_free",
    "https://t.me/s/tg_socks5",
    "https://t.me/s/socks5_proxy",
    "https://t.me/s/MTG_Proxies",
    "https://t.me/s/Free_TG_MTProto",
    "https://t.me/s/MTProto_Pool",
    "https://t.me/s/TgProxyHub",
    "https://t.me/s/Shadowsocks_Proxy",
    "https://t.me/s/VPNCenter",
    "https://t.me/s/TGProxiesFree",
    "https://t.me/s/FastMTProto",
    "https://t.me/s/BestTGProxies",
    "https://t.me/s/MTProtoRu",
    "https://t.me/s/TgSocksProxy",
]

SEED_SOURCES = [
    "https://raw.githubusercontent.com/iwh3n/tg-proxy/main/proxy.txt",
    "https://raw.githubusercontent.com/iwh3n/tg-proxy/main/all_proxies.txt",
    "https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt",
    "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt",
    "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt",
    "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/master/socks5.txt",
    "https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.txt",
    "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt",
    "https://raw.githubusercontent.com/prxchk/proxy-list/main/socks5.txt",
    "https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/master/socks5.txt",
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
]


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


async def discover_github_repos(session: aiohttp.ClientSession) -> List[str]:
    print("🔍 [GitHub Discovery] Searching active Telegram proxy repositories...", flush=True)
    gh_headers = {
        "User-Agent": "TurboProbe-TGProxy-Discovery-Bot/1.0",
        "Accept": "application/vnd.github.v3+json",
    }
    if GITHUB_TOKEN:
        gh_headers["Authorization"] = f"token {GITHUB_TOKEN}"

    search_tasks = [
        fetch_json_async(f"{GITHUB_API}/search/repositories?q={urllib.parse.quote(q)}&per_page=15", session, gh_headers)
        for q in GITHUB_TG_REPO_QUERIES
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
                    tree_tasks.append(inspect_repo_tree(owner, name, branch, session, gh_headers))

    if tree_tasks:
        tree_results = await asyncio.gather(*tree_tasks, return_exceptions=True)
        discovered = []
        for tr in tree_results:
            if isinstance(tr, list):
                discovered.extend(tr)
        print(f"  └─ Inspected {len(tree_tasks)} repositories, found {len(discovered)} raw endpoints.", flush=True)
        return discovered
    return []


async def test_endpoint_async(url: str, session: aiohttp.ClientSession) -> Tuple[str, int]:
    try:
        async with session.get(url, timeout=4.5) as resp:
            if resp.status == 200:
                text = await resp.text()
                # Count tg:// links
                tg_links = len(re.findall(r'(?:tg://proxy\?|https?://t\.me/proxy\?|tg://socks\?|https?://t\.me/socks\?)', text))
                if tg_links > 0:
                    return url, tg_links
                # Count IP:PORT lines
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
    print("🚀 [TGProxy Discovery Bot] Starting Global Sleuth Crawler...", flush=True)
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
        gh_endpoints = await discover_github_repos(session)
        all_candidates = set(SEED_SOURCES) | set(TELEGRAM_CHANNELS) | set(gh_endpoints) | existing

        print(f"📊 Benchmarking {len(all_candidates)} candidates for Telegram proxy content...", flush=True)
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
    print(f"✨ [TGProxy Discovery Bot] Complete in {elapsed}s! Saved {len(verified)} verified active sources to {DISCOVERED_TG_PATH}", flush=True)


if __name__ == "__main__":
    asyncio.run(run_discovery())
