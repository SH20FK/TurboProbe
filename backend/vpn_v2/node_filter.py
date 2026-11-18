"""Reject endpoints that can never be a usable public proxy.

The pool inherited tens of thousands of 127.0.0.1 and mis-parsed hosts from
free-config mirrors; checking them costs real tunnel time and publishes nothing.
"""
import ipaddress
import re
from urllib.parse import urlsplit

HOSTNAME = re.compile(r'^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$')
LOCAL_SUFFIXES = ('.local', '.localhost', '.internal', '.lan', '.home', '.corp', '.arpa')
BLOCKED_HOSTS = {
    'localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback',
    'speedtest.net', 'www.speedtest.net', 'fast.com', 'www.fast.com',
}


def endpoint_of(uri):
    """Returns (scheme, host, port) or None when the URI cannot have a real endpoint."""
    if not isinstance(uri, str) or '://' not in uri:
        return None
    try:
        parsed = urlsplit(uri.strip())
        scheme = parsed.scheme.lower()
        host = (parsed.hostname or '').strip('[]').lower()
        port = parsed.port
    except ValueError:
        return None
    if not scheme or not host:
        return None
    if port is None:
        port = 443
    if not 1 <= port <= 65535:
        return None
    return scheme, host, port


def is_junk_uri(uri):
    """True when the endpoint is loopback/private/reserved or a known non-proxy host."""
    endpoint = endpoint_of(uri)
    if endpoint is None:
        return True
    _scheme, host, _port = endpoint
    if host in BLOCKED_HOSTS or host.endswith(LOCAL_SUFFIXES):
        return True
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return HOSTNAME.fullmatch(host) is None
    return not address.is_global


def split_junk(uris):
    """Returns (usable, junk_count) preserving the input order."""
    usable, junk = [], 0
    for uri in uris:
        if is_junk_uri(uri):
            junk += 1
        else:
            usable.append(uri)
    return usable, junk
