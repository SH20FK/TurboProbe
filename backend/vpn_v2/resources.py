"""Conservative concurrency using CPUs available to the process/container."""
import math
import os
import json
import threading
import time
from contextlib import contextmanager
from pathlib import Path


def cpu_count():
    count = (getattr(os, 'process_cpu_count', os.cpu_count)() or 1)
    if hasattr(os, 'sched_getaffinity'):
        count = min(count, len(os.sched_getaffinity(0)))
    try:
        quota, period = Path('/sys/fs/cgroup/cpu.max').read_text().split()
        if quota != 'max':
            count = min(count, max(1, math.ceil(int(quota)/int(period))))
    except (OSError, ValueError, ZeroDivisionError):
        pass
    return max(1, count)


def concurrency():
    cpus = cpu_count()
    return {'cpus': cpus, 'downloads': min(64, max(24, cpus*16)),
            'probe_workers': min(4, cpus), 'probe_batch': 8}


def runtime_sample():
    result={'at':time.time()}
    for name, paths in {
        'memory_current':('/sys/fs/cgroup/memory.current','/sys/fs/cgroup/memory/memory.usage_in_bytes'),
        'memory_max':('/sys/fs/cgroup/memory.max','/sys/fs/cgroup/memory/memory.limit_in_bytes'),
        'pids_current':('/sys/fs/cgroup/pids.current','/sys/fs/cgroup/pids/pids.current'),
        'pids_max':('/sys/fs/cgroup/pids.max','/sys/fs/cgroup/pids/pids.max'),
        'memory_events':('/sys/fs/cgroup/memory.events',),
    }.items():
        for path in paths:
            try:
                value=Path(path).read_text().strip()
                result[name]=int(value) if value.isdecimal() else value
                break
            except OSError:pass
    return result


@contextmanager
def runtime_monitor(root):
    target=Path(root)/'backend/vpn_v2/.local/runtime-health.jsonl'
    target.parent.mkdir(parents=True,exist_ok=True)
    stop=threading.Event()
    def sample():
        data=runtime_sample()
        try:
            with target.open('a',encoding='utf-8') as stream:stream.write(json.dumps(data)+'\n')
        except OSError:pass
        print('Runtime health: '+json.dumps(data),flush=True)
    def monitor():
        while not stop.wait(30):sample()
    sample()
    thread=threading.Thread(target=monitor,daemon=True)
    thread.start()
    try:yield
    finally:
        stop.set();thread.join(timeout=2);sample()
