import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
const ORIGIN='https://lodestar.example',SCOPE=ORIGIN+'/apps/saebyeok/';
function worker(fetchImpl){
 const store=new Map(),handlers={};
 const cache={async put(req,res){store.set(typeof req==='string'?new URL(req,SCOPE).href:req.url,res);}};
 const context={URL,Request:class{constructor(u){this.url=new URL(u,SCOPE).href;}},self:{location:new URL(SCOPE+'sw.js'),addEventListener:(t,fn)=>handlers[t]=fn},
  caches:{open:async()=>cache,keys:async()=>[],match:async()=>undefined,delete:async()=>true},fetch:(req,...rest)=>fetchImpl(req&&req.url?req.url:req,...rest),Promise,Object,Boolean};
 vm.runInNewContext(source,context);
 return {store,handlers,async request(path){let responded=null;handlers.fetch({request:{method:'GET',url:new URL(path,ORIGIN).href},respondWith:p=>{responded=p;}});if(responded)await responded;await new Promise(r=>setTimeout(r,5));return responded!==null;}};
}
const response=(type,extra={})=>({ok:true,status:200,redirected:false,type:'basic',headers:{get:()=>type},clone(){return this;},...extra});
test('redirected or login-page responses are never cached',async()=>{
 const w=worker(async url=>String(url).endsWith('.html')?response('text/html; charset=utf-8',{redirected:true}):response('text/html'));
 assert.equal(await w.request('/apps/saebyeok/saebyeok-laundry.html'),true);
 assert.equal(await w.request('/apps/saebyeok/auth/index.js'),true);
 assert.equal(w.store.size,0);
});
test('static files with the expected type are cached; /api/ and unknown paths are not intercepted',async()=>{
 const w=worker(async url=>response(String(url).endsWith('.js')?'text/javascript':'text/html'));
 assert.equal(await w.request('/apps/saebyeok/realtime/adapter.js'),true);
 assert.equal(w.store.has(ORIGIN+'/apps/saebyeok/realtime/adapter.js'),true);
 assert.equal(await w.request('/api/apps/saebyeok/session'),false);
 assert.equal(await w.request('/login?next=%2Fapps%2Fsaebyeok%2Fsaebyeok-laundry.html'),false);
});
test('install precache skips redirected responses',async()=>{
 const w=worker(async path=>response(String(path).endsWith('.png')?'image/png':'text/html',{redirected:!String(path).endsWith('.png')}));
 let done;w.handlers.install({waitUntil:p=>{done=p;}});await done;
 assert.ok(w.store.size>0);for(const key of w.store.keys())assert.match(key,/\.png$/);
});
