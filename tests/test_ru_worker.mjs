import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {handleRu, selectRuNodes, VANTAGE, POLICY} from '../backend/worker/ru.js';
import worker from '../backend/worker/index.js';
import {labFresh} from '../backend/worker/index.js';
test('LatencyLab confirmations expire at 24 hours and reject malformed intervals',()=>{
 const now=Date.now();
 const n={latencylab_verified:true,latencylab_operators:['mts'],latencylab_checked_at:new Date(now-1000).toISOString(),expires_at:new Date(now+1000).toISOString()};
 assert.equal(labFresh(n,now),true);
 assert.equal(labFresh(n,now+1000),false);
 assert.equal(labFresh({...n,latencylab_operators:[]},now),false);
 assert.equal(labFresh({...n,expires_at:new Date(now+86400_000).toISOString()},now),false);
});
const now = Date.parse('2026-09-07T18:00:00Z');
const uri='tuic://User:Secret@example.com:443?sni=test#TurboProbe · проверено';
const node={uri,id:createHash('sha256').update(uri.split('#')[0]).digest('hex'),verified:true,ru_verified:true,verification_policy:POLICY,vantage_id:VANTAGE,ping_ms:60,checked_at:new Date(now-1000).toISOString(),expires_at:new Date(now+3599000).toISOString()};
const snapshot={schema_version:2,verification_policy:POLICY,updated_at:new Date(now).toISOString(),vantage:{id:VANTAGE,network:'Intersvyaz'},nodes:[node]};
const fetcher=data=>async()=>new Response(JSON.stringify(data));
const req=path=>new Request('https://sub.turboprobe.workers.dev'+path);

test('fresh exact network and full-config hash accepted',async()=>{
 assert.equal((await selectRuNodes(snapshot,now)).length,1);
 const res=await handleRu(req('/sub/ru-intersvyaz'),fetcher(snapshot),now);
 assert.equal(res.status,200); assert.equal(await res.text(),uri);
 assert.match(res.headers.get('Cache-Control'),/no-store/);
});
test('expiry, future timestamps, wrong network/policy and config change fail closed',async()=>{
 for(const patch of [{checked_at:new Date(now-3601000).toISOString()},{checked_at:new Date(now+1).toISOString()},{expires_at:new Date(now).toISOString()},{expires_at:new Date(now+7200000).toISOString()},{vantage_id:'cloud'},{ru_verified:false},{verification_policy:'legacy'},{ping_ms:0},{uri:uri.replace('Secret','secret')}]){
  const res=await handleRu(req('/sub/ru-intersvyaz'),fetcher({...snapshot,nodes:[{...node,...patch}]}),now);
  assert.equal(res.status,503,JSON.stringify(patch));
 }
});
test('old schema, missing and empty results cannot trigger global fallback',async()=>{
 for(const data of [{},[],{...snapshot,nodes:[]},{...snapshot,schema_version:1},{...snapshot,vantage:{id:'cloud'}},{...snapshot,updated_at:'2000-01-01T00:00:00Z'}]){
  let calls=0;
  const res=await handleRu(req('/sub/ru-intersvyaz'),async()=>{calls++;return new Response(JSON.stringify(data))},now);
  assert.equal(res.status,503);assert.equal(calls,1);
 }
});
test('upstream outage fails closed',async()=>{
 const res=await handleRu(req('/sub/ru-intersvyaz'),async()=>{throw new Error('down')},now);
 assert.equal(res.status,503);
});
test('unsupported filters and formats rejected, never ignored',async()=>{
 for(const query of ['?country=de','?format=clash','?limit=0','?limit=-1']){
  assert.equal((await handleRu(req('/sub/ru-intersvyaz'+query),fetcher(snapshot),now)).status,400);
 }
});
test('base64/json/head and deduplication',async()=>{
 const res=await handleRu(req('/sub/ru-intersvyaz?format=base64'),fetcher(snapshot),now);
 assert.equal(Buffer.from(await res.text(),'base64').toString(),uri);
 assert.equal((await selectRuNodes({...snapshot,nodes:[node,node]},now)).length,1);
 const json=await handleRu(req('/sub/ru-intersvyaz?format=json'),fetcher(snapshot),now);
 assert.equal((await json.json()).nodes[0].ping_ms,60);
 const head=await handleRu(new Request(req('/sub/ru-intersvyaz'), {method:'HEAD'}),fetcher(snapshot),now);
 assert.equal(await head.text(),'');
});
test('generic worker does not replace empty filter with top20',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({nodes:[{...node,checked_at:new Date().toISOString(),country:'DE',services:{}}]}));
 try {assert.equal((await worker.fetch(req('/sub?country=jp'),{},{})).status,503);}
 finally{globalThis.fetch=original;}
});
test('generic worker rejects stale/legacy JSON and never fetches TXT fallback',async()=>{
 const original=globalThis.fetch;const urls=[];
 globalThis.fetch=async url=>{urls.push(url);return new Response(JSON.stringify({nodes:[{uri,ping_ms:60}]}));};
 try {
  assert.equal((await worker.fetch(req('/sub'),{},{})).status,503);
  assert.ok(urls.every(url=>new URL(url).pathname.endsWith('.json')));
 }finally{globalThis.fetch=original;}
});
// Node's built-in type stripping exercises the actual pure TypeScript module.
import {stripTypeScriptTypes} from 'node:module';
test('UI indexer hides legacy, stale and non-finite latency', async()=>{
 const source=readFileSync(new URL('../turboprobe-web/src/utils/nodeIndexer.ts',import.meta.url),'utf8');
 const js=stripTypeScriptTypes(source);
 const {indexNode}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 const freshNode={...node,checked_at:new Date(Date.now()-1000).toISOString(),ping_ms:60,services:{youtube:true}};
 assert.equal(indexNode(freshNode,0).ping_ms,60);
 for(const change of [{verified:false},{checked_at:'2000-01-01T00:00:00Z'},{ping_ms:NaN},{verification_policy:undefined}]){
  assert.equal(indexNode({...freshNode,...change},0).ping_ms,0);
 }
 const old=indexNode({uri,ping_ms:60,ru_verified:true,health:95},0);
 assert.equal(old.ping_ms,0);assert.equal(old.ru_verified,false);
});

test('daily tunnel profile expires without acquiring LatencyLab status',async()=>{
 const {tunnelDailyFresh}=await import('../backend/worker/index.js');
 const checked=Date.now()-7200_000;
 const n={verified:true,verification_policy:'tunnel-https-v1',verification_scope:'tunnel_daily',checked_at:new Date(checked).toISOString(),expires_at:new Date(checked+86400_000).toISOString()};
 assert.equal(tunnelDailyFresh(n),true);
 assert.equal(tunnelDailyFresh({...n,expires_at:new Date(Date.now()-1).toISOString()}),false);
 assert.equal(tunnelDailyFresh({...n,expires_at:new Date(checked+2*86400_000).toISOString()}),false);
 assert.equal(n.latencylab_verified,undefined);
});


test('generic worker reads only canonical uncached publication and exposes its timestamp',async()=>{
 const original=globalThis.fetch;const calls=[];
 const checked=Date.now()-1000;
 const current={...node,uri:'vless://current@example.com:443#current',verification_scope:'tunnel_daily',checked_at:new Date(checked).toISOString(),expires_at:new Date(checked+86400_000).toISOString()};
 const updated=new Date().toISOString();
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({updated_at:updated,nodes:[current]}));};
 try {
  const res=await worker.fetch(req('/sub'),{},{});
  assert.equal(res.status,200);assert.equal(await res.text(),current.uri);
  assert.equal(res.headers.get('X-TurboProbe-Updated-At'),updated);
  assert.equal(res.headers.get('X-TurboProbe-Version'),'canonical-snapshot-v1');
  assert.equal(res.headers.get('Cache-Control'),'no-store');
  assert.equal(calls.length,1);
  const url=new URL(calls[0].url);
  assert.equal(url.origin+url.pathname,'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/nodes.json');
  assert.ok(url.searchParams.get('t'));
  assert.equal(calls[0].options.cache,'no-store');
  assert.equal(calls[0].options.cf,undefined);
 }finally{globalThis.fetch=original;}
});
test('empty, invalid, unavailable or expired canonical snapshot cannot resurrect a mirror',async()=>{
 const original=globalThis.fetch;
 try {
  for(const data of [{nodes:[]},{nodes:[node]},[],{},null,'down']){
   let calls=0;
   globalThis.fetch=async()=>{calls++;if(data==='down')throw new Error('upstream unavailable');return new Response(JSON.stringify(data));};
   assert.equal((await worker.fetch(req('/sub'),{},{})).status,503);
   assert.equal(calls,1);
  }
 }finally{globalThis.fetch=original;}
});
test('health exposes deployed version without caching',async()=>{
 const res=await worker.fetch(req('/health'),{},{});
 assert.equal(res.headers.get('Cache-Control'),'no-store');
 assert.equal((await res.json()).version,'canonical-snapshot-v1');
});
