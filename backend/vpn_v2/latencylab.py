"""Sequential LatencyLab jobs with account-scoped quota and fail-closed results."""
from __future__ import annotations

import time
import json
import hashlib
from datetime import datetime, timezone, timedelta
from urllib.parse import quote
import requests

BASE = 'https://console.latencylab.ru'


class LabError(RuntimeError):
    pass


class LabJobError(LabError):
    """The upstream agent explicitly finished this job with an error."""
    pass


class LabClient:
    def __init__(self, token, session=None, sleep=time.sleep, clock=time.monotonic):
        self.session = session or requests.Session()
        self.session.trust_env = False
        self.session.headers.update({'Authorization': 'Bearer ' + token, 'Accept': 'application/json'})
        self.sleep, self.clock = sleep, clock
        self.last_result = None
        self.deadline = float('inf')
        self.store = None

    def attach_store(self, store, run, account, checkpoint):
        self.store,self.run,self.account,self.checkpoint = store,run,account,checkpoint

    def save_job(self, node, req_id, status, payload=None):
        if self.store:
            self.store.db.execute('INSERT OR REPLACE INTO jobs VALUES(?,?,?,?,?,?)',
                (self.run,node,req_id,self.account,status,json.dumps(payload or {})))
            self.store.db.commit()
            self.checkpoint()

    def request(self, method, path, **kwargs):
        for attempt in range(3 if method == 'GET' else 1):
            remaining = self.deadline-self.clock()
            if remaining <= 0: raise TimeoutError('LatencyLab run deadline')
            try:
                response = self.session.request(method, BASE + path, timeout=(min(10,remaining), min(30,remaining)),
                                                allow_redirects=False, **kwargs)
            except requests.RequestException as exc:
                if method == 'GET' and attempt < 2:
                    self.sleep(2 ** (attempt + 1))
                    continue
                raise LabError('LatencyLab request failed: ' + type(exc).__name__) from None
            if response.status_code == 502 and path.startswith('/api/lab/job/'):
                try:
                    payload = response.json()
                except ValueError:
                    payload = {}
                if isinstance(payload, dict) and payload.get('status') == 'error':
                    raise LabJobError('LatencyLab agent failed this job (HTTP 502)')
            if method == 'GET' and response.status_code in (502, 503, 504) and attempt < 2:
                print(f'LatencyLab: temporary HTTP {response.status_code}; retrying GET', flush=True)
                self.sleep(2 ** (attempt + 1))
                continue
            break
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
        self.last_result = None
        node = hashlib.sha256(uri.split('#',1)[0].encode()).hexdigest()
        prior = self.store.db.execute("SELECT request_id,status FROM jobs WHERE node=? AND account=? ORDER BY rowid DESC LIMIT 1",(node,self.account)).fetchone() if self.store else None
        req_id = prior[0] if prior and prior[1] == 'pending' else None
        if prior and prior[1] == 'submitting':
            active = self.request('GET','/api/lab/job/active')
            if active.get('status') == 'pending' and active.get('scan_target','').split('#')[0] == uri.split('#')[0]:
                req_id = active.get('req_id')
            else:
                raise LabError('Previous submission is uncertain; refusing duplicate POST; inspect private job state')
        if not req_id:
            self.save_job(node,None,'submitting')
            start = self.request('POST', '/api/lab/vpn-key', json={'uri': uri, 'operators': operators, 'operator': 'multiscan'})
            req_id = start.get('req_id')
            if start.get('status') != 'pending' or not isinstance(req_id, str) or not req_id:
                raise LabError('Unexpected LatencyLab job response')
        self.save_job(node,req_id,'pending')
        deadline = min(self.deadline,self.clock() + timeout)
        polls = 0
        while self.clock() < deadline:
            try:
                job = self.request('GET', '/api/lab/job/' + quote(req_id, safe=''))
            except LabJobError:
                self.save_job(node,req_id,'agent_error')
                raise
            if job.get('status') == 'done':
                self.last_result = job.get('result')
                self.save_job(node,req_id,'done',self.last_result)
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


def check_candidates(nodes, clients, *, allow_partial=False, summary=None, deadline=float('inf')):
    if not clients:
        raise LabError('LatencyLab credentials are not configured')
    index, passed, accounts, attempted = 0, [], {}, 0
    if summary is not None:
        summary.update(attempted=0, quota_exhausted=False, agent_errors=0, results=[])
    for node in nodes:
        if time.monotonic() >= deadline: raise TimeoutError('LatencyLab run deadline')
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
        clients[index].deadline = deadline
        started = time.monotonic()
        try:
            accepted = clients[index].check(node['uri'], ops)
        except LabJobError:
            attempted += 1
            if summary is not None:
                summary['attempted'] = attempted
                summary['agent_errors'] += 1
                summary['results'].append({'candidate_index': attempted-1, 'status': 'agent_error', 'operators': ops})
            print(f'LatencyLab progress: {attempted}/{len(nodes)}; agent error (not a node rejection)', flush=True)
            if summary is None:
                raise
            continue
        attempted += 1
        print(f'LatencyLab progress: {attempted}/{len(nodes)}; current {"passed" if accepted else "rejected"}; {time.monotonic()-started:.0f}s', flush=True)
        if summary is not None:
            summary['attempted'] = attempted
            result = getattr(clients[index], 'last_result', None)
            summary['results'].append({'candidate_index': attempted-1, 'accepted': accepted, 'operators': ops, 'result': result})
            rows = result.get('results', [result]) if isinstance(result, dict) else []
            statuses = {r.get('operator'): r.get('ok') is True for r in rows if isinstance(r, dict)}
            print('LatencyLab operators: ' + ', '.join(op + '=' + ('OK' if statuses.get(op) else 'FAIL/MISSING') for op in ops), flush=True)
        if accepted:
            checked = datetime.now(timezone.utc)
            passed.append({**node, 'latencylab_operators': ops, 'latencylab_verified': True,
                           'latencylab_checked_at': checked.isoformat(),
                           'expires_at': (checked + timedelta(hours=24)).isoformat(), 'ru_verified': False})
    return passed
