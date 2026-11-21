// Build options (environment):
//   BACKEND=local (default)  bundled Node server: /realtime WebSocket + local login BFF
//   BACKEND=lodestar         Lodestar-hosted: Lodestar session API + Supabase Realtime (vendored supabase-js)
// Both backends copy three 0.128.0 (r128) from node_modules to vendor/three.min.js.
//   BASE=/apps/saebyeok/     URL path the files are served from (lodestar default; used only for the login return path)
//   OUT=dist                 output folder (relative to the repository root)
// Every asset reference stays relative, and no project URL, key or token is ever written into the build.
import {readFile,mkdir,writeFile,cp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const backend=process.env.BACKEND||'local';
if(!['local','lodestar'].includes(backend))throw new Error('BACKEND must be local or lodestar');
const base=process.env.BASE||(backend==='lodestar'?'/apps/saebyeok/':'/');
if(!/^\/([A-Za-z0-9_-]+\/)*$/.test(base))throw new Error('BASE must look like /apps/saebyeok/');
const dist=resolve(root,process.env.OUT||'dist');
if(dist===resolve(root)||!dist.startsWith(resolve(root)+'/'))throw new Error('OUT must be a folder inside the repository');
const read=name=>readFile(join(root,'src',name),'utf8');
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});await cp(join(root,'public'),dist,{recursive:true});
const SUPABASE_VERSION=JSON.parse(await readFile(join(root,'node_modules/@supabase/supabase-js/package.json'),'utf8').catch(()=>'{}')).version;
const THREE_VERSION=JSON.parse(await readFile(join(root,'node_modules/three/package.json'),'utf8').catch(()=>'{}')).version;
// Three.js is vendored from the pinned npm package (byte-identical to the former cdnjs r128 file) so no build loads a third-party script.
if(THREE_VERSION!=='0.128.0')throw new Error('Run npm ci first: three 0.128.0 (r128) is required');
await mkdir(join(dist,'vendor'),{recursive:true});
await cp(join(root,'node_modules/three/build/three.min.js'),join(dist,'vendor/three.min.js'));
const config=backend==='lodestar'?{backend,base}:{backend};
let vendor='';
if(backend==='lodestar'){
  if(!SUPABASE_VERSION)throw new Error('Run npm ci first: @supabase/supabase-js is required for BACKEND=lodestar');
  await cp(join(root,'node_modules/@supabase/supabase-js/dist/umd/supabase.js'),join(dist,'vendor/supabase.js'));
  vendor='\n<script src="vendor/supabase.js"></script>';
}
const shell=await read('shell.html'),engine=await read('engine.js');
for(const [name,title,accent,gate,room,scene] of [
 ['saebyeok-laundry','새벽빨래방','#ec5f8b','불 켜진 빨래방에 들어가요','laundry','laundry.js'],
 ['ttasun-spa','따순물 찜질스파','#e8493a','신발 벗고 들어오세요','spa','spa.js']]){
  const values={ICON_PREFIX:room==='laundry'?'':'spa-',OG_IMAGE:room==='laundry'?'icons/03_moon_og.png':'icons/spa-og.png',OG_WIDTH:room==='laundry'?'1200':'512',OG_HEIGHT:room==='laundry'?'630':'512',OG_ALT:room==='laundry'?'달빛 빨래멍 — 새벽빨래방, 개발자 홍서진':'따순찜질스파 아이콘',TITLE:title,ACCENT:accent,COLS:'4',GATE:gate,ROOM:room,MANIFEST:room==='laundry'?'manifest.webmanifest':'spa.webmanifest',CONFIG:JSON.stringify(config),VENDOR:vendor,SCENE:await read(scene),ENGINE:engine};
  const body=shell.replace(/\{\{(\w+)\}\}/g,(_,key)=>values[key]??(()=>{throw new Error(key)})());
  const html='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}body{margin:0}</style>'+body+'</body></html>';
  await writeFile(join(dist,name+'.html'),html);console.log('built',name+'.html');
}
await cp(join(root,'src/realtime'),join(dist,'realtime'),{recursive:true});
await cp(join(root,'src/auth'),join(dist,'auth'),{recursive:true});
await cp(join(root,'licenses'),join(dist,'licenses'),{recursive:true});
console.log('backend',backend,'base',base,'three '+THREE_VERSION,backend==='lodestar'?'supabase-js '+SUPABASE_VERSION:'');
