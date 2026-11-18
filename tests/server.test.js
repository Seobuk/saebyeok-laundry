import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {RoomState,validatePresence,parseMessage} from '../server/state.js';
import {createApp} from '../server/index.js';
const presence=(extra={})=>({in:1,x:0,z:0,fy:null,a:0,n:[0,0],l:[0,0,0],t:0,c:0,m:-1,ms:0,mu:0,f:0,...extra});
const message=(ws,p,id=1)=>ws.send(JSON.stringify({type:'presence',id,presence:p}));
function receive(ws,predicate){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.off('message',listener);reject(new Error('message timeout'));},3000);function listener(data){const m=JSON.parse(data);if(predicate(m)){clearTimeout(timer);ws.off('message',listener);resolve(m);}}ws.on('message',listener);});}
async function fixture(t,heartbeatMs=15000){const app=createApp({heartbeatMs});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>app.close());const port=app.server.address().port;return {app,async client(room='laundry',options){const ws=new WebSocket(`ws://127.0.0.1:${port}/realtime?room=${room}`,options);await once(ws,'open');return ws;},port};}
test('strict schema rejects invalid shape, types, bounds and oversized input',()=>{
 assert.equal(validatePresence(presence()),true);
 for(const p of [null,[],{},presence({evil:1}),presence({x:NaN}),presence({in:'1'}),presence({m:4}),presence({n:[0,8]}),presence({l:[0,0]}),presence({fy:Infinity}),presence({a:8})])assert.equal(validatePresence(p),false);
 assert.throws(()=>parseMessage(Buffer.from('x'.repeat(2049))));assert.throws(()=>parseMessage('{}'));assert.throws(()=>parseMessage('{'));
});
test('first claim wins atomically; owner retains machine, leaves free it; app rooms isolated',()=>{
 const s=new RoomState();s.join('laundry','a');s.join('laundry','b');s.join('spa','c');
 assert.equal(s.update('laundry','a',presence({m:1,ms:1})).accepted,true);
 const rejected=s.update('laundry','b',presence({m:1,ms:1}));assert.equal(rejected.accepted,false);assert.equal(rejected.presence.m,-1);
 assert.equal(s.update('laundry','a',presence({m:1,ms:2})).accepted,true);
 assert.equal(s.update('spa','c',presence({m:1})).presence.m,-1);
 assert.equal(s.snapshot('spa','c').length,0);assert.equal(s.leave('laundry','a'),true);assert.equal(s.leave('laundry','a'),false);
 assert.equal(s.update('laundry','b',presence({m:1,ms:1})).accepted,true);
 s.update('laundry','b',presence({in:0,m:1}));assert.equal(s.snapshot('laundry','x')[0].presence.m,-1);
});
test('two WebSocket clients relay, arbitrate, snapshot and release on departure',async t=>{
 const {client}=await fixture(t),a=await client(),b=await client();
 const joined=receive(b,m=>m.joined?.length);const ack=receive(a,m=>m.type==='ack');message(a,presence({m:2,ms:1}));assert.equal((await ack).accepted,true);assert.equal((await joined).joined[0].presence.m,2);
 const denied=receive(b,m=>m.type==='ack');message(b,presence({m:2,ms:1}));assert.equal((await denied).accepted,false);
 const left=receive(b,m=>m.left?.length);a.close();assert.equal((await left).left.length,1);
 const accepted=receive(b,m=>m.type==='ack');message(b,presence({m:2,ms:1}),2);assert.equal((await accepted).accepted,true);
});
test('server closes malformed and oversized messages',async t=>{
 const {client}=await fixture(t);for(const raw of ['{}','x'.repeat(3000)]){const ws=await client();const closed=once(ws,'close');ws.send(raw);const [code]=await closed;assert.ok([1008,1009].includes(code));}
});
test('heartbeat terminates unresponsive clients and releases ownership',async t=>{
 const {client,app}=await fixture(t,40);const ws=await client('laundry',{autoPong:false});const ack=receive(ws,m=>m.type==='ack');message(ws,presence({m:0,ms:1}));await ack;await once(ws,'close');assert.equal(app.state.snapshot('laundry','x').length,0);
});
test('HTTP serves both apps and refuses traversal',async t=>{
 const {port}=await fixture(t);for(const path of ['saebyeok-laundry.html','ttasun-spa.html','manifest.webmanifest','auth/index.js','sw.js','icons/apple-touch-icon.png'])assert.equal((await fetch(`http://127.0.0.1:${port}/${path}`)).status,200);
 assert.equal((await fetch(`http://127.0.0.1:${port}/%2e%2e%2fpackage.json`)).status,403);
});
test('invalid Origin is rejected without crashing HTTP server',async t=>{
 const {port}=await fixture(t);
 const ws=new WebSocket(`ws://127.0.0.1:${port}/realtime?room=laundry`,{origin:'not-a-url'});
 const error=await new Promise(resolve=>ws.once('error',resolve));assert.match(error.message,/403/);
 assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status,200);
});
test('new socket receives existing presence snapshot, other app receives none',async t=>{
 const {client,port}=await fixture(t),a=await client();const ack=receive(a,m=>m.type==='ack');message(a,presence());await ack;
 for(const [room,count] of [['laundry',1],['spa',0]]){const ws=new WebSocket(`ws://127.0.0.1:${port}/realtime?room=${room}`);const snapshot=await receive(ws,m=>m.type==='peers');assert.equal(snapshot.joined.length,count);ws.close();}
});
test('server limits presence message frequency',async t=>{
 const {client}=await fixture(t),ws=await client();const closed=once(ws,'close');for(let i=0;i<21;i++)message(ws,presence(),i);const [code]=await closed;assert.equal(code,1008);
});
