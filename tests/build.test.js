// Builds both backends into ignored folders and scans every emitted file for things a public build must not contain.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const run=promisify(execFile),root=fileURLToPath(new URL('../',import.meta.url));
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await files(p));else out.push(p);}return out;}
async function build(t,backend){
 const out=join('test-results','build-'+backend);await run(process.execPath,['scripts/build.mjs'],{cwd:root,env:{...process.env,BACKEND:backend,OUT:out}});
 t.after(()=>rm(join(root,out),{recursive:true,force:true}));
 const list=await files(join(root,out));return {dir:join(root,out),list,text:await Promise.all(list.filter(f=>/\.(html|js|json|webmanifest|txt|md)$/.test(f)).map(async f=>[f,await readFile(f,'utf8')]))};
}
const forbidden=[['absolute /auth/ route',/['"`(=]\/auth\//],['JWT-looking value',new RegExp('ey'+'J')],['Supabase project host',/[a-z0-9]{20}\.supabase\.(co|in)/],['local machine path',/\/home\/|\/Users\//]];
for(const backend of ['local','lodestar'])test(`${backend} build has no secrets, project hosts or absolute auth routes`,async t=>{
 const b=await build(t,backend);
 for(const [file,text] of b.text)for(const [label,re] of forbidden)assert.doesNotMatch(text,re,`${label} in ${file}`);
 for(const [file,text] of b.text)if(!file.endsWith('vendor/supabase.js'))assert.doesNotMatch(text,/supabase\.co/,`supabase.co in ${file}`);
 const html=b.text.find(([f])=>f.endsWith('saebyeok-laundry.html'))[1];
 assert.doesNotMatch(html,/(src|href)="\/(?!\/)/,'asset references stay relative');
 assert.match(html,new RegExp(`window.APP_CONFIG=\\{"backend":"${backend}"`));
 assert.equal(b.list.some(f=>f.endsWith('vendor/supabase.js')),backend==='lodestar');
 // Three.js is vendored from npm three 0.128.0 (r128): no build references cdnjs, every page loads it same-origin.
 for(const [file,text] of b.text)assert.equal(text.split('cdnjs').length-1,0,`cdnjs in ${file}`);
 for(const page of ['saebyeok-laundry.html','ttasun-spa.html']){const h=b.text.find(([f])=>f.endsWith(page))[1];assert.match(h,/<script src="vendor\/three\.min\.js"><\/script>/);assert.equal((h.match(/<script src="https?:/g)||[]).length,0,'no third-party script in '+page);}
 const three=await readFile(join(b.dir,'vendor/three.min.js'),'utf8'),pkg=JSON.parse(await readFile(join(root,'node_modules/three/package.json'),'utf8'));
 assert.equal(pkg.version,'0.128.0');assert.equal(three,await readFile(join(root,'node_modules/three/build/three.min.js'),'utf8'));assert.match(three,/SPDX-License-Identifier: MIT/);
 assert.match(await readFile(join(b.dir,'licenses/THREE-MIT.txt'),'utf8'),/three\.js authors/);
 if(backend==='lodestar'){assert.match(html,/<script src="vendor\/supabase.js"><\/script>/);assert.match(html,/"base":"\/apps\/saebyeok\/"/);}
});
test('build rejects unknown backends and unsafe BASE or OUT values',async()=>{
 for(const env of [{BACKEND:'other'},{BACKEND:'lodestar',BASE:'https://evil.example/'},{OUT:'..'},{OUT:'/tmp/x'}])
  await assert.rejects(run(process.execPath,['scripts/build.mjs'],{cwd:root,env:{...process.env,...env}}));
});
