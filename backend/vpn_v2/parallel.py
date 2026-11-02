"""Bounded queues: completed downloads must not accumulate an entire crawl in RAM."""
from collections import defaultdict, deque
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from contextlib import contextmanager
import time
from urllib.parse import urlsplit


def completed(pool, items, function, limit, deadline):
    items = iter(items)
    pending = {}
    try:
        while True:
            if time.monotonic() >= deadline:
                raise TimeoutError('work queue deadline')
            while len(pending) < limit:
                item = next(items, None)
                if item is None:
                    break
                pending[pool.submit(function, item)] = item
            if not pending:
                return
            ready, _ = wait(pending, timeout=min(1, deadline-time.monotonic()), return_when=FIRST_COMPLETED)
            while ready:
                future = ready.pop()
                yield pending.pop(future), future
    finally:
        for future in pending:
            future.cancel()


@contextmanager
def host_downloads(rows, fetch, workers, deadline, cancel, per_host=2):
    """Admit work before using a thread, so one host cannot occupy all workers."""
    queues = defaultdict(deque)
    for row in rows:
        queues[urlsplit(row['url']).hostname].append(row)
    ready = deque(queues)
    queued = set(queues)
    active = defaultdict(int)
    pending = {}
    pool = ThreadPoolExecutor(max_workers=workers)

    def available(host):
        if queues[host] and active[host] < per_host and host not in queued:
            ready.append(host)
            queued.add(host)

    def results():
        while ready or pending:
            if time.monotonic() >= deadline:
                raise TimeoutError('crawl budget exhausted')
            while ready and len(pending) < workers:
                host = ready.popleft()
                queued.remove(host)
                row = queues[host].popleft()
                pending[pool.submit(fetch, row)] = (host, row)
                active[host] += 1
                available(host)
            done, _ = wait(pending, timeout=min(1, deadline-time.monotonic()), return_when=FIRST_COMPLETED)
            while done:
                future = done.pop()
                host, row = pending.pop(future)
                active[host] -= 1
                available(host)
                yield row, future

    try:
        yield results()
    finally:
        if pending:
            cancel()
        for future in pending:
            future.cancel()
        pool.shutdown(wait=True, cancel_futures=True)
