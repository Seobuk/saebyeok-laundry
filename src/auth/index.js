// Only application identity is shown here. local mode: Lodestar credentials stay in the BFF.
// lodestar-session mode: the page runs inside Lodestar and reuses its login (see docs/realtime-adapter.md).
window.AppAuth = {ready:false,canEnter:false};
(function(){
  const config=window.APP_CONFIG||{};
  if(config.backend!=='lodestar')return;
  const SESSION_PATH='/api/apps/saebyeok/session';
  const codes={401:'unauthenticated',403:'forbidden',404:'disabled'};
  const text=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max;
  // When Lodestar cannot report the token expiry (expiresAt null/missing), assume a short life so the
  // realtime transport asks the session API again soon instead of trusting the token indefinitely.
  const UNKNOWN_EXPIRY_S=300;
  function valid(s){
    const id=s&&s.identity,rt=s&&s.realtime;
    if(!id||!rt||!text(id.issuer,512)||!text(id.sub,256)||!(id.name===null||id.name===undefined||text(id.name,200)))return false;
    if(rt.expiresAt===null||rt.expiresAt===undefined)rt.expiresAt=Math.floor(Date.now()/1000)+UNKNOWN_EXPIRY_S;
    if(!text(rt.anonKey,4096)||!text(rt.accessToken,8192)||!Number.isFinite(rt.expiresAt)||rt.expiresAt<=0)return false;
    try{const u=new URL(rt.url);return u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname));}catch{return false;}
  }
  async function load(){
    const response=await fetch(SESSION_PATH,{cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'}});
    if(!response.ok){const error=new Error('Session unavailable');error.code=codes[response.status]||'unavailable';throw error;}
    const body=await response.json();
    if(!valid(body)){const error=new Error('Invalid session');error.code='unavailable';throw error;}
    return body;
  }
  let current=null;
  // Shared with the lodestar realtime transport. Never persisted, never logged.
  window.LodestarSession={
    get(){if(!current){current=load();current.catch(()=>{current=null;});}return current;},
    refresh(){current=load();current.catch(()=>{current=null;});return current;}
  };
})();
(async function(){
  const config=window.APP_CONFIG||{};
  const status=document.getElementById('auth-status'),login=document.getElementById('auth-login'),logout=document.getElementById('auth-logout'),enter=document.getElementById('enter');
  // Capture before the engine's entry handler; the server independently enforces access.
  enter.addEventListener('click',event=>{if(!window.AppAuth.canEnter){event.preventDefault();event.stopImmediatePropagation();}},true);
  if(config.backend==='lodestar'){
    const page=location.pathname.endsWith('ttasun-spa.html')?'ttasun-spa.html':'saebyeok-laundry.html';
    const base=typeof config.base==='string'&&/^\/([A-Za-z0-9_-]+\/)*$/.test(config.base)?config.base:'/apps/saebyeok/';
    login.href='/login?next='+encodeURIComponent(base+page);logout.hidden=true;
    try{
      const s=await window.LodestarSession.get();
      window.AppAuth={mode:'lodestar-session',ready:true,required:true,enabled:true,identity:s.identity,canEnter:true};
      login.hidden=true;
      status.textContent='로드스타 로그인: '+(s.identity.name||'이름 미지정')+' · 장면 속 닉네임과 별개 · 로그아웃은 로드스타에서 해요';
      enter.disabled=false;
    }catch(error){
      window.AppAuth={mode:'lodestar-session',ready:true,required:true,enabled:true,identity:null,canEnter:false};
      const code=error&&error.code;login.hidden=code!=='unauthenticated';
      status.textContent=code==='unauthenticated'?'입장하려면 로드스타 로그인이 필요해요.':code==='forbidden'?'이 계정은 입장 허용 목록에 없어요.':code==='disabled'?'지금은 문을 닫았어요.':'로그인 상태를 확인하지 못했어요. 새로고침해 주세요.';
      enter.disabled=true;
    }
    return;
  }
  // Paths stay relative to the page so the build contains no absolute route strings.
  login.href='auth/lodestar/start?returnTo='+encodeURIComponent(location.pathname);
  logout.onclick=async()=>{
    logout.disabled=true;
    try{const response=await fetch('auth/logout',{method:'POST',credentials:'same-origin'});if(!response.ok)throw new Error();location.reload();}
    catch{status.textContent='로그아웃하지 못했어요. 다시 시도해 주세요.';logout.disabled=false;}
  };
  try{
    const response=await fetch('auth/session',{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw new Error();
    const auth=await response.json();window.AppAuth={...auth,ready:true,canEnter:!auth.required||Boolean(auth.identity)};
    login.hidden=!auth.enabled||Boolean(auth.identity);logout.hidden=!auth.identity;
    status.textContent=auth.identity?'로드스타 로그인: '+(auth.identity.name||'이름 미지정')+' · 장면 속 닉네임과 별개':auth.enabled?(auth.required?'입장하려면 로드스타 로그인이 필요해요.':'익명 입장 가능 · 원하면 로드스타로 로그인하세요.'):(auth.required?'로그인 설정이 없어 입장할 수 없어요.':'로그인 미설정 · 익명 입장');
    enter.disabled=!window.AppAuth.canEnter;
  }catch{status.textContent='로그인 상태를 확인하지 못했어요. 새로고침해 주세요.';enter.disabled=true;}
})();
