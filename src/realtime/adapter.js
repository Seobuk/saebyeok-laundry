/* Transport boundary. Scene/engine presence schema is intentionally unchanged.
   Transports: Claude room (host provided), local-ws (bundled Node server), lodestar (Supabase Realtime, see docs/realtime-adapter.md). */
(function(){
  const V=window.SaebyeokValidate;
  const listen=list=>fn=>{list.push(fn);return()=>{const i=list.indexOf(fn);if(i>=0)list.splice(i,1);};};

  function localWs(options){
    let socket, stopped=false, timer, nextId=0, latest=null, connected=false;
    const pending=new Map(), peerListeners=[], connectionListeners=[];
    function connection(value) {connected=value;connectionListeners.forEach(fn=>fn(value));}
    function connect() {
      // Relative to the page so the app also works below a sub-path.
      const url=new URL('realtime',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.search='';url.hash='';url.searchParams.set('room',options.room);
      socket=new WebSocket(url);
      socket.onopen=()=>{connection(true);};
      socket.onmessage=event=>{
        let m;try{m=JSON.parse(event.data);}catch{return;}
        if(m.type==='peers')peerListeners.forEach(fn=>fn(m));
        if(m.type==='ack'){
          const task=pending.get(m.id);if(!task)return;pending.delete(m.id);
          clearTimeout(task.timer);
          if(!m.accepted&&options.onCorrection)options.onCorrection(m);
          task.resolve(m);
        }
      };
      socket.onclose=()=>{
        connection(false);
        for(const task of pending.values()){clearTimeout(task.timer);task.reject(new Error('Disconnected'));}pending.clear();
        if(!stopped)timer=setTimeout(connect,1500);
      };
      socket.onerror=()=>socket.close();
    }
    const adapter={
      presence(p) {
        latest=p;
        if(!connected)return Promise.reject(new Error('Disconnected'));
        const id=++nextId;
        return new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Ack timeout'));socket.close();},5000);
          pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({type:'presence',id,presence:latest}));
        });
      },
      onPeers:listen(peerListeners),
      onConnection(fn){const off=listen(connectionListeners)(fn);fn(connected);return off;},
      close(){stopped=true;clearTimeout(timer);socket.close();}
    };
    // Subscribe in hook before a transport can deliver its initial snapshot.
    setTimeout(connect,0);
    window.addEventListener('pagehide',()=>adapter.close());
    window.addEventListener('pageshow',event=>{if(event.persisted){stopped=false;connect();}});
    return adapter;
  }

  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const FATAL=new Set(['unauthenticated','forbidden','disabled']);

  async function lodestar(options,config){
    const session=window.LodestarSession,lib=window.supabase;
    if(!session||!lib||typeof lib.createClient!=='function')throw new Error('Lodestar transport unavailable');
    if(!V.ROOMS.includes(options.room))throw new Error('Unknown room');
    const timing={sendIntervalMs:200,trackIntervalMs:1000,renewMs:15000,retryMs:1500,maxRetryMs:30000,refreshLeadMs:60000,minRefreshMs:10000,receivePerSecond:20,...(config.timing||{})};
    const room=options.room,topic='saebyeok:'+room,peer=crypto.randomUUID();
    let info=await session.get(),token=info.realtime.accessToken;
    // The token lives only in memory: no auth storage, no URL, no logging.
    const client=lib.createClient(info.realtime.url,info.realtime.anonKey,{accessToken:async()=>token,realtime:{heartbeatIntervalMs:15000}});
    const peerListeners=[],connectionListeners=[],known=new Map(),received=new Map();
    let channel=null,connected=false,stopped=false,retryTimer=null,retryDelay=timing.retryMs,refreshTimer=null,renewTimer=null,trackTimer=null;
    let held=-1,seq=0,lastSent=null,lastTracked=null,lastTrackAt=0,pendingTrack=null;
    let want=null,waiters=[],pumping=false,lastSendAt=0;

    function emit(change){if(change.joined.length||change.updated.length||change.left.length)peerListeners.forEach(fn=>fn(change));}
    function connection(value){
      if(connected===value)return;connected=value;
      if(!value){known.clear();received.clear();held=-1;stopRenew();clearTimeout(trackTimer);trackTimer=null;pendingTrack=null;lastTracked=null;
        const batch=waiters;want=null;waiters=[];batch.forEach(w=>w.reject(new Error('Disconnected')));}
      connectionListeners.forEach(fn=>fn(value));
    }
    function parse(key,payload){
      if(key===peer||typeof key!=='string'||!UUID.test(key)||!payload||typeof payload!=='object'||payload.v!==1||!Number.isSafeInteger(payload.seq)||payload.seq<0)return null;
      const body={v:1,peer:key,seq:payload.seq,presence:payload.presence};
      return V.withinSize(body)&&V.validatePresence(body.presence)?body:null;
    }
    function allow(key){
      const now=Date.now();let r=received.get(key);
      if(!r||now-r.at>=1000){r={at:now,count:0};received.set(key,r);}
      return ++r.count<=timing.receivePerSecond;
    }
    function best(key,metas){let top=null;for(const meta of Array.isArray(metas)?metas:[]){const body=parse(key,meta);if(body&&(!top||body.seq>top.seq))top=body;}return top;}
    function apply(body,change){
      const prev=known.get(body.peer);
      if(prev&&body.seq<=prev.seq)return;
      known.set(body.peer,{seq:body.seq});
      (prev?change.updated:change.joined).push({peer:body.peer,kind:'viewer',sameTab:false,presence:V.normalize(room,body.presence)});
    }
    const blank=()=>({joined:[],updated:[],left:[]});

    function open(){
      const ch=client.channel(topic,{config:{private:true,presence:{key:peer},broadcast:{self:false,ack:true}}});
      channel=ch;
      ch.on('presence',{event:'sync'},()=>{
        if(ch!==channel)return;
        const state=ch.presenceState()||{},change=blank();
        for(const [key,metas] of Object.entries(state)){if(key===peer)continue;const body=best(key,metas);if(body)apply(body,change);}
        for(const key of [...known.keys()])if(!Object.hasOwn(state,key)){known.delete(key);received.delete(key);change.left.push({peer:key});}
        emit(change);
      });
      ch.on('presence',{event:'join'},event=>{
        if(ch!==channel||!event||event.key===peer||!allow(event.key))return;
        const body=best(event.key,event.newPresences),change=blank();if(body)apply(body,change);emit(change);
      });
      ch.on('presence',{event:'leave'},event=>{
        if(ch!==channel||!event||!known.has(event.key)||Object.hasOwn(ch.presenceState()||{},event.key))return;
        known.delete(event.key);received.delete(event.key);emit({joined:[],updated:[],left:[{peer:event.key}]});
      });
      ch.on('broadcast',{event:'state'},message=>{
        const payload=message&&message.payload;
        // Broadcast only refreshes peers already announced through Presence.
        if(ch!==channel||!payload||!known.has(payload.peer)||!allow(payload.peer))return;
        const body=parse(payload.peer,payload),change=blank();if(body)apply(body,change);emit(change);
      });
      ch.subscribe(status=>{
        if(ch!==channel)return;
        if(status==='SUBSCRIBED'){retryDelay=timing.retryMs;connection(true);}
        else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){connection(false);reconnect();}
      });
    }
    function drop(){const old=channel;channel=null;if(old)Promise.resolve().then(()=>client.removeChannel(old)).catch(()=>{});}
    function fatal(){stopped=true;clearTimeout(refreshTimer);clearTimeout(retryTimer);retryTimer=null;drop();connection(false);}
    async function refresh(){
      info=await session.refresh();token=info.realtime.accessToken;
      await client.realtime.setAuth(token);planRefresh();
    }
    function planRefresh(){
      clearTimeout(refreshTimer);if(stopped)return;
      const wait=Math.max(timing.minRefreshMs,info.realtime.expiresAt*1000-Date.now()-timing.refreshLeadMs);
      refreshTimer=setTimeout(()=>refresh().catch(error=>{if(FATAL.has(error&&error.code))fatal();else{connection(false);reconnect();}}),wait);
    }
    function reconnect(){
      if(stopped||retryTimer)return;
      const delay=retryDelay;retryDelay=Math.min(retryDelay*2,timing.maxRetryMs);
      retryTimer=setTimeout(async()=>{
        retryTimer=null;drop();
        try{await refresh();}catch(error){if(FATAL.has(error&&error.code)){fatal();return;}reconnect();return;}
        if(!stopped)open();
      },delay);
    }

    async function rpc(name,args){
      const {data,error}=await client.rpc(name,args);
      if(error||!data||typeof data!=='object'||typeof data.ok!=='boolean')throw new Error('RPC '+name+' failed');
      return data;
    }
    function previous(){return lastSent&&held>=0&&lastSent.m===held?{m:lastSent.m,ms:lastSent.ms,mu:lastSent.mu}:{m:-1,ms:0,mu:0};}
    function correct(requested,presence){const result={accepted:false,presence,requested,reason:'occupied'};if(options.onCorrection)options.onCorrection(result);return result;}
    function startRenew(){
      if(renewTimer)return;
      renewTimer=setInterval(async()=>{
        if(held<0||!connected){stopRenew();return;}
        let r;try{r=await rpc('saebyeok_renew',{p_room:room,p_peer:peer});}catch{return;}
        if(r.ok===false&&held>=0){const requested=held;held=-1;stopRenew();correct(requested,{...(lastSent||{}),m:-1,ms:0,mu:0});}
      },timing.renewMs);
    }
    function stopRenew(){clearInterval(renewTimer);renewTimer=null;}
    async function deliver(p){
      if(!connected||!channel)throw new Error('Disconnected');
      let next=p,result={accepted:true,presence:p};
      if(next.m>=0&&(next.m!==held||!lastSent||next.mu!==lastSent.mu)){
        const r=await rpc('saebyeok_claim',{p_room:room,p_machine:next.m,p_peer:peer,p_until:Math.floor(next.mu)});
        if(r.ok){held=next.m;startRenew();}
        else{const requested=next.m;next={...next,...previous()};result=correct(requested,next);}
      }else if(next.m<0&&held>=0){
        held=-1;stopRenew();
        try{await rpc('saebyeok_release',{p_room:room,p_peer:peer});}catch{/* the lease expires on its own */}
      }
      if(!connected||!channel)throw new Error('Disconnected');
      const body={v:1,peer,seq:++seq,presence:next};
      if(!V.withinSize(body))throw new Error('Presence too large');
      const status=await channel.send({type:'broadcast',event:'state',payload:body});
      if(status!=='ok')throw new Error('Broadcast '+status);
      lastSent=next;track(body);
      if(result.accepted)result.presence=next;
      return result;
    }
    function track(body){
      pendingTrack=body;
      const changed=!lastTracked||lastTracked.presence.m!==body.presence.m||lastTracked.presence.ms!==body.presence.ms||lastTracked.presence.in!==body.presence.in;
      const wait=lastTrackAt+timing.trackIntervalMs-Date.now();
      if(changed||wait<=0)flushTrack();
      else if(!trackTimer)trackTimer=setTimeout(flushTrack,wait);
    }
    function flushTrack(){
      clearTimeout(trackTimer);trackTimer=null;const body=pendingTrack;pendingTrack=null;
      if(!body||!connected||!channel)return;
      lastTracked=body;lastTrackAt=Date.now();
      Promise.resolve().then(()=>channel&&channel.track({v:1,seq:body.seq,presence:body.presence})).catch(()=>{});
    }
    async function pump(){
      if(pumping)return;pumping=true;
      try{
        while(want){
          const wait=lastSendAt+timing.sendIntervalMs-Date.now();
          if(wait>0)await new Promise(r=>setTimeout(r,wait));
          if(!want)break;
          const p=want,batch=waiters;want=null;waiters=[];lastSendAt=Date.now();
          try{const result=await deliver(p);batch.forEach(w=>w.resolve(result));}catch(error){batch.forEach(w=>w.reject(error));}
        }
      }finally{pumping=false;}
    }

    const adapter={
      presence(p){
        if(!V.validatePresence(p))return Promise.reject(new Error('Invalid presence'));
        if(!connected)return Promise.reject(new Error('Disconnected'));
        // Only the newest state is kept; senders are coalesced to at most one delivery per interval.
        want=V.normalize(room,p);
        return new Promise((resolve,reject)=>{waiters.push({resolve,reject});pump();});
      },
      onPeers:listen(peerListeners),
      onConnection(fn){const off=listen(connectionListeners)(fn);fn(connected);return off;},
      close(){
        if(stopped)return;stopped=true;
        clearTimeout(retryTimer);retryTimer=null;clearTimeout(refreshTimer);
        if(held>=0)Promise.resolve().then(()=>client.rpc('saebyeok_release',{p_room:room,p_peer:peer})).catch(()=>{});
        const ch=channel;if(ch)Promise.resolve().then(()=>ch.untrack()).catch(()=>{});
        drop();connection(false);
      },
      peer
    };
    setTimeout(open,0);planRefresh();
    window.addEventListener('pagehide',()=>adapter.close());
    window.addEventListener('pageshow',event=>{if(event.persisted&&stopped){stopped=false;retryDelay=0;reconnect();retryDelay=timing.retryMs;}});
    return adapter;
  }

  window.Realtime={
    async create(options){
      if(window.claude&&window.claude.use)return window.claude.use('room');
      const config=window.APP_CONFIG||{};
      return config.backend==='lodestar'?lodestar(options,config):localWs(options);
    }
  };
})();
