(function(){
var T,waters=[],steam=[];
var WARM={x:-1.75,z:.2,r:2.1},COLD={x:2.75,z:.1,r:1.25},CLAY={x:-2.3,z:-4.1},SALT={x:2.5,z:-4.1},REST={x:0,z:4.3};
function inPool(p,x,z){return Math.hypot(x-p.x,z-p.z)<p.r+.1}
function waterMat(a,b){return new T.ShaderMaterial({transparent:true,uniforms:{t:{value:0},a:{value:new T.Color(a)},b:{value:new T.Color(b)}},
 vertexShader:'varying vec2 u;void main(){u=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'varying vec2 u;uniform float t;uniform vec3 a;uniform vec3 b;float w(vec2 p){return sin(p.x*5.+t*.9+sin(p.y*3.+t*.5)*1.6)*sin(p.y*6.-t*.7+sin(p.x*2.7-t*.4)*1.3);}void main(){float c=w(u);float l=smoothstep(.55,.95,abs(c));vec3 col=mix(b,a,.5+.5*sin(length(u)*2.-t*.3));col+=l*.28;gl_FragColor=vec4(pow(col,vec3(1./2.2)),.9);}'})}
function pool(a,p,c1,c2,rim){
  var r=a.cyl(p.r+.25,p.r+.3,.66,rim,{roughness:.5},48);r.position.set(p.x,.33,p.z);a.scene.add(r);
  var w=new T.Mesh(new T.CircleGeometry(p.r,48),waterMat(c1,c2));w.rotation.x=-Math.PI/2;w.position.set(p.x,.68,p.z);a.scene.add(w);waters.push(w);
}
function puffTex(a){return a.canvasTex(64,64,function(c){var g=c.createRadialGradient(32,32,2,32,32,32);g.addColorStop(0,'rgba(255,255,255,.75)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,64,64)})}
function build(a){
  T=a.T;var s=a.scene;
  var ft=a.canvasTex(256,256,function(c,w){c.fillStyle='#d6eee8';c.fillRect(0,0,w,w);c.strokeStyle='#ffffff';c.lineWidth=6;c.strokeRect(0,0,w,w)});ft.wrapS=ft.wrapT=T.RepeatWrapping;ft.repeat.set(12,16);
  var fl=new T.Mesh(new T.PlaneGeometry(11,15),new T.MeshStandardMaterial({map:ft,roughness:.55}));fl.rotation.x=-Math.PI/2;fl.position.z=-.5;fl.receiveShadow=true;s.add(fl);
  var wall=a.rbox(11,3,.3,.05,0xeaf6f2);wall.position.set(0,1.5,-7.9);s.add(wall);
  var sign=new T.Mesh(new T.PlaneGeometry(4.4,.9),new T.MeshBasicMaterial({map:a.canvasTex(704,144,function(c,w,h){c.fillStyle='#e8493a';c.fillRect(0,0,w,h);c.fillStyle='#fff8ee';c.font='76px Jua,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('♨ 따순물 찜질스파',w/2,h/2+4)})}));sign.position.set(0,2.35,-7.73);s.add(sign);
  pool(a,WARM,0x2fa7ad,0x0f6f80,0xffffff);pool(a,COLD,0x8fd4ef,0x4a9fd0,0xffffff);
  /* clay room: half dome */
  var d=new T.Mesh(new T.SphereGeometry(2.3,32,16,Math.PI,Math.PI,0,Math.PI/2),new T.MeshStandardMaterial({color:0xc98a50,side:T.DoubleSide,roughness:.95}));d.position.set(CLAY.x,0,CLAY.z-.3);d.castShadow=true;d.receiveShadow=true;s.add(d);
  var cf=a.cyl(2.4,2.4,.08,0xd9a56c,{},40);cf.position.set(CLAY.x,.04,CLAY.z-.3);s.add(cf);
  for(var i=0;i<5;i++){var coal=a.sph(.13,0xff8a3c,{emissive:0xff5a10,emissiveIntensity:.8});coal.position.set(CLAY.x-.8+i*.4,.14,CLAY.z-1.5+Math.abs(i-2)*.1);s.add(coal)}
  /* salt room */
  var saltT=a.canvasTex(256,128,function(c,w,h){c.fillStyle='#fbd9d4';c.fillRect(0,0,w,h);for(var r=0;r<4;r++)for(var k=-1;k<5;k++){c.fillStyle=['#ffc5ba','#ffe3d6','#ffb6a8','#fff0e6'][(r*2+k+4)%4];c.fillRect(k*64+(r%2?32:0)+2,r*32+2,60,28)}});
  var sw=new T.Mesh(new T.BoxGeometry(4.2,2.3,.25),new T.MeshStandardMaterial({map:saltT,emissive:0xff9a80,emissiveIntensity:.18}));sw.position.set(SALT.x,1.15,SALT.z-1.9);sw.castShadow=true;s.add(sw);
  var sw2=new T.Mesh(new T.BoxGeometry(.25,2.3,2.6),new T.MeshStandardMaterial({map:saltT,emissive:0xff9a80,emissiveIntensity:.18}));sw2.position.set(SALT.x+2.1,1.15,SALT.z-.7);sw2.castShadow=true;s.add(sw2);
  var sf=a.rbox(4.3,.08,2.9,.03,0xeec9b0);sf.position.set(SALT.x,.04,SALT.z-.6);s.add(sf);
  /* rest area */
  var mat0=a.rbox(8.4,.1,3.2,.04,0xc7d79f);mat0.position.set(REST.x,.05,REST.z);s.add(mat0);
  var tbl=a.rbox(1.4,.1,.8,.04,0xc99a67);tbl.position.set(0,.42,REST.z-.1);s.add(tbl);[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){var l=a.cyl(.04,.04,.32,0x8a6a4c);l.position.set(q[0]*.55,.26,REST.z-.1+q[1]*.28);s.add(l)});
  [[-.3,.1],[.25,-.12]].forEach(function(q){var cu=a.cyl(.09,.07,.18,0xfff8ee);cu.position.set(q[0],.56,REST.z-.1+q[1]);s.add(cu)});
  var eg=a.sph(.09,0x9c6a3f);eg.scale.y=1.25;eg.position.set(.48,.56,REST.z);s.add(eg);
  var tv=a.rbox(2,1.2,.12,.05,0x2a2f3a);tv.position.set(-3.4,1.2,REST.z-1.3);s.add(tv);var sc=new T.Mesh(new T.PlaneGeometry(1.8,1),new T.MeshBasicMaterial({color:0x8fc7e8}));sc.position.set(-3.4,1.2,REST.z-1.23);s.add(sc);var st=a.cyl(.05,.05,.65,0x6f7782);st.position.set(-3.4,.33,REST.z-1.3);s.add(st);
  /* steam */
  var pt=puffTex(a);for(i=0;i<16;i++){var sp=new T.Sprite(new T.SpriteMaterial({map:pt,transparent:true,depthWrite:false,opacity:.5}));var src=i<11?WARM:CLAY;var an=Math.random()*6.28,rad=Math.random()*(src===WARM?src.r*.8:1.6);sp.userData={x:src.x+Math.cos(an)*rad,z:(src===WARM?src.z:src.z-.6)+Math.sin(an)*rad,o:Math.random(),base:src===WARM?.75:.3};sp.scale.setScalar(.9);s.add(sp);steam.push(sp)}
}
var act=null;
function spot(p,arr){var s=arr[Math.floor(Math.random()*arr.length)];return{x:p.x+s[0],z:p.z+s[1]}}
function stop(a){act=null;a.setClose(null)}
function go(a,id,pos,pose,fy,close){stop(a);act=id;a.goTo(pos.x,pos.z,function(){a.setPose(pose);if(close)a.setClose(close(pos));a.refresh()},fy)}
function btn(id,sub){return{state:function(a){return act===id?{on:true,label:'일어나기',sub:POSE_ON[id]}:{sub:sub}}}}
var POSE_ON={warm:'물멍 중',cold:'담그는 중',clay:'땀 빼는 중',salt:'땀 빼는 중',drink:'마시는 중',lie:'쉬는 중'};
function action(id,label,sub,fn){return{label:label,state:btn(id,sub).state,run:function(a){if(act===id){stop(a);a.setPose('stand');return}fn(a)}}}
window.SCENE={
 bg:0xf1f3f5,size:10,bounds:[-4.2,-6,4.4,5.2],build:build,
 poseLabel:{gaze:'멍',soak:'탕에서 쉬는 중',sit:'찜질 중',drink:'식혜 마시는 중',lie:'누워 쉬는 중'},
 spawn:function(){return{x:1.5+Math.random(),z:2}},
 hopAt:function(a){return inPool(WARM,a.x,a.z)||inPool(COLD,a.x,a.z)},
 npcs:[],
 onWalk:function(a){stop(a)},
 sound:function(a){if(act==='warm'||act==='cold')return[.16,700];if(act==='clay'||act==='salt')return[.12,260];if(act==='drink'||act==='lie')return[.05,380];return[.07,520]},
 tick:function(a,n,t){waters.forEach(function(w){w.material.uniforms.t.value=t});steam.forEach(function(s){var u=s.userData,q=(t*.09+u.o)%1;s.position.set(u.x+Math.sin(t*.6+u.o*9)*.12,u.base+q*2.1,u.z);s.material.opacity=.42*Math.sin(q*Math.PI);s.scale.setScalar(.6+q*.9)})},
 actions:[
  action('warm','온탕 물멍','40℃',function(a){var p=spot(WARM,[[.6,.7],[.8,0],[.1,-.6]]);go(a,'warm',p,'soak',.1,function(o){return{p:a.V(o.x+.8,2.6,o.z+4.2),l:a.V(o.x,.75,o.z-.2)}})}),
  action('cold','냉탕','18℃',function(a){go(a,'cold',spot(COLD,[[-.4,.3],[-.2,-.5],[.5,-.5]]),'soak',.1,function(o){return{p:a.V(o.x+.7,2.8,o.z+4.5),l:a.V(o.x,.8,o.z-.2)}})}),
  action('clay','황토방','65℃',function(a){a.me.tw=true;go(a,'clay',spot(CLAY,[[-.9,.5],[-.2,.9]]),'sit',0,function(o){return{p:a.V(o.x+.8,2.7,o.z+5.2),l:a.V(o.x,.95,o.z-.6)}})}),
  action('salt','소금방','58℃',function(a){a.me.tw=true;go(a,'salt',spot(SALT,[[.6,.5],[-1.2,.6],[1.1,-.2]]),'sit',0,function(o){return{p:a.V(o.x-.8,2.7,o.z+5.2),l:a.V(o.x,1,o.z-.6)}})}),
  action('drink','식혜 마시기','휴게실',function(a){go(a,'drink',spot(REST,[[1.6,.5],[2.6,-.2],[.9,.9]]),'drink',0,function(o){return{p:a.V(o.x+.8,2.6,o.z+4.6),l:a.V(o.x,.8,o.z-.2)}})}),
  action('lie','누워 쉬기','휴게실',function(a){go(a,'lie',spot(REST,[[3,.4],[2.7,-.6],[-2.8,.8]]),'lie',0,function(o){return{p:a.V(o.x+.7,4.4,o.z+3.3),l:a.V(o.x,.25,o.z-.1)}})}),
  {label:'양머리',state:function(a){return a.me.tw?{on:true,label:'양머리 풀기',sub:'쓰는 중'}:{sub:'수건 말기'}},run:function(a){a.me.tw=!a.me.tw;a.push()}},
  {label:'돌아다니기',state:function(a){return{sub:'바닥 누르기'}},run:function(a){stop(a);a.setPose('stand');a.toast('바닥을 누르면 그쪽으로 걸어가요.')}}
 ]
};
Object.defineProperty(window.SCENE,'look',{get:function(){return window.THREE?(this._l||(this._l=new THREE.Vector3(0,.6,-.6))):null},set:function(){}});
})();
