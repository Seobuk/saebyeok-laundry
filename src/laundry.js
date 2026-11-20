(function(){
var N=4,MW=1.5,MZ=-3.3,WASH=60000,machines=[],T,pile,tableX=.5,tableZ=2.2;
function mx(i){return (i-(N-1)/2)*MW}
var fx={};
function build(a){
  T=a.T;var s=a.scene,add=function(m,x,y,z){m.position.set(x,y,z);s.add(m);return m};
  /* floor: terrazzo tiles */
  var floorTex=a.canvasTex(512,512,function(c,w){c.fillStyle='#d9e2e5';c.fillRect(0,0,w,w);for(var i=0;i<1400;i++){c.fillStyle=['#cfd8dc','#f8fafb','#bcd9d2','#d9cfc8'][i%4];c.beginPath();c.arc(Math.random()*w,Math.random()*w,.8+Math.random()*2.4,0,7);c.fill()}c.strokeStyle='#c4ced3';c.lineWidth=4;for(var k=0;k<=w;k+=128){c.beginPath();c.moveTo(k,0);c.lineTo(k,w);c.stroke();c.beginPath();c.moveTo(0,k);c.lineTo(w,k);c.stroke()}});
  floorTex.wrapS=floorTex.wrapT=T.RepeatWrapping;floorTex.repeat.set(3.3,5.5);
  var fl=new T.Mesh(new T.PlaneGeometry(6.6,11),new T.MeshStandardMaterial({map:floorTex,roughness:.5}));fl.position.z=.5;fl.rotation.x=-Math.PI/2;fl.receiveShadow=true;s.add(fl);
  /* walls */
  add(a.rbox(6.9,4.2,.3,.05,0xa9d6cd),0,2.1,-5);
  add(a.rbox(6.9,.5,.32,.04,0x8fc2b8),0,.25,-4.84);
  add(a.rbox(.3,2.3,11,.05,0xb9ddd5),3.3,1.15,.5);add(a.rbox(.36,.08,11,.03,0xf6f8f8),3.3,2.32,.5);
  /* left wall: storefront window onto the night street */
  add(a.rbox(.3,.9,11,.04,0xb9ddd5),-3.3,.45,.5);add(a.rbox(.3,.7,11,.04,0xb9ddd5),-3.3,3.85,.5);
  add(a.rbox(.3,2.6,.6,.03,0xb9ddd5),-3.3,2.2,-4.7);add(a.rbox(.3,2.6,.6,.03,0xb9ddd5),-3.3,2.2,5.7);
  [-4.4,-1.95,.5,2.95,5.4].forEach(function(z){add(a.rbox(.22,2.6,.12,.03,0xf6f8f8),-3.28,2.2,z)});
  add(a.rbox(.44,.07,9.9,.03,0xf6f8f8),-3.16,.92,.5);
  var street=new T.Mesh(new T.PlaneGeometry(10.2,2.9),new T.MeshBasicMaterial({map:a.canvasTex(1024,448,function(c,w,h){
    var g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#0e1430');g.addColorStop(.55,'#28305c');g.addColorStop(.75,'#3a3566');g.addColorStop(1,'#151a33');c.fillStyle=g;c.fillRect(0,0,w,h);
    c.fillStyle='#fff7d6';c.beginPath();c.arc(150,70,20,0,7);c.fill();c.fillStyle='rgba(255,247,214,.12)';c.beginPath();c.arc(150,70,44,0,7);c.fill();
    var x=0,r=7;function rnd(){r=(r*9301+49297)%233280;return r/233280}
    while(x<w){var bw=60+rnd()*110,bh=110+rnd()*170,top=h*.74-bh;c.fillStyle=['#1c2246','#232a52','#1a1f3f'][Math.floor(rnd()*3)];c.fillRect(x,top,bw,bh);
      for(var yy=top+12;yy<h*.72;yy+=20)for(var xx=x+8;xx<x+bw-10;xx+=16)if(rnd()<.32){c.fillStyle=rnd()<.7?'#ffd98f':'#9fd4ff';c.fillRect(xx,yy,8,10)}x+=bw+4}
    c.fillStyle='#2b2f45';c.fillRect(560,h*.5,260,h*.24);c.fillStyle='#e9fff6';c.fillRect(572,h*.53,236,h*.17);c.fillStyle='#3ec29a';c.fillRect(560,h*.46,260,26);c.fillStyle='#fff';c.font='bold 20px sans-serif';c.textAlign='center';c.fillText('편의점 24시',690,h*.46+19);
    c.fillStyle='#1b1f33';c.fillRect(0,h*.74,w,h*.26);c.fillStyle='#2b3048';c.fillRect(0,h*.74,w,10);
    [[690,'#7fffd4'],[380,'#ffd98f'],[880,'#ffb3c8']].forEach(function(q){var gr=c.createLinearGradient(0,h*.76,0,h);gr.addColorStop(0,q[1]+'66');gr.addColorStop(1,q[1]+'00');c.fillStyle=gr;c.fillRect(q[0]-24,h*.76,48,h*.24)});
    c.fillStyle='#3a3f58';c.fillRect(376,h*.28,6,h*.46);c.fillRect(360,h*.28,30,6);var lg=c.createRadialGradient(366,h*.3,2,366,h*.3,70);lg.addColorStop(0,'rgba(255,217,143,.85)');lg.addColorStop(1,'rgba(255,217,143,0)');c.fillStyle=lg;c.fillRect(290,h*.3-70,150,140);
  })}));street.rotation.y=Math.PI/2;add(street,-3.52,2.2,.5);
  fx.rain=a.canvasTex(256,512,function(c,w,h){c.clearRect(0,0,w,h);for(var i=0;i<90;i++){var x=Math.random()*w,y=Math.random()*h,l=10+Math.random()*30;c.strokeStyle='rgba(220,235,255,'+(.25+Math.random()*.35)+')';c.lineWidth=1.2;c.beginPath();c.moveTo(x,y);c.lineTo(x-2,y+l);c.stroke()}for(i=0;i<40;i++){c.fillStyle='rgba(235,245,255,.5)';c.beginPath();c.arc(Math.random()*w,Math.random()*h,1.5+Math.random()*2.5,0,7);c.fill()}});
  fx.rain.wrapS=fx.rain.wrapT=T.RepeatWrapping;fx.rain.repeat.set(4,1.2);
  var glass=new T.Mesh(new T.PlaneGeometry(9.8,2.6),new T.MeshBasicMaterial({map:fx.rain,transparent:true,depthWrite:false,color:0xdfe9ff}));glass.rotation.y=Math.PI/2;add(glass,-3.24,2.2,.5);
  var tint=new T.Mesh(new T.PlaneGeometry(9.8,2.6),new T.MeshBasicMaterial({color:0x8fb0ff,transparent:true,opacity:.07,depthWrite:false}));tint.rotation.y=Math.PI/2;add(tint,-3.23,2.2,.5);
  /* neon sign and wall details */
  add(a.rbox(3.6,.95,.08,.04,0x2b3150),0,3.35,-4.8);
  fx.neon=new T.Mesh(new T.PlaneGeometry(3.5,.88),new T.MeshBasicMaterial({transparent:true,map:a.canvasTex(760,190,function(c,w,h){c.textAlign='center';c.textBaseline='middle';c.shadowColor='#ff5d93';c.shadowBlur=22;c.fillStyle='#ffd3e2';c.font='92px Jua,sans-serif';c.fillText('새벽빨래방',w/2,h*.42);c.fillText('새벽빨래방',w/2,h*.42);c.shadowColor='#5ff2c8';c.shadowBlur=12;c.fillStyle='#d9fff3';c.font='26px sans-serif';c.fillText('COIN LAUNDRY · 24H',w/2,h*.85)})}));add(fx.neon,0,3.35,-4.75);
  fx.pink=new T.PointLight(0xff6f9c,.9,5.5);add(fx.pink,0,3.2,-4.1);
  for(var i=0;i<N;i++){var bar=new T.Mesh(new T.BoxGeometry(1.15,.05,.1),new T.MeshBasicMaterial({color:0xfdfcf2}));add(bar,mx(i),2.42,-4.78);add(a.rbox(1.25,.07,.16,.02,0xd5dde2),mx(i),2.47,-4.8)}
  fx.clockCv=document.createElement('canvas');fx.clockCv.width=fx.clockCv.height=128;fx.clockTex=new T.CanvasTexture(fx.clockCv);fx.clockTex.encoding=T.sRGBEncoding;drawClock();
  add(a.cyl(.3,.3,.06,0xffffff),-2.55,3.3,-4.82).rotation.x=Math.PI/2;
  add(new T.Mesh(new T.CircleGeometry(.27,32),new T.MeshBasicMaterial({map:fx.clockTex})),-2.55,3.3,-4.785);
  var note=new T.Mesh(new T.PlaneGeometry(.78,.98),new T.MeshStandardMaterial({roughness:1,map:a.canvasTex(256,320,function(c,w,h){c.fillStyle='#fffdf4';c.fillRect(0,0,w,h);c.fillStyle='#e8493a';c.fillRect(0,0,w,46);c.fillStyle='#fff';c.font='bold 26px sans-serif';c.textAlign='center';c.fillText('이용 안내',w/2,32);c.fillStyle='#283040';c.font='19px sans-serif';c.textAlign='left';['세탁 1회  4,000원','건조 30분  3,000원','세제는 자판기에서','다 된 빨래는','바로 꺼내 주세요','CCTV 24시간 녹화 중'].forEach(function(t,k){c.fillText(t,22,88+k*36)})})}));note.rotation.z=.04;note.scale.setScalar(.8);add(note,2.6,3.2,-4.83);
  add(a.sph(.035,0xe8493a),2.6,3.6,-4.8);
  /* dryers, stacked on the right wall */
  fx.dryers=[];[-2.6,-1.4].forEach(function(z,c){[0,1].forEach(function(r){fx.dryers.push(dryer(a,2.7,.52+r*1.04,z,(c+r)%2===0))})});
  /* vending machine for detergent and drinks */
  var vm=new T.Group();vm.rotation.y=-Math.PI/2;add(vm,2.7,0,.3);
  var vb=a.rbox(1.1,2.3,.9,.08,0x5f8fe0);vb.position.y=1.15;vm.add(vb);
  var vgl=new T.Mesh(new T.PlaneGeometry(.74,1.25),new T.MeshBasicMaterial({map:a.canvasTex(148,250,function(c,w,h){c.fillStyle='#eef7ff';c.fillRect(0,0,w,h);var cols=['#ea6f96','#f2bf4f','#5fcda6','#ffffff','#9d7fe0','#ea7a63'];for(var r=0;r<4;r++){c.fillStyle='#c8d3e0';c.fillRect(0,r*62+52,w,6);for(var k=0;k<4;k++){c.fillStyle=cols[(r*4+k)%6];c.fillRect(10+k*34,r*62+14,24,38);c.fillStyle='rgba(255,255,255,.55)';c.fillRect(13+k*34,r*62+18,5,30)}}})}));vgl.position.set(-.08,1.45,.46);vm.add(vgl);
  var vbtn=a.rbox(.2,.5,.04,.02,0xf6f8f8);vbtn.position.set(.38,1.45,.46);vm.add(vbtn);
  var vtop=new T.Mesh(new T.PlaneGeometry(.96,.2),new T.MeshBasicMaterial({map:a.canvasTex(192,40,function(c,w,h){c.fillStyle='#ffd166';c.fillRect(0,0,w,h);c.fillStyle='#1f2a3a';c.font='bold 22px sans-serif';c.textAlign='center';c.fillText('세제 · 음료',w/2,28)})}));vtop.position.set(0,2.12,.46);vm.add(vtop);
  var vout=a.rbox(.6,.22,.05,.03,0x2b3150);vout.position.set(-.08,.45,.46);vm.add(vout);
  var vlt=new T.PointLight(0xbfe0ff,.35,2.6);vlt.position.set(2,1.5,.3);s.add(vlt);
  /* change machine and bin */
  var cm=new T.Group();cm.rotation.y=-Math.PI/2;add(cm,2.88,0,1.6);var cb=a.rbox(.7,1.45,.55,.05,0xa9b4c0);cb.position.y=.72;cm.add(cb);
  var cs=new T.Mesh(new T.PlaneGeometry(.56,.3),new T.MeshBasicMaterial({map:a.canvasTex(112,60,function(c,w,h){c.fillStyle='#1f2a3a';c.fillRect(0,0,w,h);c.fillStyle='#7be0a0';c.font='bold 20px sans-serif';c.textAlign='center';c.fillText('동전교환',w/2,26);c.fillStyle='#ffd166';c.font='14px sans-serif';c.fillText('1000원 → 500원',w/2,48)})}));cs.position.set(0,1.18,.285);cm.add(cs);
  var slot=a.rbox(.3,.05,.03,.01,0x22262f);slot.position.set(0,.85,.285);cm.add(slot);var tray=a.rbox(.3,.12,.08,.02,0x7f8b99);tray.position.set(0,.4,.3);cm.add(tray);
  add(a.cyl(.22,.19,.6,0x7f8b99),2.85,.3,2.5);add(a.cyl(.23,.23,.04,0x5d6b7c),2.85,.62,2.5);
  /* folding table with baskets and detergent */
  var top=add(a.rbox(2.2,.12,1.2,.05,0xf6d9a8),tableX,.82,tableZ);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){add(a.cyl(.04,.04,.8,0x7f8b99),tableX+q[0]*.95,.4,tableZ+q[1]*.48)});
  pile=new T.Group();pile.position.set(tableX,.9,tableZ);s.add(pile);
  [[.75,.12,0xffffff,0x5f8fe0],[.92,-.1,0xea6f96,0xffffff]].forEach(function(b){add(a.cyl(.09,.1,.3,b[2]),tableX+b[0],1.03,tableZ+b[1]);add(a.cyl(.05,.05,.06,b[3]),tableX+b[0],1.21,tableZ+b[1])});
  add(basket(a,0x8db8ec),tableX-.6,.88,tableZ-.2).scale.setScalar(.7);
  add(basket(a,0xffb3c8),1.9,0,4.2);add(basket(a,0x9be8cf),-2.65,0,-1.6);var bc=add(a.sph(.3,0xfff2d6),-2.65,.4,-1.6);bc.scale.y=.55;
  /* chairs along the window, one with a sleeping cat */
  [0,1.1,2.2,3.3].forEach(function(z,k){chair(a,-2.75,z,[0xf6c65e,0x8db8ec,0xf6c65e,0x8db8ec][k])});
  fx.cat=cat(a);fx.cat.position.set(-2.75,.5,3.3);fx.cat.rotation.y=Math.PI/2+.4;s.add(fx.cat);
  var side=add(a.cyl(.26,.26,.04,0xffffff),-2.75,.55,.55);add(a.cyl(.03,.03,.55,0x7f8b99),-2.75,.27,.55);add(a.cyl(.06,.05,.13,0xfff8ee),-2.7,.64,.5);
  /* plant and doormat */
  add(a.cyl(.26,.2,.36,0xe7c7a8),2.75,.18,5);for(var k=0;k<7;k++){var lf=a.sph(.2,0x7cc48f);lf.scale.set(.7,1.5,.5);lf.rotation.z=Math.cos(k)*.5;add(lf,2.75+Math.cos(k)*.2,.65+k%2*.18,5+Math.sin(k)*.2)}
  var mat0=new T.Mesh(new T.PlaneGeometry(1.8,.8),new T.MeshStandardMaterial({roughness:1,map:a.canvasTex(360,160,function(c,w,h){c.fillStyle='#4a5a7a';c.fillRect(0,0,w,h);c.strokeStyle='#6b7c9d';c.lineWidth=6;c.strokeRect(10,10,w-20,h-20);c.fillStyle='#ffd3e2';c.font='44px Jua,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('어서오세요',w/2,h/2+2)})}));mat0.rotation.x=-Math.PI/2;mat0.receiveShadow=true;add(mat0,0,.012,5.5);
  /* drifting dust in the light */
  var pg=new T.BufferGeometry(),pp=[];for(k=0;k<110;k++)pp.push(-3+Math.random()*6,.3+Math.random()*3.4,-4.4+Math.random()*9.8);pg.setAttribute('position',new T.Float32BufferAttribute(pp,3));
  fx.dust=new T.Points(pg,new T.PointsMaterial({size:.05,transparent:true,opacity:.5,depthWrite:false,map:a.canvasTex(32,32,function(c){var g=c.createRadialGradient(16,16,1,16,16,16);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,32,32)})}));s.add(fx.dust);
  /* interior light */
  var p1=new T.PointLight(0xf2f6ff,.22,10);add(p1,-1.2,3.8,-1.6);var p2=new T.PointLight(0xf2f6ff,.2,10);add(p2,1.2,3.8,2.6);
  var moon=new T.PointLight(0x7f9cff,.4,6);add(moon,-2.8,2.4,.5);
  for(i=0;i<N;i++){machines.push(washer(a,mx(i),MZ-.9,i))}
}
function drawClock(){var c=fx.clockCv.getContext('2d'),d=new Date(),w=128;c.fillStyle='#ffffff';c.fillRect(0,0,w,w);c.strokeStyle='#1f2a3a';c.lineCap='round';
  for(var k=0;k<12;k++){var an=k/12*6.283;c.lineWidth=k%3?3:6;c.beginPath();c.moveTo(64+Math.sin(an)*52,64-Math.cos(an)*52);c.lineTo(64+Math.sin(an)*(k%3?46:42),64-Math.cos(an)*(k%3?46:42));c.stroke()}
  var hr=(d.getHours()%12+d.getMinutes()/60)/12*6.283,mn=d.getMinutes()/60*6.283;c.lineWidth=7;c.beginPath();c.moveTo(64,64);c.lineTo(64+Math.sin(hr)*28,64-Math.cos(hr)*28);c.stroke();c.lineWidth=4;c.beginPath();c.moveTo(64,64);c.lineTo(64+Math.sin(mn)*42,64-Math.cos(mn)*42);c.stroke();
  c.fillStyle='#ec5f8b';c.beginPath();c.arc(64,64,5,0,7);c.fill();fx.clockTex.needsUpdate=true;fx.clockMin=d.getMinutes()}
function basket(a,col){var g=new T.Group(),tex=a.canvasTex(128,64,function(c,w,h){c.fillStyle='#'+col.toString(16).padStart(6,'0');c.fillRect(0,0,w,h);c.clearRect(0,0,0,0);for(var y=14;y<h-8;y+=14)for(var x=4;x<w;x+=16)c.clearRect(x,y,9,7)});tex.wrapS=T.RepeatWrapping;tex.repeat.x=3;
  var b=new T.Mesh(new T.CylinderGeometry(.34,.28,.42,28,1,true),new T.MeshStandardMaterial({map:tex,alphaTest:.5,side:T.DoubleSide,roughness:.6}));b.position.y=.21;b.castShadow=true;g.add(b);
  var bt=a.cyl(.28,.28,.02,col);bt.position.y=.01;g.add(bt);var rim=a.mesh(new T.TorusGeometry(.34,.025,8,28),col);rim.rotation.x=Math.PI/2;rim.position.y=.42;g.add(rim);return g}
function chair(a,x,z,col){var g=new T.Group();g.position.set(x,0,z);a.scene.add(g);var seat=a.rbox(.5,.06,.5,.03,col);seat.position.y=.46;g.add(seat);var bk=a.rbox(.06,.5,.5,.03,col);bk.position.set(-.24,.74,0);bk.rotation.z=-.08;g.add(bk);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){var l=a.cyl(.025,.025,.45,0x7f8b99);l.position.set(q[0]*.2,.22,q[1]*.2);g.add(l)})}
function cat(a){var g=new T.Group(),c=0xf0a868,b=a.sph(.2,c);b.scale.set(1.35,.75,.95);b.position.y=.13;g.add(b);var h=a.sph(.13,c);h.position.set(.22,.18,0);g.add(h);
  [-1,1].forEach(function(s){var e=a.mesh(new T.ConeGeometry(.05,.09,4),c);e.position.set(.24,.31,s*.07);g.add(e);var ey=a.mesh(new T.TorusGeometry(.022,.006,4,8,Math.PI),0x3a2a22);ey.position.set(.33,.19,s*.05);ey.rotation.y=Math.PI/2;ey.rotation.x=Math.PI;g.add(ey)});
  var t=a.mesh(new T.TorusGeometry(.17,.035,8,20,Math.PI*1.1),c);t.rotation.x=Math.PI/2;t.position.set(-.05,.04,0);g.add(t);
  for(var k=0;k<3;k++){var st=a.mesh(new T.TorusGeometry(.2,.012,4,16,1),0xd9884a);st.position.set(-.1+k*.1,.13,0);st.rotation.y=Math.PI/2;st.rotation.z=1.07;g.add(st)}
  g.userData.body=b;return g}
function dryer(a,x,y,z,on){var g=new T.Group();g.position.set(x,y,z);g.rotation.y=-Math.PI/2;a.scene.add(g);
  var b=a.rbox(1.1,1,.9,.06,0xf3f5f7);g.add(b);var pnl=a.rbox(.96,.12,.04,.02,0xdce4ea);pnl.position.set(0,.38,.46);g.add(pnl);
  var led=new T.Mesh(new T.PlaneGeometry(.22,.07),new T.MeshBasicMaterial({map:a.canvasTex(88,28,function(c,w,h){c.fillStyle='#1f2a3a';c.fillRect(0,0,w,h);c.fillStyle=on?'#ffb84d':'#7be0a0';c.font='bold 18px monospace';c.textAlign='center';c.fillText(on?'건조중':'대기',w/2,20)})}));led.position.set(.3,.38,.485);g.add(led);
  var inn=new T.Mesh(new T.CircleGeometry(.29,32),on?new T.MeshBasicMaterial({color:0xffcf94}):new T.MeshStandardMaterial({color:0x4a5563}));inn.position.set(0,-.06,.25);g.add(inn);
  var well=new T.Mesh(new T.CylinderGeometry(.3,.3,.22,32,1,true),new T.MeshStandardMaterial({color:on?0xe0b07a:0x6a7584,side:T.BackSide}));well.rotation.x=Math.PI/2;well.position.set(0,-.06,.36);g.add(well);
  var tum=new T.Group();tum.position.set(0,-.06,.3);g.add(tum);[0xea6f96,0x5f8fe0,0xf2bf4f,0xffffff].forEach(function(cc,k){var m=a.sph(.09,cc,{roughness:1});m.scale.set(1.3,.8,.7);var an=k*1.57;m.position.set(Math.cos(an)*.14,Math.sin(an)*.14,0);tum.add(m)});tum.visible=on;
  var rg=a.mesh(new T.TorusGeometry(.32,.05,12,36),0xc7d1da,{metalness:.35,roughness:.35});rg.position.set(0,-.06,.47);g.add(rg);
  var gl=new T.Mesh(new T.CircleGeometry(.31,32),new T.MeshBasicMaterial({color:0xe8f6fc,transparent:true,opacity:.08,depthWrite:false}));gl.position.set(0,-.06,.48);g.add(gl);
  return{tum:tum,on:on}}
var FABRIC=['#ea6f96','#5f8fe0','#f2bf4f','#5fcda6','#f7f5ee','#9d7fe0','#ea7a63','#6eaee8','#f4dcb2'];
function clothPiece(a,k,seed){
  /* solid, soft shapes only: bundled garments under, long wrung sleeves and towels threaded over them */
  var rng=function(j){var v=Math.sin((seed+1)*12.9+k*78.2+j*37.7)*43758.5;return v-Math.floor(v)},geo,home;
  if(k<3){
    geo=new T.SphereGeometry(.17+.03*rng(1),30,22);var p=geo.attributes.position,o=rng(2)*6;
    for(var j=0;j<p.count;j++){var x=p.getX(j),y=p.getY(j),z=p.getZ(j),d=1+.12*Math.sin(x*11+o)*Math.sin(y*9-o)+.05*Math.sin((x+y)*27+o)+.035*Math.sin((x-z)*38);p.setXYZ(j,x*d*1.25,y*d*.82,z*d*.9)}
    home=[[-.12,-.06,-.02],[.12,-.09,.03],[.01,.09,-.05]][k];
  }else{
    var pts=[],n=5+Math.floor(rng(3)*2),st=rng(4)*6.28;
    for(j=0;j<n;j++){var an=st+j*(2.2+rng(j+5)*.6),rr=j===0||j===n-1?.06:.15+.1*rng(j+12);pts.push(new T.Vector3(Math.cos(an)*rr,Math.sin(an)*rr*.82,(rng(j+20)-.5)*.2))}
    var curve=new T.CatmullRomCurve3(pts,false,'catmullrom',.5),R=.058+.026*rng(30),TS=64,RS=12;geo=new T.TubeGeometry(curve,TS,R,RS,false);p=geo.attributes.position;
    for(var ti=0;ti<=TS;ti++){var u=ti/TS,c0=curve.getPointAt(u),tap=Math.pow(Math.sin(Math.PI*Math.min(1,Math.max(0,u)))*.999,.35)*(1+.16*Math.sin(u*33+k)+.08*Math.sin(u*71));for(var ri=0;ri<=RS;ri++){var id=ti*(RS+1)+ri;p.setXYZ(id,c0.x+(p.getX(id)-c0.x)*tap,c0.y+(p.getY(id)-c0.y)*tap,c0.z+(p.getZ(id)-c0.z)*tap)}}
    home=[0,0,.05+(k-3)*.008];
  }
  geo.computeVertexNormals();
  var col=FABRIC[k%FABRIC.length],m,tex=k%4===3?a.canvasTex(64,32,function(c,w,h){c.fillStyle=col;c.fillRect(0,0,w,h);c.fillStyle='rgba(255,255,255,.34)';for(var q=0;q<w;q+=16)c.fillRect(q,0,6,h)}):null;
  if(tex){tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(3,1)}
  m=new T.Mesh(geo,new T.MeshStandardMaterial(tex?{map:tex,roughness:1}:{color:new T.Color(col),roughness:1}));m.castShadow=false;m.receiveShadow=true;m.userData.home=home;m.position.set(home[0],home[1],home[2]);return m;
}
function tumble(m,t,spinning,dt){
  var h=m.drum,q=Math.min(1,dt*2.2),ph=t*1.1+m.x,sn=Math.sin(ph);
  if(spinning){h.rotation.z-=dt*(.45+.95*Math.max(0,sn));h.position.x+=(.05*sn-h.position.x)*q;h.position.y+=(.74+.07*Math.abs(Math.sin(ph*1.5))-h.position.y)*q;h.scale.y+=(1.22-h.scale.y)*q}
  else{h.position.x+=(0-h.position.x)*q;h.position.y+=(.69-h.position.y)*q;h.scale.y+=(1.02-h.scale.y)*q}
  m.cl.forEach(function(c,k){var H=c.userData.home,A=spinning?.022:0;c.position.x+=(H[0]+Math.sin(t*1.9+k*1.7)*A-c.position.x)*q;c.position.y+=(H[1]+Math.cos(t*1.5+k*2.3)*A-c.position.y)*q;if(spinning)c.rotation.z+=dt*(k%2?.28:-.2)})
}
function washer(a,x,z,i){
  var g=new T.Group();g.position.set(x,0,z);a.scene.add(g);
  var rear=a.rbox(1.38,1.9,.86,.07,0xeef1f4);rear.position.set(0,.95,-.32);g.add(rear);
  var sh=new T.Shape(),hw=.69,hh=.95,rc=.1;sh.moveTo(-hw+rc,-hh);sh.lineTo(hw-rc,-hh);sh.quadraticCurveTo(hw,-hh,hw,-hh+rc);sh.lineTo(hw,hh-rc);sh.quadraticCurveTo(hw,hh,hw-rc,hh);sh.lineTo(-hw+rc,hh);sh.quadraticCurveTo(-hw,hh,-hw,hh-rc);sh.lineTo(-hw,-hh+rc);sh.quadraticCurveTo(-hw,-hh,-hw+rc,-hh);
  var hole=new T.Path();hole.absarc(0,-.13,.47,0,Math.PI*2,true);sh.holes.push(hole);
  var fg=new T.ExtrudeGeometry(sh,{depth:.64,bevelEnabled:false,curveSegments:40}),front=a.mesh(fg,0xeef1f4);front.position.set(0,.95,.11);g.add(front);
  var pl=a.rbox(1.2,.28,.08,.03,0xdce4ea);pl.position.set(0,1.68,.74);g.add(pl);
  var lamp=new T.Mesh(new T.SphereGeometry(.035,12,10),new T.MeshBasicMaterial({color:0x7be0a0}));lamp.position.set(.27,1.68,.79);g.add(lamp);
  var lcv=document.createElement('canvas');lcv.width=128;lcv.height=44;var ltex=new T.CanvasTexture(lcv);ltex.encoding=T.sRGBEncoding;var led=new T.Mesh(new T.PlaneGeometry(.36,.124),new T.MeshBasicMaterial({map:ltex}));led.position.set(-.04,1.68,.785);g.add(led);
  var knob=a.cyl(.075,.085,.06,0xc7d1da,{metalness:.3,roughness:.35});knob.rotation.x=Math.PI/2;knob.position.set(.45,1.68,.8);g.add(knob);var kn=a.rbox(.02,.1,.02,.005,0x5d6b7c);kn.position.set(.45,1.7,.835);g.add(kn);
  var drw=a.rbox(.4,.13,.03,.02,0xeef2f5);drw.position.set(-.38,1.4,.765);g.add(drw);var dh=a.rbox(.16,.025,.02,.008,0xa9b4c0);dh.position.set(-.38,1.4,.785);g.add(dh);
  var cpl=a.rbox(.2,.22,.03,.02,0xa9b4c0);cpl.position.set(.45,1.4,.765);g.add(cpl);var csl=a.rbox(.025,.1,.02,.005,0x22262f);csl.position.set(.45,1.42,.785);g.add(csl);
  var numT=new T.Mesh(new T.PlaneGeometry(.26,.26),new T.MeshBasicMaterial({transparent:true,map:a.canvasTex(64,64,function(c){c.fillStyle='#1f2a3a';c.font='46px Jua,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(i+1,32,35)})}));numT.position.set(-.45,1.68,.785);g.add(numT);
    var drum=new T.Group();drum.position.set(0,.74,.38);g.add(drum);
  var cl=[];for(var k=0;k<9;k++){var m=clothPiece(a,k,i);drum.add(m);cl.push(m)}drum.scale.setScalar(1.22);
  var ribs=new T.Group();ribs.position.set(0,.82,.43);g.add(ribs);
  var steel=a.canvasTex(256,128,function(c,w,h){var gr=c.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#7f8b98');gr.addColorStop(1,'#39434f');c.fillStyle=gr;c.fillRect(0,0,w,h);c.fillStyle='rgba(20,26,34,.3)';for(var yy=10;yy<h;yy+=26)for(var xx=(yy%4?6:19);xx<w;xx+=26){c.beginPath();c.arc(xx,yy,4,0,7);c.fill()}});steel.wrapS=T.RepeatWrapping;steel.repeat.x=2;
  var wall=new T.Mesh(new T.CylinderGeometry(.465,.465,.66,40,1,true),new T.MeshStandardMaterial({map:steel,side:T.BackSide,roughness:.5,metalness:.15}));wall.rotation.x=Math.PI/2;wall.receiveShadow=true;ribs.add(wall);
  var back=new T.Mesh(new T.CircleGeometry(.465,40),new T.MeshStandardMaterial({color:0x4a5563,roughness:.55,metalness:.2}));back.position.z=-.32;back.receiveShadow=true;ribs.add(back);
  var hubT=a.cyl(.12,.15,.05,0x38424f);hubT.rotation.x=Math.PI/2;hubT.position.z=-.3;ribs.add(hubT);
  for(k=0;k<3;k++){var rb=a.rbox(.05,.06,.55,.02,0x8d98a4),ra=k/3*6.28+.5;rb.position.set(Math.cos(ra)*.42,Math.sin(ra)*.42,0);rb.rotation.z=ra+Math.PI/2;ribs.add(rb)}
  var hinge=new T.Group();hinge.position.set(-.5,.82,.8);g.add(hinge);
  var gasket=a.mesh(new T.TorusGeometry(.47,.035,10,44),0x39424e);gasket.position.set(0,.82,.75);g.add(gasket);
  var ring=a.mesh(new T.TorusGeometry(.49,.075,14,44),0xc7d1da,{metalness:.35,roughness:.35});ring.position.x=.5;hinge.add(ring);
  var glass=new T.Mesh(new T.CircleGeometry(.48,40),new T.MeshBasicMaterial({color:0xe8f6fc,transparent:true,opacity:.05,depthWrite:false}));glass.position.set(.5,0,.02);glass.renderOrder=2;hinge.add(glass);
  var shine=new T.Mesh(new T.CircleGeometry(.47,40),new T.MeshBasicMaterial({transparent:true,depthWrite:false,map:a.canvasTex(128,128,function(c,w){c.translate(w/2,w/2);c.rotate(-.75);c.fillStyle='rgba(255,255,255,.26)';c.beginPath();c.ellipse(-38,0,6,30,0,0,7);c.fill();c.fillStyle='rgba(255,255,255,.12)';c.beginPath();c.ellipse(-24,0,3,24,0,0,7);c.fill()})}));shine.position.set(.5,0,.03);shine.renderOrder=3;hinge.add(shine);
  return{g:g,drum:drum,ribs:ribs,hinge:hinge,lamp:lamp,cl:cl,x:x,lcv:lcv,ltex:ltex,lt:''};
}
function owner(a,i){var all=a.all();for(var k=0;k<all.length;k++)if(all[k].m===i)return all[k];return null}
function state(a,i){var o=owner(a,i);if(!o)return 0;return o.mu>Date.now()?1:2}
function freeM(a){var best=-1,bd=1e9;for(var i=0;i<N;i++)if(!owner(a,i)){var d=Math.abs(mx(i)-a.me.x);if(d<bd){bd=d;best=i}}return best}
var folding=0,foldNext=0,gazing=false;
function clearPile(){while(pile.children.length)pile.remove(pile.children[0])}
function addPile(a,n){var cols=[0xff9db8,0x8fb3ff,0xffd98a,0x9be8cf,0xffffff];var m=a.rbox(.62,.09,.48,.03,cols[n%5]);m.position.y=n*.09;pile.add(m)}
function stopAct(a){gazing=false;folding=0;a.setClose(null)}
function mmss(ms){var s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function gazeTarget(a){if(a.me.m>=0)return a.me.m;var best=-1;for(var i=0;i<N;i++)if(state(a,i)===1&&(best<0||Math.abs(mx(i)-a.me.x)<Math.abs(mx(best)-a.me.x)))best=i;return best}
window.SCENE={
 bg:0x1b2240,size:9.6,camDir:[.07,.9,.6],fit:[-3.45,0,-5.15,3.45,4,6],bounds:[-2.3,-2.1,1.95,4.9],
 lights:{sky:0xe6eeff,ground:0x5d6480,hemi:.34,sunColor:0xf4f8ff,sun:.34,sunPos:[-3,14,8]},outfit:{shoes:0x3f4a63,hood:true},build:build,
 poseLabel:{gaze:'빨래멍',load:'빨래 넣는 중',fold:'빨래 개는 중',sit:'쉬는 중'},
 spawn:function(){return{x:-1+Math.random()*1.6,z:3.8+Math.random()*.8}},
 npcs:[],
 onWalk:function(a){stopAct(a)},
 sound:function(a){if(gazing)return[.2,560];for(var i=0;i<N;i++)if(state(a,i)===1)return[.09,430];return[.03,300]},
 tick:function(a,n,t,dt){
  machines.forEach(function(m,i){var st=state(a,i),open=st===2||(a.me.pose==='load'&&a.me.m===i)?1:0;
   m.drum.visible=st>0||(a.me.pose==='load'&&a.me.m===i);
   if(st===1)m.ribs.rotation.z-=dt*1.9;tumble(m,t,st===1,dt);
   m.hinge.rotation.y+=((open?-1.75:0)-m.hinge.rotation.y)*Math.min(1,dt*5);
   m.lamp.material.color.setHex(st===0?0x7be0a0:st===1?0xffb84d:0x5aa8ff);
   var o=owner(a,i),txt=st===0?'READY':st===1?mmss(o.mu-n).padStart(5,'0'):'END';
   if(txt!==m.lt){m.lt=txt;var c=m.lcv.getContext('2d');c.fillStyle='#16202e';c.fillRect(0,0,128,44);c.font='bold 30px "Courier New",monospace';c.textAlign='center';c.textBaseline='middle';c.fillStyle=st===0?'#7be0a0':st===1?'#ffb84d':'#7fc4ff';c.shadowColor=c.fillStyle;c.shadowBlur=8;c.fillText(txt,64,24);m.ltex.needsUpdate=true}
   if(st===1)m.g.position.x=m.x+Math.sin(t*38)*.006;else m.g.position.x=m.x;
  });
  if(fx.rain)fx.rain.offset.y+=dt*.35;
  a.others().forEach(function(o){if(o.npc&&o.m>=0&&o.mu<n){o.mu=n+45000+Math.random()*60000}});
  if(fx.neon){var fl2=Math.random()<.004?.25:1;if(fl2<1)fx.flick=n+90;var lit=fx.flick>n?.3:1;fx.neon.material.opacity=lit;fx.pink.intensity=.9*lit}
  if(fx.dust){fx.dust.position.y=Math.sin(t*.15)*.15;fx.dust.rotation.y=t*.01}
  if(fx.cat){var br=1+Math.sin(t*1.6)*.04;fx.cat.userData.body.scale.set(1.35,.75*br,.95*br)}
  if(fx.dryers)fx.dryers.forEach(function(d){if(d.on)d.tum.rotation.z-=dt*2.2});
  if(fx.clockTex&&new Date().getMinutes()!==fx.clockMin)drawClock();
  var me=a.me;
  if(me.m>=0&&me.ms===1&&me.mu<=n){me.ms=2;a.push();[880,1109,1319].forEach(function(f,i){setTimeout(function(){a.blip(f,.5,.12)},i*260)});a.toast((me.m+1)+'번 세탁이 끝났어요. 꺼내기를 눌러 보세요.');a.refresh()}
  if(folding&&n>foldNext){foldNext=n+2600;me.f++;addPile(a,me.f-1);a.blip(520,.08,.05);a.push();
   if(me.f>=5){folding=0;me.carry=false;me.f=0;a.setPose('stand');a.toast('다 갰어요. 뽀송해요.');setTimeout(clearPile,2400);a.refresh()}}
  /* other people's piles stay out of the shared table; poses show it */
 },
 actions:[
  {label:'빨래 넣기',state:function(a){var m=a.me;if(m.m>=0)return{off:true,sub:m.ms===1?mmss(m.mu-Date.now())+' 남음':'세탁 끝',why:m.ms===1?'지금 돌아가고 있어요.':'먼저 꺼내 주세요.'};if(m.carry)return{off:true,sub:'',why:'꺼낸 빨래를 먼저 개어 주세요.'};if(freeM(a)<0)return{off:true,sub:'빈 세탁기 없음',why:'빈 세탁기가 없어요. 조금만 기다려 주세요.'};return{sub:'빈 세탁기로'}},
   run:function(a){stopAct(a);var i=freeM(a),me=a.me;me.m=i;me.ms=0;me.mu=Date.now()+WASH+6000;me.ms=1;me.pose='stand';a.goTo(mx(i),-2,function(){a.setPose('load');setTimeout(function(){if(me.m===i&&me.pose==='load')a.setPose('stand');me.mu=Date.now()+WASH;a.push();a.refresh()},1800)},Math.PI);a.push()}},
  {label:'빨래멍',state:function(a){var on=gazing,t=gazeTarget(a);if(on)return{on:true,label:'그만 보기',sub:'세탁기 앞'};if(t<0)return{off:true,sub:'돌아가는 세탁기 없음',why:'먼저 빨래를 넣어 주세요.'};return{sub:'가만히 서 있기'}},
   run:function(a){if(gazing){stopAct(a);a.setPose('stand');return}var i=gazeTarget(a);a.goTo(mx(i)-.72,-1.75,function(){gazing=true;a.setPose('gaze');a.setClose({p:a.V(mx(i)+.35,1.65,2.5),l:a.V(mx(i)-.12,.95,-2.6)});a.refresh()},Math.PI)}},
  {label:'꺼내기',state:function(a){var m=a.me;if(m.m<0)return{off:true,sub:'',why:'세탁기에 넣은 빨래가 없어요.'};if(m.ms===1)return{off:true,sub:mmss(m.mu-Date.now()),why:'아직 돌아가고 있어요.'};return{sub:'세탁 끝'}},
   run:function(a){stopAct(a);var me=a.me,i=me.m;a.goTo(mx(i),-2,function(){a.setPose('load');setTimeout(function(){me.m=-1;me.ms=0;me.mu=0;me.carry=true;a.setPose('stand');a.push();a.refresh()},1400)},Math.PI)}},
  {label:'빨래 개기',state:function(a){if(folding)return{on:true,label:'그만 개기',sub:a.me.f+'/5'};if(!a.me.carry)return{off:true,sub:'',why:'꺼낸 빨래가 있어야 갤 수 있어요.'};return{sub:'테이블에서'}},
   run:function(a){var me=a.me;if(folding){folding=0;a.setPose('stand');return}clearPile();me.f=0;a.goTo(tableX,tableZ+.82,function(){a.setPose('fold');folding=1;foldNext=Date.now()+1500;a.refresh()},Math.PI)}}
 ]
};
Object.defineProperty(window.SCENE,'look',{get:function(){return window.THREE?(this._l||(this._l=new THREE.Vector3(0,.8,-.35))):null},set:function(){}});
})();
