"""Short subscription labels; connection parameters are never reformatted."""
import base64
import json
import re
from urllib.parse import quote


def label(country):
    country = str(country or '').upper()
    if not re.fullmatch('[A-Z]{2}',country): return 'TurboProbe 🌐'
    flag = ''.join(chr(127397+ord(c)) for c in country)
    return f'TurboProbe {flag} {country}'


def format_uri(uri,country):
    name = label(country)
    base = uri.split('#',1)[0]
    if base.lower().startswith('vmess://'):
        payload = base[8:]
        try:
            data = json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)))
            if not isinstance(data,dict): return uri
            data['ps'] = name
            return 'vmess://'+base64.b64encode(json.dumps(data,ensure_ascii=False,separators=(',',':')).encode()).decode()
        except (ValueError,TypeError): return uri
    return base+'#'+quote(name,safe='')
