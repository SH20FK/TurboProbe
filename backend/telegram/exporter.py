#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
📦 TurboProbe TGProxy - Exporter
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

    now_str = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
    mtproto_count = sum(1 for p in proxies if p.proto == "mtproto")
    socks_count = sum(1 for p in proxies if p.proto == "socks5")
    ru_count = sum(1 for p in proxies if p.ru_verified)

    data = {
        "updated_at": now_str,
        "total": len(proxies),
        "total_mtproto": mtproto_count,
        "total_socks5": socks_count,
        "total_ru_verified": ru_count,
        "proxies": [p.to_dict() for p in proxies],
    }

    with open(os.path.join(SUB_TG_DIR, "proxies.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    with open(os.path.join(DOCS_TG_DIR, "proxies.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    mtproto_links = [p.tg_link for p in proxies if p.proto == "mtproto"]
    with open(os.path.join(SUB_TG_DIR, "mtproto.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(mtproto_links) + "\n")

    socks5_links = [p.tg_link for p in proxies if p.proto == "socks5"]
    with open(os.path.join(SUB_TG_DIR, "socks5.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(socks5_links) + "\n")

    top20_links = [p.tg_link for p in proxies[:20]]
    with open(os.path.join(SUB_TG_DIR, "top20.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(top20_links) + "\n")

    print(f"✅ Export complete! Saved {len(proxies)} proxies to sub/tg/ & docs/tg/")
