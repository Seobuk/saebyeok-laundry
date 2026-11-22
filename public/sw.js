const CACHE='saebyeok-static-v8-room-switch';
const STATIC=['saebyeok-laundry.html','ttasun-spa.html','manifest.webmanifest','spa.webmanifest','auth/index.js','realtime/validate.js','realtime/adapter.js','vendor/three.min.js','licenses.html','licenses/THREE-MIT.txt','licenses/Jua-OFL.txt','licenses/NotoSansKR-OFL.txt','licenses/ws-MIT.txt','licenses/supabase-js-MIT.txt','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','icons/maskable-512.png','icons/favicon-32.png','icons/favicon.svg','icons/03_moon_og.png','icons/spa-icon-192.png','icons/spa-icon-512.png','icons/spa-maskable-512.png','icons/spa-apple-touch-icon.png','icons/spa-favicon-32.png','icons/spa-favicon.svg'];
const TYPES={'.html':'text/html','.js':'javascript','.webmanifest':'json','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain'};
// A login redirect (or a login page served in place of a file) must never be stored as the app.
function cacheable(request,response){
  if(!response||!response.ok||response.redirected||response.type==='opaqueredirect'||response.status!==200)return false;
  const path=new URL(request.url||request,self.location).pathname,type=(response.headers.get('content-type')||'').toLowerCase();
  const ext=Object.keys(TYPES).find(e=>path.endsWith(e));
  return Boolean(ext&&type.includes(TYPES[ext]));
}
async function precache(){
  const cache=await caches.open(CACHE);
  await Promise.all(STATIC.map(async path=>{try{const response=await fetch(path,{cache:'no-cache',credentials:'same-origin'});if(cacheable(new Request(path),response))await cache.put(path,response);}catch{/* offline install keeps going */}}));
}
self.addEventListener('install',event=>event.waitUntil(precache().then(()=>{if(typeof self.skipWaiting==='function')return self.skipWaiting();})));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('saebyeok-static-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>{if(self.clients&&typeof self.clients.claim==='function')return self.clients.claim();})));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // Explicit same-origin static allowlist: never intercept /api/, realtime, login or third-party CDN requests.
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/api/')||!STATIC.some(path=>new URL(path,self.location).pathname===url.pathname))return;
  event.respondWith(fetch(event.request).then(response=>{if(cacheable(event.request,response)){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request,{ignoreSearch:true})));
});
