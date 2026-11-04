import {chromium} from '@playwright/test';import fs from 'fs';
const url=process.argv[2];
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-gpu']});
const ctx=await b.newContext({viewport:{width:2048,height:1152},deviceScaleFactor:2});const pg=await ctx.newPage();const cdp=await ctx.newCDPSession(pg);
if(process.env.SEED){const text=fs.readFileSync(process.env.SEED,'utf8');await pg.goto(url);await pg.waitForTimeout(2500);await pg.evaluate(async text=>{const base=JSON.parse(text);const db=await new Promise((r,j)=>{const q=indexedDB.open('solo-anime-studio-v1');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});await new Promise((r,j)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put({id:'seed',kind:'manual',savedAt:new Date().toISOString(),project:{...base,id:'seed'}});tx.oncomplete=r;tx.onerror=()=>j(tx.error);});localStorage.setItem('solo:last-project',JSON.stringify('seed'));},text);}
await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:200});await cdp.send('Profiler.start');
await pg.goto(url);await pg.waitForFunction(()=>document.querySelector('canvas')?.width>0);if(process.env.SEED)await pg.waitForFunction(()=>document.body.innerText.includes('Opened local project'),null,{timeout:120000});await pg.waitForTimeout(800);
const {profile}=await cdp.send('Profiler.stop');
const self=new Map();const byId=new Map(profile.nodes.map(n=>[n.id,n]));const dt=profile.timeDeltas;const cnt=new Map();profile.samples.forEach((s,i)=>cnt.set(s,(cnt.get(s)||0)+(dt[i]||0)));
for(const [id,t] of cnt){const n=byId.get(id);const cf=n.callFrame;const k=`${cf.functionName||'(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber}`;self.set(k,(self.get(k)||0)+t);}
// inclusive
const parent=new Map();for(const n of profile.nodes)for(const c of n.children||[])parent.set(c,n.id);
const inc=new Map();for(const [id,t] of cnt){let cur=id;const seen=new Set();while(cur){const cf=byId.get(cur).callFrame;const k=`${cf.functionName||'(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber}`;if(!seen.has(k)){seen.add(k);inc.set(k,(inc.get(k)||0)+t);}cur=parent.get(cur);}}
const top=m=>[...m].sort((a,b)=>b[1]-a[1]).slice(0,35).map(([k,v])=>(v/1000).toFixed(1).padStart(7)+'ms '+k).join('\n');
console.log('SELF\n'+top(self)+'\nINCLUSIVE\n'+top(inc));await b.close();
