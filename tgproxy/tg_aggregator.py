#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
⚡ TurboProbe TGProxy - Massive High-Yield Harvester & Verifier
Crawls 40+ deep-paginated Telegram channels and 50+ curated GitHub pools concurrently.
"""

import asyncio
import hashlib
import json
import os
import re
import socket
import ssl
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional, Set, Tuple
import aiohttp

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

TG_DIR = os.path.dirname(os.path.abspath(__file__))
DISCOVERED_TG_PATH = os.path.join(TG_DIR, "discovered_tg_sources.json")

# 40+ Curated Public Telegram Channels for Deep Multi-Page Pagination
TG_CHANNELS = [
    "ProxyMTProto",
    "TelMTProto",
    "MTProto",
    "TgProxies",
    "mtprotorus",
    "MTProto_TG",
    "proxy_socks5_tg",
    "MTP_ro",
    "free_tg_proxy",
    "proxyme",
    "FreeMTProxies",
    "DailyProxy",
    "ProxyCenter",
    "MTProxy_Channel",
    "Telegram_Proxies",
    "TG_Proxy_Channel",
    "MTProxies",
    "TgProxyMTProto",
    "Proxy_MTProto_Telegram",
    "TelProxy",
    "V2rayNG_VPNN",
    "proxy_mtproto_free",
    "mtproto_iran",
    "mtproto_free",
    "proxies_free",
    "tg_proxy_mtproto",
    "proxy_for_tg",
    "mtp_free",
    "tg_socks5",
    "socks5_proxy",
    "MTG_Proxies",
    "Free_TG_MTProto",
    "MTProto_Pool",
    "TgProxyHub",
    "Shadowsocks_Proxy",
    "VPNCenter",
    "TGProxiesFree",
    "FastMTProto",
    "BestTGProxies",
    "MTProtoRu",
    "TgSocksProxy",
]

# 50+ Curated High-Yield GitHub MTProto & SOCKS5 Pools
RAW_LISTS = [
    # Dedicated MTProto & TG Proxy Lists
    "https://raw.githubusercontent.com/iwh3n/tg-proxy/main/proxy.txt",
    "https://raw.githubusercontent.com/iwh3n/tg-proxy/main/all_proxies.txt",
    "https://raw.githubusercontent.com/Leon406/SubCrawler/main/sub/share/tg_proxy",
    "https://raw.githubusercontent.com/MrMohebi/xray-proxy-grabber-telegram/master/collected-proxies/mtproto.txt",
    "https://raw.githubusercontent.com/MrMohebi/xray-proxy-grabber-telegram/master/collected-proxies/socks5.txt",
    "https://raw.githubusercontent.com/soroushmirzaei/telegram-proxies-collector/main/mtproto",
    "https://raw.githubusercontent.com/soroushmirzaei/telegram-proxies-collector/main/socks5",
    "https://raw.githubusercontent.com/soroushmirzaei/telegram-proxies-collector/main/proxies",
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

TG_DC2_IP = "149.154.167.50"
TG_DC2_PORT = 443

COUNTRY_FLAGS = {
    "DE": "🇩🇪 Германия",
    "NL": "🇳🇱 Нидерланды",
    "FI": "🇫🇮 Финляндия",
    "SE": "🇸🇪 Швеция",
    "RU": "🇷🇺 Россия",
    "US": "🇺🇸 США",
    "GB": "🇬🇧 Великобритания",
    "FR": "🇫🇷 Франция",
    "PL": "🇵🇱 Польша",
    "KZ": "🇰🇿 Казахстан",
    "TR": "🇹🇷 Турция",
    "SG": "🇸🇬 Сингапур",
    "JP": "🇯🇵 Япония",
    "GLOBAL": "🌐 Сервер",
}

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


class TGProxy:
    def __init__(
        self,
        proto: str,
        server: str,
        port: int,
        secret: Optional[str] = None,
        user: Optional[str] = None,
        password: Optional[str] = None,
        country: str = "GLOBAL",
        country_label: str = "🌐 Сервер",
        ping_ms: float = 999.0,
    ):
        self.proto = proto.lower()
        self.server = server.strip().rstrip(".")
        self.port = int(port)
        self.secret = secret.strip() if secret else None
        self.user = user.strip() if user else None
        self.password = password.strip() if password else None
        self.country = country.upper()
        self.country_label = country_label
        self.ping_ms = ping_ms
        self.ru_verified = False
        self.isp_status = {"rtk": False, "mts": False, "mf": False, "beeline": False}

    @property
    def key(self) -> str:
        sec = self.secret or ""
        u = self.user or ""
        p = self.password or ""
        return f"{self.proto}://{self.server}:{self.port}@{sec}:{u}:{p}".lower()

    @property
    def is_faketls(self) -> bool:
        if self.proto == "mtproto" and self.secret:
            sec = self.secret.lower()
            return sec.startswith("ee") and len(sec) > 34
        return False

    @property
    def tg_link(self) -> str:
        if self.proto == "mtproto":
            sec = urllib.parse.quote(self.secret or "")
            return f"tg://proxy?server={self.server}&port={self.port}&secret={sec}"
        else:
            q = f"server={self.server}&port={self.port}"
            if self.user:
                q += f"&user={urllib.parse.quote(self.user)}"
            if self.password:
                q += f"&pass={urllib.parse.quote(self.password)}"
            return f"tg://socks?{q}"

    @property
    def https_link(self) -> str:
        if self.proto == "mtproto":
            sec = urllib.parse.quote(self.secret or "")
            return f"https://t.me/proxy?server={self.server}&port={self.port}&secret={sec}"
        else:
            q = f"server={self.server}&port={self.port}"
            if self.user:
                q += f"&user={urllib.parse.quote(self.user)}"
            if self.password:
                q += f"&pass={urllib.parse.quote(self.password)}"
            return f"https://t.me/socks?{q}"

    def to_dict(self) -> dict:
        return {
            "proto": self.proto,
            "server": self.server,
            "port": self.port,
            "secret": self.secret,
            "user": self.user,
            "is_faketls": self.is_faketls,
            "country": self.country,
            "country_label": self.country_label,
            "ping_ms": self.ping_ms,
            "ru_verified": self.ru_verified,
            "isp_status": self.isp_status,
            "tg_link": self.tg_link,
            "https_link": self.https_link,
        }


def guess_country_from_host(host: str) -> Tuple[str, str]:
    h = host.lower()
    for code, label in COUNTRY_FLAGS.items():
        if f".{code.lower()}" in h or f"-{code.lower()}." in h:
            return code, label
    return "GLOBAL", "🌐 Сервер"


def test_proxy_sync(p: TGProxy, timeout: float = 2.0) -> Tuple[bool, float]:
    t0 = time.perf_counter()
    try:
        s = socket.create_connection((p.server, p.port), timeout=timeout)
        s.settimeout(timeout)
        if p.proto == "mtproto":
            sec_low = (p.secret or "").lower()
            if sec_low.startswith("ee") and len(sec_low) > 34:
                sni_hex = sec_low[34:]
                try:
                    sni = bytes.fromhex(sni_hex).decode("utf-8", errors="ignore")
                except Exception:
                    sni = "www.cloudflare.com"
                ssl_sock = ctx.wrap_socket(s, server_hostname=sni or "www.cloudflare.com")
                ssl_sock.settimeout(timeout)
                _ = ssl_sock.cipher()
                ssl_sock.close()
                rtt = round((time.perf_counter() - t0) * 1000.0, 1)
                return True, rtt
            else:
                s.sendall(os.urandom(64))
                data = s.recv(4)
                s.close()
                if data:
                    rtt = round((time.perf_counter() - t0) * 1000.0, 1)
                    return True, rtt
                return False, 999.0
        else:
            # SOCKS5 Greeting + Connect to TG DC2
            s.sendall(b"\x05\x01\x00")
            resp = s.recv(2)
            if len(resp) >= 2 and resp[0] == 0x05 and resp[1] == 0x00:
                ip_bytes = socket.inet_aton(TG_DC2_IP)
                port_bytes = (TG_DC2_PORT).to_bytes(2, byteorder="big")
                s.sendall(b"\x05\x01\x00\x01" + ip_bytes + port_bytes)
                conn_resp = s.recv(10)
                s.close()
                if len(conn_resp) >= 4 and conn_resp[0] == 0x05 and conn_resp[1] == 0x00:
                    rtt = round((time.perf_counter() - t0) * 1000.0, 1)
                    return True, rtt
            s.close()
            return False, 999.0
    except Exception:
        return False, 999.0


async def scrape_channel_deep(ch: str, session: aiohttp.ClientSession) -> str:
    """Scrapes up to 3 pages backwards for a Telegram channel."""
    collected = []
    base_url = f"https://t.me/s/{ch}"
    try:
        async with session.get(base_url, timeout=4.0) as resp:
            if resp.status == 200:
                html = await resp.text()
                collected.append(html)
                # Find pagination ID
                before_ids = re.findall(r'/s/' + ch + r'\?before=(\d+)', html)
                if before_ids:
                    p2_url = f"https://t.me/s/{ch}?before={before_ids[0]}"
                    async with session.get(p2_url, timeout=4.0) as r2:
                        if r2.status == 200:
                            h2 = await r2.text()
                            collected.append(h2)
                            b2_ids = re.findall(r'/s/' + ch + r'\?before=(\d+)', h2)
                            if b2_ids:
                                p3_url = f"https://t.me/s/{ch}?before={b2_ids[0]}"
                                async with session.get(p3_url, timeout=4.0) as r3:
                                    if r3.status == 200:
                                        collected.append(await r3.text())
    except Exception:
        pass
    return "\n".join(collected)


async def fetch_source_async(url: str, session: aiohttp.ClientSession) -> str:
    try:
        async with session.get(url, timeout=4.5) as resp:
            if resp.status == 200:
                return await resp.text()
    except Exception:
        pass
    return ""


async def run_tg_harvest(test_limit: int = 0) -> List[TGProxy]:
    all_raw_sources = list(RAW_LISTS)
    if os.path.exists(DISCOVERED_TG_PATH):
        try:
            with open(DISCOVERED_TG_PATH, "r", encoding="utf-8") as f:
                d = json.load(f)
                discovered = d.get("sources", [])
                all_raw_sources = list(set(all_raw_sources + discovered))
                print(f"📡 [Source Manager] Loaded {len(discovered)} auto-discovered sources from {DISCOVERED_TG_PATH}", flush=True)
        except Exception:
            pass

    print(f"🚀 [TGProxy Harvester] Crawling {len(TG_CHANNELS)} deep channels and {len(all_raw_sources)} RAW pools concurrently...", flush=True)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    connector = aiohttp.TCPConnector(limit=100, ssl=False)

    raw_proxies: List[TGProxy] = []
    seen = set()

    async with aiohttp.ClientSession(connector=connector, headers=headers) as session:
        ch_tasks = [scrape_channel_deep(ch, session) for ch in TG_CHANNELS]
        raw_tasks = [fetch_source_async(u, session) for u in all_raw_sources]
        all_tasks = ch_tasks + raw_tasks
        results = await asyncio.gather(*all_tasks, return_exceptions=True)

        for text in results:
            if isinstance(text, str) and text:
                # 1. MTProto matches
                matches = re.finditer(r'(?:https?://t\.me/proxy\?|tg://proxy\?)([^\s<>\"\'\)]+)', text)
                for m in matches:
                    qs = m.group(1).replace("&amp;", "&")
                    parsed = urllib.parse.parse_qs(qs)
                    srv = parsed.get("server", [""])[0].strip().rstrip(".")
                    prt = parsed.get("port", ["0"])[0].strip()
                    sec = parsed.get("secret", [""])[0].strip()
                    if srv and prt.isdigit() and sec:
                        cc, label = guess_country_from_host(srv)
                        p = TGProxy("mtproto", srv, int(prt), secret=sec, country=cc, country_label=label)
                        if p.key not in seen:
                            seen.add(p.key)
                            raw_proxies.append(p)

                # 2. SOCKS5 matches
                socks_matches = re.finditer(r'(?:https?://t\.me/socks\?|tg://socks\?)([^\s<>\"\'\)]+)', text)
                for m in socks_matches:
                    qs = m.group(1).replace("&amp;", "&")
                    parsed = urllib.parse.parse_qs(qs)
                    srv = parsed.get("server", [""])[0].strip().rstrip(".")
                    prt = parsed.get("port", ["0"])[0].strip()
                    user = parsed.get("user", [None])[0]
                    pwd = parsed.get("pass", [None])[0]
                    if srv and prt.isdigit():
                        cc, label = guess_country_from_host(srv)
                        p = TGProxy("socks5", srv, int(prt), user=user, password=pwd, country=cc, country_label=label)
                        if p.key not in seen:
                            seen.add(p.key)
                            raw_proxies.append(p)

                # 3. Raw lines (IP:PORT)
                for line in text.splitlines():
                    line = line.strip()
                    if not line or line.startswith("#") or ":" not in line or "://" in line:
                        continue
                    parts = line.split(":")
                    if len(parts) == 2 and parts[1].isdigit():
                        cc, label = guess_country_from_host(parts[0])
                        p = TGProxy("socks5", parts[0], int(parts[1]), country=cc, country_label=label)
                        if p.key not in seen:
                            seen.add(p.key)
                            raw_proxies.append(p)

    mtproto_cands = [p for p in raw_proxies if p.proto == "mtproto"]
    socks_cands = [p for p in raw_proxies if p.proto == "socks5"]
    print(f"📊 Harvested {len(raw_proxies)} unique candidates (MTProto: {len(mtproto_cands)}, SOCKS5: {len(socks_cands)}).", flush=True)

    eval_pool = mtproto_cands + (socks_cands[:test_limit] if test_limit > 0 else socks_cands[:2500])

    print(f"🔬 [Telegram DC & Fake-TLS Gate] Parallel benchmarking {len(eval_pool)} candidates (100 threads)...", flush=True)
    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor(max_workers=100) as pool:
        bench_tasks = [loop.run_in_executor(pool, test_proxy_sync, p) for p in eval_pool]
        bench_results = await asyncio.gather(*bench_tasks)

    alive: List[TGProxy] = []
    for idx, (ok, rtt) in enumerate(bench_results):
        if ok and rtt < 850.0:
            p = eval_pool[idx]
            p.ping_ms = rtt
            alive.append(p)

    alive.sort(key=lambda p: (0 if p.is_faketls else 1 if p.proto == "mtproto" else 2, p.ping_ms))

    alive_mtproto = sum(1 for p in alive if p.proto == "mtproto")
    alive_socks = sum(1 for p in alive if p.proto == "socks5")
    print(f"✅ [Telegram Gate] {len(alive)} VERIFIED ONLINE! (MTProto: {alive_mtproto}, SOCKS5: {alive_socks})", flush=True)
    return alive


def main():
    test_mode = "--test" in sys.argv
    limit = 500 if test_mode else 0

    t0 = time.time()
    proxies = asyncio.run(run_tg_harvest(test_limit=limit))
    elapsed = round(time.time() - t0, 2)
    print(f"🏁 Finished in {elapsed}s. Verified online proxies: {len(proxies)}")


if __name__ == "__main__":
    main()
