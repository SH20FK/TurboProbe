"""Conservative concurrency using CPUs available to the process/container."""
import math
import os
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
            'probe_workers': min(8, max(2, cpus*2)), 'probe_batch': 16}
