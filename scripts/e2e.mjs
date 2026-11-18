// Optional: never installs Playwright or downloads a browser.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../server/index.js';
let playwright;
for(const name of ['playwright','@playwright/test']){try{playwright=await import(name);break;}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}}
if(!playwright){console.log('SKIP: Playwright 미설치. 설치/브라우저 다운로드는 수행하지 않았습니다.');process.exit(0);}
const app=createApp();app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
let browser;
try {
 browser=await playwright.chromium.launch({headless:true});
 for(const pageName of ['saebyeok-laundry.html','ttasun-spa.html']){
  const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
  try{
   const pages=await Promise.all(contexts.map(c=>c.newPage()));
   await Promise.all(pages.map(p=>p.goto(`http://127.0.0.1:${app.server.address().port}/${pageName}`)));
   await Promise.all(pages.map(p=>p.locator('#enter').click()));
   await Promise.all(pages.map(p=>p.waitForFunction(()=>document.querySelector('#live').textContent==='지금 2명 접속 중')));
   for(const p of pages)assert.equal(await p.locator('#labels .tag:not(.me):not(.ex)').count(),1);
   await contexts[1].close();await pages[0].waitForFunction(()=>document.querySelector('#live').textContent==='지금 1명 접속 중');
   console.log('PASS:',pageName,'2 contexts presence + departure');
  }finally{await Promise.all(contexts.map(c=>c.close()));}
 }
} finally {await browser?.close();await app.close();}
