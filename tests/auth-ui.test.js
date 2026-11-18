import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/auth/index.js',import.meta.url),'utf8');
async function render(payload,fail=false){const nodes=Object.fromEntries(['auth-status','auth-login','auth-logout','enter'].map(id=>[id,{disabled:true,hidden:true,addEventListener(type,fn){this.listener=fn;}}]));const window={};const requests=[];let reloaded=false;const context={window,document:{getElementById:id=>nodes[id]},location:{pathname:'/ttasun-spa.html',reload:()=>{reloaded=true;}},fetch:async(path,options)=>{requests.push({path,options});return {ok:!fail,json:async()=>payload};}};await vm.runInNewContext(source,context);return {nodes,window,requests,reloaded:()=>reloaded};}
test('UI separates verified name from nickname and logout stays available outside gate',async()=>{
 const ui=await render({enabled:true,required:true,identity:{sub:'a',name:'검증 이름'}});assert.equal(ui.nodes.enter.disabled,false);assert.match(ui.nodes['auth-status'].textContent,/검증 이름.*닉네임과 별개/);assert.equal(ui.nodes['auth-login'].hidden,true);assert.equal(ui.nodes['auth-logout'].hidden,false);await ui.nodes['auth-logout'].onclick();assert.equal(ui.requests[1].options.method,'POST');assert.equal(ui.reloaded(),true);
 const shell=await readFile(new URL('../src/shell.html',import.meta.url),'utf8');assert.match(shell,/개발자: 홍서진/);assert.match(shell,/<div class="foot[^\n]*auth-logout/);
});
test('UI anonymous fallback, required mode, disabled setup, request failure and login link',async()=>{
 for(const [enabled,required,allowed] of [[false,false,true],[true,false,true],[false,true,false],[true,true,false]]){const ui=await render({enabled,required,identity:null});assert.equal(ui.nodes.enter.disabled,!allowed);assert.equal(ui.nodes['auth-login'].hidden,!enabled);assert.match(ui.nodes['auth-login'].href,/returnTo=%2Fttasun-spa.html/);let blocked=false;ui.nodes.enter.listener({preventDefault(){blocked=true;},stopImmediatePropagation(){}});assert.equal(blocked,!allowed);}
 const ui=await render(null,true);assert.equal(ui.nodes.enter.disabled,true);assert.equal(ui.window.AppAuth.canEnter,false);
});
const good={identity:{issuer:'https://lodestar.example',sub:'member-1',name:'회원'},realtime:{url:'https://project.example',anonKey:'public-anon-test',accessToken:'test-access',expiresAt:Math.floor(Date.now()/1000)+3600}};
async function renderLodestar(status,payload){const nodes=Object.fromEntries(['auth-status','auth-login','auth-logout','enter'].map(id=>[id,{disabled:true,hidden:true,addEventListener(type,fn){this.listener=fn;}}]));const window={APP_CONFIG:{backend:'lodestar',base:'/apps/saebyeok/'}};const requests=[];const context={window,URL,document:{getElementById:id=>nodes[id]},location:{pathname:'/apps/saebyeok/ttasun-spa.html'},fetch:async(path,options)=>{requests.push({path,options});return {ok:status===200,status,json:async()=>payload};}};vm.runInNewContext(source,context);await new Promise(r=>setTimeout(r,5));return {nodes,window,requests};}
test('lodestar-session mode: session API, login link back to the page, no local BFF routes',async()=>{
 const ui=await renderLodestar(200,good);
 assert.equal(ui.requests.length,1);assert.equal(ui.requests[0].path,'/api/apps/saebyeok/session');assert.equal(ui.requests[0].options.cache,'no-store');assert.equal(ui.requests[0].options.credentials,'same-origin');
 assert.equal(ui.nodes.enter.disabled,false);assert.equal(ui.window.AppAuth.canEnter,true);assert.equal(ui.nodes['auth-logout'].hidden,true);assert.equal(ui.nodes['auth-login'].hidden,true);
 assert.match(ui.nodes['auth-status'].textContent,/회원.*닉네임과 별개.*로그아웃은 로드스타/);
 assert.equal(ui.nodes['auth-login'].href,'/login?next=%2Fapps%2Fsaebyeok%2Fttasun-spa.html');
 assert.equal(await ui.window.LodestarSession.get(),await ui.window.LodestarSession.get(),'session fetched once and shared');
 assert.doesNotMatch(source,/['"`]\/auth\//,'no absolute local auth route in the shipped file');
});
test('lodestar-session mode: 401 shows login, 403/404/invalid payload block entry',async()=>{
 for(const [status,payload,pattern,loginShown] of [[401,null,/로그인이 필요/,true],[403,null,/허용 목록/,false],[404,null,/닫았어요/,false],[200,{...good,realtime:{...good.realtime,url:'javascript:alert(1)'}},/확인하지 못했어요/,false],[200,{identity:good.identity},/확인하지 못했어요/,false]]){
  const ui=await renderLodestar(status,payload);
  assert.equal(ui.nodes.enter.disabled,true);assert.equal(ui.window.AppAuth.canEnter,false);assert.match(ui.nodes['auth-status'].textContent,pattern);assert.equal(ui.nodes['auth-login'].hidden,!loginShown);
  let blocked=false;ui.nodes.enter.listener({preventDefault(){blocked=true;},stopImmediatePropagation(){}});assert.equal(blocked,true);
 }
});
test('lodestar-session mode: expiresAt null or missing falls back to a short 5-minute expiry; other bad values still block',async()=>{
 for(const realtime of [{...good.realtime,expiresAt:null},(({expiresAt,...rest})=>rest)(good.realtime)]){
  const before=Math.floor(Date.now()/1000);
  const ui=await renderLodestar(200,{...good,realtime});
  assert.equal(ui.nodes.enter.disabled,false);assert.equal(ui.window.AppAuth.canEnter,true);
  const s=await ui.window.LodestarSession.get();
  assert.ok(Number.isFinite(s.realtime.expiresAt),'expiresAt becomes a number');
  assert.ok(s.realtime.expiresAt>=before+300&&s.realtime.expiresAt<=Math.floor(Date.now()/1000)+300,'about five minutes from now');
 }
 for(const expiresAt of ['1763450000',0,-5,NaN]){
  const ui=await renderLodestar(200,{...good,realtime:{...good.realtime,expiresAt}});
  assert.equal(ui.nodes.enter.disabled,true);assert.equal(ui.window.AppAuth.canEnter,false);assert.match(ui.nodes['auth-status'].textContent,/확인하지 못했어요/);
 }
});
