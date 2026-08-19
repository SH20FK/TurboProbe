#!/usr/bin/env python3
"""
TurboProbe VPN Auto-Aggregator
Asynchronously collects, decodes, dedupes, and categorizes 10,000+ free VPN keys
from 80+ GitHub repos, Telegram channels, and Anti-Whitelist sources.
"""

import os
import re
import sys
import json
import base64
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Output directory
SUB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sub")

# =============================================================================
# 80+ HUGE CURATED LIST OF REPOSITORIES, CHANNELS, AND SUBSCRIPTIONS
# =============================================================================

GITHUB_SOURCES = [
    # Top tier auto-collectors (5000+ keys)
    "https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub1.txt",
    "https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub2.txt",
    "https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub3.txt",
    "https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub4.txt",
    "https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub5.txt",
    "https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub6.txt",
    "https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub7.txt",
    "https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub8.txt",
    "https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Splitted-By-Protocol/vless.txt",
    "https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Splitted-By-Protocol/trojan.txt",
    "https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Splitted-By-Protocol/ss.txt",
    "https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Splitted-By-Protocol/hysteria2.txt",
    "https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Splitted-By-Protocol/tuic.txt",

    # yebekhe TVC Collectors
    "https://raw.githubusercontent.com/yebekhe/TVC/main/subscriptions/xray/normal/mix",
    "https://raw.githubusercontent.com/yebekhe/TVC/main/subscriptions/xray/base64/mix",
    "https://raw.githubusercontent.com/yebekhe/TVC/main/subscriptions/xray/normal/vless",
    "https://raw.githubusercontent.com/yebekhe/TVC/main/subscriptions/xray/normal/trojan",
    "https://raw.githubusercontent.com/yebekhe/TVC/main/subscriptions/xray/normal/shadowsocks",
    "https://raw.githubusercontent.com/yebekhe/TVC/main/subscriptions/xray/normal/hysteria2",

    # Soroushmirzaei Collectors (Telegram aggregation 200+ channels)
    "https://raw.githubusercontent.com/soroushmirzaei/telegram-configs-collector/main/protocols/vless",
    "https://raw.githubusercontent.com/soroushmirzaei/telegram-configs-collector/main/protocols/trojan",
    "https://raw.githubusercontent.com/soroushmirzaei/telegram-configs-collector/main/protocols/shadowsocks",
    "https://raw.githubusercontent.com/soroushmirzaei/telegram-configs-collector/main/protocols/hysteria2",
    "https://raw.githubusercontent.com/soroushmirzaei/telegram-configs-collector/main/protocols/tuic",
    "https://raw.githubusercontent.com/soroushmirzaei/telegram-configs-collector/main/protocols/reality",

    # MrPooyaX Protocol Collector
    "https://raw.githubusercontent.com/MrPooyaX/VmessProtocol/main/vless.txt",
    "https://raw.githubusercontent.com/MrPooyaX/VmessProtocol/main/trojan.txt",
    "https://raw.githubusercontent.com/MrPooyaX/VmessProtocol/main/Shadowsocks.txt",
    "https://raw.githubusercontent.com/MrPooyaX/VmessProtocol/main/hysteria2.txt",

    # Epodonios Collectors
    "https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/All_Configs_Sub.txt",
    "https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/Splitted-By-Protocol/vless.txt",
    "https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/Splitted-By-Protocol/trojan.txt",
    "https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/Splitted-By-Protocol/ss.txt",
    "https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/Splitted-By-Protocol/hysteria2.txt",

    # Pawdroid & Surfboard
    "https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub",
    "https://raw.githubusercontent.com/Surfboardv2ray/v2ray-worker-sub/master/sub",
    "https://raw.githubusercontent.com/peasoft/NoMore_VPNGate/master/v2ray.txt",
    "https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt",
    "https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge_base64.txt",
    "https://raw.githubusercontent.com/roosterkid/openproxylist/main/V2RAY_RAW.txt",

    # Node-collector & LalatinaHub
    "https://raw.githubusercontent.com/LonUp/Node-collector/main/sub",
    "https://raw.githubusercontent.com/LalatinaHub/Mineral/master/result/nodes",
    "https://raw.githubusercontent.com/anaer/Sub/main/clash.yaml",
    "https://raw.githubusercontent.com/mfuu/v2ray/master/v2ray",
    "https://raw.githubusercontent.com/free-v2ray-nodes/v2ray-nodes/main/nodes.txt",

    # MoslemD & ALIILAPRO & EhsanGhaffarii
    "https://raw.githubusercontent.com/MoslemD/V2ray-Collector/main/vless",
    "https://raw.githubusercontent.com/MoslemD/V2ray-Collector/main/trojan",
    "https://raw.githubusercontent.com/MoslemD/V2ray-Collector/main/shadowsocks",
    "https://raw.githubusercontent.com/ALIILAPRO/v2rayNG-Config/main/sub.txt",
    "https://raw.githubusercontent.com/EhsanGhaffarii/V2ray-Configs/main/vless.txt",
    "https://raw.githubusercontent.com/EhsanGhaffarii/V2ray-Configs/main/trojan.txt",
    "https://raw.githubusercontent.com/mrian98/FreeV2rayCollector/main/configs/vless.txt",
    "https://raw.githubusercontent.com/mrian98/FreeV2rayCollector/main/configs/trojan.txt",

    # Additional Repos
    "https://raw.githubusercontent.com/Bardiafa/v2ray/main/vless",
    "https://raw.githubusercontent.com/Soli-D/v2ray-collector/main/vless.txt",
    "https://raw.githubusercontent.com/AvenCores/v2ray-worker/main/sub",
    "https://raw.githubusercontent.com/ts-spill/free-v2ray/main/all.txt",
]

# Telegram channels web mirror list (Zero-auth scrapers)
TELEGRAM_CHANNELS = [
    "https://t.me/s/v2rayng_vpn",
    "https://t.me/s/v2ray_outlinefree",
    "https://t.me/s/VLESS_V2RAY_FREE",
    "https://t.me/s/free_v2ray_channel",
    "https://t.me/s/v2ray_configs_pool",
    "https://t.me/s/V2Ray_Alpha",
    "https://t.me/s/Proxy_Free_VPN",
    "https://t.me/s/PrivateVPNs",
    "https://t.me/s/FreeVPN_Nodes",
    "https://t.me/s/DirectVPN",
    "https://t.me/s/v2ray_custom",
    "https://t.me/s/OutlineVpnOfficial",
    "https://t.me/s/vless_reality_ru",
    "https://t.me/s/vpncity",
    "https://t.me/s/v2ray_hub",
]

# Anti-Whitelist & Russian ISP Bypass SNI domains
ANTI_WHITELIST_SNIS = {
    # Domestic & Global Whitelisted CDNs in RU
    "google.com", "dl.google.com", "gstatic.com", "youtube.com", "googlevideo.com",
    "apple.com", "icloud.com", "itunes.apple.com", "cdn-apple.com",
    "microsoft.com", "azure.com", "live.com", "office.com", "windows.com",
    "cloudflare.com", "speedtest.net", "fast.com", "amazon.com", "aws.amazon.com",
    "yandex.ru", "yandex.net", "vk.com", "vk.ru", "gosuslugi.ru", "mail.ru",
    "ozon.ru", "wildberries.ru", "sberbank.ru", "tinkoff.ru", "avito.ru",
    "yahoo.com", "twitch.tv", "github.com", "docker.com",
}

URI_REGEX = re.compile(
    r'(vless://[^\s<>"]+|trojan://[^\s<>"]+|ss://[^\s<>"]+|hy2://[^\s<>"]+|hysteria2://[^\s<>"]+|tuic://[^\s<>"]+|vmess://[^\s<>"]+)',
    re.IGNORECASE
)

def fetch_url(url: str, timeout: int = 8) -> str:
    """Fetch raw string content from URL with realistic User-Agent."""
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TurboProbe/1.0",
                "Accept": "*/*",
            }
        )
        with urllib.request.urlopen(req, timeout=timeout) as response:
            data = response.read()
            try:
                return data.decode("utf-8")
            except UnicodeDecodeError:
                return data.decode("latin1")
    except Exception:
        return ""

def try_base64_decode(text: str) -> str:
    """Safely decode base64 blobs."""
    cleaned = re.sub(r'\s+', '', text).replace('-', '+').replace('_', '/')
    if not cleaned:
        return ""
    # Pad to multiple of 4
    cleaned += '=' * ((4 - len(cleaned) % 4) % 4)
    try:
        decoded = base64.b64decode(cleaned)
        try:
            return decoded.decode('utf-8')
        except UnicodeDecodeError:
            return decoded.decode('latin1')
    except Exception:
        return ""

def extract_uris_from_content(content: str) -> list:
    """Extract all valid VPN URIs from raw text or base64."""
    if not content:
        return []
    
    uris = []
    
    # 1. Direct Regex Match
    for match in URI_REGEX.findall(content):
        cleaned = match.strip().rstrip('.,;:!?"\'')
        if cleaned:
            uris.append(cleaned)
            
    # 2. Try Base64 decoding entire content
    decoded_blob = try_base64_decode(content)
    if decoded_blob:
        for match in URI_REGEX.findall(decoded_blob):
            cleaned = match.strip().rstrip('.,;:!?"\'')
            if cleaned:
                uris.append(cleaned)
                
    # 3. Line by line base64 checks
    lines = content.splitlines()
    for line in lines:
        line = line.strip()
        if not line or line.startswith('#') or line.startswith('//'):
            continue
        if any(line.lower().startswith(p) for p in ['vless://', 'trojan://', 'ss://', 'hy2://', 'hysteria2://', 'tuic://', 'vmess://']):
            uris.append(line)
        elif len(line) > 30 and not ' ' in line and not '<' in line:
            decoded_line = try_base64_decode(line)
            if decoded_line:
                for match in URI_REGEX.findall(decoded_line):
                    uris.append(match.strip().rstrip('.,;:!?"\''))
                    
    return uris

def is_anti_whitelist(uri: str) -> bool:
    """Check if node uses an anti-whitelist SNI / Reality bypass."""
    lower = uri.lower()
    # Check if Reality protocol
    if "security=reality" in lower or "pbk=" in lower or "reality" in lower:
        for sni in ANTI_WHITELIST_SNIS:
            if f"sni={sni}" in lower or f"host={sni}" in lower or f"@{sni}" in lower:
                return True
        return True
    # Check if Hysteria 2 or TUIC with disguise
    if lower.startswith("hy2://") or lower.startswith("hysteria2://") or lower.startswith("tuic://"):
        return True
    # Check if uses CDN domain fronting
    for sni in ANTI_WHITELIST_SNIS:
        if f"sni={sni}" in lower or f"host={sni}" in lower:
            return True
    return False

def get_node_key(uri: str) -> str:
    """Generate unique deduplication key for node."""
    try:
        parsed = urllib.parse.urlparse(uri)
        protocol = parsed.scheme.lower()
        host = parsed.hostname or ""
        port = parsed.port or 443
        username = parsed.username or ""
        sni = ""
        if parsed.query:
            qs = urllib.parse.parse_qs(parsed.query)
            sni = qs.get("sni", [""])[0] or qs.get("host", [""])[0]
        return f"{protocol}://{username}@{host}:{port}?sni={sni}"
    except Exception:
        return uri.split('#')[0]

def main():
    print(f"🚀 [TurboProbe Auto-Aggregator] Starting collection from {len(GITHUB_SOURCES) + len(TELEGRAM_CHANNELS)} sources...")
    os.makedirs(SUB_DIR, exist_ok=True)
    
    all_sources = GITHUB_SOURCES + TELEGRAM_CHANNELS
    fetched_count = 0
    all_uris = []
    
    # Concurrent Fetching
    with ThreadPoolExecutor(max_workers=30) as executor:
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
                        print(f"  [+] Fetched {len(extracted):4d} keys from: {url[:65]}...")
            except Exception as e:
                pass
                
    print(f"\n📊 Total raw URIs fetched: {len(all_uris)} from {fetched_count}/{len(all_sources)} active sources.")
    
    # Deduplication
    unique_map = {}
    for uri in all_uris:
        uri = uri.strip()
        if not uri:
            continue
        key = get_node_key(uri)
        if key not in unique_map:
            unique_map[key] = uri
            
    unique_uris = list(unique_map.values())
    print(f"✨ Deduplication complete: {len(unique_uris)} unique nodes preserved.")
    
    # Categorization
    vless_nodes = []
    reality_nodes = []
    trojan_nodes = []
    hy2_nodes = []
    ss_nodes = []
    anti_whitelist_nodes = []
    
    for uri in unique_uris:
        lower = uri.lower()
        if lower.startswith("vless://"):
            vless_nodes.append(uri)
            if "security=reality" in lower or "pbk=" in lower:
                reality_nodes.append(uri)
        elif lower.startswith("trojan://"):
            trojan_nodes.append(uri)
        elif lower.startswith("hy2://") or lower.startswith("hysteria2://") or lower.startswith("tuic://"):
            hy2_nodes.append(uri)
        elif lower.startswith("ss://"):
            ss_nodes.append(uri)
            
        if is_anti_whitelist(uri):
            anti_whitelist_nodes.append(uri)
            
    # Write to files
    def write_sub(filename: str, nodes: list):
        path = os.path.join(SUB_DIR, filename)
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(nodes))
        print(f"  💾 Saved {len(nodes):5d} keys -> sub/{filename}")
        
    print("\n📁 Generating structured subscription files:")
    write_sub("all.txt", unique_uris)
    write_sub("anti-whitelist.txt", anti_whitelist_nodes)
    write_sub("reality.txt", reality_nodes)
    write_sub("trojan.txt", trojan_nodes)
    write_sub("hysteria2.txt", hy2_nodes)
    write_sub("shadowsocks.txt", ss_nodes)
    
    # Base64 All Sub
    b64_content = base64.b64encode("\n".join(unique_uris).encode("utf-8")).decode("utf-8")
    with open(os.path.join(SUB_DIR, "base64.txt"), "w", encoding="utf-8") as f:
        f.write(b64_content)
    print(f"  💾 Saved Base64 subscription -> sub/base64.txt")
    
    # Write stats json
    stats = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "total_unique": len(unique_uris),
        "reality_count": len(reality_nodes),
        "anti_whitelist_count": len(anti_whitelist_nodes),
        "trojan_count": len(trojan_nodes),
        "hysteria2_count": len(hy2_nodes),
        "shadowsocks_count": len(ss_nodes),
        "sources_count": len(all_sources),
    }
    with open(os.path.join(SUB_DIR, "stats.json"), "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
        
    print(f"\n🎉 [Done] Aggregator finished successfully at {stats['updated_at']}!\n")

if __name__ == "__main__":
    main()
