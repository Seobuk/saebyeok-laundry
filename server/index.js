import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {createAuth} from './auth.js';
import {RoomState,ROOMS,MAX_BYTES,parseMessage} from './state.js';
const root = fileURLToPath(new URL('../dist/',import.meta.url));
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
export function createApp({heartbeatMs=15000,authOptions={}}={}) {
  const state = new RoomState();
  const auth=createAuth(authOptions);
  const server = http.createServer(async (req,res) => {
    try {if(await auth.handle(req,res))return;}catch{res.writeHead(500,{'Cache-Control':'no-store'}).end('Authentication unavailable');return;}
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405).end();return;}
    try {
      let path = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if (path === '/') path='/saebyeok-laundry.html';
      const file = resolve(root,'.'+path);
      if (!file.startsWith(root)) {res.writeHead(403).end();return;}
      const body = await readFile(file);
      res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {res.writeHead(404).end('Not found');}
  });
  const wss = new WebSocketServer({noServer:true,maxPayload:MAX_BYTES});
  const send=(ws,data)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));};
  const broadcast=(room,data,except)=>{for(const ws of wss.clients)if(ws.room===room&&ws!==except)send(ws,data);};
  server.on('upgrade',(req,socket,head)=>{
    let url,origin;
    try{url=new URL(req.url,'http://localhost');origin=req.headers.origin?new URL(req.headers.origin):null;}catch{socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}
    const room=url.searchParams.get('room');
    // Local app connections only: no cross-origin page may silently join a room.
    if(url.pathname!=='/realtime'||!ROOMS.has(room)||(origin&&(!['http:','https:'].includes(origin.protocol)||origin.host!==req.headers.host))){socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}
    if(!auth.allowedOrigin(req.headers.origin)){socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');return;}
    const session=auth.session(req);
    if(auth.required&&!session){socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n');return;}
    wss.handleUpgrade(req,socket,head,ws=>{ws.room=room;ws.sessionId=session?.id;ws.identity=session?.identity||null;wss.emit('connection',ws);});
  });
  const depart=ws=>{if(state.leave(ws.room,ws.id))broadcast(ws.room,{type:'peers',left:[{peer:ws.id}]});};
  wss.on('connection',ws=>{
    ws.id=randomUUID();ws.alive=true;ws.windowAt=Date.now();ws.count=0;state.join(ws.room,ws.id,ws.identity);
    send(ws,{type:'peers',joined:state.snapshot(ws.room,ws.id),updated:[],left:[]});
    ws.on('pong',()=>{ws.alive=true;});
    ws.on('error',()=>{});
    ws.on('message',(raw,binary)=>{
      try {
        if(ws.sessionId&&!auth.valid(ws.sessionId)){ws.close(1008,'Session expired');return;}
        if(binary)throw new Error('binary');
        if(Date.now()-ws.windowAt>=1000){ws.windowAt=Date.now();ws.count=0;}
        if(++ws.count>20)throw new Error('rate');
        const m=parseMessage(raw),r=state.update(ws.room,ws.id,m.presence);
        send(ws,{type:'ack',id:m.id,...r});
        if(r.accepted)broadcast(ws.room,{type:'peers',[r.joined?'joined':'updated']:[{peer:ws.id,kind:'viewer',sameTab:false,presence:r.presence}]},ws);
      } catch {ws.close(1008,'Invalid presence');}
    });
    ws.on('close',()=>depart(ws));
  });
  auth.onInvalidate=id=>{for(const ws of wss.clients)if(ws.sessionId===id)ws.close(1008,'Session ended');};
  const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(ws.sessionId&&!auth.valid(ws.sessionId)){depart(ws);ws.close(1008,'Session expired');continue;}if(!ws.alive){depart(ws);ws.terminate();continue;}ws.alive=false;ws.ping();}},heartbeatMs);
  heartbeat.unref();
  return {server,wss,state,async close(){clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const app=createApp(),port=Number(process.env.PORT||5173),host=process.env.HOST||'127.0.0.1';
  app.server.listen(port,host,()=>console.log(`새벽빨래방 http://${host}:${port} / ttasun-spa.html`));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit()));
}
