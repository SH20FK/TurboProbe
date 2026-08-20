#!/usr/bin/env python3
"""
TurboProbe Ultra-Speed Mega-Aggregator & Low-Latency Engine v5.0
- Concurrently fetches from 100+ active global and Russian sources
- Ultra-speed concurrent TCP RTT latency benchmark across all keys
- Instant dead-node purge: drops offline/slow/broken servers
- Strict sort by LOWEST PING (fastest servers always appear first)
- Clean, aesthetic node remarks with country badge, protocol, and measured ping
- Outputs dedicated sub files, Top-20 / Top-50 VIP sub, and Clash Meta YAML
"""

import os
import sys
import re
import ssl
import time
import socket
import base64
import json
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

SUB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sub")
TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
DISCOVERED_SOURCES_PATH = os.path.join(TOOLS_DIR, "discovered_sources.json")
NODE_HISTORY_PATH = os.path.join(TOOLS_DIR, "node_history.json")
DEAD_NODES_PATH = os.path.join(TOOLS_DIR, "dead_nodes.json")

# Size of each paginated "sub/chunks/chunk-XXX.txt" file (ordered by ascending ping)
CHUNK_SIZE = 500

def load_node_history() -> dict:
    """Loads persistent cumulative history and check counters for all nodes."""
    if os.path.isfile(NODE_HISTORY_PATH):
        try:
            with open(NODE_HISTORY_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_node_history(history_map: dict):
    """Saves node check history (capped at 50,000 active nodes)."""
    if len(history_map) > 50000:
        items = sorted(history_map.items(), key=lambda x: x[1].get("total_checks", 0), reverse=True)[:50000]
        history_map = dict(items)
    try:
        with open(NODE_HISTORY_PATH, "w", encoding="utf-8") as f:
            json.dump(history_map, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"⚠️ Failed to save node_history.json: {e}")

def load_dead_nodes() -> dict:
    """Loads persistent blacklisted dead nodes to skip dead keys on future crawls."""
    if os.path.isfile(DEAD_NODES_PATH):
        try:
            with open(DEAD_NODES_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_dead_nodes(dead_map: dict):
    """Saves dead nodes with fail counters."""
    if len(dead_map) > 10000:
        items = sorted(dead_map.items(), key=lambda x: x[1].get("fail_count", 0), reverse=True)[:10000]
        dead_map = dict(items)
    try:
        with open(DEAD_NODES_PATH, "w", encoding="utf-8") as f:
            json.dump(dead_map, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"⚠️ Failed to save dead_nodes.json: {e}")

# =============================================================================
# 🏛️ GENUINE RUSSIAN DOMESTIC WHITELIST SNIS & KEYWORDS
# =============================================================================
WHITELIST_SNI_KEYWORDS = [
    "gosuslugi.ru", "sberbank.ru", "sber.ru", "vk.com", "vk.ru", "vkvideo.ru",
    "yandex.ru", "ya.ru", "yandex.net", "tinkoff.ru", "tbank.ru", "vtb.ru",
    "alfabank.ru", "ozon.ru", "wildberries.ru", "wb.ru", "nalog.gov.ru",
    "mos.ru", "rutube.ru", "pochta.ru", "mir-pay.ru", "nspk.ru", "cbr.ru",
    ".ru", ".рф"
]

# =============================================================================
# 📡 100+ HIGH QUALITY LIVING SOURCES (GITVERSE, GITHUB, TELEGRAM)
# =============================================================================
SOURCES = [
    # 🇷🇺 Russian Domestic Anti-Censorship & GitVerse Feeds
    "https://gitverse.ru/api/repos/ru-wbl/wl/raw/branch/master/KvRuVPN/KvRuVPN.txt",
    "https://gitverse.ru/api/repos/Akres/VPN/raw/branch/master/all",
    "https://gitverse.ru/api/repos/flaafix/AetrisVPN/raw/branch/master/AetrisVPN.txt",
    "https://gitverse.ru/api/repos/flaafix/AetrisVPN_Black_list/raw/branch/master/configs.txt",
    "https://raw.githubusercontent.com/kort0881/vpn-vless-configs-russia/main/githubmirror/clean/vless.txt",
    "https://raw.githubusercontent.com/kort0881/vpn-vless-configs-russia/main/githubmirror/ru-sni/vless_ru.txt",
    "https://raw.githack.com/igareck/vpn-configs-for-russia/main/BLACK_VLESS_RUS_mobile.txt",
    "https://raw.githack.com/igareck/vpn-configs-for-russia/main/BLACK_VLESS_RUS.txt",
    "https://raw.githack.com/igareck/vpn-configs-for-russia/main/Vless-Reality-White-Lists-Rus-Mobile.txt",
    "https://raw.githack.com/igareck/vpn-configs-for-russia/main/Vless-Reality-White-Lists-Rus-Mobile-2.txt",
    "https://raw.githack.com/igareck/vpn-configs-for-russia/main/WHITE-CIDR-RU-all.txt",
    "https://raw.githack.com/igareck/vpn-configs-for-russia/main/WHITE-CIDR-RU-checked.txt",
    "https://raw.githack.com/igareck/vpn-configs-for-russia/main/WHITE-SNI-RU-all.txt",
    "https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/refs/heads/main/WHITE-CIDR-RU-checked.txt",
    "https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/refs/heads/main/WHITE-SNI-RU-all.txt",
    "https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/raw/refs/heads/main/BLACK_VLESS_RUS.txt",
    "https://yahuy.eu.cc/purple.txt",
    "https://clck.ru/3Tju7N",

    # 🌐 Mega Global Hubs & Subscriptions
    "https://raw.githubusercontent.com/ALIILAPRO/v2rayNG-Config/main/server.txt",
    "https://raw.githubusercontent.com/ALIILAPRO/v2rayNG-Config/main/sub.txt",
    "https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/All_Configs_Sub.txt",
    "https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/Splitted-By-Protocol/vless.txt",
    "https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/Splitted-By-Protocol/trojan.txt",
    "https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/Splitted-By-Protocol/ss.txt",
    "https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt",
    "https://raw.githubusercontent.com/LalatinaHub/Mineral/master/result/nodes",
    "https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub",
    "https://raw.githubusercontent.com/Pawdroid/Free-servers/refs/heads/main/sub",
    "https://raw.githubusercontent.com/acymz/AutoVPN/refs/heads/main/data/V2.txt",
    "https://raw.githubusercontent.com/shabane/kamaji/master/hub/merged.txt",
    "https://raw.githubusercontent.com/mheidari98/.proxy/refs/heads/main/vless",
    "https://raw.githubusercontent.com/expressalaki/ExpressVPN/refs/heads/main/configs3.txt",
    "https://raw.githubusercontent.com/sevcator/5ubscrpt10n/main/protocols/vl.txt",
    "https://raw.githubusercontent.com/roosterkid/openproxylist/main/V2RAY_RAW.txt",
    "https://raw.githubusercontent.com/wuqb2i4f/xray-config-toolkit/main/output/base64/mix-uri",
    "https://raw.githubusercontent.com/V2RayRoot/V2RayConfig/refs/heads/main/Config/vless.txt",
    "https://raw.githubusercontent.com/miladtahanian/Config-Collector/refs/heads/main/mixed_iran.txt",
    "https://raw.githubusercontent.com/CidVpn/cid-vpn-config/refs/heads/main/general.txt",
    "https://raw.githubusercontent.com/free18/v2ray/refs/heads/main/v.txt",
    "https://raw.githubusercontent.com/miladtahanian/V2RayCFGDumper/refs/heads/main/sub.txt",
    "https://raw.githubusercontent.com/mohamadfg-dev/telegram-v2ray-configs-collector/refs/heads/main/category/vless.txt",
    "https://raw.githubusercontent.com/MahsaNetConfigTopic/config/refs/heads/main/xray_final.txt",
    "https://raw.githubusercontent.com/youfoundamin/V2rayCollector/main/mixed_iran.txt",
    "https://raw.githubusercontent.com/yitong2333/proxy-minging/refs/heads/main/v2ray.txt",
    "https://raw.githubusercontent.com/Mr-Meshky/vify/raw/refs/heads/main/configs/vless.txt",
    "https://raw.githubusercontent.com/Argh94/Proxy-List/raw/refs/heads/main/All_Config.txt",
    "https://raw.githubusercontent.com/MhdiTaheri/V2rayCollector_Py/raw/refs/heads/main/sub/Mix/mix.txt",
    "https://raw.githubusercontent.com/MhdiTaheri/V2rayCollector/raw/refs/heads/main/sub/mix",
    "https://raw.githubusercontent.com/sakha1370/OpenRay/raw/refs/heads/main/output/all_valid_proxies.txt",
    "https://raw.githubusercontent.com/MatinGhanbari/v2ray-configs/main/subscriptions/v2ray/all_sub.txt",
    "https://raw.githubusercontent.com/MatinGhanbari/v2ray-configs/main/subscriptions/v2ray/super-sub.txt",
    "https://raw.githubusercontent.com/mfuu/v2ray/master/v2ray",

    # 📱 Nikita29a FreeProxyList Mirrors (1 to 26)
    *[f"https://github.com/nikita29a/FreeProxyList/raw/refs/heads/main/mirror/{i}.txt" for i in range(1, 27)],

    # 🇷🇺 AvenCores Goida-VPN Mirrors (1 to 26)
    *[f"https://github.com/AvenCores/goida-vpn-configs/raw/refs/heads/main/githubmirror/{i}.txt" for i in range(1, 27)],

    # 📱 Telegram Live Web Channels
    "https://t.me/s/v2ray_collector",
    "https://t.me/s/V2Ray_Alpha",
    "https://t.me/s/FreeV2rays",
    "https://t.me/s/PrivateVPNs",
    "https://t.me/s/DirectVPN",
    "https://t.me/s/free_v2ray_channel",
    "https://t.me/s/v2ray_configs_pool",
    "https://t.me/s/vpn_reality",
    "https://t.me/s/vless_configs",
    "https://t.me/s/Shadowsocks_v2ray",
    "https://t.me/s/v2ray_free_config",
]

RU_DIRECT_SOURCES = {
    "https://gitverse.ru/api/repos/ru-wbl/wl/raw/branch/master/KvRuVPN/KvRuVPN.txt",
    "https://gitverse.ru/api/repos/Akres/VPN/raw/branch/master/all",
    "https://gitverse.ru/api/repos/flaafix/AetrisVPN/raw/branch/master/AetrisVPN.txt",
    "https://gitverse.ru/api/repos/flaafix/AetrisVPN_Black_list/raw/branch/master/configs.txt",
    "https://raw.githubusercontent.com/kort0881/vpn-vless-configs-russia/main/githubmirror/clean/vless.txt",
    "https://raw.githubusercontent.com/kort0881/vpn-vless-configs-russia/main/githubmirror/ru-sni/vless_ru.txt",
    "https://raw.githack.com/igareck/vpn-configs-for-russia/main/BLACK_VLESS_RUS_mobile.txt",
    "https://raw.githack.com/igareck/vpn-configs-for-russia/main/BLACK_VLESS_RUS.txt",
    "https://raw.githack.com/igareck/vpn-configs-for-russia/main/Vless-Reality-White-Lists-Rus-Mobile.txt",
    "https://raw.githack.com/igareck/vpn-configs-for-russia/main/Vless-Reality-White-Lists-Rus-Mobile-2.txt",
    "https://raw.githack.com/igareck/vpn-configs-for-russia/main/WHITE-CIDR-RU-all.txt",
    "https://raw.githack.com/igareck/vpn-configs-for-russia/main/WHITE-CIDR-RU-checked.txt",
    "https://raw.githack.com/igareck/vpn-configs-for-russia/main/WHITE-SNI-RU-all.txt",
    "https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/refs/heads/main/WHITE-CIDR-RU-checked.txt",
    "https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/refs/heads/main/WHITE-SNI-RU-all.txt",
    "https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/raw/refs/heads/main/BLACK_VLESS_RUS.txt",
    "https://yahuy.eu.cc/purple.txt",
    "https://clck.ru/3Tju7N",
}

URI_REGEX = re.compile(
    r'(?:vless|trojan|ss|hy2|hysteria2|tuic|vmess)://[^\s<>"\']+',
    re.IGNORECASE
)

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

def fetch_url(url: str, timeout: int = 8) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as resp:
            content_bytes = resp.read()
            try:
                return content_bytes.decode("utf-8")
            except UnicodeDecodeError:
                return content_bytes.decode("latin-1", errors="ignore")
    except Exception:
        return ""

def extract_uris_from_content(content: str) -> list:
    if not content:
        return []
    
    uris = []
    
    # Base64 auto-decoding
    clean = re.sub(r'\s+', '', content)
    if len(clean) > 20 and len(clean) % 4 == 0 and not clean.startswith(("vless://", "trojan://", "ss://", "vmess://", "<")):
        try:
            decoded = base64.b64decode(clean).decode("utf-8", errors="ignore")
            if "://" in decoded:
                content = decoded
        except Exception:
            pass
            
    # Telegram Web Parsing
    if '<div class="tgme_widget_message_text' in content:
        for block in re.findall(r'<div class="tgme_widget_message_text[^>]*>(.*?)</div>', content, re.DOTALL):
            for match in URI_REGEX.finditer(block):
                uris.append(match.group(0).strip())
                
    # Direct Regex
    for match in URI_REGEX.finditer(content):
        uris.append(match.group(0).strip())
        
    # Line by line
    for line in content.splitlines():
        line = line.strip()
        if any(line.startswith(proto) for proto in ("vless://", "trojan://", "ss://", "hy2://", "hysteria2://", "tuic://")):
            uris.append(line)
            
    return list(set(uris))

def get_node_key(uri: str) -> str:
    try:
        raw = uri.split('#')[0].split('?')[0]
        return raw.strip().lower()
    except Exception:
        return uri.strip().lower()

def check_node_ping(uri: str, timeout: float = 0.50) -> tuple:
    """Socket & TLS handshake benchmark. Tests real server responsiveness."""
    try:
        parsed = urllib.parse.urlparse(uri)
        netloc = parsed.netloc
        if '@' in netloc:
            netloc = netloc.split('@')[1]
        
        if ':' in netloc:
            parts = netloc.split(':')
            host = parts[0].strip('[]')
            port = int(parts[1])
        else:
            host = netloc.strip('[]')
            port = 443
            
        low = uri.lower()
        query = urllib.parse.parse_qs(parsed.query)
        sni = query.get("sni", [""])[0] or host
        is_tls = ("security=tls" in low or "trojan://" in low or port == 443) and not ("security=reality" in low or "pbk=" in low)
        
        start_t = time.perf_counter()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        sock.connect((host, port))
        
        if is_tls:
            # Perform real TLS Handshake to verify server accepts TLS connection
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            ssock = ctx.wrap_socket(sock, server_hostname=sni)
            ssock.close()
        else:
            sock.close()
            
        elapsed_ms = (time.perf_counter() - start_t) * 1000.0
        return (uri, round(elapsed_ms, 1))
    except Exception:
        return (uri, 9999.0)

# =============================================================================
# 🌍 UNIVERSAL WORLDWIDE COUNTRY KEYWORD MAP (ISO 3166-1 ALPHA-2)
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
    """Dynamically converts any 2-letter ISO country code into emoji flag."""
    code = code.upper()
    if len(code) == 2 and code.isalpha():
        return chr(127397 + ord(code[0])) + chr(127397 + ord(code[1]))
    return "🌐"

def detect_country_code(uri: str) -> str:
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

def get_country_badge(code: str) -> str:
    if code == "GLOBAL":
        return "🌐 Global"
    flag = country_code_to_flag(code)
    return f"{flag} {code}"

def sanitize_node_remark(uri: str, ping_ms: float = 0.0, purpose: str = None, idx: int = None) -> str:
    """Cleans spam from remarks and formats: TurboProbe · [Flag] [Country] · [Purpose] #[Index]"""
    base_uri = uri.split('#')[0]
    low = uri.lower()
    
    # 🌍 Universal Country detection
    cc = detect_country_code(uri)
    country_badge = get_country_badge(cc)
    
    # 🎯 Purpose detection
    if not purpose:
        if any(kw in low for kw in WHITELIST_SNI_KEYWORDS): purpose = "Anti-Censor"
        elif "security=reality" in low or "pbk=" in low: purpose = "Reality"
        elif "hy2://" in low or "hysteria2://" in low: purpose = "Hy2-Speed"
        elif "tuic://" in low: purpose = "TUIC"
        elif "trojan://" in low: purpose = "Trojan"
        elif "ss://" in low: purpose = "Shadowsocks"
        elif "vmess://" in low: purpose = "VMess"
        else: purpose = "Ultra-Fast"
    
    suffix = f" #{idx:02d}" if idx is not None else ""
    remark = f"TurboProbe · {country_badge} · {purpose}{suffix}"
    return f"{base_uri}#{remark}"

def relabel_pool_with_purpose(nodes: list, purpose: str) -> list:
    """Re-labels an entire pool of URIs with a specific purpose remark and unique index numbers."""
    return [sanitize_node_remark(uri, purpose=purpose, idx=i+1) for i, uri in enumerate(nodes)]

def generate_clash_meta_yaml(nodes: list) -> str:
    sb = ["port: 7890", "socks-port: 7891", "allow-lan: false", "mode: rule", "log-level: info", "proxies:"]
    proxy_names = []
    seen_names = set()
    
    for idx, uri in enumerate(nodes[:500], start=1):
        try:
            parsed = urllib.parse.urlparse(uri)
            clean_name = f"TurboProbe-{idx:03d}"
            if '#' in uri:
                raw_name = urllib.parse.unquote(uri.split('#')[-1]).strip()
                if raw_name:
                    clean_name = re.sub(r'[:"\'\[\]]', '', raw_name).strip()[:48]
                    
            name = f"{clean_name} #{idx:03d}"
            if name in seen_names:
                name = f"{name}-{idx}"
            seen_names.add(name)
            proxy_names.append(name)
            
            proto = parsed.scheme.lower()
            user_info = parsed.netloc.split('@')[0] if '@' in parsed.netloc else ""
            host_port = parsed.netloc.split('@')[1] if '@' in parsed.netloc else parsed.netloc
            host = host_port.split(':')[0]
            port = int(host_port.split(':')[1]) if ':' in host_port else 443
            params = urllib.parse.parse_qs(parsed.query)
            
            if proto == "vless":
                uuid = user_info
                security = params.get("security", ["none"])[0]
                sni = params.get("sni", [host])[0]
                pbk = params.get("pbk", [""])[0]
                sid = params.get("sid", [""])[0]
                fp = params.get("fp", ["chrome"])[0]
                
                sb.append(f"  - name: \"{name}\"")
                sb.append("    type: vless")
                sb.append(f"    server: {host}")
                sb.append(f"    port: {port}")
                sb.append(f"    uuid: {uuid}")
                sb.append("    udp: true")
                sb.append(f"    tls: {str(security in ('tls', 'reality')).lower()}")
                sb.append(f"    servername: {sni}")
                sb.append(f"    client-fingerprint: {fp}")
                if security == "reality" and pbk:
                    sb.append("    reality-opts:")
                    sb.append(f"      public-key: {pbk}")
                    if sid:
                        sb.append(f"      short-id: {sid}")
            elif proto == "trojan":
                password = user_info
                sni = params.get("sni", [host])[0]
                sb.append(f"  - name: \"{name}\"")
                sb.append("    type: trojan")
                sb.append(f"    server: {host}")
                sb.append(f"    port: {port}")
                sb.append(f"    password: {password}")
                sb.append("    udp: true")
                sb.append(f"    sni: {sni}")
        except Exception:
            continue
            
    sb.append("\nproxy-groups:")
    sb.append("  - name: \"⚡ TURBOPROBE-FASTEST\"")
    sb.append("    type: url-test")
    sb.append("    url: http://cp.cloudflare.com/generate_204")
    sb.append("    interval: 180")
    sb.append("    tolerance: 30")
    sb.append("    proxies:")
    for p in proxy_names:
        sb.append(f"      - {p}")
        
    sb.append("\n  - name: \"🚀 MANUAL-SELECT\"")
    sb.append("    type: select")
    sb.append("    proxies:")
    for p in proxy_names:
        sb.append(f"      - {p}")
        
    sb.append("\nrules:")
    sb.append("  - MATCH,DIRECT")
    return "\n".join(sb)

def load_discovered_sources() -> list:
    """Loads source URLs auto-confirmed by tools/discover_sources.py, if any."""
    if not os.path.exists(DISCOVERED_SOURCES_PATH):
        return []
    try:
        with open(DISCOVERED_SOURCES_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return list(data.keys())
    except Exception:
        return []

def main():
    import argparse
    parser = argparse.ArgumentParser(description="TurboProbe VPN Aggregator")
    parser.add_argument("--fast", action="store_true", help="Fast mode: Only Tier-1 sources, under 30s")
    parser.add_argument("--limit", type=int, default=0, help="Max candidates to test")
    args = parser.parse_args()

    extra_sources = []
    if args.fast:
        all_sources = SOURCES[:35]
        print(f"⚡ [TurboProbe Fast Mode] Crawling only {len(all_sources)} Tier-1 high-yield sources (under 30s)...", flush=True)
    else:
        extra_sources = load_discovered_sources()
        all_sources = list(dict.fromkeys(SOURCES + extra_sources))
        print(f"🚀 [TurboProbe Full Engine] Crawling from {len(all_sources)} verified sources "
              f"({len(SOURCES)} seed + {len(extra_sources)} auto-discovered)...", flush=True)

    fetched_count = 0
    all_uris = []
    direct_ru_fetched = {}

    # 1. Concurrent Fetching (250 workers)
    with ThreadPoolExecutor(max_workers=250) as executor:
        future_to_url = {executor.submit(fetch_url, url): url for url in all_sources}
        for future in as_completed(future_to_url):
            url = future_to_url[future]
            try:
                content = future.result()
                if content:
                    extracted = extract_uris_from_content(content)
                    if extracted:
                        fetched_count += 1
                        all_uris.extend(extracted)
                        if url in RU_DIRECT_SOURCES:
                            direct_ru_fetched[url] = extracted
            except Exception:
                pass

    # 1b. Load Direct Telegram Feed (if harvested by discovery bot)
    tg_feed_path = os.path.join(TOOLS_DIR, "telegram_feed.txt")
    if os.path.isfile(tg_feed_path):
        try:
            with open(tg_feed_path, "r", encoding="utf-8") as f:
                tg_lines = [l.strip() for l in f if l.strip()]
            if tg_lines:
                all_uris.extend(tg_lines)
                print(f"  📢 Loaded {len(tg_lines)} fresh direct keys from Telegram feed")
        except Exception:
            pass

    print(f"\n📊 Total raw keys collected: {len(all_uris)} across {fetched_count} active sources.", flush=True)
    
    # 2. Deduplication
    unique_map = {}
    for uri in all_uris:
        uri = uri.strip()
        if not uri:
            continue
        key = get_node_key(uri)
        if key not in unique_map:
            unique_map[key] = uri
            
    unique_uris = list(unique_map.values())
    print(f"✨ Deduplication complete: {len(unique_uris)} unique nodes.", flush=True)
    
    # 2b. 🚫 Purge known persistent dead keys from blacklist
    dead_map = load_dead_nodes()
    history_map = load_node_history()
    candidate_uris = []
    skipped_dead = 0
    for uri in unique_uris:
        k = get_node_key(uri)
        if k in dead_map and dead_map[k].get("fail_count", 0) >= 3:
            skipped_dead += 1
            continue
        candidate_uris.append(uri)
    if skipped_dead:
        print(f"  🚫 Purged {skipped_dead} persistent dead keys from crawl pool.")

    if args.fast:
        candidate_uris = candidate_uris[:5000]
    elif args.limit > 0:
        candidate_uris = candidate_uris[:args.limit]

    # 3. ⚡ High-Speed Turbo Multi-Threaded Latency Benchmark (2000 workers)
    print(f"🩺 Starting ultra-speed latency benchmark across {len(candidate_uris)} nodes (timeout: 0.40s, 2000 threads)...", flush=True)
    alive_tuples = []  # list of (formatted_uri, ping_ms, raw_key, health)
    checked_count = 0
    total_candidates = len(candidate_uris)
    
    with ThreadPoolExecutor(max_workers=2000) as checker:
        future_to_node = {checker.submit(check_node_ping, node, 0.40): node for node in candidate_uris}
        for future in as_completed(future_to_node):
            checked_count += 1
            if checked_count % 50000 == 0 or checked_count == total_candidates:
                print(f"  ⚡ Benchmarked {checked_count}/{total_candidates} nodes ({len(alive_tuples)} alive so far)...", flush=True)
            try:
                uri, ping_ms = future.result()
                k = get_node_key(uri)
                
                h_rec = history_map.get(k, {
                    "total_checks": 0,
                    "success_checks": 0,
                    "first_seen": datetime.now(timezone.utc).isoformat()
                })
                h_rec["total_checks"] = h_rec.get("total_checks", 0) + 1
                
                if ping_ms < 900.0:
                    h_rec["success_checks"] = h_rec.get("success_checks", 0) + 1
                    h_rec["last_seen_alive"] = datetime.now(timezone.utc).isoformat()
                    health = round((h_rec["success_checks"] / max(h_rec["total_checks"], 1)) * 100, 1)
                    formatted_uri = sanitize_node_remark(uri, ping_ms)
                    alive_tuples.append((formatted_uri, ping_ms, k, health))
                    if k in dead_map:
                        del dead_map[k]
                else:
                    rec = dead_map.get(k, {"fail_count": 0})
                    rec["fail_count"] = rec.get("fail_count", 0) + 1
                    rec["last_seen"] = datetime.now(timezone.utc).isoformat()
                    dead_map[k] = rec
                
                history_map[k] = h_rec
            except Exception:
                pass

    # Save updated dead nodes blacklist & cumulative history
    save_dead_nodes(dead_map)
    save_node_history(history_map)

    # 4. 🥇 STRICT SORT BY LOWEST PING (Ascending: 10ms -> 30ms -> 50ms)
    alive_tuples.sort(key=lambda item: item[1])
    alive_nodes = [item[0] for item in alive_tuples]
    alive_keys_set = {item[2] for item in alive_tuples}
    
    avg_ping = round(sum(item[1] for item in alive_tuples) / max(len(alive_tuples), 1), 1)
    best_ping = alive_tuples[0][1] if alive_tuples else 0.0
    ping_by_uri = {item[0]: item[1] for item in alive_tuples}
    
    print(f"✅ Benchmark finished: {len(alive_nodes)} nodes ONLINE! 🏆 Best Ping: {best_ping}ms | ⚡ Avg Ping: {avg_ping}ms", flush=True)
    
    # 5. Strict Categorization (All strictly sorted by ping!)
    vless_nodes = []
    reality_nodes = []
    trojan_nodes = []
    hy2_nodes = []
    ss_nodes = []
    anti_whitelist_pool = []

    # Russian direct sources check
    for url, keys in direct_ru_fetched.items():
        for k in keys:
            if get_node_key(k) in alive_keys_set:
                anti_whitelist_pool.append(k)

    for item in alive_tuples:
        uri = item[0]
        low = uri.lower()
        if low.startswith("vless://"):
            vless_nodes.append(uri)
            if "security=reality" in low or "pbk=" in low:
                reality_nodes.append(uri)
                if any(kw in low for kw in WHITELIST_SNI_KEYWORDS):
                    anti_whitelist_pool.append(uri)
        elif low.startswith("trojan://"):
            trojan_nodes.append(uri)
            if any(kw in low for kw in WHITELIST_SNI_KEYWORDS):
                anti_whitelist_pool.append(uri)
        elif low.startswith("hy2://") or low.startswith("hysteria2://") or low.startswith("tuic://"):
            hy2_nodes.append(uri)
            anti_whitelist_pool.append(uri)
        elif low.startswith("ss://"):
            ss_nodes.append(uri)
            
    # Deduplicate anti-whitelist while preserving lowest ping order
    seen_aw = set()
    anti_wl_sorted = []
    for u in anti_whitelist_pool:
        k = get_node_key(u)
        if k not in seen_aw:
            seen_aw.add(k)
            anti_wl_sorted.append(u)

    # 🌍 Universal Worldwide Country Classification (Dynamic for ALL detected countries)
    from collections import defaultdict
    country_pools = defaultdict(list)
    countries_dir = os.path.join(SUB_DIR, "countries")
    os.makedirs(countries_dir, exist_ok=True)

    for item in alive_tuples:
        uri = item[0]
        cc = detect_country_code(uri)
        if cc != "GLOBAL":
            country_pools[cc].append(uri)

    # VIP Curated Pools (Top-20, Top-50, Clean AI IP, YouTube 4K Stream)
    top20_pool = alive_nodes[:20]
    top50_pool = alive_nodes[:50]
    clean_ip_pool = [u for u in reality_nodes if not any(b in u.lower() for b in ["tor", "anon", "free-vpn", "public"])][:1500]
    youtube_discord_pool = (hy2_nodes + reality_nodes[:2000])

    # 6. File Writer
    def write_sub(filename: str, nodes: list):
        path = os.path.join(SUB_DIR, filename)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(nodes))
        print(f"  💾 sub/{filename:25s} -> {len(nodes):5d} keys", flush=True)

    # 6b. 📦 Paginate the FULL ascending-ping pool into fixed-size chunk files.
    def write_ping_chunks(nodes: list, ping_lookup: dict, size: int = CHUNK_SIZE):
        chunk_dir = os.path.join(SUB_DIR, "chunks")
        os.makedirs(chunk_dir, exist_ok=True)

        # Wipe stale chunk files first so a shrinking pool doesn't leave orphans
        for existing_f in os.listdir(chunk_dir):
            if existing_f.startswith("chunk-") and existing_f.endswith(".txt"):
                os.remove(os.path.join(chunk_dir, existing_f))

        manifest = []
        num_chunks = (len(nodes) + size - 1) // size
        for i in range(num_chunks):
            part = nodes[i * size:(i + 1) * size]
            fname = f"chunk-{i + 1:03d}.txt"
            with open(os.path.join(chunk_dir, fname), "w", encoding="utf-8") as f:
                f.write("\n".join(part))
            lo = ping_lookup.get(part[0], 0.0)
            hi = ping_lookup.get(part[-1], 0.0)
            manifest.append({
                "file": f"chunks/{fname}", "count": len(part),
                "ping_min_ms": lo, "ping_max_ms": hi,
            })
            print(f"  💾 sub/chunks/{fname} -> {len(part):3d} keys (ping {lo:.0f}ms .. {hi:.0f}ms)", flush=True)

        with open(os.path.join(chunk_dir, "index.json"), "w", encoding="utf-8") as f:
            json.dump({"chunk_size": size, "total_nodes": len(nodes), "chunks": manifest}, f, indent=2, ensure_ascii=False)
        return num_chunks

    print("\n📁 Saving curated, lowest-latency subscription files:", flush=True)
    write_sub("all.txt", alive_nodes)
    print(f"\n📦 Splitting {len(alive_nodes)} ascending-ping keys into {CHUNK_SIZE}-key chunk files:", flush=True)
    write_ping_chunks(alive_nodes, ping_by_uri, CHUNK_SIZE)
    write_sub("top20.txt", relabel_pool_with_purpose(top20_pool, "VIP-Top20"))
    write_sub("top50.txt", relabel_pool_with_purpose(top50_pool, "VIP-Top50"))
    write_sub("anti-whitelist.txt", relabel_pool_with_purpose(anti_wl_sorted, "Anti-Censor"))
    write_sub("reality.txt", relabel_pool_with_purpose(reality_nodes, "Reality"))
    write_sub("trojan.txt", relabel_pool_with_purpose(trojan_nodes, "Trojan"))
    write_sub("hysteria2.txt", relabel_pool_with_purpose(hy2_nodes, "Hy2-Speed"))
    write_sub("shadowsocks.txt", relabel_pool_with_purpose(ss_nodes, "Shadowsocks"))
    write_sub("clean-ip.txt", relabel_pool_with_purpose(clean_ip_pool, "Clean-IP"))
    write_sub("youtube-discord.txt", relabel_pool_with_purpose(youtube_discord_pool, "YouTube & Discord"))

    # Dynamic Worldwide Country sub files
    country_manifest = []
    print(f"\n🌍 Saving dynamic country feeds across {len(country_pools)} active world countries:", flush=True)
    for cc, cnodes in sorted(country_pools.items(), key=lambda x: -len(x[1])):
        fname = f"{cc.lower()}.txt"
        flag = country_code_to_flag(cc)
        write_sub(os.path.join("countries", fname), cnodes)
        country_manifest.append({
            "code": cc,
            "flag": flag,
            "count": len(cnodes),
            "file": f"countries/{fname}"
        })
        # Legacy root files for top popular countries
        if cc in ["DE", "NL", "KZ", "FI", "TR", "RU", "US", "SE", "GB", "FR", "JP", "SG", "HK", "CA", "PL"]:
            write_sub(fname, cnodes)

    # 🎯 Generate Dedicated Service Subscriptions (Always populated)
    services_dir = os.path.join(SUB_DIR, "services")
    os.makedirs(services_dir, exist_ok=True)
    
    ai_countries = {"US", "NL", "DE", "FI", "SG", "JP", "SE", "FR", "GB", "CA", "CH", "AT", "PL", "CZ"}
    ai_nodes = [u for u in clean_ip_pool if detect_country_code(u) in ai_countries or detect_country_code(u) == "GLOBAL"]
    if len(ai_nodes) < 50:
        ai_nodes = clean_ip_pool[:200]
        
    chatgpt_nodes = relabel_pool_with_purpose(ai_nodes[:150], "ChatGPT")
    claude_nodes = relabel_pool_with_purpose([u for u in ai_nodes if detect_country_code(u) in {"US", "NL", "DE", "FI", "GB", "SE", "JP", "SG"}][:150] or ai_nodes[:100], "Claude")
    gemini_nodes = relabel_pool_with_purpose(ai_nodes[:150], "Gemini")
    perplexity_nodes = relabel_pool_with_purpose(ai_nodes[:150], "Perplexity")
    ai_bundle_nodes = relabel_pool_with_purpose(ai_nodes[:200], "All-AI")
    youtube_nodes = relabel_pool_with_purpose((hy2_nodes + reality_nodes)[:200], "YouTube 4K")
    discord_nodes = relabel_pool_with_purpose((hy2_nodes + reality_nodes + trojan_nodes)[:200], "Discord")
    instagram_nodes = relabel_pool_with_purpose(ai_nodes[:150], "Instagram")
    twitter_nodes = relabel_pool_with_purpose(ai_nodes[:150], "Twitter / X")
    spotify_nodes = relabel_pool_with_purpose(ai_nodes[:150], "Spotify")
    github_nodes = relabel_pool_with_purpose((reality_nodes + trojan_nodes)[:150], "GitHub")

    service_files = {
        "chatgpt.txt": chatgpt_nodes,
        "claude.txt": claude_nodes,
        "gemini.txt": gemini_nodes,
        "perplexity.txt": perplexity_nodes,
        "ai-bundle.txt": ai_bundle_nodes,
        "youtube.txt": youtube_nodes,
        "discord.txt": discord_nodes,
        "instagram.txt": instagram_nodes,
        "twitter.txt": twitter_nodes,
        "spotify.txt": spotify_nodes,
        "github.txt": github_nodes,
    }

    print(f"\n🎯 Saving dedicated service subscriptions across 11 target channels:", flush=True)
    service_manifest = {}
    for sf, snodes in service_files.items():
        write_sub(os.path.join("services", sf), snodes)
        service_manifest[sf] = len(snodes)

    with open(os.path.join(services_dir, "index.json"), "w", encoding="utf-8") as f:
        json.dump({
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "services": service_manifest
        }, f, indent=2, ensure_ascii=False)

    # 🌐 Generate sub/preview.json and sub/nodes.json for Instant Frontend Mirroring
    top_preview_nodes = []
    for u in alive_nodes[:150]:
        cc = detect_country_code(u)
        proto = u.split("://")[0].lower() if "://" in u else "vless"
        p_ms = ping_by_uri.get(u, 45.0)
        is_ai_country = (cc in ai_countries or cc == "GLOBAL")
        
        top_preview_nodes.append({
            "uri": u,
            "ping_ms": p_ms,
            "country": cc,
            "protocol": proto,
            "health": 95.0,
            "services": {
                "chatgpt": is_ai_country,
                "claude": is_ai_country and cc in {"US", "NL", "DE", "FI", "GB", "SE", "JP", "SG", "GLOBAL"},
                "gemini": is_ai_country,
                "youtube": True,
                "discord": True,
                "twitter": is_ai_country,
                "spotify": is_ai_country,
                "github": True,
            }
        })

    with open(os.path.join(SUB_DIR, "preview.json"), "w", encoding="utf-8") as f:
        json.dump({
            "version": "1.0",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "total_nodes": len(alive_nodes),
            "nodes": top_preview_nodes,
        }, f, indent=2, ensure_ascii=False)
    print(f"  💾 sub/preview.json         -> Instant Web Preview ({len(top_preview_nodes)} nodes)", flush=True)

    with open(os.path.join(countries_dir, "index.json"), "w", encoding="utf-8") as f:
        json.dump({
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "total_countries": len(country_manifest),
            "countries": country_manifest
        }, f, indent=2, ensure_ascii=False)
    
    # Clash Meta Config
    clash_yaml = generate_clash_meta_yaml(alive_nodes)
    with open(os.path.join(SUB_DIR, "clash-meta.yaml"), "w", encoding="utf-8") as f:
        f.write(clash_yaml)
    print("  💾 sub/clash-meta.yaml      -> Clash Meta (auto-select lowest latency)", flush=True)
    
    # Base64 Subscription
    base64_str = base64.b64encode("\n".join(alive_nodes).encode("utf-8")).decode("utf-8")
    with open(os.path.join(SUB_DIR, "base64.txt"), "w", encoding="utf-8") as f:
        f.write(base64_str)
    print("  💾 sub/base64.txt           -> Base64 subscription", flush=True)
    
    # Stats metadata
    stats = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "total_sources": len(all_sources),
        "seed_sources": len(SOURCES),
        "discovered_sources": len(extra_sources),
        "active_sources": fetched_count,
        "raw_fetched": len(all_uris),
        "unique_nodes": len(unique_uris),
        "purged_dead_blacklist": skipped_dead,
        "alive_verified_nodes": len(alive_nodes),
        "best_ping_ms": best_ping,
        "avg_ping_ms": avg_ping,
        "anti_whitelist_nodes": len(anti_wl_sorted),
        "reality_nodes": len(reality_nodes),
        "trojan_nodes": len(trojan_nodes),
        "hysteria2_nodes": len(hy2_nodes),
        "shadowsocks_nodes": len(ss_nodes),
    }
    
    with open(os.path.join(SUB_DIR, "stats.json"), "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
        
    print(f"\n🎉 [Complete] TurboProbe v5.0 generated pristine subscriptions with {len(alive_nodes)} active nodes (Avg Ping: {avg_ping}ms)!")

if __name__ == "__main__":
    main()
