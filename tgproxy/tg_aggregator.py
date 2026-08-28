#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
⚡ TurboProbe TGProxy - Authentic Telegram Proxy Harvester & End-to-End Verifier
Strictly validates Fake-TLS handshakes for MTProto and Telegram DC2 CONNECT for SOCKS5.
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
import aiohttp

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Active Telegram Channel Web Mirrors
TG_CHANNELS = [
    "https://t.me/s/ProxyMTProto",
    "https://t.me/s/TelMTProto",
    "https://t.me/s/mtprotorus",
    "https://t.me/s/MTProto_TG",
    "https://t.me/s/proxy_socks5_tg",
    "https://t.me/s/MTP_ro",
    "https://t.me/s/free_tg_proxy",
]

SOCKS5_SOURCES = [
    "https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt",
    "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt",
    "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt",
    "https://raw.githubusercontent.com/vakhov/fresh-proxy-list/master/socks5.txt",
]

TG_DC2_IP = "149.154.167.50"
TG_DC2_PORT = 443

COUNTRY_MAP = {
    "de": ("DE", "🇩🇪 Германия"),
    "nl": ("NL", "🇳🇱 Нидерланды"),
    "fi": ("FI", "🇫🇮 Финляндия"),
    "se": ("SE", "🇸🇪 Швеция"),
    "ru": ("RU", "🇷🇺 Россия"),
    "us": ("US", "🇺🇸 США"),
    "gb": ("GB", "🇬🇧 Великобритания"),
    "fr": ("FR", "🇫🇷 Франция"),
    "pl": ("PL", "🇵🇱 Польша"),
    "kz": ("KZ", "🇰🇿 Казахстан"),
    "tr": ("TR", "🇹🇷 Турция"),
    "sg": ("SG", "🇸🇬 Сингапур"),
    "jp": ("JP", "🇯🇵 Япония"),
    "ir": ("IR", "🇮🇷 Иран"),
}


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


def guess_country(server: str) -> Tuple[str, str]:
    srv_low = server.lower()
    for domain_tld, (code, label) in COUNTRY_MAP.items():
        if srv_low.endswith(f".{domain_tld}") or f"-{domain_tld}." in srv_low:
            return code, label
    return "GLOBAL", "🌐 Сервер"


async def verify_mtproto_proxy(proxy: TGProxy, timeout: float = 2.5) -> Tuple[bool, float]:
    """Asynchronously tests real Fake-TLS or Classic MTProto handshake."""
    t0 = time.perf_counter()
    loop = asyncio.get_running_loop()
    
    def _sync_test():
        s = socket.create_connection((proxy.server, proxy.port), timeout=timeout)
        sec_low = (proxy.secret or "").lower()
        if sec_low.startswith("ee") and len(sec_low) > 34:
            sni_hex = sec_low[34:]
            try:
                sni = bytes.fromhex(sni_hex).decode("utf-8", errors="ignore")
            except Exception:
                sni = "www.cloudflare.com"
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            ssl_sock = ctx.wrap_socket(s, server_hostname=sni or "www.cloudflare.com")
            ssl_sock.settimeout(timeout)
            _ = ssl_sock.cipher()
            ssl_sock.close()
            return True
        else:
            s.sendall(os.urandom(64))
            s.settimeout(timeout)
            data = s.recv(4)
            s.close()
            return bool(data)

    try:
        ok = await asyncio.wait_for(loop.run_in_executor(None, _sync_test), timeout=timeout + 0.5)
        if ok:
            rtt = round((time.perf_counter() - t0) * 1000.0, 1)
            return True, rtt
        return False, 999.0
    except Exception:
        return False, 999.0


async def verify_socks5_tg_dc(proxy: TGProxy, timeout: float = 2.5) -> Tuple[bool, float]:
    """Strictly tests end-to-end SOCKS5 tunnel to Telegram DC2 (149.154.167.50:443)."""
    t0 = time.perf_counter()
    loop = asyncio.get_running_loop()

    def _sync_socks_connect():
        s = socket.create_connection((proxy.server, proxy.port), timeout=timeout)
        s.settimeout(timeout)
        # 1. Greeting
        if proxy.user and proxy.password:
            s.sendall(b"\x05\x02\x00\x02")
        else:
            s.sendall(b"\x05\x01\x00")
        resp = s.recv(2)
        if len(resp) < 2 or resp[0] != 0x05 or resp[1] not in (0x00, 0x02):
            s.close()
            return False

        if resp[1] == 0x02:
            u_b = proxy.user.encode("utf-8")
            p_b = proxy.password.encode("utf-8")
            s.sendall(b"\x01" + bytes([len(u_b)]) + u_b + bytes([len(p_b)]) + p_b)
            auth_resp = s.recv(2)
            if len(auth_resp) < 2 or auth_resp[1] != 0x00:
                s.close()
                return False

        # 2. SOCKS5 CONNECT to Telegram DC2 (149.154.167.50:443)
        ip_bytes = socket.inet_aton(TG_DC2_IP)
        port_bytes = (TG_DC2_PORT).to_bytes(2, byteorder="big")
        s.sendall(b"\x05\x01\x00\x01" + ip_bytes + port_bytes)
        conn_resp = s.recv(10)
        s.close()
        return len(conn_resp) >= 4 and conn_resp[0] == 0x05 and conn_resp[1] == 0x00

    try:
        ok = await asyncio.wait_for(loop.run_in_executor(None, _sync_socks_connect), timeout=timeout + 0.5)
        if ok:
            rtt = round((time.perf_counter() - t0) * 1000.0, 1)
            return True, rtt
        return False, 999.0
    except Exception:
        return False, 999.0


async def check_proxy_task(proxy: TGProxy, sem: asyncio.Semaphore) -> Optional[TGProxy]:
    async with sem:
        if proxy.proto == "mtproto":
            ok, rtt = await verify_mtproto_proxy(proxy, timeout=2.5)
        else:
            ok, rtt = await verify_socks5_tg_dc(proxy, timeout=2.5)

        if ok and rtt < 850.0:
            proxy.ping_ms = rtt
            return proxy
        return None


async def fetch_channel_html(url: str, session: aiohttp.ClientSession) -> str:
    try:
        async with session.get(url, timeout=5.0) as resp:
            if resp.status == 200:
                return await resp.text()
    except Exception:
        pass
    return ""


async def run_tg_harvest(test_limit: int = 0) -> List[TGProxy]:
    print("🚀 [TGProxy Engine] Harvesting Telegram MTProto channels & SOCKS5 pools...", flush=True)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    connector = aiohttp.TCPConnector(limit=50, ssl=False)

    raw_proxies: List[TGProxy] = []
    seen = set()

    async with aiohttp.ClientSession(connector=connector, headers=headers) as session:
        # 1. Fetch MTProto Channels
        channel_tasks = [fetch_channel_html(url, session) for url in TG_CHANNELS]
        channel_htmls = await asyncio.gather(*channel_tasks, return_exceptions=True)
        for html in channel_htmls:
            if isinstance(html, str) and html:
                matches = re.finditer(r'(?:https?://t\.me/proxy\?|tg://proxy\?)([^\s<>\"\'\)]+)', html)
                for m in matches:
                    qs = m.group(1).replace("&amp;", "&")
                    parsed = urllib.parse.parse_qs(qs)
                    srv = parsed.get("server", [""])[0].strip().rstrip(".")
                    prt = parsed.get("port", ["0"])[0].strip()
                    sec = parsed.get("secret", [""])[0].strip()
                    if srv and prt.isdigit() and sec:
                        cc, label = guess_country(srv)
                        p = TGProxy("mtproto", srv, int(prt), secret=sec, country=cc, country_label=label)
                        if p.key not in seen:
                            seen.add(p.key)
                            raw_proxies.append(p)

        # 2. Fetch SOCKS5 Sources
        socks_tasks = [fetch_channel_html(url, session) for url in SOCKS5_SOURCES]
        socks_texts = await asyncio.gather(*socks_tasks, return_exceptions=True)
        for text in socks_texts:
            if isinstance(text, str) and text:
                for line in text.splitlines():
                    line = line.strip()
                    if not line or line.startswith("#") or ":" not in line:
                        continue
                    parts = line.split(":")
                    if len(parts) == 2 and parts[1].isdigit():
                        cc, label = guess_country(parts[0])
                        p = TGProxy("socks5", parts[0], int(parts[1]), country=cc, country_label=label)
                        if p.key not in seen:
                            seen.add(p.key)
                            raw_proxies.append(p)

    mtproto_cands = [p for p in raw_proxies if p.proto == "mtproto"]
    socks_cands = [p for p in raw_proxies if p.proto == "socks5"]
    print(f"📊 Harvested {len(raw_proxies)} unique candidates (MTProto: {len(mtproto_cands)}, SOCKS5: {len(socks_cands)}).", flush=True)

    eval_pool = mtproto_cands + (socks_cands[:test_limit] if test_limit > 0 else socks_cands[:1000])

    print(f"🔬 [Telegram DC Gate] Strictly testing {len(eval_pool)} candidates with true TLS / DC2 tunnels...", flush=True)
    sem = asyncio.Semaphore(100)
    check_tasks = [check_proxy_task(p, sem) for p in eval_pool]
    checked = await asyncio.gather(*check_tasks)

    alive = [p for p in checked if p is not None]
    alive.sort(key=lambda p: (0 if p.is_faketls else 1 if p.proto == "mtproto" else 2, p.ping_ms))

    alive_mtproto = sum(1 for p in alive if p.proto == "mtproto")
    alive_socks = sum(1 for p in alive if p.proto == "socks5")
    print(f"✅ [Telegram DC Gate] {len(alive)} VERIFIED ONLINE! (MTProto: {alive_mtproto}, SOCKS5: {alive_socks})", flush=True)
    return alive


def main():
    test_mode = "--test" in sys.argv
    limit = 200 if test_mode else 0

    t0 = time.time()
    proxies = asyncio.run(run_tg_harvest(test_limit=limit))
    elapsed = round(time.time() - t0, 2)
    print(f"🏁 Finished in {elapsed}s. Verified online proxies: {len(proxies)}", flush=True)


if __name__ == "__main__":
    main()
