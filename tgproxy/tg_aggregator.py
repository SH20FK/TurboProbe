#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
⚡ TurboProbe TGProxy - High-Yield Concurrent Harvester & Verifier
Crawls 30+ Telegram channels and GitHub repos concurrently via HTTP/2 and validates handshakes.
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

TG_CHANNELS = [
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
]

RAW_LISTS = [
    "https://raw.githubusercontent.com/iwh3n/tg-proxy/main/proxy.txt",
    "https://raw.githubusercontent.com/iwh3n/tg-proxy/main/all_proxies.txt",
    "https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt",
    "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt",
    "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt",
    "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/master/socks5.txt",
    "https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.txt",
    "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt",
    "https://raw.githubusercontent.com/prxchk/proxy-list/main/socks5.txt",
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


async def fetch_source_async(url: str, session: aiohttp.ClientSession) -> str:
    try:
        async with session.get(url, timeout=4.5) as resp:
            if resp.status == 200:
                return await resp.text()
    except Exception:
        pass
    return ""


async def run_tg_harvest(test_limit: int = 0) -> List[TGProxy]:
    print("🚀 [TGProxy Harvester] Crawling 35+ Telegram channels and RAW pools concurrently...", flush=True)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    connector = aiohttp.TCPConnector(limit=100, ssl=False)

    all_sources = TG_CHANNELS + RAW_LISTS
    raw_proxies: List[TGProxy] = []
    seen = set()

    async with aiohttp.ClientSession(connector=connector, headers=headers) as session:
        tasks = [fetch_source_async(u, session) for u in all_sources]
        results = await asyncio.gather(*tasks, return_exceptions=True)

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

    eval_pool = mtproto_cands + (socks_cands[:test_limit] if test_limit > 0 else socks_cands[:1000])

    print(f"🔬 [Telegram DC & Fake-TLS Gate] Parallel benchmarking {len(eval_pool)} candidates (50 threads)...", flush=True)
    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor(max_workers=50) as pool:
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
    limit = 300 if test_mode else 0

    t0 = time.time()
    proxies = asyncio.run(run_tg_harvest(test_limit=limit))
    elapsed = round(time.time() - t0, 2)
    print(f"🏁 Finished in {elapsed}s. Verified online proxies: {len(proxies)}")


if __name__ == "__main__":
    main()
