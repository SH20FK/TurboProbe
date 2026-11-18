import unittest

from backend.vpn_v2.node_filter import endpoint_of, is_junk_uri, split_junk


class EndpointTests(unittest.TestCase):
    def test_public_endpoint(self):
        self.assertEqual(endpoint_of('vless://id@example.org:8443?type=tcp'), ('vless', 'example.org', 8443))

    def test_default_port(self):
        self.assertEqual(endpoint_of('trojan://pw@1.2.3.4'), ('trojan', '1.2.3.4', 443))

    def test_invalid_port(self):
        self.assertIsNone(endpoint_of('vless://id@example.org:99999'))
        self.assertIsNone(endpoint_of('vless://id@example.org:notaport'))


class JunkTests(unittest.TestCase):
    def test_loopback_is_junk(self):
        self.assertTrue(is_junk_uri('vless://id@127.0.0.1:40443?type=tcp'))

    def test_private_is_junk(self):
        self.assertTrue(is_junk_uri('trojan://pw@10.0.0.5:443'))
        self.assertTrue(is_junk_uri('vless://id@192.168.1.1:443'))
        self.assertTrue(is_junk_uri('vless://id@[::1]:443'))

    def test_local_suffix_and_blocklist(self):
        self.assertTrue(is_junk_uri('vless://id@proxy.local:443'))
        self.assertTrue(is_junk_uri('vless://id@www.speedtest.net:443'))
        self.assertTrue(is_junk_uri('vless://id@localhost:443'))

    def test_malformed_host(self):
        self.assertTrue(is_junk_uri('vless://id@eyj2ijoimiisinbzijoi8j+hrvcfh7cgdc5tzs9yz2hvzgrvb3npinix2lpzinmeinmc2k:443'))
        self.assertTrue(is_junk_uri('hello world'))
        self.assertTrue(is_junk_uri('vless://id@/path'))

    def test_public_hosts_survive(self):
        self.assertFalse(is_junk_uri('vless://id@8.8.8.8:443?security=reality'))
        self.assertFalse(is_junk_uri('hysteria2://pw@node.example.net:443'))
        self.assertFalse(is_junk_uri('ss://YWVzOnB3@1.1.1.1:8388'))

    def test_split_preserves_order(self):
        usable, junk = split_junk(['vless://id@1.1.1.1:443', 'vless://id@127.0.0.1:1',
                                   'trojan://pw@example.org:443'])
        self.assertEqual(usable, ['vless://id@1.1.1.1:443', 'trojan://pw@example.org:443'])
        self.assertEqual(junk, 1)


if __name__ == '__main__':
    unittest.main()
