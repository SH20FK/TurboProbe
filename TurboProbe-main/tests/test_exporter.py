import unittest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tgproxy.tg_aggregator import TGProxy
from tgproxy.exporter import export_all

class TestTGExporter(unittest.TestCase):
    def test_export_structure(self):
        p1 = TGProxy("mtproto", "1.1.1.1", 443, secret="ee12345678901234567890123456789012617669746f2e7275", country="RU", ping_ms=45.0)
        p2 = TGProxy("socks5", "2.2.2.2", 1080, country="DE", ping_ms=80.0)
        
        test_proxies = [p1, p2]
        self.assertEqual(len(test_proxies), 2)
        d1 = p1.to_dict()
        self.assertEqual(d1["proto"], "mtproto")
        self.assertEqual(d1["country"], "RU")
        self.assertEqual(d1["ping_ms"], 45.0)

if __name__ == "__main__":
    unittest.main()
