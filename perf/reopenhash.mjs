import {chromium} from '@playwright/test';import fs from 'fs';import crypto from 'crypto';
const text=fs.readFileSync(process.argv[3],'utf8');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-gpu']});
const ctx=await b.newContext({viewport:{width:1600,height:900},deviceScaleFactor:1});const pg=await ctx.newPage();const url=process.argv[2];
await pg.goto(url);await pg.waitForTimeout(2500);
await pg.evaluate(async text=>{const base=JSON.parse(text);const db=await new Promise((r,j)=>{const q=indexedDB.open('solo-anime-studio-v1');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});await new Promise((r,j)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put({id:'seed',kind:'manual',savedAt:new Date().toISOString(),project:{...base,id:'seed'}});tx.oncomplete=r;tx.onerror=()=>j(tx.error);});localStorage.setItem('solo:last-project',JSON.stringify('seed'));},text);
await pg.goto(url);await pg.waitForFunction(()=>document.body.innerText.includes('Opened local project'),null,{timeout:120000});await pg.waitForTimeout(3000);
const d=await pg.evaluate(()=>{const c=[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0];return c.toDataURL();});
console.log(url,crypto.createHash('sha256').update(d).digest('hex').slice(0,16));await b.close();
