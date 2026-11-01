"""Sequential LatencyLab jobs with account-scoped quota and fail-closed results."""
from __future__ import annotations

import time
from datetime import datetime, timezone, timedelta
from urllib.parse import quote
import requests

BASE = 'https://console.latencylab.ru'


class LabError(RuntimeError):
    pass


class LabClient:
    def __init__(self, token, session=None, sleep=time.sleep, clock=time.monotonic):
        self.session = session or requests.Session()
        self.session.trust_env = False
        self.session.headers.update({'Authorization': 'Bearer ' + token, 'Accept': 'application/json'})
        self.sleep, self.clock = sleep, clock

    def request(self, method, path, **kwargs):
        try:
            response = self.session.request(method, BASE + path, timeout=(10, 30),
                                            allow_redirects=False, **kwargs)
        except requests.RequestException as exc:
            # Network errors can contain sensitive URLs or request details.
            raise LabError('LatencyLab request failed: ' + type(exc).__name__) from None
        if response.status_code != 200:
            raise LabError('LatencyLab HTTP ' + str(response.status_code))
        try:
            data = response.json()
        except ValueError:
            raise LabError('LatencyLab returned invalid JSON') from None
        if not isinstance(data, dict) or data.get('ok') is not True:
            raise LabError('LatencyLab returned an error')
        return data

    def stats(self):
        result = self.request('GET', '/api/lab/account/stats').get('result', {})
        window = result.get('window', {})
        user_id, used, limit = result.get('user_id'), window.get('used'), window.get('limit')
        if not isinstance(user_id, int) or any(type(x) is not int or x < 0 for x in (used, limit)):
            raise LabError('LatencyLab quota is unavailable')
        return user_id, max(0, limit - used)

    def operators(self):
        result = self.request('GET', '/api/lab/operators').get('result', {})
        online = result.get('online') if isinstance(result, dict) else None
        if not isinstance(online, list) or not online or not all(isinstance(x, str) and x for x in online):
            raise LabError('No available LatencyLab operators')
        return sorted(set(online))

    def check(self, uri, operators, timeout=180, poll_interval=5):
        start = self.request('POST', '/api/lab/vpn-key', json={'uri': uri, 'operators': operators, 'operator': 'multiscan'})
        req_id = start.get('req_id')
        if start.get('status') != 'pending' or not isinstance(req_id, str) or not req_id:
            raise LabError('Unexpected LatencyLab job response')
        deadline = self.clock() + timeout
        polls = 0
        while self.clock() < deadline:
            job = self.request('GET', '/api/lab/job/' + quote(req_id, safe=''))
            if job.get('status') == 'done':
                return passes_all(job.get('result'), operators)
            if job.get('status') != 'pending':
                raise LabError('LatencyLab job did not complete')
            polls += 1
            if polls % 6 == 0:
                print('LatencyLab: job still pending', flush=True)
            self.sleep(poll_interval)
        raise LabError('LatencyLab job timed out; submission will not be repeated')


def passes_all(result, expected):
    if not isinstance(result, dict) or not expected:
        return False
    rows = result.get('results')
    if not isinstance(rows, list):
        rows = [result]
    seen = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get('operator'), str):
            return False
        op = row['operator']
        if op in seen:
            return False
        seen[op] = row.get('ok') is True
    return set(seen) == set(expected) and all(seen.values())


def check_candidates(nodes, clients, *, allow_partial=False, summary=None):
    if not clients:
        raise LabError('LatencyLab credentials are not configured')
    index, passed, accounts, attempted = 0, [], {}, 0
    if summary is not None:
        summary.update(attempted=0, quota_exhausted=False)
    for node in nodes:
        while index < len(clients):
            account, remaining = clients[index].stats()
            if account in (v for k, v in accounts.items() if k != index):
                raise LabError('LatencyLab keys belong to the same account')
            accounts[index] = account
            if remaining > 0:
                break
            index += 1
        if index == len(clients):
            if allow_partial and attempted:
                if summary is not None:
                    summary['quota_exhausted'] = True
                break
            raise LabError('LatencyLab quota exhausted')
        ops = clients[index].operators()
        accepted = clients[index].check(node['uri'], ops)
        attempted += 1
        print(f'LatencyLab progress: {attempted}/{len(nodes)}; current {"passed" if accepted else "rejected"}', flush=True)
        if summary is not None:
            summary['attempted'] = attempted
        if accepted:
            checked = datetime.now(timezone.utc)
            passed.append({**node, 'latencylab_operators': ops, 'latencylab_verified': True,
                           'latencylab_checked_at': checked.isoformat(),
                           'expires_at': (checked + timedelta(hours=24)).isoformat(), 'ru_verified': False})
    return passed
