#!/usr/bin/env python3
"""
TurboProbe 4-Tier E2E Test Suite - Tier 4: Real-World Workload Scenarios
Covers:
- S1: Full End-to-End Pipeline Execution (Mock Sources -> Ingest -> Deduplicate -> Feeds)
- S2: Multi-Worker Prober Concurrency Stress Simulation
- S3: Multi-Client Subscription Distribution Simulation (Clash, Mobile, Web, AI)
- S4: Upstream Mirror Outage & Failure Recovery Simulation
"""

import os
import sys
import json
import base64
import socket
import unittest
from unittest.mock import patch, MagicMock
from concurrent.futures import ThreadPoolExecutor

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_DIR = os.path.join(PROJECT_ROOT, "tools")
if TOOLS_DIR not in sys.path:
    sys.path.insert(0, TOOLS_DIR)

import aggregator
import service_prober


class TestTier4RealWorldScenarios(unittest.TestCase):
    """Tier 4: Realistic End-to-End System Simulations and Disaster Recovery"""

    def test_s1_full_pipeline_ingestion_and_feed_generation(self):
        """S1: Full Pipeline Simulation: Mock Multi-Protocol Sources -> Ingest -> Filter -> Feeds"""
        # 1. Prepare realistic raw sources (Telegram, Base64 sub, Clash YAML)
        telegram_snippet = (
            '<div class="tgme_widget_message_text">'
            'vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@198.51.100.1:443?security=reality&sni=de1.domain.com&pbk=abcd#TurboProbe · 🇩🇪 DE · Reality #01'
            '</div>'
        )
        base64_payload = base64.b64encode(
            (
                "trojan://pass1@198.51.100.2:443?security=tls&sni=nl1.domain.com#TurboProbe · 🇳🇱 NL · Trojan #02\n"
                "hysteria2://auth1@198.51.100.3:443?sni=kz1.domain.com#TurboProbe · 🇰🇿 KZ · Hy2-Speed #03\n"
            ).encode("utf-8")
        ).decode()
        
        # 2. Extract URIs across sources
        uris_tg = aggregator.extract_uris_from_content(telegram_snippet)
        uris_b64 = aggregator.extract_uris_from_content(base64_payload)
        
        all_extracted = uris_tg + uris_b64
        self.assertGreaterEqual(len(all_extracted), 3)

        # 3. Deduplicate
        deduped = {}
        for u in all_extracted:
            k = aggregator.get_node_key(u)
            if k not in deduped:
                deduped[k] = u

        # 4. Measure simulated latency
        alive_nodes = []
        for idx, (k, u) in enumerate(deduped.items()):
            cc = aggregator.detect_country_code(u)
            alive_nodes.append({
                "uri": u,
                "ping_ms": 20.0 + idx * 15.0,
                "country": cc,
                "health": 100.0,
                "services": {"chatgpt": True, "youtube": True}
            })

        # 5. Ascending sort
        alive_nodes.sort(key=lambda x: x["ping_ms"])
        self.assertEqual(len(alive_nodes), 3)
        self.assertLessEqual(alive_nodes[0]["ping_ms"], alive_nodes[1]["ping_ms"])

        # 6. Verify feeds generation
        preview_payload = {
            "version": "2.0",
            "total_nodes": len(alive_nodes),
            "nodes": alive_nodes
        }
        json_str = json.dumps(preview_payload)
        self.assertIn("total_nodes", json_str)
        self.assertIn("198.51.100.1", json_str)

    def test_s2_multi_worker_socket_concurrency_stress(self):
        """S2: Stress Test: 50 concurrent simulated proxy sockets and clean worker teardown"""
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.bind(('127.0.0.1', 0))
        server.listen(100)
        port = server.getsockname()[1]

        def simulated_probe(idx):
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.5)
            try:
                s.connect(('127.0.0.1', port))
                return True
            except Exception:
                return False
            finally:
                s.close()

        try:
            with ThreadPoolExecutor(max_workers=25) as executor:
                results = list(executor.map(simulated_probe, range(50)))
            self.assertEqual(len(results), 50)
            self.assertTrue(all(results))
        finally:
            server.close()

    def test_s3_multi_client_subscription_distribution(self):
        """S3: Client Subscription Distribution Simulation for Clash, Mobile, and Web"""
        nodes = [
            {
                "uri": "vless://uuid1@198.51.100.1:443?security=reality&pbk=abcd#DE-01",
                "protocol": "vless",
                "country": "DE",
                "ping_ms": 25.0,
                "services": {"chatgpt": True, "youtube": True}
            },
            {
                "uri": "trojan://pass2@198.51.100.2:443?security=tls#NL-02",
                "protocol": "trojan",
                "country": "NL",
                "ping_ms": 40.0,
                "services": {"youtube": True}
            }
        ]

        # Client 1: Mobile (requests plain text list)
        plain_text_sub = "\n".join(n["uri"] for n in nodes)
        self.assertIn("vless://", plain_text_sub)
        self.assertIn("trojan://", plain_text_sub)

        # Client 2: Clash Meta Client (generates Clash YAML)
        clash_yaml = service_prober.generate_clash_meta_yaml(nodes)
        self.assertIn("proxies:", clash_yaml)
        self.assertIn("proxy-groups:", clash_yaml)

        # Client 3: Web Visualization Frontend (JSON preview)
        web_preview = json.dumps({"total_nodes": len(nodes), "nodes": nodes})
        self.assertIn('"country": "DE"', web_preview)
        self.assertIn('"chatgpt": true', web_preview)

    def test_s4_upstream_failure_resilience(self):
        """S4: Upstream Source & API Outage Recovery: Handles network failure gracefully"""
        # Test 1: Fetching unavailable source URL returns empty string without crashing
        bad_url = "https://127.0.0.1:59997/nonexistent_feed.txt"
        content = aggregator.fetch_url(bad_url, timeout=1)
        self.assertEqual(content, "")

        # Test 2: Ingestion of empty or corrupt feed returns empty list without error
        uris = aggregator.extract_uris_from_content("corrupted_content_without_uris_$$$@@@")
        self.assertEqual(uris, [])


if __name__ == "__main__":
    unittest.main()
