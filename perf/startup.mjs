// Usage: node perf/startup.mjs URL label [runs] [throttle]
import {chromium} from '@playwright/test';import fs from 'node:fs';
const seedProject=process.env.SEED?fs.readFileSync(process.env.SEED,'utf8'):null,seedN=+(process.env.SEEDN||12);
const [url,label='run',runsS='3',thrS='4']=process.argv.slice(2);
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const res=[];
for(let i=0;i<+runsS;i++){
 const ctx=await b.newContext({viewport:{width:2048,height:1152},deviceScaleFactor:2});const pg=await ctx.newPage();
 const cdp=await ctx.newCDPSession(pg);await cdp.send('Emulation.setCPUThrottlingRate',{rate:+thrS});await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:false});
 let reqs=0,bytes=0;pg.on('requestfinished',async r=>{reqs++;try{const s=await r.sizes();bytes+=s.responseBodySize;}catch{}});
 await pg.addInitScript(()=>{window.__lt=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push([Math.round(e.startTime),Math.round(e.duration)])}).observe({type:'longtask',buffered:true});});
 if(process.env.WARM){await pg.goto(url,{waitUntil:'load'});await pg.waitForTimeout(2500);reqs=0;bytes=0;}
 if(seedProject){await pg.goto(url,{waitUntil:'load'});await pg.waitForTimeout(2500);await pg.evaluate(async({text,n})=>{const base=JSON.parse(text);const db=await new Promise((r,j)=>{const q=indexedDB.open('solo-anime-studio-v1');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});await new Promise((r,j)=>{const tx=db.transaction('projects','readwrite');const st=tx.objectStore('projects');for(let i=0;i<n;i++){const id='seed-'+i;st.put({id,kind:'manual',savedAt:new Date(Date.UTC(2026,0,1,0,i)).toISOString(),project:{...base,id,name:'Seed '+i}});}tx.oncomplete=r;tx.onerror=()=>j(tx.error);});db.close();localStorage.setItem('solo:last-project',JSON.stringify('seed-'+(n-1)));},{text:seedProject,n:seedN});reqs=0;bytes=0;}
 const t0=Date.now();await pg.goto(url,{waitUntil:'load',timeout:120000});
 await pg.waitForFunction(()=>{const c=document.querySelector('canvas');const s=document.getElementById('startup-status');if(s&&s.isConnected&&s.style.display!=='none'&&document.querySelector('#root')?.childElementCount===0)return false;return c&&c.width>0&&document.querySelector('#root')?.childElementCount>0;},null,{timeout:120000,polling:20});
 if(seedProject)await pg.waitForFunction(()=>document.body.innerText.includes('Opened local project'),null,{timeout:120000,polling:20});
 const ui=Date.now()-t0;
 // interactive: wait for two rAFs + an input handler round-trip
 await pg.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const inter=Date.now()-t0;
 await pg.waitForTimeout(1500);
 const m=await pg.evaluate(()=>{const p=performance.getEntriesByType('paint');const fcp=p.find(x=>x.name==='first-contentful-paint')?.startTime;const n=performance.getEntriesByType('navigation')[0];return {fcp:Math.round(fcp),load:Math.round(n.loadEventEnd),long:window.__lt,res:performance.getEntriesByType('resource').length};});
 const lt=m.long.filter(x=>x[0]<inter+200);
 res.push({ui,inter,fcp:m.fcp,load:m.load,reqs,kb:Math.round(bytes/1024),longN:lt.length,longMax:Math.max(0,...lt.map(x=>x[1])),longSum:lt.reduce((a,x)=>a+x[1],0)});
 await ctx.close();
}
await b.close();
const med=k=>res.map(r=>r[k]).sort((a,b)=>a-b)[Math.floor(res.length/2)];
console.log(label,JSON.stringify(res));
console.log(label,'MEDIAN',JSON.stringify(Object.fromEntries(Object.keys(res[0]).map(k=>[k,med(k)]))));
