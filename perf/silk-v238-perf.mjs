// v0.5.238 Silk Blend real-app performance + UI check.
// usage: node perf/silk-v238-perf.mjs <port> <tag> [dpr=2] [throttle=4] [state=busy] [w=2048] [h=1152]
// Needs a server (vite preview) on <port>. Writes perf/data/silk_<tag>.json
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const [port,tag,dpr='2',thr='4',state='busy',vw='2048',vh='1152']=process.argv.slice(2);
const INIT=()=>{
 window.__S={frames:[],lt:[],raf:[]};const S=window.__S;
 const rq=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>rq(t=>{const a=performance.now();try{cb(t)}finally{if(S.on)S.raf.push(performance.now()-a)}});
 let last=0;const loop=t=>{if(S.on&&last)S.frames.push(t-last);last=S.on?t:0;rq(loop)};rq(loop);
 try{new PerformanceObserver(l=>{for(const e of l.getEntries())if(S.on)S.lt.push(e.duration)}).observe({type:'longtask'})}catch{}
};
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-gpu']});
const ctx=await b.newContext({viewport:{width:+vw,height:+vh},deviceScaleFactor:+dpr});await ctx.addInitScript(INIT);
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
await pg.goto(`http://127.0.0.1:${port}/`);await pg.waitForTimeout(3000);
if(state!=='empty'){await pg.locator('input[type=file][accept=".json,.solo.json"]').setInputFiles(`sas_harness/proj/${state}.solo.json`);await pg.waitForTimeout(5000);}
const cdp=await ctx.newCDPSession(pg);
const box=await pg.getByLabel('Drawing canvas',{exact:true}).boundingBox();
const sel=(l,v)=>pg.getByLabel(l,{exact:true}).selectOption(v);
async function field(n,v){const i=pg.getByLabel(n+' exact value',{exact:true}).first();await i.fill(String(v));await i.press('Enter');}
const settle=()=>pg.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function penStroke({n=200,hz=200}={}){
 const P=i=>{const t=i/n;return [box.x+box.width*(.15+.7*t),box.y+box.height*(.5+.18*Math.sin(t*Math.PI*4))]};
 const ev=(type,i,extra={})=>{const [x,y]=P(i);return cdp.send('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1,pointerType:'pen',force:.4+.5*Math.sin(Math.PI*i/n),...extra}).catch(()=>{})};
 await ev('mouseMoved',0,{buttons:0});await ev('mousePressed',0);
 await pg.evaluate(()=>{const S=window.__S;S.frames=[];S.lt=[];S.raf=[];S.on=true;});
 const t0=Date.now(),all=[];for(let i=1;i<=n;i++){const wait=t0+i*1000/hz-Date.now();if(wait>1)await new Promise(r=>setTimeout(r,wait));all.push(ev('mouseMoved',i));}
 await Promise.all(all);
 const up0=Date.now();await ev('mouseReleased',n);await settle();const upMs=Date.now()-up0;
 await pg.waitForTimeout(400);
 return {...await pg.evaluate(()=>{const S=window.__S;S.on=false;const st=a=>{if(!a.length)return {};const s=[...a].sort((x,y)=>x-y),q=p=>+s[Math.min(s.length-1,Math.floor(s.length*p))].toFixed(1);return {n:a.length,p50:q(.5),p95:q(.95),max:+s.at(-1).toFixed(1)};};return {frames:st(S.frames),raf:st(S.raf),longtasks:S.lt.length,ltMax:+Math.max(0,...S.lt).toFixed(0)};}),upMs};
}
const res={tag,dpr:+dpr,thr:+thr,state,w:+vw,h:+vh,rows:[],ui:{}};
const silkAvailable=await pg.getByLabel('Silk Blend (B B)',{exact:true}).count()>0;
const brushes=[['pencil',async()=>{await pg.keyboard.press('Escape');await pg.getByLabel('Brush (B)',{exact:true}).first().click();await sel('Brush category','Pencil');}],['solid',async()=>{await pg.getByLabel('Brush (B)',{exact:true}).first().click();await sel('Brush category','Paint');await sel('Brush family','all');await sel('Brush preset','color-solid');}]];
if(silkAvailable)for(const mode of ['soft','wet','smudge','dry'])brushes.push(['silk-'+mode,async()=>{await pg.getByLabel('Silk Blend (B B)',{exact:true}).first().click();await sel('Silk Blend mode',mode);}]);
const blendAvailable=await pg.getByRole('group',{name:'Paint or Blend'}).count()>0||!!process.env.BLEND_CASE;
if(blendAvailable)brushes.push(['brush-blend',async()=>{await pg.getByLabel('Brush (B)',{exact:true}).first().click();await sel('Brush category','Paint');await sel('Brush family','all');await sel('Brush preset','color-solid');await pg.mouse.move(box.x+20,box.y+20);await pg.keyboard.press('j');await pg.waitForTimeout(200);}]);
if(process.env.FAMILY_CASE)for(const [nm,id] of [['blend-water','water-wet'],['blend-dry','dry-paint']])brushes.push([nm,async()=>{await pg.getByLabel('Brush (B)',{exact:true}).first().click();await sel('Brush category','Paint');await sel('Brush family','all');await sel('Brush preset',id);await pg.mouse.move(box.x+20,box.y+20);const bl=pg.getByRole('group',{name:'Paint or Blend'}).getByRole('button',{name:'Blend',exact:true}).first();if(await bl.count()&&await bl.getAttribute('aria-pressed')!=='true')await pg.keyboard.press('j');await pg.waitForTimeout(200);}]);
if(process.env.SHAPE_CASE)brushes.push(['brush-shape',async()=>{await pg.mouse.move(box.x+20,box.y+20);await pg.keyboard.press('j');await pg.waitForTimeout(200);await pg.getByRole('button',{name:'Brush Settings',exact:true}).click();const nav=n=>pg.getByRole('navigation',{name:'Brush settings sections'}).getByRole('button',{name:n,exact:true}).click();const panel=pg.getByRole('region',{name:'Brush Settings'});await nav('Tip shape');await panel.getByLabel('Custom tip shape',{exact:true}).check();await nav('Dual brush');await panel.getByLabel('Use dual brush',{exact:true}).check();await panel.getByLabel('Second brush',{exact:true}).selectOption('dry');await pg.getByRole('button',{name:'Done',exact:true}).click();await pg.waitForTimeout(300);}]);
if(+thr>1)await cdp.send('Emulation.setCPUThrottlingRate',{rate:+thr});
for(const [name,choose] of (process.env.SKIP_MATRIX?[]:brushes)){
 await choose();if(process.env.ONLY&&!process.env.ONLY.split(',').includes(name))continue;
 for(const size of [30,150]){
  await field('Size',size);await pg.mouse.move(5,5);await pg.waitForTimeout(500);
  const r=await penStroke();
  await pg.waitForTimeout(600);
  const u0=Date.now();await pg.keyboard.press('Control+z');await settle();r.undoMs=Date.now()-u0;
  res.rows.push({brush:name,size,...r});console.log(tag,name,size,'p50',r.frames.p50,'p95',r.frames.p95,'n',r.frames.n,'lt',r.longtasks,r.ltMax,'up',r.upMs,'undo',r.undoMs);
  await pg.waitForTimeout(400);
 }
}
if(silkAvailable){
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
 // UI: B toggles between your brush and Silk Blend; preset buttons; Reset.
 await pg.getByLabel('Brush (B)',{exact:true}).first().click();await sel('Brush category','Pencil');await pg.mouse.move(box.x+20,box.y+20);
 const preset=()=>pg.getByLabel('Brush preset',{exact:true}).inputValue();
 const before=await preset();await pg.keyboard.press('b');await pg.waitForTimeout(200);const afterB=await preset();await pg.keyboard.press('b');await pg.waitForTimeout(200);const afterBB=await preset();
 res.ui.bToggle={before,afterB,afterBB};
 await pg.keyboard.press('b');await pg.waitForTimeout(200);
 await pg.getByRole('button',{name:'Silk Dry',exact:true}).click();await pg.waitForTimeout(150);res.ui.afterDryPreset=await pg.getByLabel('Silk Blend mode',{exact:true}).inputValue();
 await pg.getByLabel('Reset Silk Blend',{exact:true}).click();await pg.waitForTimeout(150);res.ui.afterReset=await pg.getByLabel('Silk Blend mode',{exact:true}).inputValue();
 res.ui.footer=await pg.getByRole('button',{name:/Silk Blend/}).count();
 // Undo check: one Silk stroke, one Ctrl+Z, canvas back to the exact same pixels.
 await sel('Silk Blend mode','wet');await field('Size',90);await pg.mouse.move(5,5);await pg.waitForTimeout(600);
 const clip={x:Math.round(box.x+40),y:Math.round(box.y+40),width:Math.round(box.width-80),height:Math.round(box.height-80)};
 const shot0=await pg.screenshot({clip});await penStroke({n:120});await pg.mouse.move(5,5);await pg.waitForTimeout(800);const shot1=await pg.screenshot({clip});
 await pg.keyboard.press('Control+z');await settle();await pg.mouse.move(5,5);await pg.waitForTimeout(800);const shot2=await pg.screenshot({clip});
 await pg.keyboard.press('Control+y');await settle();await pg.waitForTimeout(800);const shot3=await pg.screenshot({clip});
 res.ui.undo={strokeChanged:!shot0.equals(shot1),undoExact:shot0.equals(shot2),redoExact:shot1.equals(shot3)};
 await pg.screenshot({path:`perf/data/silk_${tag}_ui.png`});
}
res.errs=errs;fs.mkdirSync('perf/data',{recursive:true});fs.writeFileSync(`perf/data/silk_${tag}.json`,JSON.stringify(res,null,1));console.log(JSON.stringify(res.ui),errs);await b.close();
