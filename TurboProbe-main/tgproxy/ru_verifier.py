#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🇷🇺 TurboProbe TGProxy - Russian Vantage Verifier (Zero Cost via Globalping API)
Validates MTProto and SOCKS5 proxies directly from Russian probes (Rostelecom, MTS, MegaFon, Beeline).
"""

import asyncio
import json
import os
import sys
import time
from typing import Dict, List, Optional
import aiohttp

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

GLOBALPING_API_URL = "https://api.globalping.io/v1/measurements"

# Target Russian Autonomous Systems for ISP accessibility badges
ISP_ASN_MAP = {
    12389: "rtk",     # PJSC Rostelecom
    8359: "mts",       # MTS PJSC
    31133: "mf",       # MegaFon
    16345: "beeline",  # VEON / VimpelCom (Beeline)
    25513: "selectel", # Selectel
    208722: "vk",      # VK Cloud
}


async def verify_batch_globalping(proxies: list, max_nodes: int = 40) -> list:
    """Tests a batch of proxies from Russian probes for 100% free ISP validation."""
    if not proxies:
        return proxies

    candidates = proxies[:max_nodes]
    print(f"🇷🇺 [Globalping RU Gate] Testing {len(candidates)} proxies from Russian probes...", flush=True)

    headers = {
        "User-Agent": "TurboProbe-TGProxy-Vantage/1.0",
        "Content-Type": "application/json",
    }

    async with aiohttp.ClientSession(headers=headers) as session:
        for idx, p in enumerate(candidates):
            # Measurement definition: TCP connect from Russia
            payload = {
                "type": "tcp",
                "target": p.server,
                "measurementOptions": {
                    "port": p.port,
                },
                "locations": [
                    {"country": "RU", "limit": 4}
                ],
                "limit": 4
            }

            try:
                async with session.post(GLOBALPING_API_URL, json=payload, timeout=5.0) as resp:
                    if resp.status == 201:
                        data = await resp.json()
                        m_id = data.get("id")
                        if m_id:
                            # Poll result
                            for _ in range(5):
                                await asyncio.sleep(1.2)
                                async with session.get(f"{GLOBALPING_API_URL}/{m_id}", timeout=5.0) as r_resp:
                                    if r_resp.status == 200:
                                        r_data = await r_resp.json()
                                        if r_data.get("status") in ("finished", "completed"):
                                            results = r_data.get("results", [])
                                            for res in results:
                                                probe = res.get("probe", {})
                                                asn = probe.get("asn", 0)
                                                result = res.get("result", {})
                                                status = result.get("status")
                                                
                                                if status in ("finished", "success") or result.get("response", {}).get("raw"):
                                                    p.ru_verified = True
                                                    isp_name = ISP_ASN_MAP.get(asn)
                                                    if isp_name and isp_name in p.isp_status:
                                                        p.isp_status[isp_name] = True
                                            break
            except Exception:
                pass

    ru_passed = sum(1 for p in proxies if p.ru_verified)
    print(f"✨ [Globalping RU Gate] Verification complete: {ru_passed}/{len(candidates)} confirmed accessible from Russia!", flush=True)
    return proxies
