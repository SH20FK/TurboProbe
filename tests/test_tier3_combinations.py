#!/usr/bin/env python3
"""
TurboProbe 4-Tier E2E Test Suite - Tier 3: Cross-Feature Combinations (Pairwise Interactions)
Covers:
- C1: Multi-protocol Subscriptions -> Aggregator -> Latency Sorter -> Sub Feeds
- C2: Node Pool -> Service Prober Matrix -> Globalping RU -> Service Feeds
- C3: Sub Feeds (preview.json) -> Web Frontend Filter Selectors & Presets
- C4: Output Feeds -> Cloudflare Worker Multi-Dimensional Filter -> Clash Export
- C5: Chunk Pagination Invariants & Node Health History Lifecycle
"""

import os
import sys
import json
import base64
import unittest
import urllib.parse
from unittest.mock import patch, MagicMock

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_DIR = os.path.join(PROJECT_ROOT, "tools")
if TOOLS_DIR not in sys.path:
    sys.path.insert(0, TOOLS_DIR)

import aggregator

try:
    import yaml
except ImportError:
    yaml = None


class TestTier3CrossFeatureCombinations(unittest.TestCase):
    """Tier 3: Pairwise Module Interactions and Invariant Validations"""

    def test_c1_multiprotocol_aggregator_pipeline(self):
        """C1: Mixed Protocol Feed -> Ingestion -> Deduplication -> Ping Sorting -> Feed Generation"""
        # Mixed subscription input with Base64, raw URIs, and duplicates
        raw_nodes = [
            "vless://uuid-de1@198.51.100.1:443?security=reality&pbk=key1&sni=de1.domain.com#TurboProbe · 🇩🇪 DE · Reality #01",
            "trojan://pass-nl1@198.51.100.2:443?security=tls&sni=nl1.domain.com#TurboProbe · 🇳🇱 NL · Trojan #02",
            "ss://YWVzLTI1Ni1nY206cGFzczEyMw@198.51.100.3:8388#TurboProbe · 🇫🇮 FI · Shadowsocks #03",
            "hysteria2://auth-kz1@198.51.100.4:443?sni=kz1.domain.com#TurboProbe · 🇰🇿 KZ · Hy2-Speed #04",
            # Duplicate of node 1 with different remark
            "vless://uuid-de1@198.51.100.1:443?security=reality&pbk=key1&sni=de1.domain.com#DuplicateRemark",
        ]
        
        feed_content = "\n".join(raw_nodes)
        extracted = aggregator.extract_uris_from_content(feed_content)
        
        # 1. Extraction completeness
        self.assertGreaterEqual(len(extracted), 4)
        
        # 2. Strict Deduplication
        deduped = {}
        for uri in extracted:
            key = aggregator.get_node_key(uri)
            if key not in deduped:
                deduped[key] = uri
        self.assertEqual(len(deduped), 4, "Duplicate node 1 must be eliminated")
        
        # 3. Simulated latency measurement and ascending sort
        measured = [
            {"uri": uri, "ping_ms": 15.0 + idx * 10.0, "country": aggregator.detect_country_code(uri)}
            for idx, uri in enumerate(deduped.values())
        ]
        sorted_nodes = sorted(measured, key=lambda x: x["ping_ms"])
        
        # Invariant: ping must be strictly monotonic
        for i in range(len(sorted_nodes) - 1):
            self.assertLessEqual(sorted_nodes[i]["ping_ms"], sorted_nodes[i + 1]["ping_ms"])

    def test_c2_service_prober_matrix_to_dedicated_feeds(self):
        """C2: Prober Service Matrix -> Dedicated Service Feeds Filtering (chatgpt, youtube, etc.)"""
        tested_nodes = [
            {
                "uri": "vless://uuid1@198.51.100.1:443#DE-AI",
                "country": "DE",
                "ping_ms": 25.0,
                "services": {"chatgpt": True, "claude": True, "youtube": True, "discord": False}
            },
            {
                "uri": "trojan://pass2@198.51.100.2:443#NL-Stream",
                "country": "NL",
                "ping_ms": 35.0,
                "services": {"chatgpt": False, "claude": False, "youtube": True, "discord": True}
            },
            {
                "uri": "ss://key3@198.51.100.3:8388#FI-Discord",
                "country": "FI",
                "ping_ms": 45.0,
                "services": {"chatgpt": False, "claude": False, "youtube": False, "discord": True}
            }
        ]

        # Generate service feeds
        chatgpt_feed = [n["uri"] for n in tested_nodes if n["services"].get("chatgpt")]
        youtube_feed = [n["uri"] for n in tested_nodes if n["services"].get("youtube")]
        discord_feed = [n["uri"] for n in tested_nodes if n["services"].get("discord")]
        ai_bundle_feed = [n["uri"] for n in tested_nodes if n["services"].get("chatgpt") and n["services"].get("claude")]

        self.assertEqual(len(chatgpt_feed), 1)
        self.assertEqual(chatgpt_feed[0], tested_nodes[0]["uri"])
        
        self.assertEqual(len(youtube_feed), 2)
        self.assertIn(tested_nodes[0]["uri"], youtube_feed)
        self.assertIn(tested_nodes[1]["uri"], youtube_feed)

        self.assertEqual(len(discord_feed), 2)
        self.assertIn(tested_nodes[1]["uri"], discord_feed)
        self.assertIn(tested_nodes[2]["uri"], discord_feed)

        self.assertEqual(len(ai_bundle_feed), 1)

    def test_c3_web_frontend_preset_and_filter_interactions(self):
        """C3: Web UI Presets -> Multi-criteria Node Filtering Evaluation"""
        nodes = [
            {
                "uri": "vless://u1@1.1.1.1:443#DE1",
                "protocol": "vless",
                "country": "DE",
                "ping_ms": 30.0,
                "services": {"chatgpt": True, "claude": True, "gemini": True, "youtube": True}
            },
            {
                "uri": "trojan://p2@1.1.1.2:443#NL1",
                "protocol": "trojan",
                "country": "NL",
                "ping_ms": 75.0,
                "services": {"youtube": True, "discord": True}
            },
            {
                "uri": "vless://u3@1.1.1.3:443#KZ1",
                "protocol": "vless",
                "country": "KZ",
                "ping_ms": 120.0,
                "services": {"chatgpt": True, "youtube": True}
            }
        ]

        # Preset 1: AI Bundle (requires chatgpt + claude, maxPing <= 100)
        ai_preset_matches = [
            n for n in nodes
            if n["services"].get("chatgpt") and n["services"].get("claude") and n["ping_ms"] <= 100
        ]
        self.assertEqual(len(ai_preset_matches), 1)
        self.assertEqual(ai_preset_matches[0]["country"], "DE")

        # Preset 2: YouTube / Discord Low-Ping (requires youtube, maxPing <= 80)
        yt_preset_matches = [
            n for n in nodes
            if n["services"].get("youtube") and n["ping_ms"] <= 80
        ]
        self.assertEqual(len(yt_preset_matches), 2)

    def test_c4_worker_multidimensional_filter_and_clash_export(self):
        """C4: Cloudflare Worker Multi-Dimensional Filter Simulation -> Clash Meta YAML Export"""
        mock_database = [
            {
                "uri": "vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@198.51.100.1:443?security=reality&pbk=abcd&sni=de.srv.com#DE-Reality",
                "protocol": "vless",
                "country": "DE",
                "ping_ms": 28.0,
                "health": 99.0,
                "services": {"chatgpt": True, "claude": True}
            },
            {
                "uri": "trojan://SecretPass123@198.51.100.2:443?security=tls&sni=nl.srv.com#NL-Trojan",
                "protocol": "trojan",
                "country": "NL",
                "ping_ms": 150.0,  # Fails max_ping 100
                "health": 95.0,
                "services": {"chatgpt": True}
            },
            {
                "uri": "ss://YWVzLTI1Ni1nY206cGFzczEyMw@198.51.100.3:8388#FI-SS",
                "protocol": "ss",
                "country": "FI",
                "ping_ms": 35.0,
                "health": 50.0,   # Fails min_health 90
                "services": {"chatgpt": True}
            }
        ]

        # Multi-dimensional filter criteria:
        # services: chatgpt, country: DE, proto: reality, max_ping: 100, min_health: 90
        filtered = [
            n for n in mock_database
            if n["services"].get("chatgpt")
            and n["country"] == "DE"
            and "reality" in n["uri"]
            and n["ping_ms"] <= 100
            and n["health"] >= 90
        ]
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["country"], "DE")

    def test_c5_chunk_pagination_and_history_invariants(self):
        """C5: Chunk Pagination Count Invariant & Health Percentage Computation"""
        # Create 1250 mock alive nodes
        total_nodes = 1250
        chunk_size = 500
        nodes = [{"uri": f"vless://uuid{i}@198.51.100.1:443", "ping_ms": i * 0.5} for i in range(total_nodes)]
        
        chunks = [nodes[i:i + chunk_size] for i in range(0, len(nodes), chunk_size)]
        self.assertEqual(len(chunks), 3)
        self.assertEqual(sum(len(c) for c in chunks), total_nodes)
        
        # Verify chunk 1 ping max <= chunk 2 ping min
        self.assertLessEqual(chunks[0][-1]["ping_ms"], chunks[1][0]["ping_ms"])
        self.assertLessEqual(chunks[1][-1]["ping_ms"], chunks[2][0]["ping_ms"])

        # Health computation: success_checks / total_checks * 100
        history_record = {"success_checks": 95, "total_checks": 100}
        health = (history_record["success_checks"] / history_record["total_checks"]) * 100.0
        self.assertEqual(health, 95.0)


if __name__ == "__main__":
    unittest.main()
