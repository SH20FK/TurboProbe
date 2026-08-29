import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tgproxy.tg_aggregator import TGProxy, COUNTRY_MAP

class TestTGProxy(unittest.TestCase):
    def test_mtproto_faketls_properties(self):
        secret = "ee3f72634c46d320aaa30d8bb2682e9b49617669746f2e7275"
        p = TGProxy(
            proto="mtproto",
            server="95.217.26.41",
            port=443,
            secret=secret,
            country="RU",
            country_label="🇷🇺 Россия"
        )
        self.assertTrue(p.is_faketls)
        self.assertTrue(p.is_ru)
        self.assertIn("tg://proxy?server=95.217.26.41", p.tg_link)
        self.assertIn("secret=" + secret, p.tg_link)

    def test_socks5_properties(self):
        p = TGProxy(
            proto="socks5",
            server="1.2.3.4",
            port=1080,
            user="user1",
            password="pass1",
            country="DE",
            country_label="🇩🇪 Германия"
        )
        self.assertFalse(p.is_faketls)
        self.assertFalse(p.is_ru)
        self.assertIn("tg://socks?server=1.2.3.4", p.tg_link)
        self.assertIn("user=user1", p.tg_link)

    def test_country_mapping(self):
        self.assertEqual(COUNTRY_MAP.get("RU"), "🇷🇺 Россия")
        self.assertEqual(COUNTRY_MAP.get("DE"), "🇩🇪 Германия")
        self.assertEqual(COUNTRY_MAP.get("NL"), "🇳🇱 Нидерланды")

if __name__ == "__main__":
    unittest.main()
