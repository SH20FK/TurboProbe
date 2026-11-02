"""Shared per-run DNS/endpoint checks; independent credentials still get tunnel tests."""
import asyncio
import time
from .crawler_http import public_addresses, DownloadError


async def prefilter(uris, parse_endpoint, deadline):
    dns_sem = asyncio.Semaphore(32)
    dns, resolving, endpoints = {}, {}, {}

    async def resolve(host, port):
        async with dns_sem:
            try:
                return await asyncio.wait_for(asyncio.to_thread(public_addresses,host,port),1.5)
            except (OSError,ValueError,DownloadError):
                return []

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
                    _,writer = await asyncio.wait_for(asyncio.open_connection(address,port),1.5)
                    return True
                except (OSError,ValueError,asyncio.TimeoutError): pass
                finally:
                    if writer: writer.close()
            return False
        except (OSError,ValueError,DownloadError):
            return False

    def key_for(uri):
        host,port,_ = parse_endpoint(uri)
        udp = uri.split('://')[0].lower() in ('hy2','hysteria2','tuic')
        return host,port,udp

    # One queue entry per address, not one Task for every credential/URI.
    for uri in uris:
        if time.monotonic() >= deadline: raise TimeoutError('verification deadline')
        endpoints.setdefault(key_for(uri),False)
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
    result = [uri for uri in uris if endpoints[key_for(uri)]]
    print(f'Prefilter: {len(dns)} unique hosts, {len(endpoints)} unique endpoints',flush=True)
    return result
