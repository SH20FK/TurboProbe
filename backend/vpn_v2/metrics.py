"""Per-stage timing and counters for one v2 pipeline run.

Stage seconds are summed across parallel batches, so they can exceed wall time;
the snapshot therefore reports both `elapsed_s` and per-stage totals.
"""
import json
import threading
import time
from contextlib import contextmanager
from pathlib import Path


class Metrics:
    def __init__(self):
        self.started = time.monotonic()
        self.stages = {}
        self.counters = {}
        self._lock = threading.Lock()

    def add(self, name, seconds):
        with self._lock:
            row = self.stages.setdefault(name, {'seconds': 0.0, 'calls': 0})
            row['seconds'] += seconds
            row['calls'] += 1

    def count(self, name, value=1):
        with self._lock:
            self.counters[name] = self.counters.get(name, 0) + value

    def snapshot(self):
        with self._lock:
            return {
                'version': 1,
                'elapsed_s': round(time.monotonic() - self.started, 2),
                'stages': {name: {'seconds': round(row['seconds'], 2), 'calls': row['calls']}
                           for name, row in sorted(self.stages.items())},
                'counters': dict(sorted(self.counters.items())),
            }

    def write(self, path):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.snapshot(), ensure_ascii=False, indent=2), encoding='utf-8')
        return path


METRICS = Metrics()


@contextmanager
def stage(name):
    start = time.monotonic()
    try:
        yield
    finally:
        METRICS.add(name, time.monotonic() - start)


def count(name, value=1):
    METRICS.count(name, value)
