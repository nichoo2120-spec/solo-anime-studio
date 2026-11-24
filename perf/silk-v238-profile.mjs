// CPU profile of one Silk stroke (draw + pen-up) and its undo, main thread.
import {chromium} from '@playwright/test';
const [port,mode='wet',size='150',thr='4',state='busy']=process.argv.slice(2);
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-gpu']});
const ctx=await b.newContext({viewport:{width:2048,height:1152},deviceScaleFactor:2});const pg=await ctx.newPage();
await pg.goto(`http://127.0.0.1:${port}/`);await pg.waitForTimeout(3000);
if(state!=='empty'){await pg.locator('input[type=file][accept=".json,.solo.json"]').setInputFiles(`sas_harness/proj/${state}.solo.json`);await pg.waitForTimeout(5000);}
const cdp=await ctx.newCDPSession(pg);const box=await pg.getByLabel('Drawing canvas',{exact:true}).boundingBox();
if(mode==='solid'){await pg.getByLabel('Brush (B)',{exact:true}).first().click();await pg.getByLabel('Brush category',{exact:true}).selectOption('Paint');await pg.getByLabel('Brush family',{exact:true}).selectOption('all');await pg.getByLabel('Brush preset',{exact:true}).selectOption('color-solid');}
else{await pg.getByLabel('Silk Blend (B B)',{exact:true}).first().click();await pg.getByLabel('Silk Blend mode',{exact:true}).selectOption(mode);}
const i=pg.getByLabel('Size exact value',{exact:true}).first();await i.fill(size);await i.press('Enter');await pg.mouse.move(5,5);await pg.waitForTimeout(800);
await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:200});await cdp.send('Emulation.setCPUThrottlingRate',{rate:+thr});
const n=200,P=k=>{const t=k/n;return [box.x+box.width*(.15+.7*t),box.y+box.height*(.5+.18*Math.sin(t*Math.PI*4))]};
const ev=(type,k,extra={})=>{const [x,y]=P(k);return cdp.send('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1,pointerType:'pen',force:.4+.5*Math.sin(Math.PI*k/n),...extra}).catch(()=>{})};
const report=(label,profile)=>{const cnt=new Map();profile.samples.forEach((s,k)=>cnt.set(s,(cnt.get(s)||0)+(profile.timeDeltas[k]||0)));const nodes=new Map(profile.nodes.map(x=>[x.id,x]));const self=new Map();for(const [id,us] of cnt){const c=nodes.get(id).callFrame,key=`${c.functionName||'(anon)'} ${c.url.replace(/.*\/assets\//,'')}:${c.lineNumber+1}:${c.columnNumber}`;self.set(key,(self.get(key)||0)+us);}
 const total=[...cnt.values()].reduce((a,b)=>a+b,0);console.log('##',label,'total ms',(total/1000).toFixed(0));for(const [k,v] of [...self].sort((a,b)=>b[1]-a[1]).slice(0,14))console.log('  ',(v/1000).toFixed(1),k.slice(0,140));};
await ev('mouseMoved',0,{buttons:0});await cdp.send('Profiler.start');await ev('mousePressed',0);
const t0=Date.now(),all=[];for(let k=1;k<=n;k++){const w=t0+k*5-Date.now();if(w>1)await new Promise(r=>setTimeout(r,w));all.push(ev('mouseMoved',k));}await Promise.all(all);
await ev('mouseReleased',n);await pg.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await pg.waitForTimeout(600);
report('draw+penup',(await cdp.send('Profiler.stop')).profile);
await cdp.send('Profiler.start');await pg.keyboard.press('Control+z');await pg.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await pg.waitForTimeout(300);
report('undo',(await cdp.send('Profiler.stop')).profile);await b.close();
