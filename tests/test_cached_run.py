import base64
import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
import yaml
from backend.vpn_v2 import __main__ as cli, probe
from backend.vpn_v2.crawler_run import CrawlRun
from backend.vpn_v2.crawler_store import Store
from backend.vpn_v2.geolocation import country_through_tunnel
from node_labels import format_uri


class LabelTests(unittest.TestCase):
    def test_short_label_changes_only_fragment(self):
        uri='trojan://CaseSensitive@example.com:443?sni=other.test&type=ws&path=%2Ftest#spam'
        result=format_uri(uri,'DE')
        self.assertEqual(result.split('#')[0],uri.split('#')[0])
        from urllib.parse import unquote
        self.assertEqual(unquote(result.split('#')[1]),'TurboProbe 🇩🇪 DE')
        self.assertEqual(unquote(format_uri(uri,'GLOBAL').split('#')[1]),'TurboProbe 🌐')

    def test_vmess_changes_only_ps(self):
        data={'v':'2','ps':'spam','add':'example.com','port':443,'id':'uuid','net':'ws','path':'/x','tls':'tls'}
        uri='vmess://'+base64.b64encode(json.dumps(data).encode()).decode()
        result=json.loads(base64.b64decode(format_uri(uri,'NL')[8:]))
        self.assertEqual(result,{**data,'ps':'TurboProbe 🇳🇱 NL'})

    def test_clash_uses_country_label_and_disambiguates_collisions(self):
        nodes=[{'uri':f'trojan://p{i}@example.com:443#advertisement','country':'DE'} for i in range(3)]
        document=yaml.safe_load(probe.service_prober.generate_clash_meta_yaml(nodes))
        names=[n['name'] for n in document['proxies']]
        self.assertEqual(names,['TurboProbe 🇩🇪 DE','TurboProbe 🇩🇪 DE (2)','TurboProbe 🇩🇪 DE (3)'])


class CountryTests(unittest.TestCase):
    def test_trace_wins_without_revealing_or_storing_exit_ip(self):
        with patch('backend.vpn_v2.geolocation.read_response',return_value=(200,b'ip=8.8.8.8\nloc=DE\ntls=TLSv1.3\n')) as request:
            self.assertEqual(country_through_tunnel(Mock(),time.monotonic()+20),'DE')
            self.assertEqual(request.call_count,1)

    def test_fallback_is_verified_tunnel_response(self):
        replies=[(503,b''),(200,json.dumps({'success':True,'ip':'8.8.8.8','country_code':'NL'}).encode())]
        with patch('backend.vpn_v2.geolocation.read_response',side_effect=replies):
            self.assertEqual(country_through_tunnel(Mock(),time.monotonic()+20),'NL')

    def test_private_egress_and_invalid_response_remain_unknown(self):
        replies=[(200,b'ip=127.0.0.1\nloc=RU\ntls=TLSv1.3\n'),(200,b'{"success":true,"ip":"127.0.0.1","country_code":"RU"}')]
        with patch('backend.vpn_v2.geolocation.read_response',side_effect=replies):
            self.assertEqual(country_through_tunnel(Mock(),time.monotonic()+20),'GLOBAL')


class CachedRunTests(unittest.TestCase):
    def test_sample_and_whole_cache_do_not_download_sources(self):
        with tempfile.TemporaryDirectory() as tmp:
            run=object.__new__(CrawlRun)
            run.store=Store(Path(tmp)/'state.sqlite')
            try:
                run.store.db.executemany('INSERT INTO nodes VALUES(?,?,?)',[(str(i),'uri'+str(i),0) for i in range(20)])
                small,_,metrics=run.cached_candidates(5)
                whole,_,full=run.cached_candidates(0)
                self.assertEqual((len(small),len(whole)),(5,20))
                self.assertEqual(metrics['scope'],'cached_sample')
                self.assertEqual(full['scope'],'cached_pool')
            finally:run.store.close()

    def test_cached_cli_skips_crawler_and_large_state_upload(self):
        private=Path(cli.__file__).resolve().parent/'.local'
        with tempfile.TemporaryDirectory(dir=private) as tmp:
            run=Mock(deadline=time.monotonic()+21600,local_deadline=time.monotonic()+16200)
            run.cached_candidates.return_value=(['one','two'],[],{'scope':'cached_sample','cached_pool_size':200,'urls':0})
            nodes=[{'uri':'one','country':'DE','ping_ms':20,'verified':True,'verification_policy':'tunnel-https-v1'}]
            with patch('sys.argv',['vpn_v2','--cached-only','--candidate-limit','2','--select','10','--out',str(Path(tmp)/'out.json')]), \
                 patch.object(cli,'CrawlRun',return_value=run) as constructor, \
                 patch.object(cli,'load',return_value='unused'),patch.object(cli,'verify',return_value=nodes), \
                 patch.object(cli,'measure_selected',side_effect=lambda n,**kw:n),patch.object(cli,'check_candidates',return_value=nodes):
                cli.main()
            self.assertFalse(constructor.call_args.kwargs['persist_checkpoints'])
            run.collect.assert_not_called()
            run.cached_candidates.assert_called_once_with(2)
            run.close.assert_called_once()
