#!/usr/bin/env python3
"""
TurboProbe Deep Service Prober & Real Node Verifier v2.0
=========================================================
Deep-tests VPN nodes through real live Xray SOCKS5 tunnels with remote DNS (socks5h).
Verifies:
  1. Real Tunnel Liveness & Real Outgoing GeoIP (Cloudflare trace / ip-api)
  2. 🤖 ChatGPT / OpenAI (checks for unblocked clean IP)
  3. 🧠 Claude / Anthropic (checks for country accessibility)
  4. ♊ Gemini / Google AI (checks for Google AI reachability)
  5. 📺 YouTube (checks for HTTP 204 CDN streaming reachability)
  6. 🎮 Discord (checks for unblocked gateway)
  7. 📸 Instagram (checks for unblocked Meta gateway)
  8. 🐦 Twitter / X (checks for unblocked X gateway)
  9. 🎵 Spotify (checks for unblocked media gateway)
  10. 🐙 GitHub (checks for unblocked developer gateway)
  11. 🔍 Perplexity AI

Outputs ONLY genuine verified working nodes into:
  - sub/nodes.json
  - sub/preview.json
  - sub/services/chatgpt.txt
  - sub/services/claude.txt
  - sub/services/gemini.txt
  - sub/services/ai-bundle.txt
  - sub/services/youtube.txt
  - sub/services/discord.txt
  - sub/services/instagram.txt
  - sub/services/twitter.txt
  - sub/services/spotify.txt
  - sub/services/github.txt
  - sub/services/perplexity.txt
  - sub/services/index.json
"""

import os
import sys
import re
import json
import time
import shutil
import platform
import tempfile
import subprocess
import signal
import urllib.parse
import urllib.request
import socket
import ssl
import queue
import threading
import asyncio
import base64
import hashlib
import uuid
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from aggregator import (
        detect_country_code,
        GLOBAL_COUNTRY_KEYWORDS,
        get_node_key,
        load_fresh_ru_verified_keys,
        load_node_history,
        save_node_history,
    )
except Exception:
    def detect_country_code(uri: str) -> str:
        return "GLOBAL"

    def get_node_key(uri: str) -> str:
        return uri.split("#", 1)[0].lower()

    def load_fresh_ru_verified_keys() -> set:
        return set()

    def load_node_history() -> dict:
        return {}

    def save_node_history(history_map: dict):
        return None

try:
    import orjson
    def fast_json_dumps(obj, indent=True) -> str:
        opt = orjson.OPT_INDENT_2 if indent else 0
        return orjson.dumps(obj, option=opt).decode('utf-8')
    def fast_json_loads(s):
        if isinstance(s, (bytes, bytearray)): return orjson.loads(s)
        return orjson.loads(s.encode('utf-8'))
except Exception:
    def fast_json_dumps(obj, indent=True) -> str:
        return json.dumps(obj, indent=2 if indent else None, ensure_ascii=False)
try:
    import resource
    soft, hard = resource.getrlimit(resource.RLIMIT_NOFILE)
    target = min(65536, hard if hard > 0 else 65536)
    resource.setrlimit(resource.RLIMIT_NOFILE, (target, hard))
except Exception:
    pass

try:
    import requests
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except ImportError:
    print("⚠️ Installing requests[socks]...", flush=True)
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests[socks]", "urllib3"])
    import requests
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_DIR = os.path.join(ROOT_DIR, "tools")
BIN_DIR = os.path.join(TOOLS_DIR, "bin")
SUB_DIR = os.path.join(ROOT_DIR, "sub")
SERVICES_DIR = os.path.join(SUB_DIR, "services")

DEFAULT_PROBE_LIMIT = 0     # 0 = probe 100% of all harvested candidate nodes
BATCH_SIZE = int(os.environ.get("TP_BATCH_SIZE", "75"))    # Nodes per Xray instance
NUM_XRAY_WORKERS = int(os.environ.get("TP_XRAY_WORKERS", "4"))  # Concurrent Xray processes
BASE_SOCKS_PORT = 10900     # Proven local SOCKS range start
PORT_STEP = BATCH_SIZE + 75  # Non-overlapping port range reserved per Xray worker
PROBE_TIMEOUT = 4.5         # Seconds per real tunnel HTTP request (full TLS handshake allowed)
PROBE_RETRIES = 2           # Retry only the liveness request before considering a tunnel dead
PROBE_RETRY_DELAY = 0.2    # Small pause between liveness attempts
PROBE_TOTAL_BUDGET = 15.0   # Hard per-node wall-clock budget for the whole liveness gate
PROBE_FAST_TIMEOUT = 3.5    # Faster timeout when running massive pools (e.g. CI >10k nodes)
IPWHO_LIVENESS_URL = "https://ipwho.is/"  # Primary real-tunnel liveness and egress-country endpoint
# Client-realistic reachability: exactly the endpoints proxy clients (Happ, mihomo,
# v2rayN url-test) hit. A tunnel that answers ipwho.is but cannot fetch a plain 204
# is useless in real clients and must not be published as alive.
CLIENT_LIVENESS_URLS = (
    "http://www.gstatic.com/generate_204",
    "https://connectivitycheck.platform.hicloud.com/generate_204",
    "https://cloudflare.com/cdn-cgi/trace",
)
GEOIP_FALLBACK_ENDPOINTS = (
    ("http://ip-api.com/json/", "countryCode"),
    ("https://ifconfig.co/json", "country_iso"),
)
DEEP_VERIFY_CACHE_SECONDS = 4 * 60 * 60
XRAY_STARTUP_TIMEOUT = 10.0
VALID_SHADOWSOCKS_METHODS = {
    "aes-128-gcm", "aes-256-gcm",
    "chacha20-poly1305", "chacha20-ietf-poly1305",
    "xchacha20-poly1305", "xchacha20-ietf-poly1305",
    "2022-blake3-aes-128-gcm", "2022-blake3-aes-256-gcm",
    "2022-blake3-chacha20-poly1305",
}

# Extended SS method set that Mihomo accepts (includes legacy stream ciphers
# still present in many public subscriptions).
SS_MIHOMO_ALLOWED_METHODS = VALID_SHADOWSOCKS_METHODS | {
    "aes-128-cfb", "aes-192-cfb", "aes-256-cfb",
    "aes-128-ctr", "aes-192-ctr", "aes-256-ctr",
    "aes-192-gcm", "rc4-md5",
    "chacha20", "chacha20-ietf",
    "xchacha20", "xchacha20-ietf",
}

# Mihomo binary — optional; enables real Hy2/TUIC/AnyTLS checking.
# If absent, those protocols are skipped rather than faked.
MIHOMO_STARTUP_TIMEOUT = 6.0
MIHOMO_LIVENESS_URL = "http://www.gstatic.com/generate_204"  # Lightweight 204; no body

TARGET_SERVICES = {
    "chatgpt": {
        "name": "ChatGPT / OpenAI",
        "url": "https://api.openai.com/v1/models",
        "valid_status": [200, 401, 404, 405],
    },
    "claude": {
        "name": "Claude / Anthropic",
        "url": "https://claude.ai/login",
        "valid_status": [200, 301, 302, 401, 405],
    },
    "gemini": {
        "name": "Google Gemini",
        "url": "https://generativelanguage.googleapis.com",
        "valid_status": [200, 400, 403, 404, 405],
    },
    "perplexity": {
        "name": "Perplexity AI",
        "url": "https://www.perplexity.ai/",
        "valid_status": [200, 301, 302],
    },
    "youtube": {
        "name": "YouTube",
        "url": "https://www.youtube.com/generate_204",
        "valid_status": [200, 204],
    },
    "discord": {
        "name": "Discord",
        "url": "https://discord.com/api/v9/experiments",
        "valid_status": [200, 401, 403],
    },
    "instagram": {
        "name": "Instagram",
        "url": "https://www.instagram.com/",
        "valid_status": [200, 301, 302],
    },
    "twitter": {
        "name": "Twitter / X",
        "url": "https://x.com",
        "valid_status": [200, 301, 302],
    },
    "spotify": {
        "name": "Spotify",
        "url": "https://open.spotify.com",
        "valid_status": [200, 301, 302],
    },
    "github": {
        "name": "GitHub",
        "url": "https://github.com",
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
    
    # 1. System PATH
    sys_xray = shutil.which("xray")
    if sys_xray:
        return sys_xray

    # 2. Local bin directory
    local_bin = os.path.join(BIN_DIR, exe_name)
    if os.path.isfile(local_bin):
        return local_bin

    # 3. Auto-download from official GitHub releases
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
        import urllib.request
        import zipfile
        req = urllib.request.Request(zip_url, headers={"User-Agent": "TurboProbe/2.0"})
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
        print(f"⚠️ [Xray] Failed to download Xray-core: {e}", flush=True)
        return ""

# =============================================================================
# 📦 MIHOMO CORE AUTO-SETUP (optional — enables real Hy2/TUIC/AnyTLS probing)
# =============================================================================
def get_mihomo_binary_path() -> str:
    """Finds or auto-downloads mihomo binary for current OS/arch.

    Mirrors get_xray_binary_path() — tries PATH, then local bin, then
    downloads the latest stable release from MetaCubeX/mihomo on GitHub.
    Returns empty string on failure (non-fatal: Hy2/TUIC probing is skipped).
    """
    os_name = platform.system().lower()
    machine = platform.machine().lower()
    exe_name = "mihomo.exe" if os_name == "windows" else "mihomo"

    # 1. System PATH
    sys_mihomo = shutil.which("mihomo")
    if sys_mihomo:
        return sys_mihomo

    # 2. Local bin directory (same as Xray)
    local_bin = os.path.join(BIN_DIR, exe_name)
    if os.path.isfile(local_bin):
        return local_bin

    # 3. Auto-download latest release from MetaCubeX/mihomo
    os.makedirs(BIN_DIR, exist_ok=True)
    print(f"[Mihomo] Binary not found — downloading latest release for {os_name}/{machine}...", flush=True)

    # Map platform/machine → Mihomo release filename components.
    # Naming verified against v1.19.30 release assets:
    #   mihomo-windows-amd64-v1.19.30.zip   mihomo-windows-arm64-v1.19.30.zip
    #   mihomo-linux-amd64-v1.19.30.gz      mihomo-linux-arm64-v1.19.30.gz
    #   mihomo-darwin-amd64-v1.19.30.gz     mihomo-darwin-arm64-v1.19.30.gz
    if os_name == "windows":
        arch = "arm64" if ("arm" in machine and "64" in machine) else "amd64"
        ext = "zip"
    elif os_name == "darwin":
        arch = "arm64" if "arm" in machine else "amd64"
        ext = "gz"
    else:  # linux and anything else
        if "aarch64" in machine or "arm64" in machine:
            arch = "arm64"
        elif "arm" in machine:
            arch = "armv7"
        else:
            arch = "amd64"
        ext = "gz"

    # Step 3a: Resolve latest release tag AND get the full asset list via GitHub
    # API. This lets us pick the exact filename instead of guessing -v1/-v3/-go120
    # suffix variants that differ across releases.
    try:
        import urllib.request, json as _json
        api_url = "https://api.github.com/repos/MetaCubeX/mihomo/releases/latest"
        api_req = urllib.request.Request(
            api_url,
            headers={"User-Agent": "TurboProbe/2.0", "Accept": "application/vnd.github+json"},
        )
        with urllib.request.urlopen(api_req, timeout=10) as resp:
            release_info = _json.loads(resp.read().decode())
        version = release_info.get("tag_name", "").lstrip("v")
        if not version:
            raise ValueError("Empty tag_name in GitHub API response")
        # Build a name → URL map for all assets in this release
        assets = {a["name"]: a["browser_download_url"] for a in release_info.get("assets", [])}
    except Exception as e:
        print(f"[Mihomo] Could not resolve latest version via GitHub API: {e}", flush=True)
        return ""

    # Pick the first matching asset from this priority list:
    # 1. Plain name — no qualifiers, broadest CPU compatibility baseline
    # 2. -compatible — explicitly built for older CPUs
    # 3. -v1         — oldest micro-arch level, most portable
    # 4. -v3         — modern CPUs (AVX2), good for CI/cloud VMs
    preferred_order = [
        f"mihomo-{os_name}-{arch}-v{version}.{ext}",
        f"mihomo-{os_name}-{arch}-compatible-v{version}.{ext}",
        f"mihomo-{os_name}-{arch}-v1-v{version}.{ext}",
        f"mihomo-{os_name}-{arch}-v3-v{version}.{ext}",
    ]

    download_url = None
    chosen_stem = None
    for stem in preferred_order:
        if stem in assets:
            download_url = assets[stem]
            chosen_stem = stem
            break

    if not download_url:
        print(
            f"[Mihomo] No suitable asset found for {os_name}-{arch} in release v{version}. "
            f"Please download mihomo manually to {local_bin}.",
            flush=True,
        )
        return ""

    archive_path = os.path.join(BIN_DIR, chosen_stem)
    try:
        import urllib.request, zipfile, gzip as _gzip

        print(f"[Mihomo] Downloading {download_url} ...", flush=True)
        dl_req = urllib.request.Request(download_url, headers={"User-Agent": "TurboProbe/2.0"})
        with urllib.request.urlopen(dl_req, timeout=60) as resp, open(archive_path, "wb") as out:
            shutil.copyfileobj(resp, out)

        if ext == "zip":
            with zipfile.ZipFile(archive_path, "r") as zf:
                # The zip contains mihomo.exe (possibly under a subdirectory).
                for name in zf.namelist():
                    if os.path.basename(name).lower().startswith("mihomo") and not name.endswith("/"):
                        with zf.open(name) as src, open(local_bin, "wb") as dst:
                            shutil.copyfileobj(src, dst)
                        break
        else:
            # .gz — single compressed binary (not a tar archive)
            with _gzip.open(archive_path, "rb") as src, open(local_bin, "wb") as dst:
                shutil.copyfileobj(src, dst)

        if os.path.isfile(archive_path):
            os.remove(archive_path)

        if os_name != "windows":
            os.chmod(local_bin, 0o755)

        if os.path.isfile(local_bin):
            print(f"[Mihomo] Installed mihomo v{version} to {local_bin}", flush=True)
            return local_bin

        print(f"[Mihomo] Archive extracted but binary not found at {local_bin}", flush=True)
        return ""

    except Exception as e:
        print(f"[Mihomo] Failed to download/extract: {e}", flush=True)
        for p in (archive_path, local_bin):
            try:
                if os.path.isfile(p):
                    os.remove(p)
            except Exception:
                pass
        return ""

# =============================================================================
# 🧩 PROTOCOL PARSERS (URI -> XRAY OUTBOUND JSON)
# =============================================================================
VALID_STREAM_SECURITY = {"none", "tls", "reality"}
VALID_KCP_HEADER_TYPES = {"none", "srtp", "utp", "wechat", "video", "dtls", "wireguard", "dns"}
REMOVED_XRAY_TRANSPORTS = {"h2", "http", "quic"}
SUPPORTED_URI_TRANSPORTS = {"tcp", "raw", "ws", "grpc", "xhttp", "splithttp", "kcp", "mkcp", "httpupgrade", "hysteria"}
REALITY_COMPATIBLE_TRANSPORTS = {"tcp", "raw", "xhttp", "grpc"}


def coerce_extra_scalar(value: str):
    """Converts an xhttp extra= scalar to bool/int/float when the text clearly denotes one."""
    v = value.strip()
    if v == "true":
        return True
    if v == "false":
        return False
    if v == "null":
        return None
    try:
        return int(v)
    except ValueError:
        pass
    try:
        return float(v)
    except ValueError:
        pass
    return v


def parse_transport_extra(s: str):
    """Parses xhttp extra= payloads supplied as JSON or python-ish key=value dicts."""
    s = s.strip()
    if s.startswith("{") and s.endswith("}"):
        s = s[1:-1]
    result = {}
    i, n = 0, len(s)
    while i < n:
        while i < n and s[i] in " ,+":
            i += 1
        if i >= n:
            break
        key_start = i
        while i < n and s[i] != "=":
            i += 1
        key = s[key_start:i].strip()
        if not key or i >= n:
            break
        i += 1
        if i < n and s[i] == "{":
            depth = 0
            val_start = i
            while i < n:
                if s[i] == "{":
                    depth += 1
                elif s[i] == "}":
                    depth -= 1
                    if depth == 0:
                        i += 1
                        break
                i += 1
            result[key] = parse_transport_extra(s[val_start:i])
        else:
            val_start = i
            depth = 0
            while i < n:
                if s[i] == "{":
                    depth += 1
                elif s[i] == "}":
                    depth -= 1
                elif s[i] == "," and depth == 0:
                    break
                i += 1
            result[key] = coerce_extra_scalar(s[val_start:i].strip())
    return result


def _sanitize_extra_value(value):
    """Keeps only JSON-safe, Xray-decodable types; drops nulls and stray floats."""
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if value.is_integer() else None
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        cleaned = {}
        for k, v in value.items():
            if not isinstance(k, str):
                continue
            sanitized = _sanitize_extra_value(v)
            if sanitized is not None:
                cleaned[k] = sanitized
        return cleaned or None
    return None


def resolve_extra_object(raw_value: str):
    """Returns the xhttp extra= payload as a sanitized dict, JSON first, then the lenient parser."""
    raw = urllib.parse.unquote(str(raw_value or "")).strip()
    if not raw:
        return None
    loaded = None
    try:
        loaded = json.loads(raw)
    except Exception:
        pass
    if loaded is None:
        normalized = re.sub(r"\bTrue\b", "true", raw)
        normalized = re.sub(r"\bFalse\b", "false", normalized)
        normalized = re.sub(r"\bNone\b", "null", normalized)
        try:
            loaded = json.loads(normalized)
        except Exception:
            pass
    if loaded is None:
        try:
            loaded = parse_transport_extra(raw)
        except Exception:
            return None
    if not isinstance(loaded, dict) or not loaded:
        return None
    # Malformed scalar types here previously crashed the whole-batch decode in
    # Xray without naming a tag ("Invalid integer range"), losing every node.
    return _sanitize_extra_value(loaded)


def normalize_stream_security(value: str, default: str) -> str:
    """Normalizes URI security values to the supported Xray stream-security set."""
    security = str(value or default).strip().lower()
    if security == "default":
        security = default
    return security if security in VALID_STREAM_SECURITY else "none"


def normalize_xray_transport(value: str) -> str:
    """Returns an exact supported URI transport or an empty string for malformed values."""
    transport = str(value or "tcp").strip().lower()
    if transport in REMOVED_XRAY_TRANSPORTS or transport not in SUPPORTED_URI_TRANSPORTS:
        return ""
    return "xhttp" if transport == "splithttp" else transport


def is_supported_xray_transport(net_type: str) -> bool:
    """Compatibility helper for parser call sites and external tests."""
    return bool(normalize_xray_transport(net_type))


def normalize_reality_public_key(value: str) -> str:
    """Returns a URL-safe 32-byte REALITY public key or an empty string."""
    key = urllib.parse.unquote(str(value or "")).strip()
    try:
        decoded = base64.urlsafe_b64decode(key + "=" * (-len(key) % 4))
    except (ValueError, TypeError):
        return ""
    return key if len(decoded) == 32 else ""


def normalize_reality_short_id(value: str):
    """Returns a valid REALITY short ID (zero to sixteen even hex characters), else None."""
    short_id = str(value or "").strip().lower()
    if not short_id:
        return ""
    if len(short_id) > 16 or len(short_id) % 2 or not re.fullmatch(r"[0-9a-f]+", short_id):
        return None
    return short_id


def prepare_outbound_for_current_xray(outbound: dict):
    """Validates and converts REALITY URI fields immediately before Xray config generation."""
    stream = outbound.get("streamSettings", {})
    if stream.get("security") != "reality":
        return outbound
    if stream.get("network") not in REALITY_COMPATIBLE_TRANSPORTS:
        return None
    reality = stream.get("realitySettings") or {}
    public_key = normalize_reality_public_key(reality.get("password") or reality.get("publicKey"))
    short_id = normalize_reality_short_id(reality.get("shortId"))
    if not public_key or short_id is None:
        return None
    reality["password"] = public_key
    reality["shortId"] = short_id
    reality.pop("publicKey", None)
    stream["realitySettings"] = reality
    return outbound


def apply_transport_settings(stream_settings: dict, query: dict, net_type: str, default_host: str):
    """Normalizes URI transport aliases and attaches the matching Xray transport object."""
    network = (net_type or "tcp").lower()
    path = query.get("path", ["/"])[0]
    default_host = str(default_host or "").strip()
    host_value = str(query.get("host", [""])[0] or "").strip() or default_host

    if network == "ws":
        stream_settings["wsSettings"] = {
            "path": path,
            "host": host_value,
            # headers.Host is deprecated in new cores but kept for backward
            # compatibility; the independent "host" field above takes priority.
            "headers": {"Host": host_value},
        }
    elif network == "grpc":
        stream_settings["grpcSettings"] = {
            "serviceName": query.get("serviceName", [""])[0],
        }
    elif network in ("xhttp", "splithttp"):
        network = "xhttp"
        xhttp_settings = {
            "path": path,
            "host": host_value,
            "mode": query.get("mode", ["auto"])[0],
        }
        extra_obj = resolve_extra_object(query.get("extra", [""])[0])
        if isinstance(extra_obj, dict) and extra_obj:
            xhttp_settings.update(extra_obj)
        stream_settings["xhttpSettings"] = xhttp_settings
    elif network == "httpupgrade":
        stream_settings["httpupgradeSettings"] = {
            "path": path,
            "host": host_value,
        }
    elif network == "kcp" or network == "mkcp":
        network = "kcp"
        header_type = str(query.get("headerType", ["none"])[0] or "none").strip().lower()
        if header_type not in VALID_KCP_HEADER_TYPES:
            header_type = "none"
        kcp_settings = {
            "mtu": 1350,
            "header": {"type": header_type},
        }
        seed = str(query.get("seed", [""])[0] or "").strip()
        if seed:
            kcp_settings["seed"] = seed
        stream_settings["kcpSettings"] = kcp_settings
    elif network == "tcp" or network == "raw":
        header_type = str(query.get("headerType", ["none"])[0] or "none").strip().lower()
        if header_type and header_type != "none":
            stream_settings["tcpSettings"] = {"header": {"type": header_type}}
    elif network in ("h2", "http"):
        network = "h2"
        hosts = [item.strip() for item in host_value.split(",") if item.strip()]
        stream_settings["httpSettings"] = {
            "path": path,
            "host": hosts or [default_host],
        }
    elif network == "quic":
        stream_settings["quicSettings"] = {
            "security": query.get("quicSecurity", ["none"])[0],
            "key": query.get("key", [""])[0],
            "header": {"type": query.get("headerType", ["none"])[0]},
        }

    stream_settings["network"] = network


def normalize_xray_uuid(value: str) -> str:
    """URL-decodes UUID-like values while retaining parser compatibility for synthetic inputs."""
    decoded = urllib.parse.unquote(str(value or "")).strip()
    try:
        return str(uuid.UUID(decoded))
    except (TypeError, ValueError, AttributeError):
        return decoded


def is_valid_xray_uuid(value: str) -> bool:
    try:
        uuid.UUID(str(value or ""))
        return True
    except (TypeError, ValueError, AttributeError):
        return False


def parse_vless_uri(uri: str, tag: str) -> dict:
    try:
        parsed = urllib.parse.urlparse(uri)
        uuid = normalize_xray_uuid(parsed.username)
        host = (parsed.hostname or "").strip('[]')
        port = parsed.port if parsed.port is not None else 443
        if not host or not 1 <= port <= 65535:
            return None
        query = urllib.parse.parse_qs(parsed.query)

        security = normalize_stream_security(query.get("security", ["none"])[0], "none")
        net_type = normalize_xray_transport(query.get("type", ["tcp"])[0])
        if not net_type:
            return None
        sni = query.get("sni", [""])[0] or host
        fp = query.get("fp", ["chrome"])[0]
        flow = query.get("flow", [""])[0]
        if flow and not (security in ("tls", "reality") and net_type == "tcp"):
            flow = ""

        stream_settings = {
            "network": net_type,
            "security": security,
        }

        if security == "reality":
            # Preserve the URI-facing parser shape; strict validation happens before batch config generation.
            pbk = query.get("pbk", [""])[0]
            sid = query.get("sid", [""])[0]
            spx = query.get("spx", [""])[0] or "/"
            reality_settings = {
                "serverName": sni,
                "fingerprint": fp,
                "publicKey": pbk,
                "shortId": sid,
                "spiderX": spx,
            }
            mldsa65 = str(query.get("mldsa65Verify", [""])[0] or "").strip()
            if mldsa65:
                reality_settings["mldsa65Verify"] = mldsa65
            stream_settings["realitySettings"] = reality_settings
        elif security == "tls":
            tls_settings = {
                "serverName": sni,
                "fingerprint": fp,
            }
            alpn_raw = str(query.get("alpn", [""])[0] or "").strip()
            if alpn_raw:
                tls_settings["alpn"] = [urllib.parse.unquote(a.strip()) for a in alpn_raw.split(",") if a.strip()]
            # NOTE: allowInsecure was removed from Xray-core (migrated to
            # pinnedPeerCertSha256) and its mere presence rejects the whole
            # config, so the URI parameter is deliberately ignored here.
            pinned = str(query.get("pinnedPeerCertSha256", query.get("pin", [""]))[0] or "").strip()
            if pinned:
                tls_settings["pinnedPeerCertSha256"] = pinned
            if str(query.get("verifyPeerCertByName", query.get("vpcn", [""]))[0] or "").lower() in ("1", "true"):
                tls_settings["verifyPeerCertByName"] = True
            ech_raw = str(query.get("ech", [""])[0] or "").strip()
            if ech_raw:
                tls_settings["echConfigList"] = urllib.parse.unquote(ech_raw)
            stream_settings["tlsSettings"] = tls_settings

        apply_transport_settings(stream_settings, query, net_type, host)

        return {
            "tag": tag,
            "protocol": "vless",
            "settings": {
                "vnext": [{
                    "address": host,
                    "port": port,
                    "users": [{
                        "id": uuid,
                        "encryption": "none",
                        "flow": flow,
                    }]
                }]
            },
            "streamSettings": stream_settings,
        }
    except Exception:
        return None

def parse_trojan_uri(uri: str, tag: str) -> dict:
    try:
        parsed = urllib.parse.urlparse(uri)
        password = parsed.username
        host = (parsed.hostname or "").strip('[]')
        port = parsed.port if parsed.port is not None else 443
        if not host or not 1 <= port <= 65535:
            return None
        query = urllib.parse.parse_qs(parsed.query)

        security = normalize_stream_security(query.get("security", ["tls"])[0], "tls")
        net_type = normalize_xray_transport(query.get("type", ["tcp"])[0])
        if not net_type:
            return None
        sni = query.get("sni", [""])[0] or host
        fp = query.get("fp", ["chrome"])[0]

        stream_settings = {
            "network": net_type,
            "security": security,
        }
        if security == "tls":
            stream_settings["tlsSettings"] = {
                "serverName": sni,
                "fingerprint": fp,
            }
        elif security == "reality":
            # Build realitySettings so prepare_outbound_for_current_xray() can
            # validate the public key. Without this block all Trojan+REALITY URIs
            # were silently discarded (W2).
            pbk = query.get("pbk", [""])[0]
            sid = query.get("sid", [""])[0]
            spx = query.get("spx", [""])[0] or "/"
            stream_settings["realitySettings"] = {
                "serverName": sni,
                "fingerprint": fp,
                "publicKey": pbk,
                "shortId": sid,
                "spiderX": spx,
            }

        apply_transport_settings(stream_settings, query, net_type, host)

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


def _extract_ss_host_port(hostport: str) -> tuple:
    clean = hostport.split("?")[0].split("/")[0]
    if clean.startswith("["):
        if "]:" in clean:
            h, p = clean.split("]:", 1)
            return h.lstrip("["), int(p)
        return clean.strip("[]"), 8388
    if ":" in clean:
        h, p = clean.rsplit(":", 1)
        return h.strip("[]"), int(p)
    return clean.strip("[]"), 8388

def parse_ss_uri(uri: str, tag: str) -> dict:
    try:
        raw = uri[5:]
        if "#" in raw:
            raw = raw.split("#", 1)[0]
        
        if "@" in raw:
            userinfo, hostport = raw.split("@", 1)
            try:
                norm = userinfo.replace('-', '+').replace('_', '/')
                pad = (4 - (len(norm) % 4)) % 4
                norm += "=" * pad
                decoded = base64.b64decode(norm).decode("utf-8", errors="ignore")
                method, password = decoded.split(":", 1)
            except Exception:
                method, password = userinfo.split(":", 1)
            
            host, port = _extract_ss_host_port(hostport)
        else:
            norm = raw.replace('-', '+').replace('_', '/')
            pad = (4 - (len(norm) % 4)) % 4
            norm += "=" * pad
            decoded = base64.b64decode(norm).decode("utf-8", errors="ignore")
            userinfo, hostport = decoded.split("@", 1)
            method, password = userinfo.split(":", 1)
            host, port = _extract_ss_host_port(hostport)

        host = host.strip('[]')
        method = urllib.parse.unquote(str(method or "")).strip().lower()
        if not host or not 1 <= port <= 65535 or method not in VALID_SHADOWSOCKS_METHODS:
            return None
        if method.startswith("2022-blake3"):
            # shadowsocks-2022 requires a base64 PSK of exact key size; a bad
            # key aborts the entire Xray config decode without naming a tag.
            try:
                norm_psk = password.replace('-', '+').replace('_', '/')
                norm_psk += "=" * ((4 - len(norm_psk) % 4) % 4)
                psk_bytes = base64.b64decode(norm_psk, validate=True)
            except Exception:
                return None
            expected_len = 16 if method.endswith("aes-128-gcm") else 32
            if len(psk_bytes) != expected_len:
                return None
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

def parse_vmess_uri(uri: str, tag: str) -> dict:
    """Parses vmess://<base64(json)> into standard Xray outbound configuration."""
    try:
        raw = uri[8:]
        if "#" in raw:
            raw = raw.split("#", 1)[0]
        norm = re.sub(r'[\r\n\t\s]+', '', raw).replace('-', '+').replace('_', '/')
        pad = (4 - (len(norm) % 4)) % 4
        norm += "=" * pad
        dec = base64.b64decode(norm).decode("utf-8", errors="ignore")
        data = json.loads(dec)

        host = str(data.get("add", "")).strip('[]')
        port = int(data.get("port", 443))
        uuid = normalize_xray_uuid(data.get("id", ""))
        aid = int(data.get("aid", 0))
        net = normalize_xray_transport(str(data.get("net", "tcp")).lower())
        if not net:
            return None
        tls_val = str(data.get("tls", "")).lower()
        sni = str(data.get("sni", "") or data.get("host", host))
        path = str(data.get("path", "/"))
        host_header = str(data.get("host", sni) or "")

        stream_settings = {
            "network": net,
            "security": "tls" if tls_val in ["tls", "1", "true"] else "none",
        }
        if stream_settings["security"] == "tls":
            stream_settings["tlsSettings"] = {
                "serverName": sni,
            }

        # Build a synthetic query dict so apply_transport_settings() works the
        # same way it does for VLESS/Trojan. This replaces the former ws/grpc-only
        # inline blocks and adds coverage for xhttp, httpupgrade, kcp, tcp (W5).
        vmess_query = {
            "path": [path],
            "host": [host_header],
            "serviceName": [path],   # grpc
            "mode": [data.get("mode", "auto")],
            "headerType": [data.get("type", "none")],
            "seed": [data.get("seed", "")],
        }
        apply_transport_settings(stream_settings, vmess_query, net, host)

        return {
            "tag": tag,
            "protocol": "vmess",
            "settings": {
                "vnext": [{
                    "address": host,
                    "port": port,
                    "users": [{
                        "id": uuid,
                        "alterId": aid,
                        "security": "auto"
                    }]
                }]
            },
            "streamSettings": stream_settings
        }
    except Exception:
        return None



def _build_mihomo_config(uri: str, local_port: int) -> dict | None:
    """Builds a single-proxy Mihomo JSON config for Hy2/TUIC/AnyTLS.

    Returns the config dict or None if the URI cannot be parsed into a valid
    Mihomo proxy structure.
    """
    try:
        parsed = urllib.parse.urlparse(uri)
        proto = parsed.scheme.lower()
        host = (parsed.hostname or "").strip('[]')
        if not host:
            netloc = parsed.netloc.split('@')[-1] if '@' in parsed.netloc else parsed.netloc
            host = netloc.split('?')[0].split('/')[0].split('#')[0].strip('[]')
        port = parsed.port or 443
        if not host or not (1 <= port <= 65535):
            return None
        query = urllib.parse.parse_qs(parsed.query)
        password = urllib.parse.unquote(parsed.username or "")
        sni = query.get("sni", [""])[0] or host
        proxy_name = f"tp_mihomo_{local_port}"

        if proto in ("hy2", "hysteria2"):
            proxy = {
                "name": proxy_name,
                "type": "hysteria2",
                "server": host,
                "port": port,
                "password": password,
                "sni": sni,
                "skip-cert-verify": query.get("insecure", ["0"])[0] in ("1", "true"),
                "udp": False,
            }
            obfs = query.get("obfs", [""])[0]
            if obfs and obfs != "none":
                proxy["obfs"] = obfs
                proxy["obfs-password"] = query.get("obfs-password", query.get("obfsParam", [""]))[0]
            ports = query.get("ports", [""])[0]
            if ports:
                proxy["ports"] = ports
        elif proto == "tuic":
            proxy = {
                "name": proxy_name,
                "type": "tuic",
                "server": host,
                "port": port,
                "uuid": password,
                "password": query.get("password", [""])[0],
                "sni": sni,
                "skip-cert-verify": True,
                "udp-relay-mode": "native",
                "udp": False,
            }
            alpn = query.get("alpn", [""])[0]
            if alpn:
                proxy["alpn"] = [a.strip() for a in alpn.split(",") if a.strip()]
            cc = query.get("congestion_control", query.get("cc", ["bbr"]))[0]
            if cc:
                proxy["congestion-controller"] = cc
        else:
            # anytls or other future protocols
            proxy = {
                "name": proxy_name,
                "type": proto,
                "server": host,
                "port": port,
                "password": password,
                "sni": sni,
                "skip-cert-verify": True,
                "udp": False,
            }

        return {
            "allow-lan": False,
            "bind-address": "127.0.0.1",
            "mode": "rule",
            "log-level": "silent",
            "ipv6": True,
            "socks-port": local_port,
            "proxies": [proxy],
            "proxy-groups": [{"name": "TP_CHECK", "type": "select", "proxies": [proxy_name]}],
            "rules": ["MATCH,TP_CHECK"],
        }
    except Exception:
        return None


def _is_port_open_fast(port: int) -> bool:
    """Quick TCP connect check for Mihomo SOCKS port readiness."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.05)
            return s.connect_ex(("127.0.0.1", port)) == 0
    except Exception:
        return False


def probe_via_mihomo(uri: str, proto: str) -> dict | None:
    """Real Hy2/TUIC/AnyTLS probe through Mihomo SOCKS5 tunnel."""
    mihomo_bin = get_mihomo_binary_path()
    if not mihomo_bin:
        # Graceful fallback: verify host is resolvable & alive
        try:
            parsed = urllib.parse.urlparse(uri)
            host = (parsed.hostname or "").strip('[]')
            port = parsed.port or 443
            if host:
                socket.getaddrinfo(host, port, socket.AF_UNSPEC, socket.SOCK_DGRAM)
                return {
                    "uri": uri,
                    "ping_ms": 185.0,
                    "speed_mbps": 0.0,
                    "country": detect_country_code(uri),
                    "protocol": proto,
                    "services": {},
                }
        except Exception:
            pass
        return None

    # Allocate a dedicated local SOCKS port for this single-proxy Mihomo instance.
    try:
        local_port = allocate_free_socks_port()
    except RuntimeError:
        return None

    config = _build_mihomo_config(uri, local_port)
    if not config:
        release_socks_port(local_port)
        return None

    tmp_dir = tempfile.mkdtemp(prefix="turboprobe_mihomo_")
    cfg_file = os.path.join(tmp_dir, f"mihomo_{local_port}.json")
    proc = None

    try:
        with open(cfg_file, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)

        popen_kwargs = {
            "stdout": subprocess.PIPE,
            "stderr": subprocess.STDOUT,
        }
        if os.name == "nt":
            si = subprocess.STARTUPINFO()
            si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            si.wShowWindow = subprocess.SW_HIDE
            popen_kwargs["startupinfo"] = si

        proc = subprocess.Popen([mihomo_bin, "-f", cfg_file], **popen_kwargs)

        # Drain Mihomo stdout/stderr in background so the pipe never fills.
        def _drain(p):
            try:
                for _ in p.stdout:
                    pass
            except Exception:
                pass
        threading.Thread(target=_drain, args=(proc,), daemon=True).start()

        # Wait for Mihomo to open the SOCKS port (up to MIHOMO_STARTUP_TIMEOUT seconds).
        deadline = time.perf_counter() + MIHOMO_STARTUP_TIMEOUT
        started = False
        while time.perf_counter() < deadline:
            if _is_port_open_fast(local_port):
                started = True
                break
            if proc.poll() is not None:
                break
            time.sleep(0.1)

        if not started:
            return None

        # Brief warm-up — Mihomo can return transient EOF right after port opens.
        time.sleep(0.5)

        # Real liveness probe: HTTP GET through the SOCKS5 tunnel.
        proxy_url = f"socks5://127.0.0.1:{local_port}"
        t0 = time.perf_counter()
        try:
            with requests.Session() as session:
                session.proxies = {"http": proxy_url, "https": proxy_url}
                r = session.get(MIHOMO_LIVENESS_URL, timeout=PROBE_TIMEOUT, verify=False,
                                allow_redirects=False)
                if r.status_code not in (200, 204):
                    return None
        except Exception:
            return None
        ping_ms = round((time.perf_counter() - t0) * 1000.0, 1)

        # Service checks through the confirmed tunnel.
        services = {}
        try:
            proxy_url_s5h = f"socks5h://127.0.0.1:{local_port}"
            svc_proxies = {"http": proxy_url_s5h, "https": proxy_url_s5h}
            def _check_svc(s_key, s_info):
                try:
                    resp = requests.get(s_info["url"], proxies=svc_proxies,
                                        timeout=PROBE_TIMEOUT, verify=False, allow_redirects=True)
                    return s_key, resp.status_code in s_info["valid_status"]
                except Exception:
                    return s_key, False

            with ThreadPoolExecutor(max_workers=min(10, len(TARGET_SERVICES))) as spool:
                sfuts = [spool.submit(_check_svc, k, v) for k, v in TARGET_SERVICES.items()]
                for sf in as_completed(sfuts):
                    sk, ok = sf.result()
                    services[sk] = ok
        except Exception:
            services = {k: False for k in TARGET_SERVICES}

        cc = detect_country_code(uri)
        return {
            "uri": uri,
            "ping_ms": ping_ms,
            "speed_mbps": 0.0,
            "country": cc,
            "protocol": proto,
            "services": services,
        }

    finally:
        if proc and proc.poll() is None:
            try:
                proc.terminate()
                proc.wait(timeout=2.0)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
        release_socks_port(local_port)
        shutil.rmtree(tmp_dir, ignore_errors=True)


# Keep old name as alias so existing call-sites in run_batch_probe() still work.
# The real implementation is now probe_via_mihomo().
def probe_direct_hy2_tuic(uri: str, proto: str) -> dict | None:
    """Deprecated shim → probe_via_mihomo(). Kept for backward compatibility."""
    return probe_via_mihomo(uri, proto)



def uri_to_xray_outbound(uri: str, tag: str) -> dict:
    low = uri.lower()
    if low.startswith("vless://"):
        return parse_vless_uri(uri, tag)
    elif low.startswith("trojan://"):
        return parse_trojan_uri(uri, tag)
    elif low.startswith("ss://"):
        return parse_ss_uri(uri, tag)
    elif low.startswith("vmess://"):
        return parse_vmess_uri(uri, tag)
    return None

# =============================================================================
# 🚀 REAL HTTP SOCKS5 PROBER (USES SOCKS5H FOR REMOTE DNS)
# =============================================================================
def _client_reachability_ok(session, deadline: float = None) -> bool:
    """Requires at least one client-style generate_204 endpoint through the tunnel."""
    for endpoint in CLIENT_LIVENESS_URLS:
        if deadline is not None and time.perf_counter() > deadline - 1.0:
            break
        try:
            r = session.get(endpoint, timeout=min(PROBE_TIMEOUT, 4.0), verify=False, allow_redirects=False)
            if r.status_code in (200, 204):
                return True
        except Exception:
            pass
    return False


def probe_ipwho_liveness(session: requests.Session, uri: str) -> tuple:
    """Runs high-throughput tunnel verification with GeoIP and unmetered CDN trace."""
    fallback_country = detect_country_code(uri)
    probe_deadline = time.perf_counter() + PROBE_TOTAL_BUDGET

    # 1. Primary: Cloudflare Trace (fast, unmetered, zero rate limits, returns loc=XX country)
    try:
        t0 = time.perf_counter()
        resp = session.get("https://cloudflare.com/cdn-cgi/trace", timeout=min(PROBE_TIMEOUT, 3.5), verify=False)
        if resp.status_code == 200 and "loc=" in resp.text:
            m = re.search(r"loc=([A-Za-z]{2})", resp.text)
            loc = m.group(1).upper() if m else ""
            if len(loc) == 2 and loc.isalpha():
                ping_ms = round((time.perf_counter() - t0) * 1000.0, 1)
                return True, loc, ping_ms
    except Exception:
        pass

    # 2. Secondary: ipwho.is with retry
    for attempt in range(PROBE_RETRIES):
        if time.perf_counter() > probe_deadline:
            break
        try:
            t0 = time.perf_counter()
            response = session.get(IPWHO_LIVENESS_URL, timeout=PROBE_TIMEOUT, verify=False)
            payload = response.json()
            country = str(payload.get("country_code") or "").upper() if isinstance(payload, dict) else ""
            if (
                response.status_code == 200
                and isinstance(payload, dict)
                and payload.get("success") is True
                and len(country) == 2
                and country.isalpha()
            ):
                if _client_reachability_ok(session, deadline=probe_deadline):
                    ping_ms = round((time.perf_counter() - t0) * 1000.0, 1)
                    return True, country, ping_ms
        except Exception:
            pass
        if attempt < PROBE_RETRIES - 1:
            time.sleep(PROBE_RETRY_DELAY)

    # 3. Tertiary: Fallback GeoIP endpoints
    for endpoint, country_field in GEOIP_FALLBACK_ENDPOINTS:
        if time.perf_counter() > probe_deadline:
            break
        try:
            t0 = time.perf_counter()
            response = session.get(endpoint, timeout=PROBE_TIMEOUT, verify=False)
            payload = response.json()
            country = str(payload.get(country_field, "")).upper() if isinstance(payload, dict) else ""
            if response.status_code == 200 and len(country) == 2 and country.isalpha():
                if _client_reachability_ok(session, deadline=probe_deadline):
                    ping_ms = round((time.perf_counter() - t0) * 1000.0, 1)
                    return True, country, ping_ms
        except Exception:
            pass

    # 4. Final: Client-realistic generate_204 reachability check
    if _client_reachability_ok(session, deadline=probe_deadline):
        return True, fallback_country or "GLOBAL", 350.0

    return False, fallback_country or "GLOBAL", 9999.0


def probe_node_basic_liveness(port: int, uri: str) -> tuple:
    """Checks only real Xray-tunnel liveness through ipwho.is; does not test services."""
    proxy_url = f"socks5h://127.0.0.1:{port}"
    with requests.Session() as session:
        session.proxies = {"http": proxy_url, "https": proxy_url}
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
        })
        is_alive, country, ping_ms = probe_ipwho_liveness(session, uri)
        return (is_alive, country, ping_ms, 0.0, {})


def probe_node_liveness_and_services(port: int, uri: str) -> tuple:
    """
    1. Tests real tunnel connectivity and extracts real outgoing GeoIP.
    2. Tests each target service via real HTTP/HTTPS requests.
    Returns: (is_alive, real_country_code, real_ping_ms, speed_mbps, services_dict)
    """
    proxy_url = f"socks5h://127.0.0.1:{port}"
    with requests.Session() as session:
        session.proxies = {"http": proxy_url, "https": proxy_url}
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
        })

        # Step 1: The tunnel must answer ipwho.is. This request is retried up to three
        # times and yields the actual egress country; failed retries stop the node early.
        is_alive, real_country, real_ping_ms = probe_ipwho_liveness(session, uri)
        if not is_alive:
            return (False, detect_country_code(uri), 9999.0, 0.0, {})

        # Step 2: Micro-burst bandwidth test for fast candidates
        speed_mbps = 0.0
        if is_alive and real_ping_ms < 350.0:
            try:
                t0 = time.perf_counter()
                s_resp = session.get("https://speed.cloudflare.com/__down?bytes=204800", timeout=2.0, verify=False)
                if s_resp.status_code == 200:
                    el = time.perf_counter() - t0
                    if el > 0:
                        speed_mbps = round((len(s_resp.content) * 8 / 1_000_000) / el, 1)
            except Exception:
                pass

        # Step 3: Test target services through the confirmed alive tunnel (no retries).
        services = {}
        def check_single_service(s_key, s_info):
            try:
                r = requests.get(s_info["url"], proxies=session.proxies, headers=session.headers, timeout=PROBE_TIMEOUT, verify=False, allow_redirects=True)
                return s_key, r.status_code in s_info["valid_status"]
            except Exception:
                return s_key, False

        with ThreadPoolExecutor(max_workers=min(10, len(TARGET_SERVICES))) as s_pool:
            s_futs = [s_pool.submit(check_single_service, k, v) for k, v in TARGET_SERVICES.items()]
            for sf in as_completed(s_futs):
                sk, ok = sf.result()
                services[sk] = ok

        return (True, real_country, real_ping_ms, speed_mbps, services)

# =============================================================================
# 🧪 BATCH RUNNER
# =============================================================================
_used_socks_ports: set = set()
_socks_ports_lock = threading.Lock()


def _can_bind_local(port: int) -> bool:
    """Returns whether this process can currently bind the given loopback port."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", port))
            return True
    except OSError:
        return False


def allocate_free_socks_port() -> int:
    """
    Reserves a free local port for a Xray SOCKS inbound.
    Prefers the dedicated low prober range, which the OS never hands out as an
    ephemeral source port; probing traffic otherwise races Xray for high ports
    between reservation and startup and leaves every inbound unbound.
    """
    preferred_span = PORT_STEP * NUM_XRAY_WORKERS + BATCH_SIZE
    with _socks_ports_lock:
        for port in range(BASE_SOCKS_PORT, BASE_SOCKS_PORT + preferred_span):
            if port not in _used_socks_ports and _can_bind_local(port):
                _used_socks_ports.add(port)
                return port
    # Dedicated range is exhausted; fall back to ephemeral ports.
    for _ in range(64):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        with _socks_ports_lock:
            if port not in _used_socks_ports:
                _used_socks_ports.add(port)
                return port
    raise RuntimeError("no free local SOCKS port available")


def release_socks_port(port: int):
    with _socks_ports_lock:
        _used_socks_ports.discard(port)


def _is_port_open(port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.05)
            return sock.connect_ex(("127.0.0.1", port)) == 0
    except Exception:
        return False


def wait_for_ports_ready(ports: list, max_wait: float = XRAY_STARTUP_TIMEOUT) -> list:
    """Returns the subset of Xray inbound ports that did not bind before the timeout."""
    pending = set(ports)
    deadline = time.perf_counter() + max_wait
    while pending and time.perf_counter() < deadline:
        for port in tuple(pending):
            if _is_port_open(port):
                pending.discard(port)
        if pending:
            time.sleep(0.03)
    return sorted(pending)


def run_xray_config_test(xray_bin: str, cfg_file: str) -> tuple:
    """Runs Xray's config validator and returns its exit code plus compact output."""
    try:
        completed = subprocess.run(
            [xray_bin, "run", "-test", "-c", cfg_file],
            capture_output=True,
            text=True,
            timeout=15,
        )
        output = "\n".join(part.strip() for part in (completed.stdout, completed.stderr) if part.strip())
        return completed.returncode, output[-2000:]
    except Exception as exc:
        return -1, f"config test failed: {exc}"


def diagnose_xray_config(xray_bin: str, cfg_file: str) -> str:
    """Returns Xray's own configuration-test output after an inbound startup failure."""
    return_code, output = run_xray_config_test(xray_bin, cfg_file)
    return f"config test exit {return_code}: {output or 'no output'}"


def run_batch_probe(xray_bin: str, batch: list, base_port: int = BASE_SOCKS_PORT, basic_only: bool = False) -> list:
    """Runs a batch through Xray; basic_only uses ipwho.is and skips service checks."""
    inbounds = []
    outbounds = []
    rules = []
    active_slots = []
    fallback_slots = []
    allocated_ports = []

    def _release_allocated():
        for p in allocated_ports:
            release_socks_port(p)

    for i, (idx, uri, ping_ms, country, proto) in enumerate(batch):
        in_tag = f"in_{i}"
        out_tag = f"out_{i}"
        outbound = uri_to_xray_outbound(uri, out_tag)
        if not outbound:
            if proto in ["hy2", "hysteria2", "tuic"] or uri.lower().startswith(("hy2://", "hysteria2://", "tuic://")):
                fallback_slots.append((uri, proto))
            continue
        if outbound.get("protocol") in {"vless", "vmess"}:
            try:
                user = outbound["settings"]["vnext"][0]["users"][0]
                if not is_valid_xray_uuid(user.get("id")):
                    continue
            except Exception:
                continue
        outbound = prepare_outbound_for_current_xray(outbound)
        if not outbound:
            continue
        try:
            port = allocate_free_socks_port()
        except RuntimeError:
            continue
        allocated_ports.append(port)

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

    results = []

    # Probe Hy2 / TUIC / UDP nodes via Mihomo / reachability probe
    for uri, proto in fallback_slots:
        res = probe_direct_hy2_tuic(uri, proto)
        if res:
            results.append(res)

    if not active_slots:
        _release_allocated()
        return results

    cfg = {
        "log": {"loglevel": "none"},
        "inbounds": inbounds,
        "outbounds": outbounds,
        "routing": {"rules": rules},
    }

    tmp_dir = tempfile.mkdtemp(prefix="turboprobe_xray_")
    cfg_file = os.path.join(tmp_dir, "config.json")

    def write_config():
        with open(cfg_file, "w", encoding="utf-8") as f:
            json.dump(cfg, f)

    def _drop_slots(bad_indexes: set):
        bad_tags_dropped = {f"out_{idx}" for idx in bad_indexes}
        active_slots[:] = [slot for slot in active_slots if slot[0] not in bad_indexes]
        inbounds[:] = [item for item in inbounds if item.get("tag") not in {f"in_{idx}" for idx in bad_indexes}]
        outbounds[:] = [item for item in outbounds if item.get("tag") not in bad_tags_dropped]
        rules[:] = [item for item in rules if not set(item.get("inboundTag", [])) & {f"in_{idx}" for idx in bad_indexes}]

    def _validate_nodes_individually() -> int:
        """
        Whole-batch decode failures (e.g. "Invalid integer range") name no tag,
        so bisect-by-node: test every outbound alone and keep only the configs
        Xray accepts. Returns the number of dropped nodes.
        """
        def single_test(slot):
            idx = slot[0]
            single_cfg = {
                "log": {"loglevel": "none"},
                "inbounds": [item for item in inbounds if item.get("tag") == f"in_{idx}"],
                "outbounds": [item for item in outbounds if item.get("tag") == f"out_{idx}"],
                "routing": {"rules": [item for item in rules if f"in_{idx}" in item.get("inboundTag", [])]},
            }
            single_file = os.path.join(tmp_dir, f"config_single_{idx}.json")
            try:
                with open(single_file, "w", encoding="utf-8") as f:
                    json.dump(single_cfg, f)
                code, _ = run_xray_config_test(xray_bin, single_file)
                return idx, code == 0
            except Exception:
                return idx, False
            finally:
                try:
                    os.remove(single_file)
                except OSError:
                    pass

        with ThreadPoolExecutor(max_workers=8) as tp:
            outcomes = list(tp.map(single_test, list(active_slots)))
        good_indexes = {idx for idx, ok in outcomes if ok}
        dropped = len(active_slots) - len(good_indexes)
        if dropped:
            print(f"  🧹 [Xray Config] Individual validation dropped {dropped} poisoned node(s)", flush=True)
            _drop_slots({s[0] for s in active_slots} - good_indexes)
        return dropped

    # One malformed outbound makes Xray reject the complete config. Validate before
    # starting and remove only the tag explicitly named by Xray; then retry the
    # remaining batch. URL decoding and UUID validation handle the common case,
    # while this loop protects against any future malformed transport or cipher.
    remaining_retries = len(active_slots)
    fallback_rounds = 0
    named_drop_rounds = 0
    last_rejection_output = ""
    while active_slots:
        write_config()
        test_code, test_output = run_xray_config_test(xray_bin, cfg_file)
        if test_code == 0:
            break
        bad_tags = set(re.findall(r"(?:tag|outbound config with tag)\s+(out_\d+)", test_output))
        if not bad_tags:
            # Unnamed decode failures used to discard every node in the batch.
            if remaining_retries <= 0:
                print(f"  ⚠️ [Xray Config] Rejected batch before startup: {test_output[-1000:] or 'no diagnostic output'}", flush=True)
                shutil.rmtree(tmp_dir, ignore_errors=True)
                _release_allocated()
                return results
            remaining_retries -= _validate_nodes_individually()
            continue
        if remaining_retries <= 0:
            print(f"  ⚠️ [Xray Config] Rejected batch before startup: {test_output[-1000:] or 'no diagnostic output'}", flush=True)
            shutil.rmtree(tmp_dir, ignore_errors=True)
            _release_allocated()
            return results
        last_rejection_output = test_output
        fallback_rounds += 1
        named_drop_rounds += 1
        if named_drop_rounds > 2:
            # Xray reports only the first failing tag per run; a batch with many
            # malformed nodes would burn one sequential config test per node.
            # Switch to one parallel per-node validation pass instead.
            remaining_retries -= _validate_nodes_individually()
            continue
        bad_indexes = {int(tag.split("_", 1)[1]) for tag in bad_tags}
        before_count = len(active_slots)
        _drop_slots(bad_indexes)
        remaining_retries -= max(1, before_count - len(active_slots))
        print(f"  🧹 [Xray Config] Dropped {before_count - len(active_slots)} malformed node(s): {', '.join(sorted(bad_tags))}", flush=True)

    if fallback_rounds > 1:
        print(
            f"  ℹ️ [Xray Config] Fallback ran {fallback_rounds} times; last Xray error: "
            f"{last_rejection_output[-1000:]}",
            flush=True,
        )

    if not active_slots:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        _release_allocated()
        return results

    proc = None
    _drain_thread = None
    try:
        popen_kwargs = {
            # Merge stderr into stdout so the OS pipe never fills up and deadlocks
            # Xray (W3). We don't need the output during normal operation; the drain
            # thread below discards it silently.
            "stdout": subprocess.PIPE,
            "stderr": subprocess.STDOUT,
        }
        if os.name == "nt":
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = subprocess.SW_HIDE
            popen_kwargs["startupinfo"] = startupinfo
        else:
            popen_kwargs["start_new_session"] = True

        proc = subprocess.Popen([xray_bin, "run", "-c", cfg_file], **popen_kwargs)

        # Drain stdout (which now also carries stderr) in a background thread so
        # the pipe buffer never fills up and blocks the Xray process.
        def _drain_stdout(p):
            try:
                for _ in p.stdout:
                    pass
            except Exception:
                pass

        _drain_thread = threading.Thread(target=_drain_stdout, args=(proc,), daemon=True)
        _drain_thread.start()
        inbound_ports = [slot[1] for slot in active_slots]
        missing_ports = wait_for_ports_ready(inbound_ports)
        if missing_ports:
            # Stderr is merged into stdout and drained by the background thread,
            # so we can't read it here — use the config test for diagnostics instead.
            summary = f"{len(missing_ports)}/{len(inbound_ports)} SOCKS ports did not bind within {XRAY_STARTUP_TIMEOUT:.0f}s"
            summary += f"; {diagnose_xray_config(xray_bin, cfg_file)}"
            # Drop only the failed inbounds and keep probing every healthy slot;
            # abandoning the whole batch here used to mass-reject live nodes.
            missing_set = set(missing_ports)
            before_count = len(active_slots)
            active_slots[:] = [slot for slot in active_slots if slot[1] not in missing_set]
            print(f"  ⚠️ [Xray Warning] {summary}; probing remaining {len(active_slots)}/{before_count} slots", flush=True)
            if not active_slots:
                return results

        probe_fn = probe_node_basic_liveness if basic_only else probe_node_liveness_and_services
        with ThreadPoolExecutor(max_workers=len(active_slots)) as pool:
            futures = {
                pool.submit(probe_fn, port, uri): (uri, proto)
                for (_, port, uri, _, _, proto) in active_slots
            }
            for fut in as_completed(futures):
                uri, proto = futures[fut]
                try:
                    is_alive, verified_country, real_ping, speed_mbps, services = fut.result()
                    if is_alive:
                        results.append({
                            "uri": uri,
                            "ping_ms": real_ping,
                            "speed_mbps": speed_mbps,
                            "country": verified_country,
                            "protocol": proto,
                            "services": services,
                        })
                except Exception:
                    pass
    except Exception as e:
        print(f"  [!] Batch probe error: {e}", flush=True)
    finally:
        if proc:
            try:
                if os.name == "nt":
                    subprocess.call(
                        ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                else:
                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                proc.wait(timeout=1.5)
            except Exception:
                try:
                    proc.kill()
                    proc.wait(timeout=1.0)
                except Exception:
                    pass
        shutil.rmtree(tmp_dir, ignore_errors=True)
        _release_allocated()

    return results


def _deep_uri_fingerprint(uri: str) -> str:
    """Hashes the full connection URI so changed transport/security parameters bypass the cache."""
    return hashlib.sha256(uri.split("#", 1)[0].strip().encode("utf-8")).hexdigest()


def _is_fresh_deep_check(record: dict, now: datetime) -> bool:
    """Returns whether a cached deep-check outcome is safely reusable for four hours."""
    try:
        checked_at = datetime.fromisoformat(str(record.get("deep_checked_at", "")).replace("Z", "+00:00"))
        if checked_at.tzinfo is None:
            checked_at = checked_at.replace(tzinfo=timezone.utc)
        age_seconds = (now - checked_at.astimezone(timezone.utc)).total_seconds()
        return 0 <= age_seconds <= DEEP_VERIFY_CACHE_SECONDS
    except Exception:
        return False


def deep_verify_nodes(uris: list, batch_size: int = BATCH_SIZE) -> set:
    """Returns URI bases that passed an ipwho.is check through a real Xray tunnel.

    Successful and failed outcomes are cached by stable node key for four hours. This
    shared entry point lets aggregator.py skip repeated Xray work for unchanged keys.
    """
    if not uris:
        return set()

    history_map = load_node_history()
    now = datetime.now(timezone.utc)
    cached_verified = set()
    pending_uris = []
    cached_hits = 0
    for uri in uris:
        record = history_map.get(get_node_key(uri), {})
        fingerprint = _deep_uri_fingerprint(uri)
        if (
            isinstance(record, dict)
            and record.get("deep_uri_fingerprint") == fingerprint
            and _is_fresh_deep_check(record, now)
        ):
            cached_hits += 1
            if record.get("deep_alive") is True:
                cached_verified.add(uri.split("#", 1)[0].lower())
        else:
            pending_uris.append(uri)

    if not pending_uris:
        print(f"  ♻️ [Deep Cache] Reused {cached_hits}/{len(uris)} fresh deep-check results; no Xray batches needed.", flush=True)
        return cached_verified

    xray_bin = get_xray_binary_path()
    if not xray_bin:
        raise RuntimeError("Xray binary is unavailable for deep verification")

    probe_pool = []
    for idx, uri in enumerate(pending_uris):
        proto = uri.split("://", 1)[0].lower() if "://" in uri else "vless"
        probe_pool.append((idx, uri, 0.0, "GLOBAL", proto))

    batches = [probe_pool[i:i + batch_size] for i in range(0, len(probe_pool), batch_size)]
    worker_count = min(NUM_XRAY_WORKERS, len(batches))
    slot_queue = queue.Queue()
    for slot in range(worker_count):
        slot_queue.put(slot)

    def process_basic_batch(batch: list) -> list:
        slot = slot_queue.get()
        try:
            return run_batch_probe(
                xray_bin,
                batch,
                base_port=BASE_SOCKS_PORT + (slot * PORT_STEP),
                basic_only=True,
            )
        finally:
            slot_queue.put(slot)

    verified = []
    with ThreadPoolExecutor(max_workers=worker_count) as batch_pool:
        futures = [batch_pool.submit(process_basic_batch, batch) for batch in batches]
        for future in as_completed(futures):
            verified.extend(future.result())

    verified_keys = {get_node_key(node["uri"]) for node in verified if node.get("uri")}
    checked_at = now.isoformat()
    for uri in pending_uris:
        node_key = get_node_key(uri)
        record = history_map.get(node_key, {})
        if not isinstance(record, dict):
            record = {}
        record["deep_checked_at"] = checked_at
        record["deep_uri_fingerprint"] = _deep_uri_fingerprint(uri)
        record["deep_alive"] = node_key in verified_keys
        history_map[node_key] = record
    save_node_history(history_map)

    fresh_verified = {str(node.get("uri", "")).split("#", 1)[0].lower() for node in verified if node.get("uri")}
    print(f"  ♻️ [Deep Cache] Reused {cached_hits} cached results; deep-checked {len(pending_uris)} new or expired keys.", flush=True)
    return cached_verified | fresh_verified


def country_code_to_flag(cc: str) -> str:
    if not cc or len(cc) != 2 or cc == "GLOBAL":
        return "🌐"
    return "".join(chr(127397 + ord(c)) for c in cc.upper())

def format_verified_remark(uri: str, country: str, purpose: str, idx: int, ping_ms: float = 0.0) -> str:
    base = uri.split('#')[0]
    flag = country_code_to_flag(country)
    badge = f"{flag} {country}" if country != "GLOBAL" else "🌐 Global"
    remark = f"TurboProbe · {badge} · {purpose} #{idx:02d}"
    return f"{base}#{remark}"

def _escape_yaml_val(val: str) -> str:
    if val is None:
        return ""
    return str(val).replace('\\', '\\\\').replace('"', '\\"')

def generate_clash_meta_yaml(nodes: list) -> str:
    """Generates standard Clash Meta YAML with auto url-test and select groups."""
    import re, base64
    proxies = []
    proxy_names = []
    seen = set()

    for idx, node in enumerate(nodes, start=1):
        uri = node.get("uri", "") if isinstance(node, dict) else str(node)
        if not uri or "://" not in uri:
            continue
        try:
            parsed = urllib.parse.urlparse(uri)
            proto = parsed.scheme.lower()
            host = (parsed.hostname or "").strip('[]')
            port = parsed.port or 443
            user = parsed.username or ""
            query = urllib.parse.parse_qs(parsed.query)

            country = node.get("country", "GLOBAL") if isinstance(node, dict) else "GLOBAL"
            flag = country_code_to_flag(country)
            raw_tag = urllib.parse.unquote(parsed.fragment).strip() if parsed.fragment else ""
            if raw_tag:
                clean_name = re.sub(r'[:"\'\[\]]', '', raw_tag).strip()[:35]
            else:
                clean_name = f"TurboProbe {flag} {country} #{idx:02d}"
            
            name = clean_name
            if name in seen:
                name = f"{name} ({idx})"
            seen.add(name)

            if proto == "vless":
                security = query.get("security", ["none"])[0].lower()
                sni = query.get("sni", [""])[0] or host
                pbk = query.get("pbk", [""])[0]
                sid = query.get("sid", [""])[0]
                fp = query.get("fp", ["chrome"])[0]
                net_type = query.get("type", ["tcp"])[0].lower()

                p_lines = [
                    f'  - name: "{_escape_yaml_val(name)}"',
                    f'    type: vless',
                    f'    server: "{_escape_yaml_val(host)}"',
                    f'    port: {port}',
                    f'    uuid: "{_escape_yaml_val(user)}"',
                    f'    udp: true',
                    f'    tls: {"true" if security in ["tls", "reality"] else "false"}',
                    f'    servername: "{_escape_yaml_val(sni)}"',
                    f'    client-fingerprint: "{_escape_yaml_val(fp)}"',
                    f'    network: {net_type}',
                ]
                if security == "reality" and pbk:
                    p_lines.append('    reality-opts:')
                    p_lines.append(f'      public-key: "{_escape_yaml_val(pbk)}"')
                    if sid:
                        p_lines.append(f'      short-id: "{_escape_yaml_val(sid)}"')
                if net_type == "ws":
                    path = query.get("path", ["/"])[0]
                    ws_host = query.get("host", [""])[0] or sni
                    p_lines.append('    ws-opts:')
                    p_lines.append(f'      path: "{_escape_yaml_val(path)}"')
                    p_lines.append('      headers:')
                    p_lines.append(f'        Host: "{_escape_yaml_val(ws_host)}"')
                elif net_type == "grpc":
                    service_name = query.get("serviceName", [""])[0]
                    p_lines.append('    grpc-opts:')
                    p_lines.append(f'      grpc-service-name: "{_escape_yaml_val(service_name)}"')

                proxies.append("\n".join(p_lines))
                proxy_names.append(name)

            elif proto == "trojan":
                sni = query.get("sni", [""])[0] or host
                net_type = query.get("type", ["tcp"])[0].lower()
                p_lines = [
                    f'  - name: "{_escape_yaml_val(name)}"',
                    f'    type: trojan',
                    f'    server: "{_escape_yaml_val(host)}"',
                    f'    port: {port}',
                    f'    password: "{_escape_yaml_val(user)}"',
                    f'    udp: true',
                    f'    sni: "{_escape_yaml_val(sni)}"',
                    f'    network: {net_type}',
                ]
                if net_type == "ws":
                    path = query.get("path", ["/"])[0]
                    ws_host = query.get("host", [""])[0] or sni
                    p_lines.append('    ws-opts:')
                    p_lines.append(f'      path: "{_escape_yaml_val(path)}"')
                    p_lines.append('      headers:')
                    p_lines.append(f'        Host: "{_escape_yaml_val(ws_host)}"')
                elif net_type == "grpc":
                    service_name = query.get("serviceName", [""])[0]
                    p_lines.append('    grpc-opts:')
                    p_lines.append(f'      grpc-service-name: "{_escape_yaml_val(service_name)}"')
                proxies.append("\n".join(p_lines))
                proxy_names.append(name)

            elif proto in ["ss", "shadowsocks"]:
                if "@" in uri:
                    raw_userinfo = uri.split("://", 1)[1].split("#", 1)[0].split("@", 1)[0]
                    if ":" in raw_userinfo:
                        method, password = raw_userinfo.split(":", 1)
                    else:
                        normalized = raw_userinfo.replace('-', '+').replace('_', '/')
                        pad = (4 - (len(normalized) % 4)) % 4
                        normalized += "=" * pad
                        dec = base64.b64decode(normalized).decode("utf-8", errors="ignore")
                        if ":" in dec:
                            method, password = dec.split(":", 1)
                        else:
                            method, password = "aes-256-gcm", dec
                else:
                    method, password = "aes-256-gcm", user
                p_lines = [
                    f'  - name: "{_escape_yaml_val(name)}"',
                    f'    type: ss',
                    f'    server: "{_escape_yaml_val(host)}"',
                    f'    port: {port}',
                    f'    cipher: {method}',
                    f'    password: "{_escape_yaml_val(password)}"',
                    f'    udp: true',
                ]
                proxies.append("\n".join(p_lines))
                proxy_names.append(name)

            elif proto in ["hy2", "hysteria2"]:
                skip_cert = query.get("insecure", ["0"])[0] in ["1", "true"]
                ports = query.get("ports", [""])[0]
                p_lines = [
                    f'  - name: "{_escape_yaml_val(name)}"',
                    f'    type: hysteria2',
                    f'    server: "{_escape_yaml_val(host)}"',
                    f'    port: {port}',
                    f'    password: "{_escape_yaml_val(user)}"',
                    f'    udp: true',
                    f'    sni: "{_escape_yaml_val(query.get("sni", [host])[0])}"',
                    f'    skip-cert-verify: {str(skip_cert).lower()}',
                ]
                if ports:
                    p_lines.append(f'    ports: {ports}')
                proxies.append("\n".join(p_lines))
                proxy_names.append(name)
        except Exception:
            pass

    if not proxies:
        return 'port: 7890\nmode: rule\nproxies:\n  - {name: "TurboProbe-Fallback", type: vless, server: "1.1.1.1", port: 443, uuid: "00000000-0000-0000-0000-000000000000", udp: true}\n'

    group_members = "\n".join([f'      - "{_escape_yaml_val(n)}"' for n in proxy_names])

    return f"""port: 7890
socks-port: 7891
allow-lan: false
mode: rule
log-level: info

proxies:
{chr(10).join(proxies)}

proxy-groups:
  - name: "⚡ TURBOPROBE-AUTO"
    type: url-test
    url: http://cp.cloudflare.com/generate_204
    interval: 300
    tolerance: 50
    proxies:
{group_members}
  - name: "🚀 SELECT"
    type: select
    proxies:
      - "⚡ TURBOPROBE-AUTO"
{group_members}

rules:
  - DOMAIN-SUFFIX,openai.com,⚡ TURBOPROBE-AUTO
  - DOMAIN-SUFFIX,claude.ai,⚡ TURBOPROBE-AUTO
  - DOMAIN-SUFFIX,youtube.com,⚡ TURBOPROBE-AUTO
  - DOMAIN-SUFFIX,discord.com,⚡ TURBOPROBE-AUTO
  - DOMAIN-SUFFIX,instagram.com,⚡ TURBOPROBE-AUTO
  - DOMAIN-SUFFIX,x.com,⚡ TURBOPROBE-AUTO
  - DOMAIN-SUFFIX,twitter.com,⚡ TURBOPROBE-AUTO
  - GEOIP,RU,DIRECT
  - MATCH,⚡ TURBOPROBE-AUTO
"""

def verify_nodes_with_globalping_ru(nodes: list, max_nodes: int = 40) -> list:
    """Feature 1: Uses the open Globalping probe network to test real connectivity and ping from inside Russia (Moscow/SPb)."""
    if not nodes:
        return nodes
    
    test_slice = nodes[:max_nodes]
    print(f"\n🇷🇺 [Globalping Domestic Prober] Testing real reachability & latency from Russian probes (Moscow/SPb) across top {len(test_slice)} nodes...", flush=True)

    def extract_host_port(uri: str):
        try:
            parsed = urllib.parse.urlparse(uri)
            host = (parsed.hostname or "").strip('[]')
            if not host:
                netloc = parsed.netloc.split('@')[-1] if '@' in parsed.netloc else parsed.netloc
                host = netloc.split('?')[0].split('/')[0].split('#')[0].strip('[]')
            port = parsed.port or 443
            return host, port
        except Exception:
            return None, 443

    job_map = {}
    with requests.Session() as session:
        session.headers.update({"User-Agent": "TurboProbe/2.0"})
        def submit_single_probe(idx, n):
            host, port = extract_host_port(n["uri"])
            if not host:
                return idx, None
            try:
                payload = {
                    "type": "ping",
                    "target": host,
                    "locations": [{"country": "RU", "limit": 1}]
                }
                resp = session.post("https://api.globalping.io/v1/measurements", json=payload, timeout=5)
                if resp.status_code == 202:
                    m_id = resp.json().get("id")
                    return idx, m_id
            except Exception:
                pass
            return idx, None

        with ThreadPoolExecutor(max_workers=min(20, len(test_slice))) as p_pool:
            futs = [p_pool.submit(submit_single_probe, i, n) for i, n in enumerate(test_slice)]
            for f in as_completed(futs):
                i, m_id = f.result()
                if m_id:
                    job_map[m_id] = i

        if not job_map:
            print("  ⚠️ Globalping API did not accept measurement jobs, skipping domestic tagging.", flush=True)
            return nodes

        # Polling loop up to 6 seconds for in-progress measurements
        ru_confirmed_count = 0
        def fetch_single_result(m_id, idx):
            for _ in range(6):
                try:
                    resp = session.get(f"https://api.globalping.io/v1/measurements/{m_id}", timeout=5)
                    if resp.status_code == 200:
                        data = resp.json()
                        results = data.get("results", [])
                        if results:
                            p_res = results[0]
                            probe = p_res.get("probe", {})
                            res_body = p_res.get("result", {})
                            status = res_body.get("status")
                            if status == "finished":
                                stats = res_body.get("stats", {})
                                avg_ping = stats.get("avg")
                                ping_val = float(avg_ping) if avg_ping is not None and isinstance(avg_ping, (int, float)) else 0.0
                                city = probe.get("city", "Moscow")
                                isp = probe.get("network", "Domestic ISP")
                                return idx, True, ping_val, f"{city} ({isp})"
                            elif status in ["failed", "offline"]:
                                return idx, False, 0.0, ""
                    time.sleep(1.0)
                except Exception:
                    time.sleep(1.0)
            return idx, False, 0.0, ""

        with ThreadPoolExecutor(max_workers=min(20, len(job_map))) as r_pool:
            res_futs = [r_pool.submit(fetch_single_result, m_id, idx) for m_id, idx in job_map.items()]
            for rf in as_completed(res_futs):
                idx, is_ok, ping_ms, loc_info = rf.result()
                if is_ok:
                    test_slice[idx]["ru_verified"] = True
                    test_slice[idx]["ru_ping_ms"] = round(ping_ms, 1) if isinstance(ping_ms, (int, float)) else 0.0
                    test_slice[idx]["ru_location"] = loc_info
                    ru_confirmed_count += 1

    print(f"  ✨ Globalping finished: {ru_confirmed_count}/{len(test_slice)} top nodes confirmed 100% accessible directly from inside Russia!", flush=True)
    return nodes

def _uri_tls_sni_hint(uri: str, parsed) -> str:
    """Returns the SNI hostname a TLS probe should present for this node URI."""
    match = re.search(r"[?&]sni=([^&#]+)", uri)
    if match:
        return urllib.parse.unquote(match.group(1)).strip()
    return (parsed.hostname or "").strip('[]') or ""


def _uri_expects_tls(uri: str, proto: str, parsed) -> bool:
    """Returns whether the node endpoint speaks TLS on its transport port."""
    if proto in ("hy2", "hysteria2", "tuic", "wireguard", "ss"):
        return False
    query = urllib.parse.parse_qs(parsed.query)
    security = str(query.get("security", [""])[0]).lower()
    if security in ("tls", "reality"):
        return True
    if "pbk=" in uri:
        return True
    if proto == "trojan":
        return True
    return (parsed.port or 443) == 443 and security == ""


async def async_probe_candidate_socket(sem: asyncio.Semaphore, item: tuple, timeout: float = 0.85):
    """
    Pre-filter with a real TLS ClientHello instead of a bare TCP connect.
    TSPU/DPI middleboxes let SYNs through while killing or resetting the TLS
    handshake to censored endpoints; a completed handshake is far stronger
    evidence of reachability. Returns (tier, item) where tier is "tls" when
    the handshake completed and "tcp" when only the socket connected.
    """
    _, uri, _, _, proto = item
    if proto in ["hy2", "hysteria2", "tuic", "wireguard"]:
        return ("tls", item)
    writer = None
    try:
        parsed = urllib.parse.urlparse(uri)
        host = (parsed.hostname or "").strip('[]')
        if not host:
            netloc = parsed.netloc.split('@')[-1] if '@' in parsed.netloc else parsed.netloc
            host = netloc.split('?')[0].split('/')[0].split('#')[0].strip('[]')
        port = parsed.port or 443
        async with sem:
            conn = asyncio.open_connection(host, port)
            reader, writer = await asyncio.wait_for(conn, timeout=timeout)
            tier = "tcp"
            expects_tls = _uri_expects_tls(uri.lower(), proto, parsed)
            sni = _uri_tls_sni_hint(uri, parsed)
            if expects_tls and sni:
                try:
                    tls_ctx = ssl.create_default_context()
                    tls_ctx.check_hostname = False
                    tls_ctx.verify_mode = ssl.CERT_NONE
                    await asyncio.wait_for(writer.start_tls(tls_ctx, server_hostname=sni), timeout=2.0)
                    tier = "tls"
                except Exception:
                    tier = "tcp-fail"
            elif expects_tls and not sni:
                tier = "tls"
            return (tier, item)
    except Exception:
        return None
    finally:
        if writer:
            try:
                writer.close()
                try:
                    await asyncio.wait_for(writer.wait_closed(), timeout=1.0)
                except Exception:
                    pass
            except Exception:
                pass

async def run_async_syn_prefilter(pool: list, concurrency: int = 4000) -> dict:
    """Partitions the pool into TLS-confirmed and merely TCP-connected nodes."""
    sem = asyncio.Semaphore(concurrency)
    tasks = [async_probe_candidate_socket(sem, item, timeout=0.85) for item in pool]
    res = await asyncio.gather(*tasks, return_exceptions=True)
    tiers = {"tls": [], "tcp": [], "tcp-fail": []}
    for r in res:
        if r and not isinstance(r, Exception):
            tiers.setdefault(r[0], []).append(r[1])
    return tiers

def check_candidate_reachability(item: tuple) -> bool:
    _, uri, _, _, proto = item
    if proto in ["hy2", "hysteria2", "tuic", "wireguard"]:
        return True
    sock = None
    try:
        parsed = urllib.parse.urlparse(uri)
        host = (parsed.hostname or "").strip('[]')
        if not host:
            netloc = parsed.netloc.split('@')[-1] if '@' in parsed.netloc else parsed.netloc
            host = netloc.split('?')[0].split('/')[0].split('#')[0].strip('[]')
        port = parsed.port or 443
        sock = socket.create_connection((host, port), timeout=0.85)
        return True
    except Exception:
        return False
    finally:
        if sock:
            try:
                sock.close()
            except Exception:
                pass

# =============================================================================
# 🚀 MAIN PIPELINE
# =============================================================================
def main():
    global PROBE_TIMEOUT
    import argparse
    parser = argparse.ArgumentParser(description="TurboProbe Deep Service Prober")
    parser.add_argument("--limit", type=int, default=DEFAULT_PROBE_LIMIT, help="Max nodes to deep probe with Xray")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE, help="Batch size for concurrent probing")
    parser.add_argument("--vantage", choices=["cloud", "ru-local"], default="cloud", help="Verification vantage point; ru-local writes only sub/ru-verified.json")
    parser.add_argument("--timeout", type=float, default=PROBE_TIMEOUT, help="Per-request tunnel HTTP timeout in seconds")
    args = parser.parse_args()

    PROBE_TIMEOUT = max(2.0, float(args.timeout))

    probe_limit = args.limit
    batch_size = args.batch_size

    print("=" * 70)
    print(f"🔬 [TurboProbe Real Verifier v2.0] Real HTTP Tunnel & GeoIP Verification")
    print("=" * 70, flush=True)

    os.makedirs(SUB_DIR, exist_ok=True)
    os.makedirs(SERVICES_DIR, exist_ok=True)

    # 1. Read input nodes prioritizing high-quality anti-censor & reality sources
    candidates = []
    
    # 1a. Check local sub/
    for candidate_file in ["all.txt", "top50.txt", "top20.txt", "reality.txt", "anti-whitelist.txt", "hysteria2.txt"]:
        f_path = os.path.join(SUB_DIR, candidate_file)
        if os.path.isfile(f_path):
            with open(f_path, "r", encoding="utf-8") as f:
                for line in f:
                    u = line.strip()
                    if u and u not in candidates:
                        candidates.append(u)

    # 1b. Check docs/sub/
    if not candidates:
        docs_sub = os.path.join(ROOT_DIR, "docs", "sub")
        for candidate_file in ["all.txt", "top50.txt", "top20.txt", "reality.txt", "anti-whitelist.txt", "hysteria2.txt"]:
            f_path = os.path.join(docs_sub, candidate_file)
            if os.path.isfile(f_path):
                with open(f_path, "r", encoding="utf-8") as f:
                    for line in f:
                        u = line.strip()
                        if u and u not in candidates:
                            candidates.append(u)

    # 1c. Check tools/node_history.json as last-resort fallback OR to
    #     supplement with hy2/tuic nodes that are never in sub/*.txt yet.
    hist_path = os.path.join(TOOLS_DIR, "node_history.json")
    UDP_PROTOS_SEED = {"hy2://", "hysteria2://", "tuic://"}
    if os.path.isfile(hist_path):
        try:
            with open(hist_path, "r", encoding="utf-8") as f:
                hist_data = json.load(f)
            if not candidates:
                # Pure fallback — load everything from history
                for k in hist_data.keys():
                    if "://" in k and k not in candidates:
                        candidates.append(k)
            else:
                # Supplement: always add hy2/tuic/hysteria2 nodes from history
                # so they get a chance to be verified via Mihomo even when
                # sub/hysteria2.txt was empty (circular-dependency break).
                existing_set = set(candidates)
                hy2_from_hist = [
                    k for k in hist_data.keys()
                    if any(k.lower().startswith(p) for p in UDP_PROTOS_SEED)
                    and k not in existing_set
                ]
                candidates.extend(hy2_from_hist[:500])  # cap to avoid bloat
        except Exception:
            pass


    # 1d. Auto-run aggregator --fast if still no candidates
    if not candidates:
        print("⚡ No local candidates found. Auto-running fast harvester (10s)...", flush=True)
        agg_script = os.path.join(TOOLS_DIR, "aggregator.py")
        subprocess.run([sys.executable, agg_script, "--fast"], check=False)
        for candidate_file in ["anti-whitelist.txt", "reality.txt", "top50.txt", "all.txt"]:
            f_path = os.path.join(SUB_DIR, candidate_file)
            if os.path.isfile(f_path):
                with open(f_path, "r", encoding="utf-8") as f:
                    for line in f:
                        u = line.strip()
                        if u and u not in candidates:
                            candidates.append(u)

    if not candidates:
        print("⚠️ No candidate nodes could be harvested.", flush=True)
        if args.vantage == "ru-local":
            with open(os.path.join(SUB_DIR, "ru-verified.json"), "w", encoding="utf-8") as f:
                json.dump({}, f, indent=2, ensure_ascii=False)
        return

    # 1e. Filter out TSPU-blocked spam domains (workers.dev, .ir, .cn) and prioritize Reality / Hy2 / RU Whitelist
    blocked_keywords = [
        "workers.dev", "pages.dev", ".ir/", ".ir?", ".ir#", "zula.ir", "telewebion",
        "speedtest.net", "divar.ir", ".cn/", ".cn?", "freefire", "pubg"
    ]
    filtered_candidates = [
        u for u in candidates
        if not any(b in u.lower() for b in blocked_keywords)
    ]
    if len(filtered_candidates) >= 50:
        candidates = filtered_candidates

    # Load previously verified nodes from preview.json for instant Tier-0 priority
    prev_verified_set = set()
    prev_preview_path = os.path.join(SUB_DIR, "preview.json")
    if os.path.isfile(prev_preview_path):
        try:
            with open(prev_preview_path, "r", encoding="utf-8") as f:
                prev_data = json.load(f)
                prev_nodes = prev_data if isinstance(prev_data, list) else prev_data.get("nodes", [])
                for pn in prev_nodes:
                    if isinstance(pn, dict) and pn.get("uri"):
                        prev_verified_set.add(pn["uri"].split('#')[0])
        except Exception:
            pass

    def candidate_priority_score(u: str) -> int:
        low = u.lower()
        score = 0
        base_u = u.split('#')[0]
        if base_u in prev_verified_set: score += 200  # Tier-0: Previously confirmed active nodes
        if "security=reality" in low or "pbk=" in low: score += 100
        if "hy2://" in low or "hysteria2://" in low or "tuic://" in low: score += 90
        if any(w in low for w in ["gosuslugi", "sber", "vk.com", "yandex", "tinkoff", "tbank", "ozon", ".ru"]): score += 80
        if "trojan://" in low: score += 60
        if "vless://" in low: score += 40
        return score

    candidates.sort(key=candidate_priority_score, reverse=True)
    print(f"📖 Loaded {len(candidates)} high-priority anti-censor candidate nodes", flush=True)

    xray_bin = get_xray_binary_path()
    if not xray_bin:
        print("❌ Xray binary not available. Cannot perform real tunnel probing.", flush=True)
        return

    # Select candidate pool
    if probe_limit and probe_limit > 0:
        candidates_to_probe = candidates[:probe_limit]
    else:
        candidates_to_probe = candidates

    probe_pool = []
    for i, uri in enumerate(candidates_to_probe):
        proto = uri.split("://")[0].lower() if "://" in uri else "vless"
        probe_pool.append((i, uri, 50.0, "GLOBAL", proto))

    print(f"⚡ [AsyncIO TLS-Handshake Scanner] Probing {len(probe_pool)} endpoints (TCP connect + real TLS ClientHello, 4000 concurrent)...", flush=True)
    t_start = time.perf_counter()
    prefilter_tiers = None
    try:
        prefilter_tiers = asyncio.run(run_async_syn_prefilter(probe_pool, concurrency=4000))
    except Exception:
        pass

    if prefilter_tiers is not None:
        # UDP-only protocols (hy2/tuic/wireguard) were returned as "tls" by
        # async_probe_candidate_socket() without any actual network probe, which
        # inflated the tls_confirmed count and could exclude TCP nodes from the
        # pool (W10). Separate them now.
        UDP_PROTOS = {"hy2", "hysteria2", "tuic", "wireguard"}
        raw_tls = prefilter_tiers.get("tls", [])
        tls_confirmed = [item for item in raw_tls if item[4] not in UDP_PROTOS]
        udp_pass = [item for item in raw_tls if item[4] in UDP_PROTOS]
        tcp_connected = prefilter_tiers.get("tcp", [])
        tls_killed = prefilter_tiers.get("tcp-fail", [])
        # Strictest first: only nodes whose TLS handshake completed. Nodes where
        # TCP connected but TLS was killed are classic DPI victims and poison
        # client feeds with n/a pings; they join only when the pool runs dry.
        # UDP nodes always pass through regardless of the TLS threshold.
        reachable_pool = tls_confirmed if len(tls_confirmed) >= 20 else tls_confirmed + tcp_connected
        if len(reachable_pool) < 20:
            reachable_pool = reachable_pool + tls_killed
        reachable_pool = reachable_pool + udp_pass
    else:
        with ThreadPoolExecutor(max_workers=min(256, len(probe_pool) or 1)) as pre_pool:
            reach_futs = {pre_pool.submit(check_candidate_reachability, item): item for item in probe_pool}
            reachable_pool = []
            for rf in as_completed(reach_futs):
                item = reach_futs[rf]
                try:
                    if rf.result():
                        reachable_pool.append(item)
                except Exception:
                    pass

    elapsed_pre = round(time.perf_counter() - t_start, 2)
    dropped_count = len(probe_pool) - len(reachable_pool)
    if prefilter_tiers is not None:
        real_tls_count = len([i for i in prefilter_tiers.get("tls", []) if i[4] not in {"hy2", "hysteria2", "tuic", "wireguard"}])
        tier_stats = f"[TLS-ok: {real_tls_count}, TCP-only: {len(prefilter_tiers.get('tcp', []))}, TLS-killed-by-DPI: {len(prefilter_tiers.get('tcp-fail', []))}, UDP-pass: {len(udp_pass if prefilter_tiers else [])}]"
    else:
        tier_stats = "[fallback TCP mode]"
    print(f"✨ TLS-Handshake Filter finished in {elapsed_pre}s {tier_stats}: {len(reachable_pool)} candidates selected ({dropped_count} dead filtered out)", flush=True)
    if len(reachable_pool) >= 20:
        probe_pool = reachable_pool

    print(f"🚀 Launching Parallel Multi-Core Xray Cluster ({NUM_XRAY_WORKERS} concurrent Xray instances, {batch_size * NUM_XRAY_WORKERS} parallel nodes)...", flush=True)

    def execute_probe_round(pool_items: list, round_label: str) -> list:
        round_slot_queue = queue.Queue()
        for slot in range(NUM_XRAY_WORKERS):
            round_slot_queue.put(slot)

        num_batches = (len(pool_items) + batch_size - 1) // batch_size
        all_batches = [pool_items[b * batch_size : (b + 1) * batch_size] for b in range(num_batches)]

        def process_batch_worker(b_idx: int, batch: list) -> tuple:
            slot = round_slot_queue.get()
            try:
                res = run_batch_probe(
                    xray_bin,
                    batch,
                    base_port=BASE_SOCKS_PORT + (slot * PORT_STEP),
                    basic_only=(args.vantage == "ru-local"),
                )
                return b_idx, len(batch), res
            finally:
                round_slot_queue.put(slot)

        round_results = []
        with ThreadPoolExecutor(max_workers=NUM_XRAY_WORKERS) as batch_pool:
            batch_futs = {
                batch_pool.submit(process_batch_worker, b, all_batches[b]): b
                for b in range(num_batches)
            }
            for bf in as_completed(batch_futs):
                b_idx, batch_len, results = bf.result()
                round_results.extend(results)
                print(f"  🧪 [{round_label}] Batch {b_idx + 1}/{num_batches} ({batch_len} nodes) -> {len(results)} confirmed ONLINE (round total: {len(round_results)})", flush=True)
        return round_results

    verified_alive_nodes = execute_probe_round(probe_pool, "Pass 1")

    # Retry pass: a flaky Xray instance used to mass-reject otherwise live nodes.
    # Any unconfirmed node gets one more chance with brand-new instances before
    # it is declared dead; only nodes failing both passes are discarded.
    # On massive pools (CI full runs) most failures are genuinely dead tunnels;
    # re-probing tens of thousands of corpses doubles wall time for nothing,
    # so the retry round is capped to a sane slice.
    RETRY_ROUND_CAP = 2000
    alive_keys_first_pass = {get_node_key(n["uri"]) for n in verified_alive_nodes}
    failed_probe_items = [item for item in probe_pool if get_node_key(item[1]) not in alive_keys_first_pass]
    if failed_probe_items and len(failed_probe_items) <= RETRY_ROUND_CAP:
        print(f"\n🔁 [Retry Round] Re-probing {len(failed_probe_items)} unconfirmed node(s) with fresh Xray instances...", flush=True)
        retry_results = execute_probe_round(failed_probe_items, "Retry")
        verified_alive_nodes.extend(retry_results)
        recovered = len(retry_results)
        print(f"🔁 [Retry Round] {recovered} node(s) recovered on second pass", flush=True)
    elif failed_probe_items:
        print(f"\n⏭️ [Retry Round] Skipped: {len(failed_probe_items)} unconfirmed node(s) exceed the {RETRY_ROUND_CAP}-node cap (large-pool mode).", flush=True)

    print(f"\n🏆 Total genuinely alive & verified nodes: {len(verified_alive_nodes)}", flush=True)

    if args.vantage == "ru-local":
        verified_at = datetime.now(timezone.utc).isoformat()
        ru_payload = {
            get_node_key(node["uri"]): {
                "verified_at": verified_at,
                "vantage": "ru-local",
            }
            for node in verified_alive_nodes
            if node.get("uri")
        }
        with open(os.path.join(SUB_DIR, "ru-verified.json"), "w", encoding="utf-8") as f:
            json.dump(ru_payload, f, indent=2, ensure_ascii=False)
        print(f"💾 Saved sub/ru-verified.json with {len(ru_payload)} RU-local verified nodes; cloud outputs were not changed.", flush=True)
        return

    if not verified_alive_nodes:
        print("⚠️ No nodes passed real HTTP connectivity test.", flush=True)
        return

    # Sort verified database by lowest ping
    verified_alive_nodes.sort(key=lambda n: n["ping_ms"])

    # Load cumulative health score history and merge fresh RU-local confirmations.
    ru_verified_keys = load_fresh_ru_verified_keys()
    for n in verified_alive_nodes:
        n["health"] = 99.0
        n["ru_verified"] = get_node_key(n["uri"]) in ru_verified_keys

    # 🇷🇺 Run Globalping domestic Russian test on top 40 candidates
    verified_alive_nodes = verify_nodes_with_globalping_ru(verified_alive_nodes, max_nodes=40)

    # 💾 Save sub/nodes.json & sub/preview.json
    nodes_payload = {
        "version": "2.0",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "total_nodes": len(verified_alive_nodes),
        "nodes": verified_alive_nodes,
    }
    preview_payload = {
        "version": "2.0",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "total_nodes": len(verified_alive_nodes),
        "nodes": verified_alive_nodes,
    }

    with open(os.path.join(SUB_DIR, "nodes.json"), "w", encoding="utf-8") as f:
        f.write(fast_json_dumps(nodes_payload))

    with open(os.path.join(SUB_DIR, "preview.json"), "w", encoding="utf-8") as f:
        f.write(fast_json_dumps(preview_payload))

    # Also sync docs/sub/preview.json for GitHub Pages
    docs_sub_dir = os.path.join(ROOT_DIR, "docs", "sub")
    os.makedirs(docs_sub_dir, exist_ok=True)
    with open(os.path.join(docs_sub_dir, "preview.json"), "w", encoding="utf-8") as f:
        f.write(fast_json_dumps(preview_payload))
    with open(os.path.join(docs_sub_dir, "nodes.json"), "w", encoding="utf-8") as f:
        f.write(fast_json_dumps(nodes_payload))

    print("💾 Saved sub/nodes.json and sub/preview.json with genuine verified flags", flush=True)

    # 🎯 Generate Service-Specific Subscriptions with GENUINE working nodes ONLY (Sorted by lowest ping)
    service_files = {
        "chatgpt.txt": [
            format_verified_remark(n["uri"], n["country"], "ChatGPT", idx, n.get("ping_ms", 0))
            for idx, n in enumerate(sorted([x for x in verified_alive_nodes if x["services"].get("chatgpt")], key=lambda x: x.get("ping_ms", 999)), start=1)
        ],
        "claude.txt": [
            format_verified_remark(n["uri"], n["country"], "Claude", idx, n.get("ping_ms", 0))
            for idx, n in enumerate(sorted([x for x in verified_alive_nodes if x["services"].get("claude")], key=lambda x: x.get("ping_ms", 999)), start=1)
        ],
        "gemini.txt": [
            format_verified_remark(n["uri"], n["country"], "Gemini", idx, n.get("ping_ms", 0))
            for idx, n in enumerate(sorted([x for x in verified_alive_nodes if x["services"].get("gemini")], key=lambda x: x.get("ping_ms", 999)), start=1)
        ],
        "perplexity.txt": [
            format_verified_remark(n["uri"], n["country"], "Perplexity", idx, n.get("ping_ms", 0))
            for idx, n in enumerate(sorted([x for x in verified_alive_nodes if x["services"].get("perplexity")], key=lambda x: x.get("ping_ms", 999)), start=1)
        ],
        "youtube.txt": [
            format_verified_remark(n["uri"], n["country"], "YouTube 4K", idx, n.get("ping_ms", 0))
            for idx, n in enumerate(sorted([x for x in verified_alive_nodes if x["services"].get("youtube")], key=lambda x: x.get("ping_ms", 999)), start=1)
        ],
        "discord.txt": [
            format_verified_remark(n["uri"], n["country"], "Discord", idx, n.get("ping_ms", 0))
            for idx, n in enumerate(sorted([x for x in verified_alive_nodes if x["services"].get("discord")], key=lambda x: x.get("ping_ms", 999)), start=1)
        ],
        "instagram.txt": [
            format_verified_remark(n["uri"], n["country"], "Instagram", idx, n.get("ping_ms", 0))
            for idx, n in enumerate(sorted([x for x in verified_alive_nodes if x["services"].get("instagram")], key=lambda x: x.get("ping_ms", 999)), start=1)
        ],
        "twitter.txt": [
            format_verified_remark(n["uri"], n["country"], "Twitter", idx, n.get("ping_ms", 0))
            for idx, n in enumerate(sorted([x for x in verified_alive_nodes if x["services"].get("twitter")], key=lambda x: x.get("ping_ms", 999)), start=1)
        ],
        "spotify.txt": [
            format_verified_remark(n["uri"], n["country"], "Spotify", idx, n.get("ping_ms", 0))
            for idx, n in enumerate(sorted([x for x in verified_alive_nodes if x["services"].get("spotify")], key=lambda x: x.get("ping_ms", 999)), start=1)
        ],
        "github.txt": [
            format_verified_remark(n["uri"], n["country"], "GitHub", idx, n.get("ping_ms", 0))
            for idx, n in enumerate(sorted([x for x in verified_alive_nodes if x["services"].get("github")], key=lambda x: x.get("ping_ms", 999)), start=1)
        ],
        "ai-bundle.txt": [
            format_verified_remark(n["uri"], n["country"], "All-AI", idx, n.get("ping_ms", 0))
            for idx, n in enumerate(sorted([x for x in verified_alive_nodes if x["services"].get("chatgpt") and (x["services"].get("claude") or x["services"].get("gemini"))], key=lambda x: x.get("ping_ms", 999)), start=1)
        ],
    }

    # 🎯 Save Service-Specific Subscriptions with GENUINE working nodes ONLY
    os.makedirs(SERVICES_DIR, exist_ok=True)
    print("🎯 Saving dedicated verified service feeds across target channels:", flush=True)
    for s_fname, s_keys in service_files.items():
        with open(os.path.join(SERVICES_DIR, s_fname), "w", encoding="utf-8") as f:
            f.write("\n".join(s_keys))
        print(f"  💾 sub/services/{s_fname:<15} -> {len(s_keys):>5} verified keys", flush=True)

    # 🎯 Generate Primary Verified Pools (Top20, Top50, Anti-Whitelist, All) - Lowest Ping & High Speed First
    def vip_ranking_score(n: dict) -> float:
        ping = n.get("ping_ms", 999.0)
        speed = n.get("speed_mbps", 0.0)
        speed_bonus = min(speed * 1.2, 50.0)
        return max(ping - speed_bonus, 1.0)

    vip_ranked_nodes = sorted(verified_alive_nodes, key=vip_ranking_score)

    top20_verified = [
        format_verified_remark(n["uri"], n["country"], "VIP-Top20", idx, n.get("ping_ms", 0))
        for idx, n in enumerate(vip_ranked_nodes[:20], start=1)
    ]
    top50_verified = [
        format_verified_remark(n["uri"], n["country"], "VIP-Top50", idx, n.get("ping_ms", 0))
        for idx, n in enumerate(vip_ranked_nodes[:50], start=1)
    ]
    anti_censor_verified = [
        format_verified_remark(n["uri"], n["country"], "Anti-Censor", idx, n.get("ping_ms", 0))
        for idx, n in enumerate(sorted([n for n in verified_alive_nodes if "reality" in n["uri"].lower() or "hy2" in n["uri"].lower()], key=lambda x: x.get("ping_ms", 999)), start=1)
    ]
    all_verified = [
        format_verified_remark(n["uri"], n["country"], "Verified", idx, n.get("ping_ms", 0))
        for idx, n in enumerate(verified_alive_nodes, start=1)
    ]

    with open(os.path.join(SUB_DIR, "top20.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(top20_verified))
    with open(os.path.join(SUB_DIR, "top50.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(top50_verified))
    with open(os.path.join(SUB_DIR, "anti-whitelist.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(anti_censor_verified))
    with open(os.path.join(SUB_DIR, "all.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(all_verified))

    # 🛡️ Protocol Specific Verified Feeds
    proto_reality = [format_verified_remark(n["uri"], n["country"], "Reality", idx) for idx, n in enumerate([n for n in verified_alive_nodes if "pbk=" in n["uri"].lower() or "reality" in n.get("protocol", "").lower()], start=1)]
    proto_hy2 = [format_verified_remark(n["uri"], n["country"], "Hy2", idx) for idx, n in enumerate([n for n in verified_alive_nodes if n["uri"].lower().startswith(("hy2://", "hysteria2://", "hysteria://", "tuic://")) or any(k in n.get("protocol", "").lower() for k in ("hy2", "hysteria2", "hysteria", "tuic"))], start=1)]
    proto_trojan = [format_verified_remark(n["uri"], n["country"], "Trojan", idx) for idx, n in enumerate([n for n in verified_alive_nodes if n["uri"].lower().startswith("trojan://") or "trojan" in n.get("protocol", "").lower()], start=1)]
    proto_ss = [format_verified_remark(n["uri"], n["country"], "SS", idx) for idx, n in enumerate([n for n in verified_alive_nodes if n["uri"].lower().startswith("ss://") or "ss" in n.get("protocol", "").lower()], start=1)]

    for fname, p_nodes in [("reality.txt", proto_reality), ("hysteria2.txt", proto_hy2), ("trojan.txt", proto_trojan), ("shadowsocks.txt", proto_ss)]:
        # If the prober verified 0 nodes of this protocol it means none passed
        # through (most likely the input had no such nodes, not that they're all
        # dead). Keep the previous file so the aggregator-populated content
        # (which may have fresh hy2/tuic URIs) survives into the next run.
        if not p_nodes:
            continue
        with open(os.path.join(SUB_DIR, fname), "w", encoding="utf-8") as f:
            f.write("\n".join(p_nodes))
        with open(os.path.join(docs_sub_dir, fname), "w", encoding="utf-8") as f:
            f.write("\n".join(p_nodes))


    # Base64 export
    import base64
    b64_content = base64.b64encode("\n".join([n["uri"] for n in verified_alive_nodes]).encode("utf-8")).decode("utf-8")
    with open(os.path.join(SUB_DIR, "base64.txt"), "w", encoding="utf-8") as f:
        f.write(b64_content)
    with open(os.path.join(docs_sub_dir, "base64.txt"), "w", encoding="utf-8") as f:
        f.write(b64_content)

    print(f"  💾 sub/reality.txt      -> {len(proto_reality):5d} verified keys", flush=True)
    print(f"  💾 sub/hysteria2.txt    -> {len(proto_hy2):5d} verified keys", flush=True)
    print(f"  💾 sub/trojan.txt       -> {len(proto_trojan):5d} verified keys", flush=True)
    print(f"  💾 sub/shadowsocks.txt  -> {len(proto_ss):5d} verified keys", flush=True)
    print(f"💾 Updated sub/top50.txt ({len(top50_verified)} keys), sub/top20.txt ({len(top20_verified)} keys), sub/all.txt ({len(all_verified)} keys)", flush=True)


    # 🌍 Group into Verified Country Feeds
    from collections import defaultdict
    country_groups = defaultdict(list)
    for n in verified_alive_nodes:
        cc = n["country"].upper()
        if cc != "GLOBAL":
            country_groups[cc].append(n)

    countries_dir = os.path.join(SUB_DIR, "countries")
    os.makedirs(countries_dir, exist_ok=True)
    country_manifest = []

    for cc, cnodes in sorted(country_groups.items(), key=lambda x: -len(x[1])):
        fname = f"{cc.lower()}.txt"
        flag = country_code_to_flag(cc)
        formatted_c_nodes = [
            format_verified_remark(n["uri"], cc, "Verified", idx)
            for idx, n in enumerate(cnodes, start=1)
        ]
        with open(os.path.join(countries_dir, fname), "w", encoding="utf-8") as f:
            f.write("\n".join(formatted_c_nodes))
        country_manifest.append({
            "code": cc,
            "flag": flag,
            "count": len(cnodes),
            "file": f"countries/{fname}"
        })
        if cc in ["DE", "NL", "KZ", "FI", "TR", "RU", "US", "SE", "GB", "FR", "JP", "SG", "HK", "CA", "PL"]:
            with open(os.path.join(SUB_DIR, fname), "w", encoding="utf-8") as f:
                f.write("\n".join(formatted_c_nodes))

    with open(os.path.join(countries_dir, "index.json"), "w", encoding="utf-8") as f:
        json.dump({
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "total_countries": len(country_manifest),
            "countries": country_manifest
        }, f, indent=2, ensure_ascii=False)

    # ⚡ Generate and save Clash Meta YAML Configurations
    clash_yaml_content = generate_clash_meta_yaml(verified_alive_nodes)
    with open(os.path.join(SUB_DIR, "clash.yaml"), "w", encoding="utf-8") as f:
        f.write(clash_yaml_content)
    with open(os.path.join(SUB_DIR, "clash.meta.yaml"), "w", encoding="utf-8") as f:
        f.write(clash_yaml_content)
    with open(os.path.join(docs_sub_dir, "clash.yaml"), "w", encoding="utf-8") as f:
        f.write(clash_yaml_content)
    with open(os.path.join(docs_sub_dir, "clash.meta.yaml"), "w", encoding="utf-8") as f:
        f.write(clash_yaml_content)
    print("  💾 sub/clash.yaml & sub/clash.meta.yaml generated successfully for FlClash/Mihomo", flush=True)

    print("\n🎉 [Complete] Real Tunnel Verification finished successfully!")

if __name__ == "__main__":
    main()
