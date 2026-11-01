"""Shared per-run DNS/endpoint checks; independent credentials still get tunnel tests."""
import asyncio
import time
from .crawler_http import public_addresses, DownloadError


async def prefilter(uris, parse_endpoint, deadline):
    sem = asyncio.Semaphore(128)
    dns, endpoints = {}, {}

    async def resolve(host, port):
        async with sem:
            return await asyncio.wait_for(asyncio.to_thread(public_addresses,host,port),1.5)

    async def endpoint(host, port, udp):
        if time.monotonic() >= deadline: raise TimeoutError('verification deadline')
        try:
            if host not in dns: dns[host] = asyncio.create_task(resolve(host,port))
            addresses = await dns[host]
            if udp: return True
            async with sem:
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

    async def check(uri):
        host,port,_ = parse_endpoint(uri)
        udp = uri.split('://')[0].lower() in ('hy2','hysteria2','tuic')
        key = (host,port,udp)
        if key not in endpoints: endpoints[key] = asyncio.create_task(endpoint(host,port,udp))
        return uri if await endpoints[key] else None

    result = [uri for uri in await asyncio.gather(*(check(uri) for uri in uris)) if uri]
    if time.monotonic() >= deadline: raise TimeoutError('verification deadline')
    print(f'Prefilter: {len(dns)} unique hosts, {len(endpoints)} unique endpoints',flush=True)
    return result
