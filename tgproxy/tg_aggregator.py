#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
⚡ TurboProbe TGProxy - Telegram Proxy Harvester & Fast Handshake Engine
Collects, parses, and validates MTProto (Fake-TLS / Classic) and SOCKS5 proxies.
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
from typing import Dict, List, Optional, Set, Tuple

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

TG_SOURCES = [
    # Top curated high-yield SOCKS5 & MTProto lists
    "https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt",
    "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt",
    "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt",
    "https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.txt",
    "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/master/socks5.txt",
    "https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5_RAW.txt",
    "https://raw.githubusercontent.com/ErcinDedeoglu/proxies/main/proxies/socks5.txt",
    "https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/master/socks5.txt",
    "https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/socks5_proxies.txt",
    "https://raw.githubusercontent.com/prxchk/proxy-list/main/socks5.txt",
    # Dedicated MTProto Repositories
    "https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/telegram/mtproto",
    "https://raw.githubusercontent.com/soroushmirzaei/telegram-proxies-collector/main/proxies",
    "https://raw.githubusercontent.com/IranianCypherpunks/sub/main/mtproto",
    "https://raw.githubusercontent.com/Surfboardv2ray/TGParse/main/config",
    "https://raw.githubusercontent.com/mftg/tgproxy/main/mtproto.txt",
    "https://raw.githubusercontent.com/vfarid/v2ray-share/main/mtproto.txt",
    "https://raw.githubusercontent.com/ALIILAPRO/v2rayNG-Config/main/sub.txt",
    # Telegram web channel scraper mirrors (MTProto)
    "https://t.me/s/MTProxy",
    "https://t.me/s/TelMTProto",
    "https://t.me/s/ProxyMTProto",
    "https://t.me/s/TgProxies",
    "https://t.me/s/MTP_ro",
    "https://t.me/s/proxy_socks5_tg",
    "https://t.me/s/mtprotorus",
    "https://t.me/s/tg_proxy_mtproto",
]

SUB_TG_DIR = os.path.join("sub", "tg")
os.makedirs(SUB_TG_DIR, exist_ok=True)


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
        ping_ms: float = 999.0,
    ):
        self.proto = proto.lower()
        self.server = server.strip()
        self.port = int(port)
        self.secret = secret.strip() if secret else None
        self.user = user.strip() if user else None
        self.password = password.strip() if password else None
        self.country = country.upper()
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
            "ping_ms": self.ping_ms,
            "ru_verified": self.ru_verified,
            "isp_status": self.isp_status,
            "tg_link": self.tg_link,
            "https_link": self.https_link,
        }


def parse_tg_proxy_from_text(text: str) -> List[TGProxy]:
    results = []
    seen = set()

    mtproto_patterns = [
        r"(?:tg://proxy\?|https?://t\.me/proxy\?)([^\s<>\"'\)]+)",
    ]
    for pat in mtproto_patterns:
        for match in re.finditer(pat, text, re.IGNORECASE):
            qs = match.group(1).replace("&amp;", "&")
            parsed = urllib.parse.parse_qs(qs)
            server = parsed.get("server", [""])[0].strip()
            port = parsed.get("port", [""])[0].strip()
            secret = parsed.get("secret", [""])[0].strip()
            if server and port.isdigit() and secret:
                p = TGProxy("mtproto", server, int(port), secret=secret)
                if p.key not in seen:
                    seen.add(p.key)
                    results.append(p)

    socks_patterns = [
        r"(?:tg://socks\?|https?://t\.me/socks\?)([^\s<>\"'\)]+)",
    ]
    for pat in socks_patterns:
        for match in re.finditer(pat, text, re.IGNORECASE):
            qs = match.group(1).replace("&amp;", "&")
            parsed = urllib.parse.parse_qs(qs)
            server = parsed.get("server", [""])[0].strip()
            port = parsed.get("port", [""])[0].strip()
            user = parsed.get("user", [None])[0]
            password = parsed.get("pass", [None])[0]
            if server and port.isdigit():
                p = TGProxy("socks5", server, int(port), user=user, password=password)
                if p.key not in seen:
                    seen.add(p.key)
                    results.append(p)

    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "<" in line:
            continue
        parts = line.split(":")
        if len(parts) == 2 and parts[1].isdigit():
            p = TGProxy("socks5", parts[0], int(parts[1]))
            if p.key not in seen:
                seen.add(p.key)
                results.append(p)
        elif len(parts) == 4 and parts[1].isdigit():
            p = TGProxy("socks5", parts[0], int(parts[1]), user=parts[2], password=parts[3])
            if p.key not in seen:
                seen.add(p.key)
                results.append(p)

    return results


async def validate_socks5_proxy(proxy: TGProxy, timeout: float = 2.0) -> Tuple[bool, float]:
    t0 = time.perf_counter()
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(proxy.server, proxy.port),
            timeout=timeout
        )
        writer.write(b"\x05\x02\x00\x02")
        await asyncio.wait_for(writer.drain(), timeout=timeout)
        resp = await asyncio.wait_for(reader.read(2), timeout=timeout)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass

        if len(resp) >= 2 and resp[0] == 0x05 and resp[1] in (0x00, 0x02):
            rtt = round((time.perf_counter() - t0) * 1000.0, 1)
            return True, rtt
        return False, 999.0
    except Exception:
        return False, 999.0


async def validate_mtproto_proxy(proxy: TGProxy, timeout: float = 2.5) -> Tuple[bool, float]:
    t0 = time.perf_counter()
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(proxy.server, proxy.port),
            timeout=timeout
        )
        if proxy.is_faketls:
            client_hello = (
                b"\x16\x03\x01\x00\xba"
                b"\x01\x00\x00\xb6"
                b"\x03\x03"
                + os.urandom(32)
                + b"\x00"
                + b"\x00\x04\x13\x01\x13\x02"
                + b"\x01\x00"
                + b"\x00\x87"
            )
            writer.write(client_hello)
            await asyncio.wait_for(writer.drain(), timeout=timeout)
            resp = await asyncio.wait_for(reader.read(5), timeout=timeout)
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass
            if len(resp) >= 1 and resp[0] in (0x16, 0x17):
                rtt = round((time.perf_counter() - t0) * 1000.0, 1)
                return True, rtt
            return False, 999.0
        else:
            key_frame = os.urandom(64)
            writer.write(key_frame)
            await asyncio.wait_for(writer.drain(), timeout=timeout)
            resp = await asyncio.wait_for(reader.read(4), timeout=timeout)
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass
            rtt = round((time.perf_counter() - t0) * 1000.0, 1)
            return True, rtt
    except Exception:
        return False, 999.0


async def check_proxy_task(proxy: TGProxy, sem: asyncio.Semaphore) -> Optional[TGProxy]:
    async with sem:
        if proxy.proto == "mtproto":
            ok, rtt = await validate_mtproto_proxy(proxy, timeout=2.5)
        else:
            ok, rtt = await validate_socks5_proxy(proxy, timeout=2.0)
        
        if ok and rtt < 900.0:
            proxy.ping_ms = rtt
            return proxy
        return None


async def fetch_source(url: str, session) -> str:
    try:
        async with session.get(url, timeout=5.0) as resp:
            if resp.status == 200:
                return await resp.text()
    except Exception:
        pass
    return ""


async def run_tg_harvest(test_limit: int = 0) -> List[TGProxy]:
    print("🚀 [TGProxy Harvester] Starting Telegram & SOCKS5 proxy harvesting...", flush=True)
    import aiohttp

    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    connector = aiohttp.TCPConnector(limit=100, ssl=False)
    
    raw_proxies: List[TGProxy] = []
    seen = set()

    async with aiohttp.ClientSession(connector=connector, headers=headers) as session:
        tasks = [fetch_source(url, session) for url in TG_SOURCES]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for res in results:
            if isinstance(res, str) and res:
                found = parse_tg_proxy_from_text(res)
                for p in found:
                    if p.key not in seen:
                        seen.add(p.key)
                        raw_proxies.append(p)

    print(f"📊 Collected {len(raw_proxies)} unique candidate proxies (MTProto & SOCKS5).", flush=True)

    if test_limit > 0:
        raw_proxies = raw_proxies[:test_limit]

    print(f"🩺 Benchmarking {len(raw_proxies)} candidates with async handshakes...", flush=True)
    sem = asyncio.Semaphore(500)
    check_tasks = [check_proxy_task(p, sem) for p in raw_proxies]
    checked = await asyncio.gather(*check_tasks)

    alive = [p for p in checked if p is not None]
    alive.sort(key=lambda p: p.ping_ms)
    print(f"✨ Handshake validation complete: {len(alive)} confirmed ONLINE!", flush=True)
    return alive


def main():
    test_mode = "--test" in sys.argv
    limit = 50 if test_mode else 0
    
    t0 = time.time()
    proxies = asyncio.run(run_tg_harvest(test_limit=limit))
    elapsed = round(time.time() - t0, 2)
    print(f"🏁 Finished in {elapsed}s. Alive proxies: {len(proxies)}")
    
    for idx, p in enumerate(proxies[:10]):
        print(f"  #{idx+1:02d} [{p.proto.upper()}] {p.server}:{p.port} - {p.ping_ms}ms (FakeTLS: {p.is_faketls})")


if __name__ == "__main__":
    main()
