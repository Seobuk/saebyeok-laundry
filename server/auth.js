import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';

const SCOPE='lodestar:identity', SESSION='laundry_session', FLOW='laundry_oauth';
const random=()=>randomBytes(32).toString('base64url');
const loopback=url=>['localhost','127.0.0.1','[::1]'].includes(url.hostname);
const safeURL=value=>{const u=new URL(value);if(u.username||u.password||u.hash||!(u.protocol==='https:'||(u.protocol==='http:'&&loopback(u))))throw new Error('Invalid authentication URL');return u;};
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
const cookieValue=(req,name)=>{const values=(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(name+'='));return values.length===1?values[0].slice(name.length+1):'';};
export function createAuth({env=process.env,now=Date.now,sessionMs=3600000,flowMs=300000}={}) {
  const required=env.AUTH_REQUIRED==='1';
  const enabled=Boolean(env.LODESTAR_CLIENT_ID&&env.LODESTAR_REDIRECT_URI&&env.SESSION_SECRET);
  let issuer,redirect,secure=true;
  if(enabled){
    issuer=safeURL(env.LODESTAR_ISSUER||'https://lodestar-rho.vercel.app');
    redirect=safeURL(env.LODESTAR_REDIRECT_URI);
    if(issuer.pathname!=='/'||issuer.search||redirect.pathname!=='/auth/lodestar/callback'||redirect.search||!/^ldi_client_[A-Za-z0-9_-]+$/.test(env.LODESTAR_CLIENT_ID)||Buffer.byteLength(env.SESSION_SECRET)<32)throw new Error('Invalid authentication configuration (SESSION_SECRET needs at least 32 bytes)');
    if(env.NODE_ENV==='production'&&(issuer.protocol!=='https:'||redirect.protocol!=='https:'))throw new Error('Production authentication requires HTTPS');
    secure=redirect.protocol==='https:';
  }
  const sessions=new Map(),flows=new Map();
  const sign=id=>createHmac('sha256',env.SESSION_SECRET).update(id).digest('base64url');
  const seal=id=>id+'.'+sign(id);
  function unseal(value){if(!enabled||!value)return null;const [id,mac,...rest]=value.split('.');return !rest.length&&id&&mac&&equal(sign(id),mac)?id:null;}
  const cookie=(name,value,seconds)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure?'; Secure':''}`;
  function prune(){for(const map of [sessions,flows])for(const [id,row] of map)if(row.expiresAt<=now())map.delete(id);}
  function session(req){prune();const id=unseal(cookieValue(req,SESSION));const row=id&&sessions.get(id);return row?{id,...row}:null;}
  function valid(id){prune();return sessions.has(id);}
  const response=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(data));};
  const move=(res,path)=>{res.writeHead(303,{Location:path,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end();};
  const landing=value=>value==='/ttasun-spa.html'?value:'/saebyeok-laundry.html';
  const auth={enabled,required,session,valid,allowedOrigin:origin=>!enabled||origin===redirect.origin,onInvalidate:()=>{},async handle(req,res){
    const url=new URL(req.url,'http://localhost');
    if(!['/auth/session','/auth/logout','/auth/lodestar/start','/auth/lodestar/callback'].includes(url.pathname))return false;
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
    if(url.pathname==='/auth/session'&&req.method==='GET'){
      response(res,200,{enabled,required,identity:session(req)?.identity||null});return true;
    }
    if(!enabled){response(res,503,{error:'login_disabled'});return true;}
    // Pin the browser-facing host to the registered callback; never trust forwarded headers.
    if(req.headers.host!==redirect.host){response(res,403,{error:'invalid_origin'});return true;}
    if(url.pathname==='/auth/logout'&&req.method==='POST'){
      if(req.headers.origin!==redirect.origin){response(res,403,{error:'invalid_origin'});return true;}
      const old=session(req);if(old){sessions.delete(old.id);auth.onInvalidate(old.id);}
      const flow=unseal(cookieValue(req,FLOW));if(flow)flows.delete(flow);
      res.setHeader('Set-Cookie',[cookie(SESSION,'',0),cookie(FLOW,'',0)]);response(res,200,{ok:true});return true;
    }
    if(url.pathname==='/auth/lodestar/start'&&req.method==='GET'){
      if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==redirect.origin)){response(res,403,{error:'invalid_origin'});return true;}
      prune();if(flows.size>=1000||sessions.size>=10000){response(res,503,{error:'busy'});return true;}
      const old=unseal(cookieValue(req,FLOW));if(old)flows.delete(old);
      const id=random(),state=random(),verifier=random();
      flows.set(id,{state,verifier,expiresAt:now()+flowMs,returnTo:landing(url.searchParams.get('returnTo'))});
      const target=new URL('/auth/mcp/authorize',issuer);
      target.search=new URLSearchParams({response_type:'code',client_id:env.LODESTAR_CLIENT_ID,redirect_uri:env.LODESTAR_REDIRECT_URI,scope:SCOPE,state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
      res.setHeader('Set-Cookie',cookie(FLOW,seal(id),Math.ceil(flowMs/1000)));move(res,target.href);return true;
    }
    if(url.pathname==='/auth/lodestar/callback'&&req.method==='GET'){
      prune();const id=unseal(cookieValue(req,FLOW)),flow=id&&flows.get(id);if(id)flows.delete(id);
      res.setHeader('Set-Cookie',cookie(FLOW,'',0));
      const one=key=>url.searchParams.getAll(key).length===1?url.searchParams.get(key):null;
      if(!flow||!one('state')||!equal(flow.state,one('state'))||one('iss')!==issuer.origin||!one('code')||url.searchParams.has('error')){response(res,400,{error:'invalid_callback'});return true;}
      try{
        const tokenResponse=await fetch(new URL('/api/oauth/token',issuer),{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:env.LODESTAR_CLIENT_ID,redirect_uri:env.LODESTAR_REDIRECT_URI,code:one('code'),code_verifier:flow.verifier})});
        if(!tokenResponse.ok)throw new Error();
        const token=await tokenResponse.json();
        if(token.scope!==SCOPE||token.token_type?.toLowerCase()!=='bearer'||typeof token.access_token!=='string'||!token.access_token.startsWith('ldi_')||!Number.isFinite(token.expires_in)||token.expires_in<=0)throw new Error();
        const infoResponse=await fetch(new URL('/api/oauth/userinfo',issuer),{redirect:'error',signal:AbortSignal.timeout(5000),headers:{Authorization:`Bearer ${token.access_token}`}});
        if(!infoResponse.ok)throw new Error();const info=await infoResponse.json();
        if(typeof info.sub!=='string'||!info.sub||info.sub.length>256||!(info.name===null||typeof info.name==='string'&&info.name.length<=256))throw new Error();
        // Keep only verified identity. Neither access nor refresh token survives this request.
        const identity={issuer:issuer.origin,sub:info.sub,name:info.name};
        const old=session(req);if(old){sessions.delete(old.id);auth.onInvalidate(old.id);}
        prune();if(sessions.size>=10000)throw new Error();
        const sessionId=random(),lifetime=Math.min(sessionMs,token.expires_in*1000);
        sessions.set(sessionId,{identity,expiresAt:now()+lifetime});
        res.setHeader('Set-Cookie',[cookie(FLOW,'',0),cookie(SESSION,seal(sessionId),Math.ceil(lifetime/1000))]);move(res,flow.returnTo);
      }catch{response(res,502,{error:'login_failed'});}
      return true;
    }
    response(res,404,{error:'not_found'});return true;
  }};
  return auth;
}
