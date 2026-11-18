// The browser local-ws transport against the real server, using Node's WebSocket (relative /realtime URL).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server/index.js';
const sources=await Promise.all(['validate.js','adapter.js'].map(f=>readFile(new URL('../src/realtime/'+f,import.meta.url),'utf8')));
const presence=(extra={})=>({in:1,x:0,z:0,fy:null,a:0,n:[0,0],l:[0,0,0],t:0,c:0,m:-1,ms:0,mu:0,f:0,...extra});
async function browser(port,onCorrection){
 const context={URL,TextEncoder,WebSocket,setTimeout,clearTimeout,JSON,location:{href:`http://127.0.0.1:${port}/ttasun-spa.html?x=1`,protocol:'http:'},addEventListener(){}};
 context.window=context;vm.createContext(context);for(const s of sources)vm.runInContext(s,context);
 const a=await context.Realtime.create({room:'laundry',onCorrection});const peers=[];a.onPeers(c=>peers.push(c));
 await new Promise(r=>a.onConnection(c=>{if(c)r();}));return {a,peers};
}
test('local-ws adapter joins via a page-relative URL and arbitrates machines',{skip:typeof WebSocket!=='function'},async t=>{
 const app=createApp();app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>app.close());
 const port=app.server.address().port,corrections=[];
 const x=await browser(port),y=await browser(port,r=>corrections.push(r));t.after(()=>{x.a.close();y.a.close();});
 assert.equal((await x.a.presence(presence({m:1,ms:1}))).accepted,true);
 const r=await y.a.presence(presence({m:1,ms:1}));assert.equal(r.accepted,false);assert.equal(corrections.length,1);
 await new Promise(r=>setTimeout(r,50));assert.ok(y.peers.some(c=>c.joined?.length||c.updated?.length));
});
