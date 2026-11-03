"""Rotate through every stored key; publish early, then continue local verification."""
import argparse
from datetime import datetime,timezone,timedelta
import json
import gzip
import hashlib
from pathlib import Path
import time

from .crawler_run import CrawlRun
from .github import push_snapshot
from .latencylab import LabClient,LabError,check_candidates
from .probe import verify,verify_stable,rank,measure_selected,service_prober
from .secrets import load


def load_progress(path):
    if not path.exists(): return {'version':1,'cursor':'','processed':0,'cycle':1,'best':[]}
    if path.suffix=='.gz':
        with gzip.open(path,'rb') as stream:body=stream.read(256*1024*1024+1)
        if len(body)>256*1024*1024:raise ValueError('Queue checkpoint exceeds size budget')
        value=json.loads(body)
    else:value=json.loads(path.read_text(encoding='utf-8'))
    import re
    if (value.get('version')!=1 or not re.fullmatch('[a-f0-9]{64}|',value.get('cursor','!'))
            or type(value.get('processed')) is not int or value['processed']<0
            or type(value.get('cycle')) is not int or value['cycle']<1
            or not isinstance(value.get('best'),list) or len(value['best'])>200):
        raise ValueError('Invalid rolling queue checkpoint; refusing to reset progress')
    return value


def fresh_best(nodes):
    now=datetime.now(timezone.utc)
    fresh=[]
    for node in nodes:
        try:
            age=now-datetime.fromisoformat(node['checked_at'])
            if timedelta(0)<=age<timedelta(hours=24): fresh.append(node)
        except (KeyError,ValueError,TypeError): pass
    return rank(fresh,200)


def next_window(store,cursor,size):
    return list(store.db.execute('SELECT id,uri FROM nodes WHERE id>? ORDER BY id LIMIT ?',(cursor,size)))


def save_progress(run,progress,private):
    progress['updated_at']=datetime.now(timezone.utc).isoformat()
    # Only public config and measured node fields travel. No API responses/headers.
    fields=('uri','verified','verification_policy','ping_kind','ping_ms','country','checked_at','protocol')
    progress['best']=[{k:n[k] for k in fields if k in n} for n in fresh_best(progress['best'])]
    private.write_text(json.dumps(progress,ensure_ascii=False),encoding='utf-8')
    run.branch.save_progress(progress)


def run_queue(run,progress,private,select=200,window=1000,max_windows=0,recheck=False):
    engine=verify_stable if recheck else verify
    total=run.store.db.execute('SELECT count(*) FROM nodes').fetchone()[0]
    if not total: raise LabError('Saved cache is empty; no source crawl was started')
    def ident(uri):return hashlib.sha256(uri.split('#',1)[0].encode()).hexdigest()
    local={n['id']:n for n in progress.get('local',[])}
    lab={n['id']:n for n in progress.get('lab',[])}
    def remember(nodes):
        for n in nodes:
            key=ident(n['uri'])
            local[key]={'id':key,'ping_ms':n['ping_ms'],'country':n.get('country','GLOBAL'),'checked_at':n['checked_at'],
                        'verification_rounds':n.get('verification_rounds',1),
                        **{k:n[k] for k in ('speed_mbps','speed_status','speed_transfer_bytes','country_source') if k in n}}
    def current_nodes():
        now=datetime.now(timezone.utc);result=[]
        for key,n in list(local.items()):
            try:age=(now-datetime.fromisoformat(n['checked_at'])).total_seconds()
            except (ValueError,TypeError,KeyError):age=86400
            if not 0<=age<86400:local.pop(key);continue
            row=run.store.db.execute('SELECT uri FROM nodes WHERE id=?',(key,)).fetchone()
            if not row:continue
            item={**n,'uri':row[0],'verified':True,'verification_policy':'tunnel-https-v1',
                  'verification_scope':'tunnel_daily','ping_kind':'https_tunnel',
                  'expires_at':(datetime.fromisoformat(n['checked_at'])+timedelta(hours=24)).isoformat(),
                  'protocol':row[0].split('://')[0]}
            confirmation=lab.get(key)
            if confirmation:
                try:valid=datetime.fromisoformat(confirmation['expires_at'])>now
                except (ValueError,TypeError,KeyError):valid=False
                if valid:item.update({k:v for k,v in confirmation.items() if k!='id'})
                else:lab.pop(key,None)
            result.append(item)
        return sorted(result,key=lambda n:n['ping_ms'])
    def checkpoint():
        progress['local']=list(local.values());progress['lab']=list(lab.values())
        save_progress(run,progress,private)
    def publish_current():
        nodes=current_nodes()
        if not nodes:return False
        report={'schema_version':1,'publication_profile':'tunnel-and-latencylab','mode':'cached-rolling',
                'updated_at':datetime.now(timezone.utc).isoformat(),'candidate_count':progress['processed'],
                'nodes':nodes,'selected_count':sum(n.get('latencylab_verified') is True for n in nodes),
                'crawler':{'scope':'checked_cache_subset','cached_pool_size':total,
                           'processed_in_cycle':progress['processed'],'cycle':progress['cycle']}}
        (private.parent/'rolling-result.json').write_text(json.dumps(report,ensure_ascii=False),encoding='utf-8')
        push_snapshot(report,load('GITHUB_TOKEN'))
        print(f'PUBLISHED: {len(nodes)} tunnel nodes; {report["selected_count"]} in LatencyLab group',flush=True)
        return True
    lab_paused=False
    def lab_batch(all_nodes):
        nonlocal lab_paused
        if lab_paused or time.monotonic()>=run.deadline:return False
        today=datetime.now(timezone.utc).date().isoformat()
        daily=progress.get('daily',{})
        if daily.get('date')!=today:daily={'date':today,'reserved':[]}
        progress['daily']=daily
        remaining=max(0,select-len(daily['reserved']))
        selected=[n for n in all_nodes if ident(n['uri']) not in daily['reserved'] and n.get('latencylab_verified') is not True][:min(20,remaining)]
        if selected:
            # Reserve before POST; uncertainty must never cause duplicate daily spending.
            daily['reserved'].extend(ident(n['uri']) for n in selected)
            checkpoint()
            clients=[LabClient(load(name)) for name in ('LATENCYLAB_API_KEY_1','LATENCYLAB_API_KEY_2')]
            for i,client in enumerate(clients):client.attach_store(run.store,datetime.now(timezone.utc).isoformat(),i,run.checkpoint_jobs)
            summary={}
            try:
                passed=check_candidates(selected,clients,allow_partial=True,summary=summary,deadline=run.deadline)
                for n in passed:
                    key=ident(n['uri']);remember([n])
                    lab[key]={'id':key,**{k:n[k] for k in ('latencylab_verified','latencylab_checked_at','latencylab_operators','expires_at')}}
                print(f'LatencyLab daily reserved: {len(daily["reserved"])}/{select}; accepted this batch: {len(passed)}',flush=True)
            except LabError as error:
                lab_paused=True
                print(f'LatencyLab: {error}; ordinary verification continues',flush=True)
            checkpoint()
            if summary.get('quota_exhausted') or summary.get('agent_errors'):lab_paused=True
            return True
        return False
    prior=fresh_best(progress['best'])
    progress['best']=engine([n['uri'] for n in prior],deadline=run.local_deadline) if prior else []
    still_good={ident(n['uri']) for n in progress['best']}
    for old in prior:
        key=ident(old['uri'])
        if key not in still_good:local.pop(key,None);lab.pop(key,None)
    remember(progress['best'])
    published=False;windows=0
    print(f'Rolling queue: {total} stored keys; cycle {progress["cycle"]}; '
          f'{progress["processed"]} processed; LatencyLab daily ceiling={select}',flush=True)
    while time.monotonic()<run.local_deadline:
        rows=next_window(run.store,progress['cursor'],window)
        if not rows:
            if windows:break
            progress.update(cursor='',processed=0,cycle=progress['cycle']+1)
            rows=next_window(run.store,'',window)
        try:verified=engine([r[1] for r in rows],deadline=run.local_deadline)
        except TimeoutError:
            print('Local budget reached; unfinished window will be retried next run',flush=True);break
        good={ident(n['uri']) for n in verified}
        for key,_ in rows:
            if key not in good:local.pop(key,None);lab.pop(key,None)
        remember(verified)
        all_nodes=current_nodes()
        progress['best']=rank(all_nodes,200)
        progress['cursor']=rows[-1][0];progress['processed']+=len(rows);windows+=1
        checkpoint()
        published=publish_current() or published
        print(f'Queue progress: {progress["processed"]}/{total}; {len(local)} fresh tunnel nodes',flush=True)
        if max_windows and windows>=max_windows:break
        if not next_window(run.store,progress['cursor'],1):break
    # Never spend quota on early windows. Freeze the global shortlist only once
    # the saved pool has been visited, then measure speed without reranking it.
    complete = not next_window(run.store,progress['cursor'],1) and progress['processed'] >= total
    if complete and select:
        shortlist = rank(current_nodes(), min(select,200))
        print(f'Local pool complete: global top {len(shortlist)} selected for LatencyLab',flush=True)
        daily = progress.get('daily',{})
        reserved = daily.get('reserved',[]) if daily.get('date') == datetime.now(timezone.utc).date().isoformat() else []
        shortlist = [n for n in shortlist if ident(n['uri']) not in reserved and n.get('latencylab_verified') is not True][:max(0,select-len(reserved))]
        try:
            shortlist = measure_selected(shortlist,deadline=run.deadline) if shortlist else []
            remember(shortlist)
            checkpoint()
            published=publish_current() or published
            while time.monotonic()<run.deadline and lab_batch(shortlist):
                published=publish_current() or published
        except TimeoutError:
            print('Final-stage budget reached; progress preserved',flush=True)
    elif select:
        print('LatencyLab deferred: local pool incomplete; quota not spent on an intermediate top',flush=True)
    checkpoint()
    print(f'Queue saved: {progress["processed"]}/{total}; next run resumes at cursor',flush=True)
    if not published:raise LabError('Queue saved; no fresh tunnel nodes available for publication')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--select',type=int,default=200)
    parser.add_argument('--window',type=int,default=1000)
    parser.add_argument('--max-windows',type=int,default=0,help='0 continues until the local budget; 1 is a bounded pilot')
    parser.add_argument('--budget-seconds',type=int,default=21600)
    parser.add_argument('--recheck',action='store_true',help='require a second complete HTTPS pass with fresh cores')
    args=parser.parse_args()
    if not 0<=args.select<=200 or not 1<=args.window<=5000 or args.max_windows<0:parser.error('invalid select/window size')
    if not 5401<=args.budget_seconds<=21600:parser.error('invalid time budget')
    names=('GITHUB_TOKEN',)+(('LATENCYLAB_API_KEY_1','LATENCYLAB_API_KEY_2') if args.select else ())
    for name in names:
        if not load(name):raise LabError(f'Missing secret: {name}')
    private=Path(__file__).resolve().parent/'.local'
    run=CrawlRun(private/'rolling-state',load('GITHUB_TOKEN'),True,args.budget_seconds,persist_checkpoints=False)
    if not args.select:
        run.local_deadline=run.deadline-300  # No Lab stage: retain five minutes for final checkpoint/publication.
    try:
        service_prober.get_xray_binary_path();service_prober.get_mihomo_binary_path()
        progress_path=run.branch.path/'probe-progress.json.gz'
        if not progress_path.exists():progress_path=run.branch.path/'probe-progress.json'
        progress=load_progress(progress_path)
        run_queue(run,progress,private/'probe-progress.json',args.select,args.window,args.max_windows,args.recheck)
    finally:run.close()


if __name__=='__main__':
    try:main()
    except (LabError,RuntimeError,ValueError) as error:raise SystemExit(str(error)) from None
