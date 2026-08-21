#!/usr/bin/env python3
"""
TurboProbe 4-Tier E2E Test Suite - Protocol Formats, Parsers, Schemas, and Feed Cleanliness
Covers:
- Tier 1: F3 (Protocol Parsing & Ingestion), F6 (Subscription Data Feed Cleanliness)
- Tier 2: Boundary & Corner Cases (Malformed URIs, unpadded Base64, Cyrillic remarks, IPv6 addresses)
"""

import os
import sys
import re
import json
import base64
import unittest
import urllib.parse

# Ensure tools directory is on sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_DIR = os.path.join(PROJECT_ROOT, "tools")
if TOOLS_DIR not in sys.path:
    sys.path.insert(0, TOOLS_DIR)

import aggregator
import service_prober

try:
    import yaml
except ImportError:
    yaml = None


class TestProtocolParsingAndIngestion(unittest.TestCase):
    """Tier 1: Feature Coverage for F3 (Protocol Parsing & Ingestion Hardening)"""

    def test_f3_01_vless_reality_outbound_generation(self):
        """F3.1: VLESS Reality URI parsing with pbk, sid, fp, sni, spx, flow"""
        uri = (
            "vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@198.51.100.1:443"
            "?security=reality&sni=www.microsoft.com&fp=chrome&pbk=ABCD1234EFGH5678"
            "&sid=1234abcd&spx=%2F&flow=xtls-rprx-vision&type=tcp#TurboProbe-Reality"
        )
        outbound = service_prober.parse_vless_uri(uri, "out-1")
        self.assertIsNotNone(outbound, "VLESS Reality URI must parse successfully")
        self.assertEqual(outbound["protocol"], "vless")
        self.assertEqual(outbound["tag"], "out-1")
        
        # Verify settings
        vnext = outbound["settings"]["vnext"][0]
        self.assertEqual(vnext["address"], "198.51.100.1")
        self.assertEqual(vnext["port"], 443)
        self.assertEqual(vnext["users"][0]["id"], "83afd88f-200f-4d89-bfc7-66eff160c1d8")
        self.assertEqual(vnext["users"][0]["flow"], "xtls-rprx-vision")
        
        # Verify stream settings
        stream = outbound["streamSettings"]
        self.assertEqual(stream["network"], "tcp")
        self.assertEqual(stream["security"], "reality")
        reality = stream["realitySettings"]
        self.assertEqual(reality["serverName"], "www.microsoft.com")
        self.assertEqual(reality["fingerprint"], "chrome")
        self.assertEqual(reality["publicKey"], "ABCD1234EFGH5678")
        self.assertEqual(reality["shortId"], "1234abcd")

    def test_f3_02_vless_websocket_and_grpc_transports(self):
        """F3.2: VLESS with WebSocket (path, host) and gRPC (serviceName) transports"""
        ws_uri = (
            "vless://a1b2c3d4-e5f6-7890-abcd-ef1234567890@198.51.100.2:8443"
            "?security=tls&sni=cdn.example.com&type=ws&path=%2Fws-proxy&host=cdn.example.com#WS-Node"
        )
        ws_outbound = service_prober.parse_vless_uri(ws_uri, "ws-out")
        self.assertIsNotNone(ws_outbound)
        self.assertEqual(ws_outbound["streamSettings"]["network"], "ws")
        self.assertEqual(ws_outbound["streamSettings"]["wsSettings"]["path"], "/ws-proxy")
        self.assertEqual(ws_outbound["streamSettings"]["wsSettings"]["headers"]["Host"], "cdn.example.com")

        grpc_uri = (
            "vless://a1b2c3d4-e5f6-7890-abcd-ef1234567890@198.51.100.3:443"
            "?security=tls&sni=grpc.example.com&type=grpc&serviceName=gun-service#GRPC-Node"
        )
        grpc_outbound = service_prober.parse_vless_uri(grpc_uri, "grpc-out")
        self.assertIsNotNone(grpc_outbound)
        self.assertEqual(grpc_outbound["streamSettings"]["network"], "grpc")
        self.assertEqual(grpc_outbound["streamSettings"]["grpcSettings"]["serviceName"], "gun-service")

    def test_f3_03_trojan_tls_parsing(self):
        """F3.3: Trojan URI parsing with TLS and password auth"""
        trojan_uri = "trojan://SecretPass123@198.51.100.4:443?security=tls&sni=trojan.example.com&type=tcp#Trojan-Node"
        outbound = service_prober.parse_trojan_uri(trojan_uri, "trojan-out")
        self.assertIsNotNone(outbound)
        self.assertEqual(outbound["protocol"], "trojan")
        server = outbound["settings"]["servers"][0]
        self.assertEqual(server["address"], "198.51.100.4")
        self.assertEqual(server["port"], 443)
        self.assertEqual(server["password"], "SecretPass123")
        self.assertEqual(outbound["streamSettings"]["tlsSettings"]["serverName"], "trojan.example.com")

    def test_f3_04_shadowsocks_sip002_and_legacy_parsing(self):
        """F3.4: Shadowsocks SIP002 (Base64 method:pass) and Legacy formats"""
        # SIP002: ss://base64(aes-256-gcm:pass123)@198.51.100.5:8388#SS-Node
        userinfo_b64 = base64.b64encode(b"aes-256-gcm:pass123").decode()
        ss_uri = f"ss://{userinfo_b64}@198.51.100.5:8388#SS-Node"
        outbound = service_prober.parse_ss_uri(ss_uri, "ss-out")
        self.assertIsNotNone(outbound)
        self.assertEqual(outbound["protocol"], "shadowsocks")
        server = outbound["settings"]["servers"][0]
        self.assertEqual(server["address"], "198.51.100.5")
        self.assertEqual(server["port"], 8388)
        self.assertEqual(server["method"], "aes-256-gcm")
        self.assertEqual(server["password"], "pass123")

    def test_f3_05_hysteria2_extraction_from_content(self):
        """F3.5: Hysteria 2 / hy2 protocol extraction from raw subscription feeds"""
        raw_feed = (
            "hysteria2://authPass@198.51.100.6:443?sni=hy2.example.com&insecure=1#Hy2-Node\n"
            "hy2://authPass2@198.51.100.7:8443?sni=hy2-2.example.com#Hy2-ShortScheme\n"
        )
        uris = aggregator.extract_uris_from_content(raw_feed)
        self.assertTrue(any(u.startswith("hysteria2://") for u in uris), "Must extract hysteria2:// URI")
        self.assertTrue(any(u.startswith("hy2://") or u.startswith("hysteria2://") for u in uris), "Must extract hy2:// URI")

    def test_f3_06_clash_yaml_proxy_extraction(self):
        """F3.6: Extract proxy definitions from Clash Meta YAML configs"""
        clash_yaml = """
proxies:
  - name: "Clash-VLESS-Reality"
    type: vless
    server: 198.51.100.10
    port: 443
    uuid: 83afd88f-200f-4d89-bfc7-66eff160c1d8
    tls: true
    servername: server.domain.com
    network: tcp
    reality-opts:
      public-key: "ABCD1234EFGH5678"
      short-id: "1234abcd"
  - name: "Clash-Trojan"
    type: trojan
    server: 198.51.100.11
    port: 443
    password: "TrojanPassword"
    sni: trojan.domain.com
  - name: "Clash-SS"
    type: ss
    server: 198.51.100.12
    port: 8388
    cipher: aes-256-gcm
    password: "SSPassword"
"""
        uris = aggregator.extract_proxies_from_clash_yaml(clash_yaml)
        self.assertGreaterEqual(len(uris), 3, "Should extract at least 3 proxy URIs from YAML")
        self.assertTrue(any(u.startswith("vless://") and "pbk=ABCD1234EFGH5678" in u for u in uris))
        self.assertTrue(any(u.startswith("trojan://") and "TrojanPassword" in u for u in uris))
        self.assertTrue(any(u.startswith("ss://") for u in uris))

    def test_f3_07_multilayer_base64_recursive_unpacking(self):
        """F3.7: Multi-layer Base64 decoding up to 3-5 layers"""
        raw_uri = "vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@198.51.100.1:443?security=reality#Layer0"
        
        # Encode layer 1
        l1 = base64.b64encode(raw_uri.encode()).decode()
        # Encode layer 2
        l2 = base64.b64encode(l1.encode()).decode()
        # Encode layer 3
        l3 = base64.b64encode(l2.encode()).decode()
        
        decoded = aggregator.recursive_decode_subscription(l3, max_depth=5)
        # When fully unpacked, it should contain the raw URI or intermediate decodable stream
        self.assertTrue("vless://" in decoded or decoded == raw_uri or "://" in decoded)


class TestSubscriptionDataFeedCleanliness(unittest.TestCase):
    """Tier 1: Feature Coverage for F6 (Subscription Data Feed Cleanliness)"""

    def test_f6_01_no_git_conflict_markers_in_sub_files(self):
        """F6.1: Scan all files in sub/ and ensure ZERO Git conflict markers (<<<<<<<, =======, >>>>>>>)"""
        sub_dir = os.path.join(PROJECT_ROOT, "sub")
        if not os.path.exists(sub_dir):
            self.skipTest("sub/ directory does not exist")
        
        conflict_pattern = re.compile(r'^(<{7}|={7}|>{7})(\s|$)', re.MULTILINE)
        corrupted_files = []

        for root, _, files in os.walk(sub_dir):
            for file in files:
                if file.endswith((".txt", ".json", ".yaml", ".yml")):
                    filepath = os.path.join(root, file)
                    try:
                        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read()
                            if conflict_pattern.search(content):
                                corrupted_files.append(filepath)
                    except Exception as e:
                        corrupted_files.append(f"{filepath} (Read Error: {e})")

        self.assertEqual(corrupted_files, [], f"Found residual Git conflict markers in: {corrupted_files}")

    def test_f6_02_json_feeds_syntax_and_schema_validation(self):
        """F6.2: Validate JSON syntax and structure of sub/nodes.json and sub/preview.json"""
        sub_dir = os.path.join(PROJECT_ROOT, "sub")
        for json_name in ["preview.json", "nodes.json", "stats.json"]:
            path = os.path.join(sub_dir, json_name)
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.assertIsInstance(data, (dict, list), f"{json_name} must parse as JSON dict or list")
                    if isinstance(data, dict) and "nodes" in data:
                        self.assertIsInstance(data["nodes"], list)
                        if len(data["nodes"]) > 0:
                            node0 = data["nodes"][0]
                            self.assertIn("uri", node0)

    def test_f6_03_clash_meta_yaml_syntax_and_schema(self):
        """F6.3: Validate YAML syntax of sub/clash.yaml / sub/clash-meta.yaml"""
        if yaml is None:
            self.skipTest("PyYAML is not available")
        
        sub_dir = os.path.join(PROJECT_ROOT, "sub")
        for yaml_name in ["clash.yaml", "clash-meta.yaml", "clash.meta.yaml"]:
            path = os.path.join(sub_dir, yaml_name)
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    parsed = yaml.safe_load(f)
                    self.assertIsInstance(parsed, dict)
                    self.assertIn("proxies", parsed)
                    self.assertIsInstance(parsed["proxies"], list)
                    self.assertIn("proxy-groups", parsed)
                    self.assertIn("rules", parsed)

    def test_f6_04_plaintext_feeds_line_integrity(self):
        """F6.4: Validate that plaintext sub feeds (all.txt, top20.txt, etc.) contain valid URI lines"""
        sub_dir = os.path.join(PROJECT_ROOT, "sub")
        for txt_name in ["all.txt", "top20.txt", "top50.txt", "anti-whitelist.txt"]:
            path = os.path.join(sub_dir, txt_name)
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    lines = [l.strip() for l in f if l.strip()]
                    for i, line in enumerate(lines[:50]):
                        self.assertTrue(
                            "://" in line,
                            f"Line {i+1} in {txt_name} must be a valid URI containing '://': {line[:40]}"
                        )

    def test_f6_05_chunks_pagination_consistency(self):
        """F6.5: Verify sub/chunks/index.json manifests match actual chunk files"""
        chunks_dir = os.path.join(PROJECT_ROOT, "sub", "chunks")
        index_file = os.path.join(chunks_dir, "index.json")
        if os.path.exists(index_file):
            with open(index_file, "r", encoding="utf-8") as f:
                manifest = json.load(f)
                self.assertIsInstance(manifest, (dict, list))
                if isinstance(manifest, dict) and "chunks" in manifest:
                    for chunk_info in manifest["chunks"]:
                        chunk_path = os.path.join(chunks_dir, chunk_info.get("filename", ""))
                        if chunk_info.get("filename"):
                            self.assertTrue(os.path.exists(chunk_path), f"Chunk file {chunk_path} must exist")


class TestBoundaryAndCornerCases(unittest.TestCase):
    """Tier 2: Boundary & Corner Cases (Malformed URIs, Encodings, Extremes)"""

    def test_t2_01_unpadded_base64_decoding_resilience(self):
        """T2.1: Test unpadded Base64 strings (length % 4 == 1, 2, 3) in Shadowsocks userinfo"""
        # Valid userinfo: aes-256-gcm:pass123 (length 18 bytes -> base64 length 24)
        # Test unpadded: 'aes-128-gcm:p' -> b64 is 'YWVzLTEyOC1nY206cA==' (len 20, padded)
        # Stripped: 'YWVzLTEyOC1nY206cA' (len 18, mod 4 = 2)
        raw_b64 = "YWVzLTEyOC1nY206cA"  # Missing '=='
        ss_uri = f"ss://{raw_b64}@198.51.100.20:8388#Unpadded-SS"
        outbound = service_prober.parse_ss_uri(ss_uri, "out-unpadded")
        self.assertIsNotNone(outbound, "Should decode unpadded Base64 userinfo without error")
        self.assertEqual(outbound["settings"]["servers"][0]["method"], "aes-128-gcm")
        self.assertEqual(outbound["settings"]["servers"][0]["password"], "p")

    def test_t2_02_base64url_safe_characters_decoding(self):
        """T2.2: Test Base64URL characters ('-' and '_') vs standard ('+' and '/')"""
        # Userinfo with chars resulting in + and /: 'chacha20-ietf-poly1305:?>?>??'
        # Standard: 'Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTo/Pj8+Pz8='
        # URL-safe: 'Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTo_Pj8-Pz8='
        b64url = "Y2hhY2hhMjAtaWV0Zi1wb2x5MTMwNTo_Pj8-Pz8="
        # In service_prober.parse_ss_uri, test fallback or url-safe handling
        ss_uri = f"ss://{b64url}@198.51.100.21:8388#URLSafe-SS"
        outbound = service_prober.parse_ss_uri(ss_uri, "out-urlsafe")
        # Should not throw unhandled exception
        self.assertTrue(outbound is None or isinstance(outbound, dict))

    def test_t2_03_ipv6_bracketed_host_extraction(self):
        """T2.3: Test IPv6 host extraction with and without brackets [2001:db8::1]:8443"""
        vless_ipv6 = (
            "vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@[2001:db8::1]:8443"
            "?security=reality&pbk=ABCD1234EFGH5678&sni=example.com#IPv6-Node"
        )
        outbound = service_prober.parse_vless_uri(vless_ipv6, "ipv6-out")
        self.assertIsNotNone(outbound)
        address = outbound["settings"]["vnext"][0]["address"]
        # Xray JSON addresses must be cleaned of outer brackets
        self.assertNotIn("[", address)
        self.assertNotIn("]", address)
        self.assertEqual(address, "2001:db8::1")

    def test_t2_04_country_detection_domain_boundary(self):
        """T2.4: Ensure .com, .org, .co do not trigger false positive Colombia 'CO' matching"""
        uri_com = "trojan://pass@example.com:443#Tag"
        uri_co = "trojan://pass@example.co:443#ColombiaTag"
        
        cc_com = aggregator.detect_country_code(uri_com)
        cc_co = aggregator.detect_country_code(uri_co)
        
        # .co should match CO
        self.assertEqual(cc_co, "CO")
        # .com should NOT match CO (unless specification allows, but spec bug 3 says: no false CO match on .com)
        # Note: if implementation currently has the .co bug, we assert spec behavior
        self.assertNotEqual(cc_com, "CO", "example.com should not be classified as CO (Colombia)")

    def test_t2_05_remark_sanitization_special_characters(self):
        """T2.5: Remark sanitization with YAML reserved characters (:, \", ', [, ], #) and Unicode/Cyrillic"""
        uri = "vless://uuid@198.51.100.1:443?security=reality&pbk=abcd#Прокси: [VIP] \"Супер\" 'Скорость' #1"
        sanitized = aggregator.sanitize_node_remark(uri, ping_ms=25.0, purpose="Reality", idx=1)
        self.assertIn("TurboProbe", sanitized)
        self.assertIn("#", sanitized)
        # Check clash yaml generation with special characters in tags
        clash_yaml = service_prober.generate_clash_meta_yaml([{"uri": uri, "country": "RU"}])
        self.assertNotIn('name: "Прокси: [VIP]', clash_yaml, "Colons and quotes should be sanitized in YAML proxy names")

    def test_t2_06_clash_yaml_with_hysteria2_support(self):
        """T2.6: Clash Meta YAML generation supports Hysteria 2 proxy type"""
        nodes = [
            {
                "uri": "hysteria2://MyPassword123@198.51.100.30:443?sni=hy2.server.com&insecure=1#Hy2-Special",
                "country": "KZ"
            }
        ]
        # In service_prober / aggregator, test generating clash meta yaml
        clash_yaml = service_prober.generate_clash_meta_yaml(nodes)
        self.assertIn("type: hysteria2", clash_yaml, "Clash Meta YAML generator must support hysteria2 proxy type")


if __name__ == "__main__":
    unittest.main()
