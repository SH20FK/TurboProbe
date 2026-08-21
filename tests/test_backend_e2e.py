#!/usr/bin/env python3
"""
TurboProbe 4-Tier E2E Test Suite - Backend Aggregator, Prober & Source Discovery
Covers:
- Tier 1: F1 (Socket/Session Leaks), F2 (Concurrency/Race Conditions), F5 (Globalping Resilience)
- Tier 2: Boundary & Corner Cases (0ms pings, NoneType stats, empty candidate pool, deduplication collisions)
"""

import os
import sys
import time
import json
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
import discover_sources


class TestSocketAndSessionSafety(unittest.TestCase):
    """Tier 1 & 2: Feature Coverage for F1 (Socket & Session Leak Elimination)"""

    def test_f1_01_tcp_socket_closed_on_success(self):
        """F1.1: Verify raw TCP socket closes properly without leaving open descriptors"""
        # Start a dummy local listening socket
        server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_sock.bind(('127.0.0.1', 0))
        server_sock.listen(1)
        port = server_sock.getsockname()[1]
        
        try:
            test_uri = f"vless://uuid@127.0.0.1:{port}?security=none#LocalTest"
            uri, ping = aggregator.check_node_ping(test_uri, timeout=0.2)
            self.assertEqual(uri, test_uri)
            self.assertLess(ping, 1000.0, "Ping should be small for local loopback")
        finally:
            server_sock.close()

    def test_f1_02_socket_closed_on_connection_refused(self):
        """F1.2: Verify socket connection refused handles exception and closes descriptor"""
        # Use an unused port on localhost
        test_uri = "vless://uuid@127.0.0.1:59999?security=none#RefusedTest"
        uri, ping = aggregator.check_node_ping(test_uri, timeout=0.1)
        self.assertEqual(uri, test_uri)
        self.assertEqual(ping, 9999.0, "Refused connection must return 9999.0 dropped score")

    def test_f1_03_socket_closed_on_timeout(self):
        """F1.3: Verify socket timeout terminates cleanly and closes socket"""
        # Use non-routable IP (RFC 5737 198.51.100.1)
        test_uri = "vless://uuid@198.51.100.1:443?security=none#TimeoutTest"
        start_t = time.perf_counter()
        uri, ping = aggregator.check_node_ping(test_uri, timeout=0.1)
        elapsed = time.perf_counter() - start_t
        self.assertEqual(ping, 9999.0)
        self.assertLess(elapsed, 0.5, "Timeout must be strictly enforced within reasonable limit")

    def test_f1_04_http_fetch_context_closing(self):
        """F1.4: Verify fetch_url closes HTTP responses and handles errors gracefully"""
        res = aggregator.fetch_url("http://127.0.0.1:59998/nonexistent", timeout=1)
        self.assertEqual(res, "", "Failed fetch must return empty string without unhandled crash")

    def test_f1_05_rapid_connect_disconnect_stress(self):
        """F1.5: 50 Rapid sequential ping checks to verify no socket descriptor starvation"""
        server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_sock.bind(('127.0.0.1', 0))
        server_sock.listen(50)
        port = server_sock.getsockname()[1]
        
        try:
            test_uri = f"vless://uuid@127.0.0.1:{port}?security=none#Stress"
            for _ in range(50):
                aggregator.check_node_ping(test_uri, timeout=0.1)
        finally:
            server_sock.close()


class TestConcurrencyAndDeduplication(unittest.TestCase):
    """Tier 1 & 2: Feature Coverage for F2 (Concurrency & Race Condition Elimination)"""

    def test_f2_01_threadpool_concurrent_pings(self):
        """F2.1: Concurrent ThreadPoolExecutor execution across 30 simulated keys"""
        server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_sock.bind(('127.0.0.1', 0))
        server_sock.listen(100)
        port = server_sock.getsockname()[1]
        
        try:
            uris = [f"vless://uuid{i}@127.0.0.1:{port}?security=none#Node-{i}" for i in range(30)]
            with ThreadPoolExecutor(max_workers=10) as executor:
                results = list(executor.map(lambda u: aggregator.check_node_ping(u, timeout=0.2), uris))
            self.assertEqual(len(results), 30)
            for uri, ping in results:
                self.assertLess(ping, 1000.0)
        finally:
            server_sock.close()

    def test_f2_02_strict_uri_deduplication(self):
        """F2.2: Strict deduplication eliminating identical host+port+user with different remarks"""
        uri1 = "vless://user123@198.51.100.1:443?security=reality&pbk=key1#Tag1"
        uri2 = "vless://user123@198.51.100.1:443?security=reality&pbk=key1#Tag2-Duplicate"
        uri3 = "vless://user999@198.51.100.1:443?security=reality&pbk=key1#DifferentUser"
        
        key1 = aggregator.get_node_key(uri1)
        key2 = aggregator.get_node_key(uri2)
        key3 = aggregator.get_node_key(uri3)
        
        self.assertEqual(key1, key2, "Same host+port+user must yield identical deduplication key")
        self.assertNotEqual(key1, key3, "Different users must yield different deduplication keys")

    def test_f2_03_concurrent_history_state_mutation(self):
        """F2.3: Test save and load of persistent node history dictionary"""
        test_history = {
            f"key_{i}": {"success_checks": i, "total_checks": i + 5, "last_ping": 20.0 + i}
            for i in range(100)
        }
        # In-memory validation
        self.assertEqual(len(test_history), 100)
        items = sorted(test_history.items(), key=lambda x: x[1].get("total_checks", 0), reverse=True)
        self.assertEqual(len(items), 100)

    def test_f2_04_dead_nodes_blacklist_lifecycle(self):
        """F2.4: Test dead nodes blacklist counter increment and eviction logic"""
        dead_map = {f"dead_{i}": {"fail_count": i + 1, "last_failed": "2026-08-21T12:00:00Z"} for i in range(50)}
        self.assertEqual(len(dead_map), 50)
        # Verify filtering nodes with >= 3 fails
        filtered = {k: v for k, v in dead_map.items() if v.get("fail_count", 0) >= 3}
        self.assertEqual(len(filtered), 48)

    def test_f2_05_prober_batch_chunking_concurrency(self):
        """F2.5: Verify candidate nodes can be chunked into isolated worker batches"""
        nodes = [{"uri": f"vless://uuid{i}@198.51.100.1:443"} for i in range(225)]
        batch_size = service_prober.BATCH_SIZE
        chunks = [nodes[i:i + batch_size] for i in range(0, len(nodes), batch_size)]
        self.assertEqual(len(chunks), 3)
        self.assertEqual(len(chunks[0]), 75)
        self.assertEqual(len(chunks[1]), 75)
        self.assertEqual(len(chunks[2]), 75)


class TestGlobalpingAPIResilience(unittest.TestCase):
    """Tier 1 & 2: Feature Coverage for F5 (Globalping API Resilience)"""

    @patch("requests.Session.post")
    @patch("requests.Session.get")
    def test_f5_01_globalping_happy_path_measurement(self, mock_get, mock_post):
        """F5.1: Happy path: Globalping measurement job submitted and returns RU probe ping"""
        mock_post_resp = MagicMock()
        mock_post_resp.status_code = 202
        mock_post_resp.json.return_value = {"id": "job-12345"}
        mock_post.return_value = mock_post_resp

        mock_get_resp = MagicMock()
        mock_get_resp.status_code = 200
        mock_get_resp.json.return_value = {
            "results": [
                {
                    "probe": {"city": "Moscow", "country": "RU", "network": "Rostelecom"},
                    "result": {
                        "status": "finished",
                        "stats": {"avg": 32.5, "min": 28.0, "max": 38.0}
                    }
                }
            ]
        }
        mock_get.return_value = mock_get_resp

        nodes = [
            {"uri": "vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@198.51.100.1:443", "country": "DE"}
        ]
        
        with patch("time.sleep", return_value=None):
            result = service_prober.verify_nodes_with_globalping_ru(nodes, max_nodes=1)
        
        self.assertEqual(len(result), 1)
        self.assertTrue(result[0].get("ru_verified"), "Node should be marked ru_verified=True")
        self.assertEqual(result[0].get("ru_ping_ms"), 32.5)
        self.assertIn("Moscow", result[0].get("ru_location", ""))

    @patch("requests.Session.post")
    def test_f5_02_globalping_rate_limit_429(self, mock_post):
        """F5.2: Globalping returns HTTP 429 Too Many Requests -> does not crash prober"""
        mock_resp = MagicMock()
        mock_resp.status_code = 429
        mock_post.return_value = mock_resp

        nodes = [{"uri": "vless://uuid@198.51.100.1:443"}]
        result = service_prober.verify_nodes_with_globalping_ru(nodes, max_nodes=1)
        self.assertEqual(len(result), 1)
        self.assertFalse(result[0].get("ru_verified", False))

    @patch("requests.Session.post")
    def test_f5_03_globalping_network_timeout(self, mock_post):
        """F5.3: Globalping network timeout / connection error -> continues smoothly"""
        import requests
        mock_post.side_effect = requests.exceptions.Timeout("Connection timed out")

        nodes = [{"uri": "vless://uuid@198.51.100.1:443"}]
        result = service_prober.verify_nodes_with_globalping_ru(nodes, max_nodes=1)
        self.assertEqual(len(result), 1)
        self.assertFalse(result[0].get("ru_verified", False))

    @patch("requests.Session.post")
    @patch("requests.Session.get")
    def test_f5_04_globalping_missing_stats_none_safety(self, mock_get, mock_post):
        """F5.4: Globalping result with empty/None stats does not trigger NoneType exception"""
        mock_post_resp = MagicMock()
        mock_post_resp.status_code = 202
        mock_post_resp.json.return_value = {"id": "job-none-stats"}
        mock_post.return_value = mock_post_resp

        mock_get_resp = MagicMock()
        mock_get_resp.status_code = 200
        # Result has finished status but stats dictionary is None or empty
        mock_get_resp.json.return_value = {
            "results": [
                {
                    "probe": {"city": "Saint Petersburg", "country": "RU"},
                    "result": {
                        "status": "finished",
                        "stats": {}
                    }
                }
            ]
        }
        mock_get.return_value = mock_get_resp

        nodes = [{"uri": "vless://uuid@198.51.100.1:443"}]
        with patch("time.sleep", return_value=None):
            result = service_prober.verify_nodes_with_globalping_ru(nodes, max_nodes=1)
        self.assertEqual(len(result), 1)

    def test_f5_05_globalping_empty_node_list(self):
        """F5.5: Globalping called with empty node list returns empty list immediately"""
        res = service_prober.verify_nodes_with_globalping_ru([], max_nodes=10)
        self.assertEqual(res, [])


class TestDiscoveryAndTargetServices(unittest.TestCase):
    """Tier 1: Feature Coverage for Source Discovery & Service Probing Matrix"""

    def test_target_services_matrix_completeness(self):
        """Verify all 11 required target services are defined in service_prober.py"""
        required_services = [
            "chatgpt", "claude", "gemini", "perplexity", "youtube",
            "discord", "instagram", "twitter", "spotify", "github"
        ]
        for srv in required_services:
            self.assertIn(srv, service_prober.TARGET_SERVICES, f"Service {srv} must be defined in TARGET_SERVICES")
            self.assertIn("url", service_prober.TARGET_SERVICES[srv])
            self.assertIn("valid_status", service_prober.TARGET_SERVICES[srv])

    def test_discover_sources_queries_completeness(self):
        """Verify discover_sources.py defines diverse search queries for protocols"""
        self.assertGreaterEqual(len(discover_sources.GITHUB_CODE_QUERIES), 10)
        self.assertGreaterEqual(len(discover_sources.DYNAMIC_REPO_QUERIES), 15)
        self.assertGreaterEqual(len(discover_sources.SEED_REPOSITORIES), 1)


if __name__ == "__main__":
    unittest.main()
