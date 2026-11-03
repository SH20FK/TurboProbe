"""Shared per-run DNS/endpoint checks; independent credentials still get tunnel tests."""
import asyncio
import time
from collections import OrderedDict


class ProbeCache:
    """Bounded monotonic TTL cache; no tasks/sockets survive an event loop."""
    def __init__(self, limit=32768):
        self.limit = limit
        self.items = OrderedDict()

    def get(self, key):
        row = self.items.get(key)
        if row is None: return None
        if row[0] <= time.monotonic():
            self.items.pop(key, None)
            return None
        self.items.move_to_end(key)
        return row[1]

    def put(self, key, value, ttl):
        self.items[key] = (time.monotonic()+ttl, value)
        self.items.move_to_end(key)
        while len(self.items) > self.limit: self.items.popitem(last=False)


RUN_CACHE = ProbeCache()
from .crawler_http import public_addresses, DownloadError


async def prefilter(uris, parse_endpoint, deadline, *, cache=None):
    cache = RUN_CACHE if cache is None else cache
    dns_sem = asyncio.Semaphore(32)
    dns, resolving, endpoints = {}, {}, {}

    async def resolve(host, port):
        async with dns_sem:
            key = ('dns', host)
            cached = cache.get(key)
            if cached is not None: return cached
            try:
                addresses = await asyncio.wait_for(asyncio.to_thread(public_addresses,host,port),1.5)
            except (OSError,ValueError,DownloadError,asyncio.TimeoutError):
                addresses = []
            cache.put(key, addresses, 300 if addresses else 10)
            return addresses

    async def addresses_for(host, port):
        if host not in dns:
            if host not in resolving:
                resolving[host] = asyncio.create_task(resolve(host,port))
            dns[host] = await resolving[host]
            resolving.pop(host,None)
        return dns[host]

    async def endpoint(host, port, udp):
        if time.monotonic() >= deadline: raise TimeoutError('verification deadline')
        try:
            addresses = await addresses_for(host,port)
            if udp: return bool(addresses)
            for address in addresses[:4]:
                if time.monotonic() >= deadline: raise TimeoutError('verification deadline')
                writer = None
                try:
                    key = ('tcp', address, port)
                    cached = cache.get(key)
                    if cached is True: return True
                    if cached is False: continue
                    _,writer = await asyncio.wait_for(asyncio.open_connection(address,port),1.5)
                    cache.put(key, True, 60)
                    return True
                except (OSError,ValueError,asyncio.TimeoutError):
                    cache.put(('tcp', address, port), False, 10)
                finally:
                    if writer: writer.close()
            return False
        except (OSError,ValueError,DownloadError):
            return False

    def key_for(uri):
        if uri.split('://')[0].lower() in ('hy2','hysteria2','tuic'): return None
        host,port,_ = parse_endpoint(uri)
        return host,port,False

    # One queue entry per address, not one Task for every credential/URI.
    for uri in uris:
        if time.monotonic() >= deadline: raise TimeoutError('verification deadline')
        key = key_for(uri)
        if key is not None: endpoints.setdefault(key,False)
    queue = iter(endpoints)
    checked = 0
    async def worker():
        nonlocal checked
        for key in queue:
            endpoints[key] = await endpoint(*key)
            checked += 1
            if checked % 1000 == 0:
                print(f'Prefilter progress: {checked}/{len(endpoints)} unique endpoints',flush=True)
    tasks = [asyncio.create_task(worker()) for _ in range(min(128,len(endpoints)))]
    try:
        await asyncio.gather(*tasks)
    finally:
        for task in tasks: task.cancel()
        await asyncio.gather(*tasks,return_exceptions=True)
        for task in resolving.values(): task.cancel()
        await asyncio.gather(*resolving.values(),return_exceptions=True)
    if time.monotonic() >= deadline: raise TimeoutError('verification deadline')
    result = [uri for uri in uris if key_for(uri) is None or endpoints[key_for(uri)]]
    print(f'Prefilter: {len(dns)} unique hosts, {len(endpoints)} unique endpoints',flush=True)
    return result
