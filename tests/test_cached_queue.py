from datetime import datetime,timezone,timedelta
import json
import hashlib
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock,patch
from backend.vpn_v2 import cached_queue as q
from backend.vpn_v2.crawler_store import Store


def verified(uris,**kwargs):
    return [{'uri':u,'ping_ms':i+10,'country':'DE','verified':True,
             'verification_policy':'tunnel-https-v1','checked_at':datetime.now(timezone.utc).isoformat()} for i,u in enumerate(uris)]


class RollingQueueTests(unittest.TestCase):
    def test_up_to_200_unique_lab_checks_while_all_240_tunnels_are_retained(self):
        self.store.db.execute('DELETE FROM nodes')
        uris=[f'trojan://extra{i}@example.com:443' for i in range(240)]
        self.store.db.executemany('INSERT INTO nodes VALUES(?,?,?)',[(hashlib.sha256(u.encode()).hexdigest(),u,0) for u in uris])
        self.store.db.commit()
        progress=q.load_progress(self.path)
        with patch.object(q,'verify',side_effect=verified),patch.object(q,'measure_selected',side_effect=lambda n,**kw:n), \
             patch.object(q,'load',return_value='unused'),patch.object(q,'check_candidates',return_value=[]) as lab, \
             patch.object(q,'push_snapshot'):
            q.run_queue(self.run,progress,self.path,select=200,window=240)
        submitted=[n['uri'] for c in lab.call_args_list for n in c.args[0]]
        self.assertEqual(len(submitted),200)
        self.assertEqual(len(set(submitted)),200)
        self.assertEqual(len(progress['local']),240)
        self.assertTrue(all(len(c.args[0])<=20 for c in lab.call_args_list))

    def test_daily_reservations_reset_on_utc_date_change(self):
        progress=q.load_progress(self.path)
        progress['daily']={'date':'2000-01-01','reserved':['old']*200}
        with patch.object(q,'verify',side_effect=verified),patch.object(q,'measure_selected',side_effect=lambda n,**kw:n), \
             patch.object(q,'load',return_value='unused'),patch.object(q,'check_candidates',return_value=[]) as lab, \
             patch.object(q,'push_snapshot'):
            q.run_queue(self.run,progress,self.path,select=2,window=4)
        self.assertEqual(sum(len(c.args[0]) for c in lab.call_args_list),2)
        self.assertEqual(progress['daily']['date'],datetime.now(timezone.utc).date().isoformat())

    def test_daily_limit_is_shared_across_batches_and_restarts(self):
        progress=q.load_progress(self.path)
        with patch.object(q,'verify',side_effect=verified),patch.object(q,'measure_selected',side_effect=lambda n,**kw:n), \
             patch.object(q,'load',return_value='unused'),patch.object(q,'check_candidates',return_value=[]) as lab, \
             patch.object(q,'push_snapshot'):
            q.run_queue(self.run,progress,self.path,select=3,window=1)
        self.assertEqual(sum(len(c.args[0]) for c in lab.call_args_list),3)
        self.assertEqual(len(progress['daily']['reserved']),3)
        with patch.object(q,'verify',side_effect=verified),patch.object(q,'load',return_value='unused'), \
             patch.object(q,'check_candidates') as lab,patch.object(q,'push_snapshot'):
            q.run_queue(self.run,q.load_progress(self.path),self.path,select=3,window=4)
        lab.assert_not_called()

    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.store=Store(self.root/'cache.sqlite')
        self.store.db.executemany('INSERT INTO nodes VALUES(?,?,?)',[(hashlib.sha256(f'trojan://p{i}@example.com:443'.encode()).hexdigest(),f'trojan://p{i}@example.com:443',0) for i in range(1,5)])
        self.store.db.commit()
        self.ids=[r[0] for r in self.store.db.execute("SELECT id FROM nodes ORDER BY id")]
        self.run=SimpleNamespace(store=self.store,branch=Mock(),local_deadline=float('inf'),deadline=float('inf'),checkpoint_jobs=Mock())
        self.path=self.root/'progress.json'

    def tearDown(self):self.store.close();self.temp.cleanup()

    def test_resume_uses_next_window_and_refreshes_prior_winners(self):
        progress=q.load_progress(self.path)
        seen=[]
        def first(uris,**kw):
            seen.extend(uris);self.run.local_deadline=0;return verified(uris)
        with patch.object(q,'verify',side_effect=first),patch.object(q,'measure_selected',side_effect=lambda n,**kw:n), \
             patch.object(q,'load',return_value='unused'),patch.object(q,'check_candidates',side_effect=lambda nodes,*a,**kw:[{**n,"latencylab_verified":True,"latencylab_operators":["mts"],"latencylab_checked_at":datetime.now(timezone.utc).isoformat(),"expires_at":(datetime.now(timezone.utc)+timedelta(hours=24)).isoformat()} for n in nodes]) as lab, \
             patch.object(q,'push_snapshot') as push:
            q.run_queue(self.run,progress,self.path,select=1,window=2)
        self.assertEqual(progress['processed'],2)
        self.assertEqual(progress['cursor'],self.ids[1])
        self.assertEqual(lab.call_count,1);self.assertGreaterEqual(push.call_count,1)
        self.run.local_deadline=float('inf')
        progress=q.load_progress(self.path)
        def second(uris,**kw):seen.extend(uris);return verified(uris)
        with patch.object(q,'verify',side_effect=second),patch.object(q,'measure_selected',side_effect=lambda n,**kw:n), \
             patch.object(q,'load',return_value='unused'),patch.object(q,'check_candidates',side_effect=lambda nodes,*a,**kw:[{**n,"latencylab_verified":True,"latencylab_operators":["mts"],"latencylab_checked_at":datetime.now(timezone.utc).isoformat(),"expires_at":(datetime.now(timezone.utc)+timedelta(hours=24)).isoformat()} for n in nodes]) as lab, \
             patch.object(q,'push_snapshot'):
            q.run_queue(self.run,progress,self.path,select=1,window=2)
        self.assertEqual(progress['processed'],4)
        self.assertEqual(progress['cursor'],self.ids[3])
        self.assertEqual(set(seen),{f'trojan://p{i}@example.com:443' for i in range(1,5)})
        self.assertEqual(lab.call_count,0)

    def test_zero_lab_passes_keep_old_subscription_but_continue_all_keys(self):
        progress=q.load_progress(self.path)
        with patch.object(q,'verify',side_effect=verified) as engine,patch.object(q,'measure_selected',side_effect=lambda n,**kw:n), \
             patch.object(q,'load',return_value='unused'),patch.object(q,'check_candidates',return_value=[]) as lab, \
             patch.object(q,'push_snapshot') as push:
            q.run_queue(self.run,progress,self.path,select=1,window=2)
        self.assertEqual(progress['processed'],4)
        self.assertEqual(engine.call_count,2)
        self.assertEqual(lab.call_count,1)
        self.assertGreaterEqual(push.call_count,2)
        self.assertTrue(all(c.args[0]["publication_profile"]=="tunnel-and-latencylab" for c in push.call_args_list))

    def test_unfinished_window_does_not_advance_cursor(self):
        progress=q.load_progress(self.path)
        with patch.object(q,'verify',side_effect=TimeoutError('budget')):
            with self.assertRaises(q.LabError):q.run_queue(self.run,progress,self.path,select=1,window=2)
        self.assertEqual(q.load_progress(self.path)['cursor'],'')
        self.assertEqual(progress['processed'],0)

    def test_corrupt_checkpoint_is_not_silently_reset(self):
        self.path.write_text(json.dumps({'version':1,'cursor':'invalid','processed':20,'cycle':1,'best':[]}))
        with self.assertRaises(ValueError):q.load_progress(self.path)
