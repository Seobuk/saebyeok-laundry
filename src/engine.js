(function(){
var cfg=window.SCENE,$=function(i){return document.getElementById(i)},T=window.THREE;
var ADJ=['노곤한','뽀송한','졸린','느긋한','따끈한','말랑한','조용한','나른한'],NOUN=['수달','고양이','오리','곰','토끼','물개','너구리','참새'];
var POSES=['stand','gaze','load','fold','soak','sit','drink','lie'],POSELABEL=cfg.poseLabel;
var CLOTH=[0xf4a6a0,0x8db8ec,0xf6cf74,0xa3d9b5,0xc7aef0,0xffffff],HAIR=[0x33293a,0x6a452c,0x9aa0aa,0xc9743f,0x40578f],SKIN=[0xf9dcc4,0xf0c8a4,0xdcab84,0xfde8d8];
function ri(n){return Math.floor(Math.random()*n)}
function int(v,n){v=Math.floor(Number(v));return v>=0&&v<n?v:0}
function clamp(v,a,b){v=Number(v);return isFinite(v)?Math.max(a,Math.min(b,v)):a}
function fail(msg){$('gate').querySelector('h2').textContent=msg;$('gate').querySelector('p').textContent='3D 그래픽을 켤 수 있는 브라우저에서 다시 열어 주세요.';$('enter').hidden=true}
if(!T){fail('3D 그래픽을 불러오지 못했어요');return}
var stage=$('stage'),renderer;
try{renderer=new T.WebGLRenderer({antialias:true,alpha:false})}catch(e){fail('이 기기에서는 3D를 켤 수 없어요');return}
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputEncoding=T.sRGBEncoding;
stage.insertBefore(renderer.domElement,stage.firstChild);renderer.domElement.id='cv';
var scene=new T.Scene();scene.background=new T.Color(cfg.bg);
var cam=new T.PerspectiveCamera(30,1,.1,200);
var L=cfg.lights||{};scene.add(new T.HemisphereLight(L.sky||0xffffff,L.ground||0xc9d4d8,L.hemi==null?.72:L.hemi));
var sun=new T.DirectionalLight(L.sunColor||0xfff4e6,L.sun==null?.78:L.sun);sun.position.set(-6,14,9);if(L.sunPos)sun.position.set(L.sunPos[0],L.sunPos[1],L.sunPos[2]);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);var sc=sun.shadow.camera,S=cfg.size*.75;sc.left=-S;sc.right=S;sc.top=S;sc.bottom=-S;sc.far=50;sun.shadow.bias=-.0006;sun.shadow.radius=4;scene.add(sun);
/* builders */
var M={};
function mat(c,o){var k=c+JSON.stringify(o||{});return M[k]||(M[k]=new T.MeshStandardMaterial(Object.assign({color:c,roughness:.72,metalness:0},o||{})))}
function mesh(g,c,o,sh){var m=new T.Mesh(g,typeof c==='number'?mat(c,o):c);m.castShadow=sh!==false;m.receiveShadow=true;return m}
function rbox(w,h,d,r,c,o){r=Math.min(r,w/2-.001,h/2-.001,d/2-.001);var s=new T.Shape(),x=-w/2+r,y=-h/2+r,W=w-2*r,H=h-2*r;s.moveTo(x,y-r+r*0);s.absarc(x+W,y,0.0001,-Math.PI/2,0);s.absarc(x+W,y+H,.0001,0,Math.PI/2);s.absarc(x,y+H,.0001,Math.PI/2,Math.PI);s.absarc(x,y,.0001,Math.PI,Math.PI*1.5);var g=new T.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:4,steps:1,curveSegments:2});g.center();return mesh(g,c,o)}
function cap(r,h,c){var p=[];for(var i=0;i<=6;i++){var a=-Math.PI/2+i/6*Math.PI/2;p.push(new T.Vector2(Math.cos(a)*r,Math.sin(a)*r))}for(i=0;i<=6;i++){a=i/6*Math.PI/2;p.push(new T.Vector2(Math.cos(a)*r,h+Math.sin(a)*r))}return mesh(new T.LatheGeometry(p,16),c)}
function sph(r,c,o){return mesh(new T.SphereGeometry(r,22,16),c,o)}
function cyl(a,b,h,c,o,seg){return mesh(new T.CylinderGeometry(a,b,h,seg||32),c,o)}
function canvasTex(w,h,fn){var c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);var t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=4;return t}
var api={T:T,renderer:renderer,scene:scene,mat:mat,mesh:mesh,rbox:rbox,cap:cap,sph:sph,cyl:cyl,canvasTex:canvasTex,clamp:clamp};
/* avatar */
var _spiral;function spiralTex(){return _spiral||(_spiral=canvasTex(128,128,function(c,w){c.fillStyle='#f7bccb';c.fillRect(0,0,w,w);c.strokeStyle='#c9607c';c.lineWidth=5;c.lineCap='round';c.beginPath();for(var i=0;i<=150;i++){var a=i/150*Math.PI*6.4,r=4+i/150*50,x=w/2+Math.cos(a)*r,y=w/2+Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y)}c.stroke()}))}
function mkAvatar(l){
  var g=new T.Group(),rig=new T.Group();g.add(rig);var cloth=CLOTH[l[0]],skin=SKIN[l[2]],hair=HAIR[l[1]];
  var body=cap(.26,.26,cloth);body.position.y=.42;body.scale.set(1,1,.86);rig.add(body);
  var head=new T.Group();head.position.y=.98;rig.add(head);
  head.add(sph(.34,skin));
  var h=mesh(new T.SphereGeometry(.355,22,14,0,Math.PI*2,0,Math.PI*.52),hair);h.position.set(0,.02,-.03);head.add(h);
  [-1,1].forEach(function(s){var e=sph(.038,0x22202a);e.castShadow=false;e.position.set(s*.13,-.02,.315);head.add(e);var b=sph(.05,0xf4a9a0);b.castShadow=false;b.scale.set(1,.55,.3);b.position.set(s*.21,-.09,.27);head.add(b)});
  /* yangmeori: a towel over the crown and back of the head, its two ends rolled into coils beside the face */
  var mo=mesh(new T.TorusGeometry(.045,.013,6,14,Math.PI),0x5a3a3a);mo.castShadow=false;mo.rotation.z=Math.PI;mo.position.set(0,-.12,.312);head.add(mo);
  var tw=new T.Group(),TOWEL=0xf2a3b7,tm=mat(TOWEL,{roughness:1,side:T.DoubleSide});
  var hoodG=new T.SphereGeometry(.365,128,80,0,Math.PI*2,0,Math.PI*.68),hp=hoodG.attributes.position,hi=hoodG.index.array,keep=[];
  for(var q=0;q<hi.length;q+=3){var cx3=(hp.getX(hi[q])+hp.getX(hi[q+1])+hp.getX(hi[q+2]))/3,cy3=(hp.getY(hi[q])+hp.getY(hi[q+1])+hp.getY(hi[q+2]))/3,cz3=(hp.getZ(hi[q])+hp.getZ(hi[q+1])+hp.getZ(hi[q+2]))/3;
    if(!(cz3>0&&Math.pow(cx3/.31,2)+Math.pow((cy3+.04)/.235,2)<1))keep.push(hi[q],hi[q+1],hi[q+2])}
  hoodG.setIndex(keep);tw.add(mesh(hoodG,tm));
  var coilSide=mat(TOWEL,{roughness:1}),coilEnd=new T.MeshStandardMaterial({roughness:1,map:spiralTex()});
  [-1,1].forEach(function(s){var c=new T.Mesh(new T.CylinderGeometry(.165,.165,.36,28),[coilSide,coilEnd,coilEnd]);c.castShadow=true;c.rotation.x=Math.PI/2;var hold=new T.Group();hold.add(c);var lip=mesh(new T.TorusGeometry(.15,.022,8,28),TOWEL,{roughness:1});lip.position.z=.18;hold.add(lip);hold.position.set(s*.375,.02,.04);tw.add(hold)});
  tw.visible=false;head.add(tw);
  function limb(x,y,r,len,c){var p=new T.Group();p.position.set(x,y,0);var m=cap(r,len,c);m.rotation.x=Math.PI;p.add(m);rig.add(p);return p}
  var aL=limb(-.3,.68,.075,.26,cloth),aR=limb(.3,.68,.075,.26,cloth),lL=limb(-.13,.3,.09,.12,0x4f5d73),lR=limb(.13,.3,.09,.12,0x4f5d73);
  var OF=cfg.outfit||{};if(OF.shoes)[lL,lR].forEach(function(l){var s=sph(.1,OF.shoes);s.scale.set(1,.5,1.45);s.position.set(0,-.2,.05);l.add(s)});
  if(OF.hood){var hd=sph(.25,cloth);hd.scale.set(1.2,.55,.7);hd.position.set(0,.8,-.3);rig.add(hd);[-1,1].forEach(function(s){var st=cyl(.013,.013,.18,0xffffff);st.position.set(s*.08,.66,.225);rig.add(st)})}
  var cup=cyl(.06,.05,.14,0xfff8ee);cup.position.set(0,-.42,.05);cup.visible=false;aR.add(cup);
  var carry=sph(.24,0xe7f0ff);carry.scale.set(1.2,.8,.9);carry.position.set(0,.58,.32);carry.visible=false;rig.add(carry);
  g.scale.setScalar(1.18);
  g.traverse(function(o){if(o.isMesh)o.castShadow=true});
  return{g:g,rig:rig,head:head,hair:h,aL:aL,aR:aR,lL:lL,lR:lR,tw:tw,cup:cup,carry:carry};
}
function animate(a,t,dt){
  var v=a.v,moving=a.moving,p=moving?'walk':a.pose,ph=t*9;
  var tg={aL:0,aR:0,lL:0,lR:0,lean:0,y:0,rx:0,hx:0};
  if(p==='walk'){tg.aL=Math.sin(ph)*.7;tg.aR=-tg.aL;tg.lL=-Math.sin(ph)*.7;tg.lR=-tg.lL;tg.y=Math.abs(Math.sin(ph))*.05}
  else if(p==='gaze'){tg.y=Math.sin(t*1.1)*.012;tg.hx=.05}
  else if(p==='load'){tg.lean=.6+Math.sin(t*3)*.08;tg.aL=-1.5+Math.sin(t*5)*.3;tg.aR=-1.5-Math.sin(t*5)*.3}
  else if(p==='fold'){var s=Math.sin(t*2.6);tg.lean=.18;tg.aL=-1.2-s*.45;tg.aR=-1.2-s*.45}
  else if(p==='soak'){tg.y=Math.sin(t*1.3+a.seed)*.03;tg.aL=-.3;tg.aR=-.3;tg.hx=-.08}
  else if(p==='sit'||p==='drink'){tg.y=-.22;tg.lL=-1.45;tg.lR=-1.45;tg.aL=-.5;tg.aR=-.5;if(p==='drink'){var q=(Math.sin(t*.9)+1)/2;tg.aR=-.7-q*1.75;tg.hx=-q*.22}}
  else if(p==='lie'){tg.rx=-Math.PI/2;tg.y=.2+.02*Math.sin(t*.9);tg.aL=-.1;tg.aR=-.1}
  else{tg.y=Math.sin(t*1.4+a.seed)*.008}
  if(a.hop)tg.y+=.72;
  var k=Math.min(1,dt*9),r=a.parts;
  r.aL.rotation.x+=(tg.aL-r.aL.rotation.x)*k;r.aR.rotation.x+=(tg.aR-r.aR.rotation.x)*k;r.lL.rotation.x+=(tg.lL-r.lL.rotation.x)*k;r.lR.rotation.x+=(tg.lR-r.lR.rotation.x)*k;
  r.rig.rotation.x+=((tg.lean+tg.rx)-r.rig.rotation.x)*k;r.rig.position.y+=(tg.y-r.rig.position.y)*k;r.head.rotation.x+=(tg.hx-r.head.rotation.x)*k;
  r.tw.visible=!!a.tw;r.hair.visible=!a.tw;r.cup.visible=p==='drink';r.carry.visible=!!a.carry&&p!=='fold';
}
/* actors */
var LABELS=$('labels');
function nick(a){return ADJ[a.n[0]]+' '+NOUN[a.n[1]]}
function mkActor(o){
  var a=Object.assign({x:0,z:0,tx:0,tz:0,ry:0,fy:null,pose:'stand',n:[0,0],l:[0,0,0],m:-1,ms:0,mu:0,f:0,seed:Math.random()*9},o);
  a.parts=mkAvatar(a.l);scene.add(a.parts.g);
  var d=document.createElement('div');d.className='tag'+(a.isMe?' me':'')+(a.npc?' ex':'');LABELS.appendChild(d);a.dom=d;return a;
}
function rmActor(a){scene.remove(a.parts.g);a.dom.remove()}
var s0=cfg.spawn();
var me=mkActor({isMe:true,x:s0.x,z:s0.z,tx:s0.x,tz:s0.z,n:[ri(8),ri(8)],l:[ri(6),ri(5),ri(4)]});me.parts.g.visible=false;me.dom.hidden=true;
var inside=false,peers={},npcs=[],room=null,connected=false;
function send(){if(!room||!inside)return;room.presence({in:1,x:+me.tx.toFixed(2),z:+me.tz.toFixed(2),fy:me.fy==null?null:+me.fy.toFixed(2),a:POSES.indexOf(me.pose),n:me.n,l:me.l,t:me.tw?1:0,c:me.carry?1:0,m:me.m,ms:me.ms,mu:me.mu,f:me.f}).catch(function(){})}
var dirty=false;function push(){dirty=true}setInterval(function(){if(dirty){dirty=false;send()}},150);
function absorb(p){
  if(p.sameTab||p.kind!=='viewer')return;var q=p.presence||{},a=peers[p.peer];
  if(q.in!==1){if(a){rmActor(a);delete peers[p.peer]}return}
  var b=cfg.bounds,x=clamp(q.x,b[0],b[2]),z=clamp(q.z,b[1],b[3]),n=Array.isArray(q.n)?[int(q.n[0],8),int(q.n[1],8)]:[0,0],l=Array.isArray(q.l)?[int(q.l[0],6),int(q.l[1],5),int(q.l[2],4)]:[0,0,0];
  if(!a){a=peers[p.peer]=mkActor({id:p.peer,x:x,z:z,tx:x,tz:z,n:n,l:l});syncNpc()}
  a.tx=x;a.tz=z;a.fy=typeof q.fy==='number'?q.fy:null;a.pose=POSES[int(q.a,POSES.length)];a.tw=q.t===1;a.carry=q.c===1;a.m=Number.isInteger(q.m)?q.m:-1;a.ms=int(q.ms,3);a.mu=Math.min(Number(q.mu)||0,Date.now()+6e5);a.f=int(q.f,20);
}
function onPeers(ch){(ch.joined||[]).forEach(absorb);(ch.updated||[]).forEach(absorb);(ch.left||[]).forEach(function(p){var a=peers[p.peer];if(a){rmActor(a);delete peers[p.peer]}});syncNpc();live()}
function hook(){
  function clearPeers(){Object.keys(peers).forEach(function(k){rmActor(peers[k])});peers={};syncNpc();live()}
  window.Realtime.create({room:window.APP_ROOM,onCorrection:function(result){
    if(me.m!==result.requested)return;
    me.m=result.presence.m;me.ms=result.presence.ms;me.mu=result.presence.mu;arrive=null;me.pose='stand';
    toast('다른 손님이 먼저 사용했어요. 다른 세탁기를 골라 주세요.');push();renderBar();
  }}).then(function(r){
    if(!r){live();return}room=r;
    r.onConnection(function(c){connected=c;if(!c)clearPeers();else if(inside)push();live()},function(){connected=false;clearPeers();live()});
    r.onPeers(onPeers,function(){connected=false;clearPeers();live()});if(inside)push();
  }).catch(live)
}
hook();
function syncNpc(){var want=Math.max(0,cfg.npcs.length-Object.keys(peers).length);while(npcs.length>want)rmActor(npcs.pop());while(npcs.length<want){var i=npcs.length,d=cfg.npcs[i],a=mkActor({npc:true,x:d.x,z:d.z,tx:d.x,tz:d.z,fy:d.fy,pose:d.pose,n:[(i*3+1)%8,(i*5+2)%8],l:[(i*2+1)%6,i%5,i%4],m:d.m==null?-1:d.m,ms:d.m==null?0:1,mu:d.m==null?0:Date.now()+2e4+i*17000,tw:d.tw,f:d.f||0});a.parts.g.position.set(d.x,0,d.z);npcs.push(a)}live()}
function others(){return Object.keys(peers).map(function(k){return peers[k]}).concat(npcs)}
function all(){return others().concat(inside?[me]:[])}
function live(){var e=$('live'),n=Object.keys(peers).length+(inside?1:0);if(room&&connected){e.textContent='지금 '+n+'명 접속 중';e.dataset.on='1'}else{e.textContent='실시간 연결 없음';e.dataset.on=''}$('note').textContent=npcs.length?'"예시" 이름표는 실제 사람이 아니에요.':'지금 보이는 사람은 모두 실제 접속자예요.'}
/* sound */
var ac,gain,lp,muted=false;
function audio(){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume();if(gain)return;var len=ac.sampleRate*3,b=ac.createBuffer(1,len,ac.sampleRate),d=b.getChannelData(0),l=0;for(var i=0;i<len;i++){var w=Math.random()*2-1;l=(l+.02*w)/1.02;d[i]=l*3.5}var s=ac.createBufferSource();s.buffer=b;s.loop=true;lp=ac.createBiquadFilter();lp.type='lowpass';gain=ac.createGain();gain.gain.value=0;s.connect(lp);lp.connect(gain);gain.connect(ac.destination);s.start()}catch(e){ac=null}}
function blip(f,d,v){if(!ac||muted)return;var o=ac.createOscillator(),g=ac.createGain(),n=ac.currentTime;o.frequency.setValueAtTime(f,n);g.gain.setValueAtTime(v,n);g.gain.exponentialRampToValueAtTime(.0005,n+d);o.connect(g);g.connect(ac.destination);o.start(n);o.stop(n+d+.02)}
$('mute').onclick=function(){muted=!muted;this.textContent=muted?'소리 켜기':'소리 끄기';this.setAttribute('aria-pressed',muted)};
/* camera */
var camPos=new T.Vector3(),camLook=new T.Vector3(),closeup=null,W=1,H=1,hasCam=false;
function resize(){var b=stage.getBoundingClientRect();W=b.width||360;H=b.height||500;renderer.setSize(W,H);cam.aspect=W/H;cam.updateProjectionMatrix();fitCache=null}
window.addEventListener('resize',resize);
var fitCache=null,tmpCam=new T.PerspectiveCamera(30,1,.1,200);
function fit(){
  var b=cfg.fit,cs=[],k;for(k=0;k<8;k++)cs.push(new T.Vector3(k&1?b[3]:b[0],k&2?b[4]:b[1],k&4?b[5]:b[2]));
  var dir=new T.Vector3(cfg.camDir[0],cfg.camDir[1],cfg.camDir[2]).normalize(),look=new T.Vector3((b[0]+b[3])/2,(b[1]+b[4])/2,(b[2]+b[5])/2),v=new T.Vector3(),ext;
  tmpCam.fov=cam.fov;tmpCam.aspect=cam.aspect;tmpCam.updateProjectionMatrix();
  function place(d){tmpCam.position.copy(dir).multiplyScalar(d).add(look);tmpCam.lookAt(look);tmpCam.updateMatrixWorld();var e2=[1,-1,1,-1];cs.forEach(function(c){v.copy(c).project(tmpCam);e2[0]=Math.min(e2[0],v.x);e2[1]=Math.max(e2[1],v.x);e2[2]=Math.min(e2[2],v.y);e2[3]=Math.max(e2[3],v.y)});return e2}
  for(var it=0;it<4;it++){var lo=2,hi=120;for(k=0;k<32;k++){var mid=(lo+hi)/2;ext=place(mid);if(Math.max(-ext[0],ext[1])>.97||Math.max(-ext[2],ext[3])>.9)lo=mid;else hi=mid}
    ext=place(hi);var cx=(ext[0]+ext[1])/2,cy=(ext[2]+ext[3])/2,hh=Math.tan(cam.fov*Math.PI/360)*hi,right=new T.Vector3().setFromMatrixColumn(tmpCam.matrixWorld,0),up=new T.Vector3().setFromMatrixColumn(tmpCam.matrixWorld,1);
    look.addScaledVector(right,cx*hh*cam.aspect).addScaledVector(up,cy*hh)}
  place(hi);fitCache={p:tmpCam.position.clone(),l:look.clone()}}
function camGoal(t){
  if(closeup)return{p:closeup.p,l:closeup.l};
  if(cfg.fit){if(!fitCache)fit();return fitCache}
  var tan=Math.tan(cam.fov*Math.PI/360),d=Math.max(cfg.size*.9/(2*tan*cam.aspect),cfg.size*1.25),dir=(cfg.camDir?new T.Vector3(cfg.camDir[0],cfg.camDir[1],cfg.camDir[2]):new T.Vector3(0,.8,.72)).normalize();
  return{p:dir.multiplyScalar(d).add(cfg.look),l:cfg.look};
}
/* interaction */
function toast(s){var e=$('toast');e.textContent=s;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(function(){e.hidden=true},3000)}
var ray=new T.Raycaster(),ground=new T.Plane(new T.Vector3(0,1,0),0),arrive=null;
function goTo(x,z,done,fy){var b=cfg.bounds;me.tx=clamp(x,b[0],b[2]);me.tz=clamp(z,b[1],b[3]);me.fy=fy==null?null:fy;arrive=done||null;push()}
function setPose(p){me.pose=p;push()}
renderer.domElement.addEventListener('pointerdown',function(e){
  if(!inside)return;var b=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),cam);
  var v=new T.Vector3();if(!ray.ray.intersectPlane(ground,v))return;
  if(cfg.onWalk)cfg.onWalk(api);closeup=null;setPose('stand');goTo(v.x,v.z);
});
Object.assign(api,{me:me,others:others,all:all,toast:toast,goTo:goTo,setPose:setPose,push:push,blip:blip,setClose:function(c){closeup=c},V:function(x,y,z){return new T.Vector3(x,y,z)},refresh:function(){renderBar()}});
/* bar */
var bar=$('bar');
function renderBar(){cfg.actions.forEach(function(ac2,i){var b=bar.children[i],s=ac2.state(api);b.querySelector('b').textContent=s.label||ac2.label;b.querySelector('small').textContent=s.sub||'';b.setAttribute('aria-pressed',!!s.on);b.classList.toggle('off',!!s.off);})}
cfg.actions.forEach(function(ac2){var b=document.createElement('button');b.innerHTML='<b></b><small></small>';b.onclick=function(){if(!inside)return;var s=ac2.state(api);if(s.off){toast(s.why||s.sub);return}ac2.run(api);renderBar()};bar.appendChild(b)});
setInterval(function(){renderBar()},400);
/* loop */
if(cfg.build)cfg.build(api);
var last=Date.now(),t=0,vec=new T.Vector3(),reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
function frame(){
  var n=Date.now(),dt=Math.min(.08,(n-last)/1000);if(dt<0)dt=0;last=n;t+=dt;var showT=reduce?t*.2:t;
  all().forEach(function(a){
    var dx=a.tx-a.x,dz=a.tz-a.z,d=Math.hypot(dx,dz),st=dt*1.9;a.moving=d>.02;
    if(a.moving){var mv=Math.min(st,d);a.x+=dx/d*mv;a.z+=dz/d*mv;a.ry=Math.atan2(dx,dz)}else if(a.fy!=null)a.ry=a.fy;
    a.hop=cfg.hopAt?a.moving&&cfg.hopAt(a):false;
    var g=a.parts.g;g.position.x=a.x;g.position.z=a.z;var dr=a.ry-g.rotation.y;while(dr>Math.PI)dr-=Math.PI*2;while(dr<-Math.PI)dr+=Math.PI*2;g.rotation.y+=dr*Math.min(1,dt*8);
    animate(a,showT,dt);
    var seated=!a.moving&&(a.pose==='sit'||a.pose==='drink');vec.set(a.x,(a.pose==='lie'&&!a.moving?.6:seated?1.55:a.pose==='soak'&&!a.moving?1.75:1.85)+(a.tw&&a.pose!=='lie'?.25:0),a.z);vec.project(cam);
    var label=(a.isMe?'나 · ':a.npc?'예시 · ':'')+nick(a),st2=!a.moving&&POSELABEL[a.pose]?' · '+POSELABEL[a.pose]:'',txt=label+st2;
    if(a.dom.textContent!==txt)a.dom.textContent=txt;
    a.dom.style.transform='translate(-50%,-100%) translate('+((vec.x+1)/2*W).toFixed(1)+'px,'+((1-vec.y)/2*H).toFixed(1)+'px)';
  });
  if(!me.moving&&arrive&&inside){var f=arrive;arrive=null;f()}
  if(cfg.tick)cfg.tick(api,n,showT,dt);
  var g=camGoal(showT);
  if(!hasCam){camPos.copy(g.p);camLook.copy(g.l);hasCam=true}
  var k=Math.min(1,dt*2.2);camPos.lerp(g.p,k);camLook.lerp(g.l,k);cam.position.copy(camPos);cam.lookAt(camLook);
  if(ac&&gain){var sd=cfg.sound(api);gain.gain.setTargetAtTime(muted?0:sd[0],ac.currentTime,.5);lp.frequency.setTargetAtTime(sd[1],ac.currentTime,.5)}
  renderer.render(scene,cam);
  requestAnimationFrame(frame);
}
$('who').textContent=nick(me);
$('enter').onclick=function(){inside=true;me.parts.g.visible=true;me.dom.hidden=false;$('gate').hidden=true;$('bar').hidden=false;audio();push();live();renderBar();if(navigator.wakeLock&&navigator.wakeLock.request)navigator.wakeLock.request('screen').catch(function(){})};
resize();syncNpc();renderBar();requestAnimationFrame(frame);
})();
