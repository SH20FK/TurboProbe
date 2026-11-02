"""Crawler lifecycle: restore, seed once, discover, collect and checkpoint."""
import time
from .crawler_store import Store
from .crawler_state import StateBranch
from . import crawler


class CrawlRun:
    def __init__(self, directory, token, persistent, seconds=21600, *, persist_checkpoints=True):
        if not 5401 <= seconds <= 21600: raise ValueError('run budget must reserve 90 minutes for API and publication')
        if persistent and not token: raise ValueError('GitHub credentials required for persistent crawler state')
        self.deadline = time.monotonic()+seconds
        self.local_deadline = self.deadline-5400
        print('Crawler startup: opening local SQLite registry',flush=True)
        self.store = Store(directory/'crawler.sqlite')
        self.branch = StateBranch(token) if persistent else None
        self.ready = False
        self.persist_checkpoints = persist_checkpoints
        self.checkpoint_failed = False
        try:
            if self.branch:
                print('Crawler startup: restoring crawler-state from GitHub',flush=True)
                self.branch.open(self.store)
                print('Crawler startup: remote state ready',flush=True)
            crawler.seed(self.store)
            self.ready = True
        except BaseException:
            self.store.close()
            if self.branch: self.branch.close()
            raise

    def checkpoint(self):
        self.store.db.commit()
        if self.branch and self.persist_checkpoints:
            try:
                self.branch.save(self.store)
                self.checkpoint_failed = False
            except BaseException:
                self.checkpoint_failed = True
                raise

    def checkpoint_jobs(self):
        self.store.db.commit()
        if self.branch: self.branch.save_jobs(self.store)

    def cached_candidates(self, limit=0):
        total = self.store.db.execute('SELECT count(*) FROM nodes').fetchone()[0]
        rows = self.store.db.execute('SELECT uri FROM nodes ORDER BY id LIMIT ?', (limit or -1,))
        uris = [r[0] for r in rows]
        print(f'Cached-only: {len(uris)}/{total} stored keys; no source downloads or discovery',flush=True)
        return uris,[],{'scope':'cached_sample' if limit and limit<total else 'cached_pool',
                       'cached_pool_size':total,'unique_keys':len(uris),'urls':0}

    def collect(self, discovery, token, urls=None, *, workers=None):
        if urls is not None:
            for url in urls: self.store.add(url)
        discovery_errors = []
        if discovery:
            print('Discovery phase started (maximum 30 minutes)',flush=True)
            try:
                discovery_errors = crawler.discover(self.store,token,min(self.local_deadline,time.monotonic()+1800))
            except TimeoutError:
                discovery_errors.append('discovery_time_budget')
            self.checkpoint()
        from .crawler_store import public_url,source_id
        print('Discovery finished; starting source downloads',flush=True)
        only = {source_id(public_url(u)) for u in urls if public_url(u)} if urls is not None else None
        uris,errors,metrics = crawler.collect(self.store,self.local_deadline,only=only,workers=workers)
        metrics['scope'] = 'custom_sources' if only is not None else 'all_eligible_sources'
        metrics['discovery_errors'] = discovery_errors
        metrics['registry'] = dict(self.store.db.execute('SELECT status,count(*) FROM sources GROUP BY status'))
        warning = self.store.db.execute("SELECT value FROM meta WHERE key='search_coverage_warning'").fetchone()
        metrics['search_coverage_warning'] = warning[0] if warning else None
        queued = self.store.db.execute("SELECT value FROM meta WHERE key='search_queue'").fetchone()
        if queued:
            import json
            metrics['search_partitions_remaining'] = len(json.loads(queued[0]))
        from collections import Counter
        metrics['error_reasons'] = dict(Counter(e['reason'] for e in errors))
        metrics['unique_keys'] = len(uris)
        self.checkpoint()
        return uris,errors,metrics

    def close(self):
        try:
            if self.ready and not self.checkpoint_failed: self.checkpoint()
        finally:
            self.store.close()
            if self.branch: self.branch.close()
