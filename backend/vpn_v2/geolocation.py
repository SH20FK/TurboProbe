"""Observe exit country through the selected SOCKS tunnel, never from its label."""
import ipaddress
import json
import re
import time
from .probe import service_prober  # also initializes the legacy verification import path
from verification import read_response, valid_response
from requests import RequestException


def country_through_tunnel(session, deadline):
    for url, kind in (('https://www.cloudflare.com/cdn-cgi/trace','trace'),
                      ('https://ipwho.is/','json')):
        if time.monotonic() >= deadline: break
        try:
            status,body = read_response(session,url,deadline,3,16384)
            if kind == 'trace':
                if not valid_response('trace',status,body): continue
                data = dict(line.split('=',1) for line in body.decode().splitlines() if '=' in line)
                code = data.get('loc','').upper()
            else:
                if status != 200: continue
                data = json.loads(body)
                if not isinstance(data,dict) or data.get('success') is not True: continue
                if not ipaddress.ip_address(data.get('ip','')).is_global: continue
                code = str(data.get('country_code','')).upper()
            if re.fullmatch('[A-Z]{2}',code): return code
        except (RequestException,OSError,ValueError,TypeError):
            continue
    return 'GLOBAL'
