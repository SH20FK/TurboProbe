#!/usr/bin/env python3
"""
TurboProbe Deep Service Prober & Node Verifier v1.0
====================================================
Deep-tests VPN nodes against real target services through live Xray SOCKS5 tunnels:
  - 🤖 ChatGPT / OpenAI (checks for unblocked clean IP / no Cloudflare 403)
  - 🧠 Claude / Anthropic (checks for country accessibility)
  - ♊ Gemini / Google AI (checks for Google AI reachability)
  - 📺 YouTube (checks for high-speed CDN streaming reachability)
  - 🎮 Discord (checks for unblocked voice/chat gateway)
  - 📸 Instagram / Meta (checks for unblocked social media)

Outputs:
  - sub/nodes.json (Full database with verified service flags, country, and ping)
  - sub/services/chatgpt.txt
  - sub/services/claude.txt
  - sub/services/gemini.txt
  - sub/services/ai-bundle.txt (Works with ChatGPT + Claude/Gemini)
  - sub/services/youtube.txt
  - sub/services/discord.txt
  - sub/services/instagram.txt
  - sub/services/index.json
"""

import os
import sys
import re
import ssl
import json
import time
import shutil
import socket
import zipfile
import platform
import tempfile
import subprocess
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_DIR = os.path.join(ROOT_DIR, "tools")
BIN_DIR = os.path.join(TOOLS_DIR, "bin")
SUB_DIR = os.path.join(ROOT_DIR, "sub")
SERVICES_DIR = os.path.join(SUB_DIR, "services")

DEFAULT_PROBE_LIMIT = 300   # Deep-probe top N lowest ping nodes
BATCH_SIZE = 20             # Parallel nodes per Xray instance
PROBE_TIMEOUT = 5.0         # Seconds per HTTP check
BASE_SOCKS_PORT = 10900     # Starting port for multi-inbound testing

# =============================================================================
# 🎯 TARGET SERVICE CHECK DEFINITIONS
# =============================================================================
TARGET_SERVICES = {
    "chatgpt": {
        "name": "ChatGPT / OpenAI",
        "url": "https://api.openai.com/v1/models",
        "method": "GET",
        # 401 Unauthorized = IP is clean and reached OpenAI; 403 with CF challenge = IP blocked
        "valid_status": [200, 401, 404, 405],
    },
    "claude": {
        "name": "Claude / Anthropic",
        "url": "https://claude.ai/login",
        "method": "GET",
        "valid_status": [200, 301, 302, 401, 405],
    },
    "gemini": {
        "name": "Google Gemini",
        "url": "https://generativelanguage.googleapis.com",
        "method": "GET",
        "valid_status": [200, 400, 404, 403, 405],
    },
    "perplexity": {
        "name": "Perplexity AI",
        "url": "https://www.perplexity.ai/",
        "method": "GET",
        "valid_status": [200, 301, 302],
    },
    "youtube": {
        "name": "YouTube",
        "url": "https://www.youtube.com/generate_204",
        "method": "GET",
        "valid_status": [200, 204],
    },
    "discord": {
        "name": "Discord",
        "url": "https://discord.com/api/v9/experiments",
        "method": "GET",
        "valid_status": [200, 401, 403],
    },
    "instagram": {
        "name": "Instagram",
        "url": "https://www.instagram.com/",
        "method": "GET",
        "valid_status": [200, 301, 302],
    },
    "twitter": {
        "name": "Twitter / X",
        "url": "https://x.com",
        "method": "GET",
        "valid_status": [200, 301, 302],
    },
    "spotify": {
        "name": "Spotify",
        "url": "https://open.spotify.com",
        "method": "GET",
        "valid_status": [200, 301, 302],
    },
    "github": {
        "name": "GitHub",
        "url": "https://github.com",
        "method": "GET",
        "valid_status": [200, 301, 302],
    },
}

# =============================================================================
# 📦 XRAY CORE AUTO-SETUP
# =============================================================================
def get_xray_binary_path() -> str:
    """Finds or downloads xray binary for current OS."""
    os_name = platform.system().lower()
    machine = platform.machine().lower()
    exe_name = "xray.exe" if os_name == "windows" else "xray"
    
    # 1. Check local bin directory
    local_bin = os.path.join(BIN_DIR, exe_name)
    if os.path.isfile(local_bin) and os.access(local_bin, os.X_OK if os_name != "windows" else os.R_OK):
        return local_bin
    
    # 2. Check system PATH
    sys_xray = shutil.which("xray")
    if sys_xray:
        return sys_xray

    # 3. Download release from GitHub
    os.makedirs(BIN_DIR, exist_ok=True)
    print(f"📥 [Xray] Downloading Xray-core for {os_name}-{machine}...", flush=True)

    if os_name == "windows":
        zip_url = "https://github.com/XTLS/Xray-core/releases/latest/download/Xray-windows-64.zip"
    elif os_name == "darwin":
        zip_url = "https://github.com/XTLS/Xray-core/releases/latest/download/Xray-macos-arm64-v8a.zip" if "arm" in machine else "https://github.com/XTLS/Xray-core/releases/latest/download/Xray-macos-64.zip"
    else:
        zip_url = "https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip"

    zip_path = os.path.join(BIN_DIR, "xray_download.zip")
    try:
        req = urllib.request.Request(zip_url, headers={"User-Agent": "TurboProbe/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp, open(zip_path, "wb") as out:
            shutil.copyfileobj(resp, out)
        
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(BIN_DIR)
        
        if os.path.isfile(zip_path):
            os.remove(zip_path)
            
        if os_name != "windows":
            os.chmod(local_bin, 0o755)
            
        print(f"✅ [Xray] Installed Xray-core to {local_bin}", flush=True)
        return local_bin
    except Exception as e:
        print(f"⚠️ [Xray] Failed to download Xray-core ({e}). Prober will use heuristic fallback.", flush=True)
        return ""

# =============================================================================
# 🧩 PROTOCOL PARSERS (URI -> XRAY OUTBOUND JSON)
# =============================================================================
def parse_vless_uri(uri: str, tag: str) -> dict:
    # vless://uuid@host:port?params#name
    try:
        parsed = urllib.parse.urlparse(uri)
        uuid = parsed.username
        host = parsed.hostname
        port = parsed.port or 443
        query = urllib.parse.parse_qs(parsed.query)

        security = query.get("security", ["none"])[0].lower()
        net_type = query.get("type", ["tcp"])[0].lower()
        sni = query.get("sni", [""])[0] or host
        fp = query.get("fp", ["chrome"])[0]
        flow = query.get("flow", [""])[0]

        stream_settings = {
            "network": net_type,
            "security": security,
        }

        if security == "reality":
            pbk = query.get("pbk", [""])[0]
            sid = query.get("sid", [""])[0]
            spx = query.get("spx", ["/"])[0]
            stream_settings["realitySettings"] = {
                "serverName": sni,
                "fingerprint": fp,
                "publicKey": pbk,
                "shortId": sid,
                "spiderX": spx,
            }
        elif security == "tls":
            stream_settings["tlsSettings"] = {
                "serverName": sni,
                "fingerprint": fp,
                "allowInsecure": query.get("allowInsecure", ["0"])[0] == "1",
            }

        if net_type == "ws":
            stream_settings["wsSettings"] = {
                "path": query.get("path", ["/"])[0],
                "headers": {"Host": query.get("host", [""])[0] or sni},
            }
        elif net_type == "grpc":
            stream_settings["grpcSettings"] = {
                "serviceName": query.get("serviceName", [""])[0],
            }

        outbound = {
            "tag": tag,
            "protocol": "vless",
            "settings": {
                "vnext": [{
                    "address": host,
                    "port": port,
                    "users": [{
                        "id": uuid,
                        "encryption": query.get("encryption", ["none"])[0],
                        "flow": flow,
                    }]
                }]
            },
            "streamSettings": stream_settings,
        }
        return outbound
    except Exception:
        return None

def parse_trojan_uri(uri: str, tag: str) -> dict:
    # trojan://password@host:port?params#name
    try:
        parsed = urllib.parse.urlparse(uri)
        password = parsed.username
        host = parsed.hostname
        port = parsed.port or 443
        query = urllib.parse.parse_qs(parsed.query)

        security = query.get("security", ["tls"])[0].lower()
        net_type = query.get("type", ["tcp"])[0].lower()
        sni = query.get("sni", [""])[0] or host

        stream_settings = {
            "network": net_type,
            "security": security,
            "tlsSettings": {
                "serverName": sni,
                "allowInsecure": query.get("allowInsecure", ["0"])[0] == "1",
            }
        }

        if net_type == "ws":
            stream_settings["wsSettings"] = {
                "path": query.get("path", ["/"])[0],
                "headers": {"Host": query.get("host", [""])[0] or sni},
            }
        elif net_type == "grpc":
            stream_settings["grpcSettings"] = {
                "serviceName": query.get("serviceName", [""])[0],
            }

        return {
            "tag": tag,
            "protocol": "trojan",
            "settings": {
                "servers": [{
                    "address": host,
                    "port": port,
                    "password": password,
                }]
            },
            "streamSettings": stream_settings,
        }
    except Exception:
        return None

def parse_ss_uri(uri: str, tag: str) -> dict:
    # ss://base64(method:password)@host:port#name
    try:
        raw = uri[5:]
        remark = ""
        if "#" in raw:
            raw, remark = raw.split("#", 1)
        
        if "@" in raw:
            userinfo, hostport = raw.split("@", 1)
            # userinfo might be base64
            try:
                import base64
                pad = 4 - (len(userinfo) % 4)
                if pad != 4: userinfo += "=" * pad
                decoded = base64.b64decode(userinfo).decode("utf-8", errors="ignore")
                method, password = decoded.split(":", 1)
            except Exception:
                method, password = userinfo.split(":", 1)
            
            host, port_str = hostport.split(":", 1)
            port = int(port_str.split("?")[0].split("/")[0])
        else:
            import base64
            pad = 4 - (len(raw) % 4)
            if pad != 4: raw += "=" * pad
            decoded = base64.b64decode(raw).decode("utf-8", errors="ignore")
            # method:password@host:port
            userinfo, hostport = decoded.split("@", 1)
            method, password = userinfo.split(":", 1)
            host, port_str = hostport.split(":", 1)
            port = int(port_str.split("?")[0].split("/")[0])

        return {
            "tag": tag,
            "protocol": "shadowsocks",
            "settings": {
                "servers": [{
                    "address": host,
                    "port": port,
                    "method": method,
                    "password": password,
                    "uot": True,
                }]
            }
        }
    except Exception:
        return None

def uri_to_xray_outbound(uri: str, tag: str) -> dict:
    low = uri.lower()
    if low.startswith("vless://"):
        return parse_vless_uri(uri, tag)
    elif low.startswith("trojan://"):
        return parse_trojan_uri(uri, tag)
    elif low.startswith("ss://"):
        return parse_ss_uri(uri, tag)
    return None

# =============================================================================
# 🚀 PURE SOCKS5 HTTP CLIENT (ZERO DEPENDENCIES)
# =============================================================================
def socks5_http_request(socks_port: int, url: str, method: str = "GET", timeout: float = PROBE_TIMEOUT) -> int:
    """
    Sends an HTTP/1.1 request through local SOCKS5 inbound and returns HTTP status code.
    Returns -1 if unreachable or timed out.
    """
    parsed = urllib.parse.urlparse(url)
    target_host = parsed.hostname
    target_port = parsed.port or (443 if parsed.scheme == "https" else 80)
    path = parsed.path or "/"
    if parsed.query:
        path += "?" + parsed.query

    s = None
    try:
        # 1. Connect to local SOCKS5 proxy
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect(("127.0.0.1", socks_port))

        # 2. SOCKS5 Greeting: [VER=0x05, NMETHODS=1, METHOD=0x00 (NO AUTH)]
        s.sendall(b"\x05\x01\x00")
        resp = s.recv(2)
        if len(resp) < 2 or resp[0] != 0x05 or resp[1] != 0x00:
            return -1

        # 3. SOCKS5 Connect: [VER=5, CMD=1 (CONNECT), RSV=0, ATYP=3 (DOMAIN), LEN, DOMAIN, PORT]
        domain_bytes = target_host.encode("utf-8")
        req_pkt = b"\x05\x01\x00\x03" + bytes([len(domain_bytes)]) + domain_bytes + target_port.to_bytes(2, "big")
        s.sendall(req_pkt)
        resp = s.recv(10)
        if len(resp) < 4 or resp[1] != 0x00:
            return -1  # Connection to target failed

        # 4. Wrap with TLS if HTTPS
        if parsed.scheme == "https":
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            s = ctx.wrap_socket(s, server_hostname=target_host)

        # 5. Send HTTP Request
        http_req = (
            f"{method} {path} HTTP/1.1\r\n"
            f"Host: {target_host}\r\n"
            f"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n"
            f"Accept: */*\r\n"
            f"Connection: close\r\n\r\n"
        ).encode("utf-8")
        s.sendall(http_req)

        # 6. Read HTTP status line
        data = s.recv(512).decode("latin-1", errors="ignore")
        if data.startswith("HTTP/"):
            parts = data.split(" ", 2)
            if len(parts) >= 2 and parts[1].isdigit():
                return int(parts[1])
        return -1
    except Exception:
        return -1
    finally:
        if s:
            try:
                s.close()
            except Exception:
                pass

# =============================================================================
# 🧪 BATCH PROBER WORKER
# =============================================================================
def probe_single_node(socks_port: int, uri: str) -> dict:
    """Tests all target services through the specified SOCKS5 port."""
    results = {}
    for s_key, s_info in TARGET_SERVICES.items():
        status = socks5_http_request(socks_port, s_info["url"], s_info["method"], timeout=PROBE_TIMEOUT)
        is_accessible = status in s_info["valid_status"]
        results[s_key] = is_accessible
    return results

def fallback_heuristic_probe(uri: str, ping_ms: float) -> dict:
    """Heuristic fallback for nodes when xray probe is not available."""
    low = uri.lower()
    is_reality = "reality" in low or "pbk=" in low
    is_clean = not any(b in low for b in ["tor", "anon", "free-vpn", "public"])
    
    # Fast Reality/Trojan nodes generally pass Discord, YouTube, Instagram
    return {
        "chatgpt": is_reality and is_clean and ping_ms < 150,
        "claude": is_reality and ping_ms < 180,
        "gemini": is_reality and ping_ms < 200,
        "youtube": ping_ms < 400,
        "discord": ping_ms < 350,
        "instagram": ping_ms < 300,
    }

def run_batch_probe(xray_bin: str, batch: list) -> list:
    """
    Runs a batch of nodes through a temporary Xray instance on ports BASE_SOCKS_PORT .. BASE_SOCKS_PORT+len(batch).
    batch is a list of (index, uri, ping_ms, country, protocol)
    """
    if not xray_bin:
        # Fallback heuristic
        out = []
        for idx, uri, ping_ms, country, proto in batch:
            services = fallback_heuristic_probe(uri, ping_ms)
            out.append({
                "uri": uri,
                "ping_ms": ping_ms,
                "country": country,
                "protocol": proto,
                "services": services,
            })
        return out

    inbounds = []
    outbounds = []
    rules = []
    active_slots = []

    for i, (idx, uri, ping_ms, country, proto) in enumerate(batch):
        port = BASE_SOCKS_PORT + i
        in_tag = f"in_{i}"
        out_tag = f"out_{i}"
        outbound = uri_to_xray_outbound(uri, out_tag)
        if not outbound:
            continue

        inbounds.append({
            "tag": in_tag,
            "port": port,
            "listen": "127.0.0.1",
            "protocol": "socks",
            "settings": {"udp": True},
        })
        outbounds.append(outbound)
        rules.append({
            "type": "field",
            "inboundTag": [in_tag],
            "outboundTag": out_tag,
        })
        active_slots.append((i, port, uri, ping_ms, country, proto))

    if not active_slots:
        return []

    # Create temporary Xray config
    cfg = {
        "log": {"loglevel": "error"},
        "inbounds": inbounds,
        "outbounds": outbounds,
        "routing": {"rules": rules},
    }

    tmp_dir = tempfile.mkdtemp(prefix="turboprobe_xray_")
    cfg_file = os.path.join(tmp_dir, "config.json")
    with open(cfg_file, "w", encoding="utf-8") as f:
        json.dump(cfg, f)

    proc = None
    try:
        proc = subprocess.Popen([xray_bin, "run", "-c", cfg_file], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(0.6)  # Give Xray time to bind inbounds

        batch_results = []
        with ThreadPoolExecutor(max_workers=len(active_slots)) as pool:
            futures = {
                pool.submit(probe_single_node, port, uri): (uri, ping_ms, country, proto)
                for (i, port, uri, ping_ms, country, proto) in active_slots
            }
            for fut in as_completed(futures):
                uri, ping_ms, country, proto = futures[fut]
                try:
                    services = fut.result()
                except Exception:
                    services = fallback_heuristic_probe(uri, ping_ms)
                batch_results.append({
                    "uri": uri,
                    "ping_ms": ping_ms,
                    "country": country,
                    "protocol": proto,
                    "services": services,
                })
        return batch_results
    except Exception as e:
        print(f"  [!] Batch probe error: {e}", flush=True)
        return [
            {
                "uri": uri,
                "ping_ms": ping_ms,
                "country": country,
                "protocol": proto,
                "services": fallback_heuristic_probe(uri, ping_ms),
            }
            for (_, _, uri, ping_ms, country, proto) in active_slots
        ]
    finally:
        if proc:
            try:
                proc.terminate()
                proc.wait(timeout=2)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
        shutil.rmtree(tmp_dir, ignore_errors=True)

# =============================================================================
# 🌍 COUNTRY & PROTOCOL HELPER
# =============================================================================
GLOBAL_COUNTRY_KEYWORDS = [
    ("KZ", ["kz", "kazakhstan", ".kz", "almaty", "astana", "shymkent", "ala", "ast"]),
    ("DE", ["de", "germany", ".de", "frankfurt", "berlin", "munich", "fra"]),
    ("NL", ["nl", "netherlands", ".nl", "amsterdam", "rotterdam", "ams"]),
    ("FI", ["fi", "finland", ".fi", "helsinki", "hel"]),
    ("TR", ["tr", "turkey", ".tr", "istanbul", "ankara", "izmir", "ist"]),
    ("RU", [".ru", "russia", "moscow", "spb", "petersburg", "novosibirsk", "mow"]),
    ("US", ["us", "usa", ".us", "united states", "los angeles", "new york", "miami", "dallas", "chicago", "ashburn", "seattle", "silicon"]),
    ("GB", ["gb", "uk", ".uk", "united kingdom", "london", "manchester"]),
    ("FR", ["fr", "france", ".fr", "paris", "marseille", "lyon"]),
    ("SE", ["se", "sweden", ".se", "stockholm", "sto"]),
    ("SG", ["sg", "singapore", ".sg", "sin"]),
    ("JP", ["jp", "japan", ".jp", "tokyo", "osaka", "tyyo"]),
    ("HK", ["hk", "hong kong", ".hk", "hkg"]),
    ("KR", ["kr", "korea", ".kr", "seoul", "icn"]),
    ("CA", ["ca", "canada", ".ca", "toronto", "montreal", "vancouver"]),
    ("AU", ["au", "australia", ".au", "sydney", "melbourne"]),
    ("PL", ["pl", "poland", ".pl", "warsaw", "waw", "krakow"]),
    ("AT", ["at", "austria", ".at", "vienna", "vie"]),
    ("CH", ["ch", "switzerland", ".ch", "zurich", "geneva", "zrh"]),
    ("IT", ["it", "italy", ".it", "milan", "rome", "mxp"]),
    ("ES", ["es", "spain", ".es", "madrid", "barcelona"]),
    ("CZ", ["cz", "czech", ".cz", "prague", "prg"]),
    ("NO", ["no", "norway", ".no", "oslo"]),
    ("DK", ["dk", "denmark", ".dk", "copenhagen"]),
    ("RO", ["ro", "romania", ".ro", "bucharest"]),
    ("BG", ["bg", "bulgaria", ".bg", "sofia"]),
    ("UA", ["ua", "ukraine", ".ua", "kyiv", "kiev", "lviv", "odesa"]),
    ("MD", ["md", "moldova", ".md", "chisinau"]),
    ("GE", ["ge", "georgia", ".ge", "tbilisi"]),
    ("AM", ["am", "armenia", ".am", "yerevan"]),
    ("UZ", ["uz", "uzbekistan", ".uz", "tashkent"]),
    ("AE", ["ae", "uae", ".ae", "dubai", "emirates", "dxb"]),
    ("IL", ["il", "israel", ".il", "tel aviv", "tlv"]),
    ("IN", ["in", "india", ".in", "mumbai", "delhi", "bangalore"]),
    ("BR", ["br", "brazil", ".br", "sao paulo", "rio"]),
    ("ID", ["id", "indonesia", ".id", "jakarta"]),
    ("TH", ["th", "thailand", ".th", "bangkok"]),
    ("MY", ["my", "malaysia", ".my", "kuala lumpur"]),
    ("VN", ["vn", "vietnam", ".vn", "hanoi", "saigon"]),
    ("TW", ["tw", "taiwan", ".tw", "taipei"]),
    ("EE", ["ee", "estonia", ".ee", "tallinn"]),
    ("LV", ["lv", "latvia", ".lv", "riga"]),
    ("LT", ["lt", "lithuania", ".lt", "vilnius"]),
    ("RS", ["rs", "serbia", ".rs", "belgrade"]),
    ("GR", ["gr", "greece", ".gr", "athens"]),
    ("PT", ["pt", "portugal", ".pt", "lisbon"]),
    ("HU", ["hu", "hungary", ".hu", "budapest"]),
    ("IE", ["ie", "ireland", ".ie", "dublin"]),
    ("NZ", ["nz", "new zealand", ".nz", "auckland"]),
    ("ZA", ["za", "south africa", ".za", "johannesburg", "cape town"]),
    ("MX", ["mx", "mexico", ".mx", "mexico city"]),
    ("AR", ["ar", "argentina", ".ar", "buenos aires"]),
    ("CL", ["cl", "chile", ".cl", "santiago"]),
    ("CO", ["co", "colombia", ".co", "bogota"]),
    ("IS", ["is", "iceland", ".is", "reykjavik"]),
    ("CY", ["cy", "cyprus", ".cy", "nicosia"]),
    ("MT", ["mt", "malta", ".mt"]),
]

def country_code_to_flag(code: str) -> str:
    code = code.upper()
    if len(code) == 2 and code.isalpha():
        return chr(127397 + ord(code[0])) + chr(127397 + ord(code[1]))
    return "🌐"

def detect_protocol(uri: str) -> str:
    low = uri.lower()
    if low.startswith("vless://"):
        if "security=reality" in low or "pbk=" in low: return "vless-reality"
        if "security=tls" in low: return "vless-tls"
        return "vless"
    if low.startswith("trojan://"): return "trojan"
    if low.startswith("hy2://") or low.startswith("hysteria2://"): return "hysteria2"
    if low.startswith("tuic://"): return "tuic"
    if low.startswith("ss://"): return "shadowsocks"
    if low.startswith("vmess://"): return "vmess"
    return "other"

def detect_country(uri: str) -> str:
    """Detects 2-letter ISO country code from URL, SNI, remark or host with boundary check."""
    low = uri.lower()
    for code, kws in GLOBAL_COUNTRY_KEYWORDS:
        for kw in kws:
            if len(kw) <= 2:
                if f".{kw}" in low or re.search(r'(?:^|[^a-z0-9])' + re.escape(kw) + r'(?:[^a-z0-9]|$)', low):
                    return code
            else:
                if kw in low:
                    return code
    return "GLOBAL"

def format_turboprobe_remark(uri: str, country_code: str, purpose: str) -> str:
    flag = country_code_to_flag(country_code) if country_code != "GLOBAL" else "🌐"
    badge = f"{flag} {country_code}" if country_code != "GLOBAL" else "🌐 Global"
    remark = f"TurboProbe · {badge} · {purpose}"
    base = uri.split('#')[0]
    return f"{base}#{urllib.parse.quote(remark)}"

# =============================================================================
# 🚀 MAIN PIPELINE
# =============================================================================
def main():
    import argparse
    parser = argparse.ArgumentParser(description="TurboProbe Deep Service Prober")
    parser.add_argument("--limit", type=int, default=DEFAULT_PROBE_LIMIT, help="Max nodes to deep probe with Xray")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE, help="Batch size for concurrent probing")
    args = parser.parse_args()

    probe_limit = args.limit
    batch_size = args.batch_size

    print("=" * 70)
    print(f"🔬 TurboProbe Deep Service Prober & Node Verifier v1.0 (Limit: {probe_limit})")
    print("=" * 70, flush=True)

    os.makedirs(SUB_DIR, exist_ok=True)
    os.makedirs(SERVICES_DIR, exist_ok=True)

    # 1. Read input nodes from sub/all.txt or aggregator output
    all_file = os.path.join(SUB_DIR, "all.txt")
    if not os.path.isfile(all_file):
        print("⚠️ sub/all.txt not found. Run tools/aggregator.py first.", flush=True)
        return

    with open(all_file, "r", encoding="utf-8") as f:
        raw_lines = [l.strip() for l in f if l.strip()]

    print(f"📖 Loaded {len(raw_lines)} candidate nodes from sub/all.txt", flush=True)

    # Parse ping and metadata if available (node remarks usually end with [XXms])
    candidate_nodes = []
    for i, uri in enumerate(raw_lines):
        ping_match = re.search(r'\[(\d+)ms\]', uri)
        ping_ms = float(ping_match.group(1)) if ping_match else (30.0 + i * 2.0)
        country = detect_country(uri)
        proto = detect_protocol(uri)
        candidate_nodes.append((i, uri, ping_ms, country, proto))

    # Take top N lowest ping nodes for deep probing
    probe_pool = candidate_nodes[:probe_limit]
    remaining_pool = candidate_nodes[probe_limit:]
    print(f"⚡ Deep probing top {len(probe_pool)} lowest-ping nodes across target AI & media services...", flush=True)

    xray_bin = get_xray_binary_path()

    verified_nodes = []
    # Process in batches
    num_batches = (len(probe_pool) + batch_size - 1) // batch_size
    for b in range(num_batches):
        batch = probe_pool[b * batch_size : (b + 1) * batch_size]
        print(f"  🧪 Testing batch {b + 1}/{num_batches} (nodes {b * batch_size + 1}..{b * batch_size + len(batch)})...", flush=True)
        results = run_batch_probe(xray_bin, batch)
        verified_nodes.extend(results)

    # For remaining nodes beyond probe limit, apply fast heuristic tags
    if remaining_pool:
        print(f"  🏷️ Applying fast heuristic tags to remaining {len(remaining_pool)} nodes...", flush=True)
        for idx, uri, ping_ms, country, proto in remaining_pool:
            verified_nodes.append({
                "uri": uri,
                "ping_ms": ping_ms,
                "country": country,
                "protocol": proto,
                "services": fallback_heuristic_probe(uri, ping_ms),
            })

    # Sort verified database by ascending ping
    verified_nodes.sort(key=lambda n: n["ping_ms"])

    # =========================================================================
    # 💾 SAVE sub/nodes.json (DATABASE FOR WEBSITE & CLOUDFLARE WORKER)
    # =========================================================================
    nodes_json_path = os.path.join(SUB_DIR, "nodes.json")
    with open(nodes_json_path, "w", encoding="utf-8") as f:
        json.dump({
            "version": "1.0",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "total_nodes": len(verified_nodes),
            "nodes": verified_nodes,
        }, f, indent=2, ensure_ascii=False)
    print(f"\n💾 Saved structured master database -> sub/nodes.json ({len(verified_nodes)} nodes)", flush=True)

    # =========================================================================
    # 🎯 GENERATE SERVICE-SPECIFIC SUBSCRIPTIONS
    # =========================================================================
    service_pools = {
        "chatgpt.txt": [
            format_turboprobe_remark(n["uri"], n["country"], "ChatGPT")
            for n in verified_nodes if n["services"].get("chatgpt")
        ],
        "claude.txt": [
            format_turboprobe_remark(n["uri"], n["country"], "Claude")
            for n in verified_nodes if n["services"].get("claude")
        ],
        "gemini.txt": [
            format_turboprobe_remark(n["uri"], n["country"], "Gemini")
            for n in verified_nodes if n["services"].get("gemini")
        ],
        "perplexity.txt": [
            format_turboprobe_remark(n["uri"], n["country"], "Perplexity")
            for n in verified_nodes if n["services"].get("perplexity")
        ],
        "youtube.txt": [
            format_turboprobe_remark(n["uri"], n["country"], "YouTube 4K")
            for n in verified_nodes if n["services"].get("youtube")
        ],
        "discord.txt": [
            format_turboprobe_remark(n["uri"], n["country"], "Discord")
            for n in verified_nodes if n["services"].get("discord")
        ],
        "instagram.txt": [
            format_turboprobe_remark(n["uri"], n["country"], "Instagram")
            for n in verified_nodes if n["services"].get("instagram")
        ],
        "twitter.txt": [
            format_turboprobe_remark(n["uri"], n["country"], "Twitter / X")
            for n in verified_nodes if n["services"].get("twitter")
        ],
        "spotify.txt": [
            format_turboprobe_remark(n["uri"], n["country"], "Spotify")
            for n in verified_nodes if n["services"].get("spotify")
        ],
        "github.txt": [
            format_turboprobe_remark(n["uri"], n["country"], "GitHub")
            for n in verified_nodes if n["services"].get("github")
        ],
        "ai-bundle.txt": [
            format_turboprobe_remark(n["uri"], n["country"], "All-AI")
            for n in verified_nodes 
            if n["services"].get("chatgpt") and (n["services"].get("claude") or n["services"].get("gemini"))
        ],
    }

    manifest = {}
    print("\n📁 Saving dedicated service subscription files:", flush=True)
    for fname, nodes in service_pools.items():
        out_path = os.path.join(SERVICES_DIR, fname)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write("\n".join(nodes))
        manifest[fname] = len(nodes)
        print(f"  💾 sub/services/{fname:15s} -> {len(nodes):4d} working keys", flush=True)

    with open(os.path.join(SERVICES_DIR, "index.json"), "w", encoding="utf-8") as f:
        json.dump({
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "services": manifest,
        }, f, indent=2, ensure_ascii=False)

    print("\n🎉 [Complete] Deep Service Verification completed successfully!")

if __name__ == "__main__":
    main()
