"""Public HTTPS downloads with pinned public DNS addresses and host throttling."""
import http.client
import ipaddress
import socket
import ssl
import threading
import time
from urllib.parse import urlsplit, urljoin
from .crawler_store import public_url


class DownloadError(RuntimeError):
    def __init__(self, reason, substantive=False):
        super().__init__(reason)
        self.substantive = substantive


def public_addresses(host, port=443):
    addresses = [r[4][0] for r in socket.getaddrinfo(host,port,type=socket.SOCK_STREAM)]
    if not addresses or any(not ipaddress.ip_address(a).is_global for a in addresses):
        raise DownloadError('non_public_address', True)
    return list(dict.fromkeys(addresses))


class Http:
    def __init__(self, deadline, clock=time.monotonic, sleep=time.sleep):
        self.deadline, self.clock, self.sleep = deadline, clock, sleep
        self.lock, self.slots, self.delays = threading.Lock(), {}, {}
        self.bytes = 0

    def fetch(self, url, headers=None, max_bytes=4*1024*1024):
        for redirect in range(4):
            if not public_url(url): raise DownloadError('unsafe_url', True)
            p = urlsplit(url)
            with self.lock:
                sem = self.slots.setdefault(p.hostname,threading.Semaphore(2))
            with sem:
                for attempt in range(3):
                    if self.clock() >= self.deadline: raise TimeoutError('crawl budget exhausted')
                    delay = self.delays.get(p.hostname,0)
                    if self.clock()+delay >= self.deadline: raise TimeoutError('crawl budget exhausted')
                    self.sleep(delay)
                    try:
                        addresses = public_addresses(p.hostname,p.port or 443)
                        conn = http.client.HTTPSConnection(p.hostname,p.port or 443,timeout=min(10,max(.1,self.deadline-self.clock())),context=ssl.create_default_context())
                        # Keep hostname for SNI/cert validation but connect to the validated IP.
                        def dial(address, timeout, source_address=None):
                            for ip in addresses:
                                try: return socket.create_connection((ip,p.port or 443),timeout,source_address)
                                except OSError: pass
                            raise OSError('public endpoints unreachable')
                        conn._create_connection = dial
                        try:
                            conn.request('GET',p.path+('?' + p.query if p.query else ''),headers={
                                'User-Agent':'TurboProbe-Crawler/3', 'Accept-Encoding':'identity', **(headers or {})})
                            response = conn.getresponse()
                            status = response.status
                            meta = {k.lower():v for k,v in response.getheaders()}
                            body = bytearray()
                            if status == 200:
                                if meta.get('content-encoding','identity') != 'identity': raise DownloadError('unsupported_encoding')
                                while True:
                                    if self.clock() >= self.deadline: raise TimeoutError('crawl budget exhausted')
                                    part = response.read(65536)
                                    if not part: break
                                    body.extend(part)
                                    if len(body)>max_bytes: raise DownloadError('oversized',True)
                            with self.lock: self.bytes += len(body)
                        finally:
                            conn.close()
                        if status in (301,302,303,307,308):
                            if redirect == 3: raise DownloadError('redirect_limit',True)
                            url = urljoin(url,meta.get('location',''))
                            break
                        if status == 429 or status >= 500:
                            try: wait = max(1,float(meta.get('retry-after','2')))
                            except ValueError: wait = 2
                            self.delays[p.hostname] = min(60,max(wait,2**attempt))
                            if attempt < 2: continue
                            raise DownloadError('rate_limited' if status == 429 else 'platform_error')
                        self.delays[p.hostname] = max(0,self.delays.get(p.hostname,0)*.5)
                        if status not in (200,304): raise DownloadError('http_'+str(status),status in (404,410))
                        return status,meta,bytes(body).decode('utf-8','replace')
                    except (OSError,http.client.HTTPException) as exc:
                        if attempt == 2: raise DownloadError('network_error') from None
                        self.delays[p.hostname] = 2**attempt
                else:
                    raise DownloadError('download_failed')
        raise DownloadError('redirect_limit',True)
