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

# Size of each paginated "sub/chunks/chunk-XXX.txt" file (ordered by ascending ping)
CHUNK_SIZE = 20

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

def check_node_ping(uri: str, timeout: float = 0.45) -> tuple:
    """Ultra-speed socket health and RTT latency benchmark. Returns (uri, ping_ms) or (uri, 9999.0)."""
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
            
        start_t = time.perf_counter()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        res = sock.connect_ex((host, port))
        sock.close()
        
        if res == 0:
            elapsed_ms = (time.perf_counter() - start_t) * 1000.0
            return (uri, round(elapsed_ms, 1))
        return (uri, 9999.0)
    except Exception:
        return (uri, 9999.0)

def sanitize_node_remark(uri: str, ping_ms: float) -> str:
    """Cleans spam from remarks and formats country badge + protocol + measured latency."""
    base_uri = uri.split('#')[0]
    low = uri.lower()
    
    # Country detection
    country = "🌐 Fast"
    if "kz" in low or "kazakhstan" in low or ".kz" in low: country = "🇰🇿 KZ"
    elif "de" in low or "germany" in low or "fra" in low: country = "🇩🇪 DE"
    elif "nl" in low or "netherlands" in low or "ams" in low: country = "🇳🇱 NL"
    elif "fi" in low or "finland" in low or "hel" in low: country = "🇫🇮 FI"
    elif "tr" in low or "turkey" in low or "ist" in low: country = "🇹🇷 TR"
    elif ".ru" in low or "russia" in low or "mow" in low: country = "🇷🇺 RU"
    elif "us" in low or "usa" in low: country = "🇺🇸 US"
    elif "se" in low or "sweden" in low: country = "🇸🇪 SE"
    
    # Protocol detection
    ptype = "VLESS"
    if "trojan://" in low: ptype = "Trojan"
    elif "hy2://" in low or "hysteria2://" in low: ptype = "Hy2"
    elif "ss://" in low: ptype = "SS"
    elif "security=reality" in low or "pbk=" in low: ptype = "Reality"
    
    remark = f"⚡ {country} {ptype} · {int(ping_ms)}ms"
    return f"{base_uri}#{urllib.parse.quote(remark)}"

def generate_clash_meta_yaml(nodes: list) -> str:
    sb = ["port: 7890", "socks-port: 7891", "allow-lan: false", "mode: rule", "log-level: info", "proxies:"]
    proxy_names = []
    
    for idx, uri in enumerate(nodes[:500], start=1):
        try:
            parsed = urllib.parse.urlparse(uri)
            name = f"Node-{idx}"
            if '#' in uri:
                raw_name = urllib.parse.unquote(uri.split('#')[-1]).strip()
                if raw_name:
                    name = f"[{idx:03d}] {raw_name[:28]}"
                    
            name = re.sub(r'[:"\'\[\]]', '', name).strip()
            if not name:
                name = f"TurboProbe-{idx}"
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
    extra_sources = load_discovered_sources()
    # Static seed list + anything the discovery bot has confirmed on past runs
    all_sources = list(dict.fromkeys(SOURCES + extra_sources))

    print(f"🚀 [TurboProbe Ultra-Speed Engine v5.0] Crawling from {len(all_sources)} verified sources "
          f"({len(SOURCES)} seed + {len(extra_sources)} auto-discovered)...")
    os.makedirs(SUB_DIR, exist_ok=True)
    
    fetched_count = 0
    all_uris = []
    direct_ru_fetched = {}

    # 1. Concurrent Fetching (50 workers)
    with ThreadPoolExecutor(max_workers=50) as executor:
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
                        print(f"  [+] Fetched {len(extracted):4d} keys from: {url[:60]}...")
            except Exception:
                pass
                
    print(f"\n📊 Total raw keys collected: {len(all_uris)} across {fetched_count}/{len(SOURCES)} active sources.")
    
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
    print(f"✨ Deduplication complete: {len(unique_uris)} unique nodes.")
    
    # 3. ⚡ High-Speed Multi-Threaded Latency Benchmark & Dead-Node Purge (250 workers)
    print(f"🩺 Starting concurrent latency benchmark across {len(unique_uris)} nodes (timeout: 0.45s, 250 threads)...", flush=True)
    alive_tuples = []  # list of (formatted_uri, ping_ms, raw_key)
    
    with ThreadPoolExecutor(max_workers=250) as checker:
        future_to_node = {checker.submit(check_node_ping, node, 0.45): node for node in unique_uris}
        for future in as_completed(future_to_node):
            try:
                uri, ping_ms = future.result()
                if ping_ms < 900.0:
                    formatted_uri = sanitize_node_remark(uri, ping_ms)
                    alive_tuples.append((formatted_uri, ping_ms, get_node_key(uri)))
            except Exception:
                pass

    # 4. 🥇 STRICT SORT BY LOWEST PING (Ascending: 10ms -> 30ms -> 50ms)
    alive_tuples.sort(key=lambda item: item[1])
    alive_nodes = [item[0] for item in alive_tuples]
    alive_keys_set = {item[2] for item in alive_tuples}
    
    avg_ping = round(sum(item[1] for item in alive_tuples) / max(len(alive_tuples), 1), 1)
    best_ping = alive_tuples[0][1] if alive_tuples else 0.0
    ping_by_uri = {formatted_uri: ping_ms for formatted_uri, ping_ms, rk in alive_tuples}
    
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
            k_key = get_node_key(k)
            if k_key in alive_keys_set:
                for formatted_uri, p, rk in alive_tuples:
                    if rk == k_key:
                        anti_whitelist_pool.append(formatted_uri)
                        break

    for uri, ping_ms, rk in alive_tuples:
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

    # 🌍 Country Classification (All sorted by lowest ping)
    country_pools = {
        "de.txt": [],
        "nl.txt": [],
        "kz.txt": [],
        "fi.txt": [],
        "tr.txt": [],
        "ru.txt": [],
        "us.txt": [],
    }
    for uri, ping_ms, rk in alive_tuples:
        low = uri.lower()
        if "de" in low or "germany" in low or "fra" in low: country_pools["de.txt"].append(uri)
        if "nl" in low or "netherlands" in low or "ams" in low: country_pools["nl.txt"].append(uri)
        if "kz" in low or "kazakhstan" in low or "ala" in low or "ast" in low or ".kz" in low: country_pools["kz.txt"].append(uri)
        if "fi" in low or "finland" in low or "hel" in low: country_pools["fi.txt"].append(uri)
        if "tr" in low or "turkey" in low or "ist" in low: country_pools["tr.txt"].append(uri)
        if ".ru" in low or "russia" in low or "mow" in low: country_pools["ru.txt"].append(uri)
        if "us" in low or "usa" in low: country_pools["us.txt"].append(uri)

    # VIP Curated Pools (Top-20, Top-50, Clean AI IP, YouTube 4K Stream)
    top20_pool = alive_nodes[:20]
    top50_pool = alive_nodes[:50]
    clean_ip_pool = [u for u in reality_nodes if not any(b in u.lower() for b in ["tor", "anon", "free-vpn", "public"])][:1500]
    youtube_discord_pool = (hy2_nodes + reality_nodes[:2000])

    # 6. File Writer
    def write_sub(filename: str, nodes: list):
        path = os.path.join(SUB_DIR, filename)
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(nodes))
        print(f"  💾 sub/{filename:20s} -> {len(nodes):5d} ultra-low ping keys", flush=True)

    # 6b. 📦 Paginate the FULL ascending-ping pool into fixed-size chunk files.
    #     chunk-001.txt holds the 20 lowest-ping keys, chunk-002.txt the next 20
    #     (all with a higher ping than every key in chunk-001), and so on —
    #     the whole pool split into ascending-ping pages instead of one giant file.
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
    write_sub("top20.txt", top20_pool)
    write_sub("top50.txt", top50_pool)
    write_sub("anti-whitelist.txt", anti_wl_sorted)
    write_sub("reality.txt", reality_nodes)
    write_sub("trojan.txt", trojan_nodes)
    write_sub("hysteria2.txt", hy2_nodes)
    write_sub("shadowsocks.txt", ss_nodes)
    write_sub("clean-ip.txt", clean_ip_pool)
    write_sub("youtube-discord.txt", youtube_discord_pool)

    # Country sub files
    for cfile, cnodes in country_pools.items():
        if cnodes:
            write_sub(cfile, cnodes)
    
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
