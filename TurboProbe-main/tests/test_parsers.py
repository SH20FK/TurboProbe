import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tools.aggregator import (
    parse_host_and_port,
    is_basic_proxy_uri,
    extract_proxies_from_clash_yaml,
)

class TestProtocolParsers(unittest.TestCase):
    def test_parse_host_and_port_standard(self):
        uri = "vless://uuid@example.com:443?security=reality#Node-DE"
        host, port, port_str = parse_host_and_port(uri)
        self.assertEqual(host, "example.com")
        self.assertEqual(port, 443)
        self.assertEqual(port_str, "443")

    def test_parse_host_and_port_range(self):
        uri = "hy2://pass@1.2.3.4:20000-30000?sni=test.com#Hy2-MultiPort"
        host, port, port_str = parse_host_and_port(uri)
        self.assertEqual(host, "1.2.3.4")
        self.assertEqual(port, 20000)
        self.assertEqual(port_str, "20000-30000")

    def test_is_basic_proxy_uri_valid(self):
        valid_vless = "vless://11111111-2222-3333-4444-555555555555@95.217.26.41:443?type=tcp&security=reality&pbk=key&sni=avito.ru#RU-Node"
        valid_trojan = "trojan://password123@trojan.example.com:443#Trojan-DE"
        self.assertTrue(is_basic_proxy_uri(valid_vless))
        self.assertTrue(is_basic_proxy_uri(valid_trojan))

    def test_is_basic_proxy_uri_invalid(self):
        self.assertFalse(is_basic_proxy_uri("not_a_vpn_link"))
        self.assertFalse(is_basic_proxy_uri("http://example.com"))
        self.assertFalse(is_basic_proxy_uri("vless://:443"))

    def test_extract_proxies_from_clash_yaml(self):
        clash_yaml = """
proxies:
  - name: "Test-Vless"
    type: vless
    server: 1.2.3.4
    port: 443
    uuid: 11111111-2222-3333-4444-555555555555
    network: tcp
    tls: true
    servername: www.google.com
"""
        extracted = extract_proxies_from_clash_yaml(clash_yaml)
        self.assertIsInstance(extracted, list)
        self.assertTrue(len(extracted) > 0)
        self.assertIn("vless://", extracted[0])

if __name__ == "__main__":
    unittest.main()
