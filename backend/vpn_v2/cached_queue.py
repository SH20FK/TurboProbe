"""Rotate through every stored key; publish early, then continue local verification."""
import argparse
from datetime import datetime,timezone,timedelta
import json
from pathlib import Path
import time

from .crawler_run import CrawlRun
from .github import push_snapshot
from .latencylab import LabClient,LabError,check_candidates
from .probe import verify,rank,measure_selected,service_prober
from .secrets import load


def load_progress(path):
    if not path.exists(): return {'version':1,'cursor':'','processed':0,'cycle':1,'best':[]}
    value=json.loads(path.read_text(encoding='utf-8'))
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


def run_queue(run,progress,private,select=10,window=1000):
    total=run.store.db.execute('SELECT count(*) FROM nodes').fetchone()[0]
    if not total: raise LabError('Saved cache is empty; no source crawl was started')
    # Prior winners are refreshed, while the cursor still advances through other keys.
    prior=fresh_best(progress['best'])
    progress['best']=verify([n['uri'] for n in prior],deadline=run.local_deadline) if prior else []
    published=False
    lab_attempted=False
    windows=0
    print(f'Rolling queue: {total} stored keys; cycle {progress["cycle"]}; '
          f'{progress["processed"]} processed in this cycle; window={window}',flush=True)
    while time.monotonic()<run.local_deadline:
        rows=next_window(run.store,progress['cursor'],window)
        if not rows:
            if windows: break
            progress.update(cursor='',processed=0,cycle=progress['cycle']+1)
            rows=next_window(run.store,'',window)
        try:
            verified=verify([r[1] for r in rows],deadline=run.local_deadline)
        except TimeoutError:
            print('Local time budget reached; unfinished window will be retried next run',flush=True)
            break
        best={n['uri'].split('#',1)[0]:n for n in fresh_best(progress['best'])}
        best.update({n['uri'].split('#',1)[0]:n for n in verified})
        progress['best']=rank(list(best.values()),200)
        progress['cursor']=rows[-1][0]
        progress['processed']+=len(rows)
        windows+=1
        save_progress(run,progress,private)
        exhausted=not next_window(run.store,progress['cursor'],1)
        print(f'Queue progress: {progress["processed"]}/{total}; '
              f'{len(progress["best"])} fresh winners retained',flush=True)
        if not lab_attempted and (len(progress['best'])>=select or exhausted):
            lab_attempted=True
            selected=measure_selected(rank(progress['best'],select),deadline=run.deadline)
            if selected:
                summary={}
                clients=[LabClient(load(name)) for name in ('LATENCYLAB_API_KEY_1','LATENCYLAB_API_KEY_2')]
                for i,client in enumerate(clients):client.attach_store(run.store,datetime.now(timezone.utc).isoformat(),i,run.checkpoint_jobs)
                try:
                    passed=check_candidates(selected,clients,allow_partial=False,summary=summary,deadline=run.deadline)
                    if summary.get('agent_errors'):raise LabError('LatencyLab agent errors; previous subscription preserved')
                    report={'schema_version':1,'mode':'cached-rolling','updated_at':datetime.now(timezone.utc).isoformat(),
                            'candidate_count':progress['processed'],'selected_count':len(selected),'nodes':passed,
                            'latencylab':summary,'crawler':{'scope':'checked_cache_subset','cached_pool_size':total,
                            'processed_in_cycle':progress['processed'],'cycle':progress['cycle']}}
                    (private.parent/'rolling-result.json').write_text(json.dumps(report,ensure_ascii=False),encoding='utf-8')
                    if passed:
                        push_snapshot(report,load('GITHUB_TOKEN'))
                        published=True
                        print(f'PUBLISHED: {len(passed)} nodes. Continuing the remaining queue without additional LatencyLab jobs.',flush=True)
                    else:print('No LatencyLab passes; old subscription preserved. Continuing local queue.',flush=True)
                except LabError as error:print(f'LatencyLab: {error}; local queue continues',flush=True)
        if exhausted:break
    # Cursor moves only after a whole window finishes and its checkpoint is saved.
    save_progress(run,progress,private)
    print(f'Queue saved: cycle {progress["cycle"]}, processed {progress["processed"]}/{total}. '
          'Next run resumes at the saved cursor.',flush=True)
    if not published:raise LabError('Queue results saved; no new subscription published in this run')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--select',type=int,default=10)
    parser.add_argument('--window',type=int,default=1000)
    args=parser.parse_args()
    if not 1<=args.select<=200 or not 1<=args.window<=5000:parser.error('invalid select/window size')
    for name in ('GITHUB_TOKEN','LATENCYLAB_API_KEY_1','LATENCYLAB_API_KEY_2'):
        if not load(name):raise LabError(f'Missing secret: {name}')
    private=Path(__file__).resolve().parent/'.local'
    run=CrawlRun(private/'rolling-state',load('GITHUB_TOKEN'),True,persist_checkpoints=False)
    try:
        service_prober.get_xray_binary_path();service_prober.get_mihomo_binary_path()
        progress=load_progress(run.branch.path/'probe-progress.json')
        run_queue(run,progress,private/'probe-progress.json',args.select,args.window)
    finally:run.close()


if __name__=='__main__':
    try:main()
    except (LabError,RuntimeError,ValueError) as error:raise SystemExit(str(error)) from None
