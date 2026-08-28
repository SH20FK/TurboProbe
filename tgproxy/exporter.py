#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
📦 TurboProbe TGProxy - Subscriptions & Data Exporter
"""

import json
import os
import sys
import time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

SUB_TG_DIR = os.path.join("sub", "tg")
DOCS_TG_DIR = os.path.join("docs", "tg")
os.makedirs(SUB_TG_DIR, exist_ok=True)
os.makedirs(DOCS_TG_DIR, exist_ok=True)


def export_all(proxies: list):
    print(f"📁 [TGProxy Exporter] Exporting {len(proxies)} verified proxies...", flush=True)

    # 1. JSON Feed for Web App
    now_str = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
    data = {
        "updated_at": now_str,
        "total": len(proxies),
        "total_mtproto": sum(1 for p in proxies if p.proto == "mtproto"),
        "total_socks5": sum(1 for p in proxies if p.proto == "socks5"),
        "total_ru_verified": sum(1 for p in proxies if p.ru_verified),
        "proxies": [p.to_dict() for p in proxies],
    }

    with open(os.path.join(SUB_TG_DIR, "proxies.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    with open(os.path.join(DOCS_TG_DIR, "proxies.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # 2. MTProto Links
    mtproto_links = [p.tg_link for p in proxies if p.proto == "mtproto"]
    with open(os.path.join(SUB_TG_DIR, "mtproto.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(mtproto_links) + "\n")

    # 3. SOCKS5 Links
    socks5_links = [p.tg_link for p in proxies if p.proto == "socks5"]
    with open(os.path.join(SUB_TG_DIR, "socks5.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(socks5_links) + "\n")

    # 4. Top 20 Fastest
    top20_links = [p.tg_link for p in proxies[:20]]
    with open(os.path.join(SUB_TG_DIR, "top20.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(top20_links) + "\n")

    # 5. HTTPS Web Links (for sharing in chats)
    https_links = [p.https_link for p in proxies[:50]]
    with open(os.path.join(SUB_TG_DIR, "share_links.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(https_links) + "\n")

    print(f"✅ Export complete! Saved to sub/tg/ & docs/tg/")
