// Contract tests for the lodestar transport with a fake Supabase client (no network, no real project).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const validateSource=await readFile(new URL('../src/realtime/validate.js',import.meta.url),'utf8');
const adapterSource=await readFile(new URL('../src/realtime/adapter.js',import.meta.url),'utf8');
const presence=(extra={})=>({in:1,x:0,z:0,fy:null,a:0,n:[0,0],l:[0,0,0],t:0,c:0,m:-1,ms:0,mu:0,f:0,...extra});
const plain=v=>v===undefined?v:JSON.parse(JSON.stringify(v));
const tick=(ms=5)=>new Promise(r=>setTimeout(r,ms));
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const SESSION={identity:{issuer:'https://lodestar.example',sub:'member-1',name:'회원'},realtime:{url:'https://project.example',anonKey:'public-anon-test',accessToken:'test-access-1',expiresAt:Math.floor(Date.now()/1000)+3600}};

function fake(){
  const calls={rpc:[],setAuth:[],created:[],channels:[]};
  let rpcImpl=()=>({data:{ok:true},error:null});
  class Channel{
    constructor(topic,opts){Object.assign(this,{topic,opts,handlers:[],state:{},sent:[],tracked:[],sendStatus:'ok'});calls.channels.push(this);}
    on(type,filter,cb){this.handlers.push({type,event:filter.event,cb});return this;}
    subscribe(cb){this.status=cb;return this;}
    fire(type,event,payload){for(const h of this.handlers)if(h.type===type&&h.event===event)h.cb(payload);}
    presenceState(){return this.state;}
    async send(message){this.sent.push(message);return this.sendStatus;}
    async track(payload){this.tracked.push(payload);return 'ok';}
    async untrack(){this.untracked=true;}
  }
  const client={channel:(topic,opts)=>new Channel(topic,opts),async rpc(name,args){calls.rpc.push({name,args});return rpcImpl(name,args);},realtime:{async setAuth(token){calls.setAuth.push(token);}},async removeChannel(ch){ch.removed=true;}};
  return {calls,lib:{createClient(url,key,opts){calls.created.push({url,key,opts});return client;}},setRpc(fn){rpcImpl=fn;}};
}

async function setup(t,{room='laundry',timing={},session}={}){
  const f=fake(),corrections=[],changes=[],states=[],listeners={};
  let refreshes=0;
  const sessionApi=session||{get:async()=>SESSION,refresh:async()=>{refreshes++;return {...SESSION,realtime:{...SESSION.realtime,accessToken:'test-access-'+(refreshes+1)}};}};
  const context={console,URL,TextEncoder,Date,Promise,crypto:globalThis.crypto,setTimeout,clearTimeout,setInterval,clearInterval,location:{href:'https://lodestar.example/apps/saebyeok/saebyeok-laundry.html',protocol:'https:'},
    supabase:f.lib,LodestarSession:sessionApi,APP_CONFIG:{backend:'lodestar',base:'/apps/saebyeok/',timing:{sendIntervalMs:0,trackIntervalMs:0,renewMs:20,retryMs:10,maxRetryMs:40,...timing}},
    addEventListener(type,fn){listeners[type]=fn;}};
  context.window=context;vm.createContext(context);vm.runInContext(validateSource,context);vm.runInContext(adapterSource,context);
  const adapter=await context.Realtime.create({room,onCorrection:r=>corrections.push(r)});
  t.after(()=>adapter.close());
  adapter.onPeers(c=>changes.push(JSON.parse(JSON.stringify(c))));adapter.onConnection(v=>states.push(v));
  await tick();
  const channel=f.calls.channels.at(-1);
  return {f,adapter,channel,corrections,changes,states,listeners,refreshes:()=>refreshes,async connect(ch=f.calls.channels.at(-1)){ch.status('SUBSCRIBED');await tick();return ch;}};
}

test('lodestar: private channel per room, token from session API only, snapshot then join/leave mapping',async t=>{
  const s=await setup(t);
  assert.equal(s.f.calls.created[0].url,'https://project.example');assert.equal(s.f.calls.created[0].key,'public-anon-test');
  assert.equal(await s.f.calls.created[0].opts.accessToken(),'test-access-1');
  assert.equal(s.channel.topic,'saebyeok:laundry');
  assert.deepEqual(plain({...s.channel.opts.config,presence:undefined}),{private:true,broadcast:{self:false,ack:true}});
  assert.equal(s.channel.opts.config.presence.key,s.adapter.peer);
  assert.deepEqual(s.states,[false]);await s.connect();assert.deepEqual(s.states,[false,true]);
  s.channel.state={[s.adapter.peer]:[{v:1,seq:1,presence:presence()}],[A]:[{v:1,seq:3,presence:presence({x:1})},{v:1,seq:2,presence:presence()}],[B]:[{v:1,seq:1,presence:{...presence(),evil:1}}]};
  s.channel.fire('presence','sync');
  assert.deepEqual(s.changes.at(-1),{joined:[{peer:A,kind:'viewer',sameTab:false,presence:presence({x:1})}],updated:[],left:[]});
  s.channel.fire('presence','join',{key:A,newPresences:[{v:1,seq:4,presence:presence({x:2})}]});
  assert.equal(s.changes.at(-1).updated[0].presence.x,2);
  s.channel.fire('presence','leave',{key:A});assert.equal(s.changes.length,2,'still present in state: no left');
  s.channel.state={};s.channel.fire('presence','leave',{key:A});
  assert.deepEqual(s.changes.at(-1),{joined:[],updated:[],left:[{peer:A}]});
});

test('lodestar: broadcast updates known peers only, ignores stale seq, invalid and oversized payloads',async t=>{
  const s=await setup(t);await s.connect();
  s.channel.state={[A]:[{v:1,seq:5,presence:presence()}]};s.channel.fire('presence','sync');const base=s.changes.length;
  const send=payload=>s.channel.fire('broadcast','state',{type:'broadcast',event:'state',payload});
  send({v:1,peer:B,seq:9,presence:presence()});
  send({v:1,peer:A,seq:4,presence:presence({x:5})});
  send({v:1,peer:A,seq:6,presence:presence({m:9})});
  send({v:1,peer:A,seq:6,presence:{...presence(),pad:'x'.repeat(3000)}});
  send({v:2,peer:A,seq:6,presence:presence()});
  assert.equal(s.changes.length,base,'nothing applied');
  send({v:1,peer:A,seq:6,presence:presence({x:3})});
  assert.deepEqual(s.changes.at(-1).updated,[{peer:A,kind:'viewer',sameTab:false,presence:presence({x:3})}]);
});

test('lodestar: receive limit drops more than 20 messages per peer per second',async t=>{
  const s=await setup(t);await s.connect();
  s.channel.state={[A]:[{v:1,seq:0,presence:presence()}]};s.channel.fire('presence','sync');const base=s.changes.length;
  for(let i=1;i<=30;i++)s.channel.fire('broadcast','state',{payload:{v:1,peer:A,seq:i,presence:presence({x:i/10})}});
  assert.equal(s.changes.length-base,20);
});

test('lodestar: send broadcasts {v,peer,seq,presence}, tracks presence, spa never claims',async t=>{
  const s=await setup(t,{room:'spa'});await s.connect();
  assert.equal(s.channel.topic,'saebyeok:spa');
  const result=await s.adapter.presence(presence({m:2,ms:1,mu:Date.now()+1000}));
  assert.equal(result.accepted,true);assert.equal(result.presence.m,-1);
  assert.equal(s.f.calls.rpc.length,0);
  const msg=s.channel.sent[0];assert.equal(msg.type,'broadcast');assert.equal(msg.event,'state');
  assert.deepEqual(plain(Object.keys(msg.payload).sort()),['peer','presence','seq','v']);assert.equal(msg.payload.peer,s.adapter.peer);assert.equal(msg.payload.seq,1);
  await tick();assert.deepEqual(plain(s.channel.tracked[0]),plain({v:1,seq:1,presence:msg.payload.presence}));
  await assert.rejects(s.adapter.presence({...presence(),evil:1}),/Invalid/);
  s.channel.sendStatus='timed out';await assert.rejects(s.adapter.presence(presence()),/timed out/);
});

test('lodestar: claim wins, occupied claim is corrected, release on leaving, 10 minute cap',async t=>{
  const s=await setup(t);await s.connect();
  const far=Date.now()+3600000;
  let r=await s.adapter.presence(presence({m:1,ms:1,mu:far}));
  assert.equal(r.accepted,true);
  const claim=s.f.calls.rpc[0];assert.equal(claim.name,'saebyeok_claim');
  assert.deepEqual(plain(Object.keys(claim.args).sort()),['p_machine','p_peer','p_room','p_until']);
  assert.equal(claim.args.p_room,'laundry');assert.equal(claim.args.p_machine,1);assert.equal(claim.args.p_peer,s.adapter.peer);
  assert.ok(claim.args.p_until<=Date.now()+600000&&Number.isInteger(claim.args.p_until));
  r=await s.adapter.presence(presence({m:1,ms:2,mu:claim.args.p_until}));assert.equal(s.f.calls.rpc.length,1,'same machine and until: no rpc');
  s.f.setRpc(name=>({data:name==='saebyeok_claim'?{ok:false,machine:3,holder_peer:A,until:0,expires_at:0}:{ok:true},error:null}));
  r=await s.adapter.presence(presence({m:3,ms:1,mu:Date.now()+1000}));
  assert.equal(r.accepted,false);assert.equal(r.reason,'occupied');assert.equal(r.requested,3);assert.equal(r.presence.m,1);assert.equal(r.presence.ms,2);
  assert.equal(s.corrections.length,1);assert.equal(s.channel.sent.at(-1).payload.presence.m,1,'corrected state is broadcast');
  await s.adapter.presence(presence({m:-1}));
  assert.deepEqual(plain(s.f.calls.rpc.at(-1)),{name:'saebyeok_release',args:{p_room:'laundry',p_peer:s.adapter.peer}});
});

test('lodestar: rejected first claim falls back to no machine',async t=>{
  const s=await setup(t);await s.connect();
  s.f.setRpc(()=>({data:{ok:false,machine:0,holder_peer:A,until:0,expires_at:0},error:null}));
  const r=await s.adapter.presence(presence({m:0,ms:1,mu:Date.now()+1000}));
  assert.deepEqual([r.accepted,r.presence.m,r.presence.ms,r.presence.mu,r.requested],[false,-1,0,0,0]);
  s.f.setRpc(()=>({data:null,error:{message:'boom'}}));
  await assert.rejects(s.adapter.presence(presence({m:2,ms:1,mu:Date.now()+1000})),/RPC/);
});

test('lodestar: lease is renewed while held and a lost lease is corrected',async t=>{
  const s=await setup(t);await s.connect();
  await s.adapter.presence(presence({m:2,ms:1,mu:Date.now()+1000}));
  await tick(50);
  const renew=s.f.calls.rpc.filter(c=>c.name==='saebyeok_renew');
  assert.ok(renew.length>=1);assert.deepEqual(plain(renew[0].args),{p_room:'laundry',p_peer:s.adapter.peer});
  s.f.setRpc(name=>({data:{ok:name!=='saebyeok_renew'},error:null}));
  await tick(50);
  assert.equal(s.corrections.length,1);assert.deepEqual([s.corrections[0].requested,s.corrections[0].presence.m,s.corrections[0].reason],[2,-1,'occupied']);
  const count=s.f.calls.rpc.length;await tick(50);assert.equal(s.f.calls.rpc.length,count,'renew stops after loss');
});

test('lodestar: channel error reports offline, refreshes token and resubscribes',async t=>{
  const s=await setup(t);await s.connect();
  s.channel.state={[A]:[{v:1,seq:1,presence:presence()}]};s.channel.fire('presence','sync');
  s.channel.status('CHANNEL_ERROR');
  assert.deepEqual(s.states.slice(-1),[false]);
  await assert.rejects(s.adapter.presence(presence()),/Disconnected/);
  await tick(30);
  assert.equal(s.channel.removed,true);assert.equal(s.refreshes(),1);assert.deepEqual(s.f.calls.setAuth,['test-access-2']);
  const next=s.f.calls.channels.at(-1);assert.notEqual(next,s.channel);
  await s.connect(next);assert.deepEqual(s.states.slice(-1),[true]);
  next.state={[A]:[{v:1,seq:1,presence:presence()}]};next.fire('presence','sync');
  assert.equal(s.changes.at(-1).joined.length,1,'fresh snapshot after reconnect');
});

test('lodestar: logged-out or removed members stop retrying; token refresh calls setAuth',async t=>{
  let calls=0;
  const s=await setup(t,{session:{get:async()=>SESSION,refresh:async()=>{calls++;const e=new Error('no');e.code='unauthenticated';throw e;}}});
  await s.connect();s.channel.status('TIMED_OUT');await tick(80);
  assert.equal(calls,1);assert.equal(s.f.calls.channels.length,1);assert.deepEqual(s.states.slice(-1),[false]);
  const soon={...SESSION,realtime:{...SESSION.realtime,expiresAt:Date.now()/1000+0.05}};
  const r=await setup(t,{timing:{refreshLeadMs:0,minRefreshMs:10},session:{get:async()=>soon,refresh:async()=>({...SESSION,realtime:{...SESSION.realtime,accessToken:'test-access-9'}})}});
  await tick(120);assert.deepEqual(r.f.calls.setAuth,['test-access-9']);
});

test('lodestar: close releases a held machine and leaves the channel',async t=>{
  const s=await setup(t);await s.connect();
  await s.adapter.presence(presence({m:0,ms:1,mu:Date.now()+1000}));
  s.adapter.close();await tick();
  assert.equal(s.f.calls.rpc.at(-1).name,'saebyeok_release');assert.equal(s.channel.untracked,true);assert.equal(s.channel.removed,true);
  assert.deepEqual(s.states.slice(-1),[false]);
});
