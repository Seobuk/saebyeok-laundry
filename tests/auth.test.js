import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createHash,randomBytes} from 'node:crypto';
import {WebSocket} from 'ws';
import {createApp} from '../server/index.js';
import {createAuth} from '../server/auth.js';
const presence={in:1,x:0,z:0,fy:null,a:0,n:[0,0],l:[0,0,0],t:0,c:0,m:-1,ms:0,mu:0,f:0};
const cookies=res=>res.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
function receive(ws,predicate){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('WS timeout')),2000);const listener=data=>{const value=JSON.parse(data);if(predicate(value)){clearTimeout(timeout);ws.off('message',listener);resolve(value);}};ws.on('message',listener);});}
async function fixture(t,{required=false,configured=true}={}){
  const codes=new Map(),tokens=new Set();let clock=Date.now(),issuer,tokenCalls=0,userinfoCalls=0,badPKCE=false,badInfo=false,badScope=false,nullName=false;
  const provider=http.createServer(async(req,res)=>{
    const url=new URL(req.url,issuer);
    if(url.pathname==='/auth/mcp/authorize'){
      assert.equal(url.searchParams.get('scope'),'lodestar:identity');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
      assert.equal(url.searchParams.get('client_id'),'ldi_client_local_test');
      const code=randomBytes(24).toString('hex');codes.set(code,url.searchParams);
      const callback=new URL(url.searchParams.get('redirect_uri'));callback.search=new URLSearchParams({code,state:url.searchParams.get('state'),iss:issuer});res.writeHead(302,{Location:callback.href}).end();return;
    }
    if(url.pathname==='/api/oauth/token'){
      tokenCalls++;let body='';for await(const chunk of req)body+=chunk;const params=new URLSearchParams(body),original=codes.get(params.get('code'));codes.delete(params.get('code'));
      assert.equal(params.get('grant_type'),'authorization_code');assert.equal(params.get('client_id'),'ldi_client_local_test');assert.equal(params.has('client_secret'),false);
      if(!original||params.get('redirect_uri')!==original.get('redirect_uri')||createHash('sha256').update(params.get('code_verifier')).digest('base64url')!==(badPKCE?'invalid-challenge':original.get('code_challenge'))){res.writeHead(400).end('{}');return;}
      const access='ldi_'+randomBytes(24).toString('hex');tokens.add(access);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({access_token:access,token_type:'Bearer',scope:badScope?'lodestar:mcp':'lodestar:identity',expires_in:3600}));return;
    }
    if(url.pathname==='/api/oauth/userinfo'){
      userinfoCalls++;assert.ok(tokens.has(req.headers.authorization?.slice(7)));res.end(JSON.stringify(badInfo?{sub:null,name:'No'}:{sub:'member-local',name:nullName?null:'검증된 이름',team:null}));return;
    }
    res.writeHead(404).end();
  });provider.listen(0,'127.0.0.1');await once(provider,'listening');issuer=`http://127.0.0.1:${provider.address().port}`;
  const env=configured?{LODESTAR_ISSUER:issuer,LODESTAR_CLIENT_ID:'ldi_client_local_test',SESSION_SECRET:randomBytes(32).toString('hex'),LODESTAR_REDIRECT_URI:'http://127.0.0.1:1/auth/lodestar/callback'}:{};
  // Reserve an actual listener before constructing auth with its exact public URL.
  const placeholder=http.createServer();placeholder.listen(0,'127.0.0.1');await once(placeholder,'listening');const port=placeholder.address().port;await new Promise(r=>placeholder.close(r));
  const base=`http://127.0.0.1:${port}`;if(configured)env.LODESTAR_REDIRECT_URI=base+'/auth/lodestar/callback';env.AUTH_REQUIRED=required?'1':'0';
  const app=createApp({heartbeatMs:30,authOptions:{env,now:()=>clock}});app.server.listen(port,'127.0.0.1');await once(app.server,'listening');t.after(async()=>{await app.close();await new Promise(r=>provider.close(r));});
  const request=(path,options={})=>fetch(new URL(path,base),{redirect:'manual',...options});
  async function start(){const response=await request('/auth/lodestar/start?returnTo=/ttasun-spa.html');assert.equal(response.status,303);const authorized=await fetch(response.headers.get('location'),{redirect:'manual'});return {callback:new URL(authorized.headers.get('location')),cookie:cookies(response),response};}
  async function login(){const flow=await start();const response=await request(flow.callback,{headers:{cookie:flow.cookie}});assert.equal(response.status,303);return {cookie:cookies(response),response,flow};}
  function socket(cookie){return new WebSocket(base.replace('http:','ws:')+'/realtime?room=laundry',{headers:cookie?{cookie}:{},origin:base});}
  return {app,base,request,start,login,socket,advance:ms=>{clock+=ms;},calls:()=>({tokenCalls,userinfoCalls}),badPKCE:()=>{badPKCE=true;},badInfo:()=>{badInfo=true;},badScope:()=>{badScope=true;},nullName:()=>{nullName=true;}};
}
test('fake provider authorize→callback→token→userinfo→session→WS identity and snapshots',async t=>{
 const f=await fixture(t),{cookie,response}=await f.login();assert.equal(response.headers.get('location'),'/ttasun-spa.html');
 const sessionCookie=response.headers.getSetCookie().find(v=>v.startsWith('laundry_session='));assert.match(sessionCookie,/HttpOnly/);assert.match(sessionCookie,/SameSite=Lax/);assert.doesNotMatch(sessionCookie,/Secure/);
 const session=await f.request('/auth/session',{headers:{cookie}});assert.equal(session.headers.get('cache-control'),'no-store');const value=await session.json();assert.equal(value.identity.sub,'member-local');assert.equal(value.identity.name,'검증된 이름');assert.match(value.identity.issuer,/^http:\/\/127\.0\.0\.1:/);assert.doesNotMatch(JSON.stringify(value),/access_token|refresh_token|ldi_/);
 const a=f.socket(cookie);await once(a,'open');const b=f.socket();await once(b,'open');const joined=receive(b,m=>m.joined?.length);a.send(JSON.stringify({type:'presence',id:1,presence}));const peer=(await joined).joined[0];assert.equal(peer.presence.identity.sub,'member-local');assert.equal(peer.presence.identity.name,'검증된 이름');assert.deepEqual(peer.presence.n,[0,0]);
 const c=f.socket();const snapshot=await receive(c,m=>m.type==='peers');assert.deepEqual(snapshot.joined[0].presence.identity,peer.presence.identity);
 assert.deepEqual(f.calls(),{tokenCalls:1,userinfoCalls:1});a.close();b.close();c.close();
});
test('state/issuer/missing browser binding/duplicate fields rejected before exchange; callback is one use',async t=>{
 const f=await fixture(t);
 for(const mutation of ['state','iss','duplicate','cookie']){
  const flow=await f.start();if(mutation==='state')flow.callback.searchParams.set('state','wrong');if(mutation==='iss')flow.callback.searchParams.set('iss','https://wrong.invalid');if(mutation==='duplicate')flow.callback.searchParams.append('code','second');
  const response=await f.request(flow.callback,{headers:{cookie:mutation==='cookie'?'':flow.cookie}});assert.equal(response.status,400);assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 }
 assert.equal(f.calls().tokenCalls,0);const {flow}=await f.login();assert.equal((await f.request(flow.callback,{headers:{cookie:flow.cookie}})).status,400);
});
test('PKCE failure and malformed provider data never create session',async t=>{
 for(const kind of ['badPKCE','badInfo','badScope']){await t.test(kind,async t=>{const f=await fixture(t);f[kind]();const flow=await f.start();const response=await f.request(flow.callback,{headers:{cookie:flow.cookie}});assert.equal(response.status,502);assert.equal(response.headers.getSetCookie().some(v=>v.startsWith('laundry_session=')),false);assert.equal((await (await f.request('/auth/session')).json()).identity,null);});}
});
test('logout requires same origin, revokes cookie replay and existing sockets',async t=>{
 const f=await fixture(t,{required:true}),{cookie}=await f.login(),ws=f.socket(cookie);await once(ws,'open');
 assert.equal((await f.request('/auth/logout',{method:'POST',headers:{cookie,origin:'https://evil.invalid'}})).status,403);
 const closed=once(ws,'close');const response=await f.request('/auth/logout',{method:'POST',headers:{cookie,origin:f.base}});assert.equal(response.status,200);assert.equal((await closed)[0],1008);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await (await f.request('/auth/session',{headers:{cookie}})).json()).identity,null);const replay=f.socket(cookie);assert.match((await new Promise(r=>replay.once('error',r))).message,/401/);
});
test('expired sessions terminate sockets and fail required upgrades; expired flow cannot exchange',async t=>{
 const f=await fixture(t,{required:true}),{cookie}=await f.login(),ws=f.socket(cookie);await once(ws,'open');const close=once(ws,'close');f.advance(3600001);ws.send(JSON.stringify({type:'presence',id:1,presence}));assert.equal((await close)[0],1008);
 const denied=f.socket(cookie);assert.match((await new Promise(r=>denied.once('error',r))).message,/401/);assert.equal((await (await f.request('/auth/session',{headers:{cookie}})).json()).identity,null);
 const flow=await f.start();f.advance(300001);assert.equal((await f.request(flow.callback,{headers:{cookie:flow.cookie}})).status,400);
});
test('missing configuration keeps anonymous mode, but AUTH_REQUIRED fails closed',async t=>{
 for(const required of [false,true]){await t.test(String(required),async t=>{const f=await fixture(t,{configured:false,required});const status=await (await f.request('/auth/session')).json();assert.deepEqual(status,{enabled:false,required,identity:null});assert.equal((await f.request('/auth/lodestar/start')).status,503);const ws=f.socket();if(required)assert.match((await new Promise(r=>ws.once('error',r))).message,/401/);else{await once(ws,'open');ws.close();}});}
});
test('client identity injection is rejected and forged cookies cannot authenticate',async t=>{
 const f=await fixture(t),{cookie}=await f.login(),ws=f.socket(cookie);await once(ws,'open');const closed=once(ws,'close');ws.send(JSON.stringify({type:'presence',id:1,presence:{...presence,identity:{sub:'forged'}}}));assert.equal((await closed)[0],1008);
 assert.equal((await (await f.request('/auth/session',{headers:{cookie:cookie.replace(/laundry_session=./,'laundry_session=X')}})).json()).identity,null);
});
test('nonlocal HTTP config rejected; HTTPS issues Secure transaction cookie',async()=>{
 const env={LODESTAR_CLIENT_ID:'ldi_client_test',SESSION_SECRET:randomBytes(32).toString('hex'),LODESTAR_REDIRECT_URI:'http://example.com/auth/lodestar/callback'};assert.throws(()=>createAuth({env}));env.LODESTAR_REDIRECT_URI='https://app.example.com/auth/lodestar/callback';const auth=createAuth({env});const headers={};await auth.handle({url:'/auth/lodestar/start',method:'GET',headers:{host:'app.example.com'}},{setHeader:(k,v)=>headers[k]=v,writeHead:()=>{},end:()=>{}});assert.match(headers['Set-Cookie'],/; Secure/);
});


test('auth client static script is served with or without OAuth configuration',async t=>{
 for(const configured of [false,true]){await t.test(String(configured),async t=>{const f=await fixture(t,{configured});const response=await f.request('/auth/index.js');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);assert.match(await response.text(),/window.AppAuth/);});}
});
test('nullable identity name is preserved; configured WS requires exact Origin',async t=>{
 const f=await fixture(t);f.nullName();const {cookie}=await f.login();assert.equal((await (await f.request('/auth/session',{headers:{cookie}})).json()).identity.name,null);
 for(const origin of [undefined,f.base.replace('http:','https:')]){const ws=new WebSocket(f.base.replace('http:','ws:')+'/realtime?room=laundry',{headers:{cookie},...(origin?{origin}:{})});assert.match((await new Promise(r=>ws.once('error',r))).message,/403/);}
});
