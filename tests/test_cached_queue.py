from datetime import datetime,timezone
import json
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
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.store=Store(self.root/'cache.sqlite')
        self.store.db.executemany('INSERT INTO nodes VALUES(?,?,?)',[(f'{i:064x}',f'trojan://p{i}@example.com:443',0) for i in range(1,5)])
        self.store.db.commit()
        self.run=SimpleNamespace(store=self.store,branch=Mock(),local_deadline=float('inf'),deadline=float('inf'),checkpoint_jobs=Mock())
        self.path=self.root/'progress.json'

    def tearDown(self):self.store.close();self.temp.cleanup()

    def test_resume_uses_next_window_and_refreshes_prior_winners(self):
        progress=q.load_progress(self.path)
        seen=[]
        def first(uris,**kw):
            seen.extend(uris);self.run.local_deadline=0;return verified(uris)
        with patch.object(q,'verify',side_effect=first),patch.object(q,'measure_selected',side_effect=lambda n,**kw:n), \
             patch.object(q,'load',return_value='unused'),patch.object(q,'check_candidates',side_effect=lambda n,*a,**kw:n) as lab, \
             patch.object(q,'push_snapshot') as push:
            q.run_queue(self.run,progress,self.path,select=1,window=2)
        self.assertEqual(progress['processed'],2)
        self.assertEqual(progress['cursor'],f'{2:064x}')
        self.assertEqual(lab.call_count,1);push.assert_called_once()
        self.run.local_deadline=float('inf')
        progress=q.load_progress(self.path)
        def second(uris,**kw):seen.extend(uris);return verified(uris)
        with patch.object(q,'verify',side_effect=second),patch.object(q,'measure_selected',side_effect=lambda n,**kw:n), \
             patch.object(q,'load',return_value='unused'),patch.object(q,'check_candidates',side_effect=lambda n,*a,**kw:n) as lab, \
             patch.object(q,'push_snapshot'):
            q.run_queue(self.run,progress,self.path,select=1,window=2)
        self.assertEqual(progress['processed'],4)
        self.assertEqual(progress['cursor'],f'{4:064x}')
        self.assertEqual(set(seen),{f'trojan://p{i}@example.com:443' for i in range(1,5)})
        self.assertEqual(lab.call_count,1)

    def test_zero_lab_passes_keep_old_subscription_but_continue_all_keys(self):
        progress=q.load_progress(self.path)
        with patch.object(q,'verify',side_effect=verified) as engine,patch.object(q,'measure_selected',side_effect=lambda n,**kw:n), \
             patch.object(q,'load',return_value='unused'),patch.object(q,'check_candidates',return_value=[]) as lab, \
             patch.object(q,'push_snapshot') as push:
            with self.assertRaises(q.LabError):q.run_queue(self.run,progress,self.path,select=1,window=2)
        self.assertEqual(progress['processed'],4)
        self.assertEqual(engine.call_count,2)
        self.assertEqual(lab.call_count,1)
        push.assert_not_called()

    def test_unfinished_window_does_not_advance_cursor(self):
        progress=q.load_progress(self.path)
        with patch.object(q,'verify',side_effect=TimeoutError('budget')):
            with self.assertRaises(q.LabError):q.run_queue(self.run,progress,self.path,select=1,window=2)
        self.assertEqual(q.load_progress(self.path)['cursor'],'')
        self.assertEqual(progress['processed'],0)

    def test_corrupt_checkpoint_is_not_silently_reset(self):
        self.path.write_text(json.dumps({'version':1,'cursor':'invalid','processed':20,'cycle':1,'best':[]}))
        with self.assertRaises(ValueError):q.load_progress(self.path)
