import {open,sel,field,penStroke,PORT} from './lib.mjs';import fs from 'fs';
PORT.dev156=6166;const [proj='busy',thr='4']=process.argv.slice(2);
const {b,pg,cdp}=await open('dev156',2,{});await pg.waitForTimeout(4000);
await pg.locator('input[type=file][accept=".json,.solo.json"]').setInputFiles(`proj/${proj}.solo.json`);await pg.waitForTimeout(6000);
const box=await pg.getByLabel('Drawing canvas',{exact:true}).boundingBox();try{await pg.getByLabel('Select Color',{exact:true}).click();}catch{}
await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:200});
await cdp.send('Emulation.setCPUThrottlingRate',{rate:+thr});
const out={};
for(const [n,cat,id,size] of [['ink70-first','Ink',null,70],['ink70','Ink',null,70],['pencil70','Pencil',null,70],['solid70','Paint','color-solid',70],['dryink150','Paint','dry-ink-bristle',150],['smudge30','Paint','smudge-bristle',30],['blender30','Paint','color-blender',30],['wetmix30','Paint','wet-mix',30]]){
 await sel(pg,'Brush category',cat);if(cat==='Paint'){await sel(pg,'Brush family','all');await sel(pg,'Brush preset',id);}
 await field(pg,'Size',size);await pg.mouse.move(5,5);await pg.waitForTimeout(800);
 await cdp.send('Profiler.start');const r=await penStroke(pg,cdp,box,{n:200});
 const u0=Date.now();await pg.keyboard.press('Control+z');await pg.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const undo=Date.now()-u0;
 await pg.waitForTimeout(300);const {profile}=await cdp.send('Profiler.stop');
 await pg.waitForTimeout(600);
 const self=new Map(),dt=profile.timeDeltas,cnt=new Map();profile.samples.forEach((s,i)=>cnt.set(s,(cnt.get(s)||0)+(dt[i]||0)));
 const nodes=new Map(profile.nodes.map(n=>[n.id,n]));const parent=new Map();for(const n of profile.nodes)for(const c of n.children||[])parent.set(c,n.id);
 const K=c=>`${c.functionName||'(anon)'} ${c.url.replace(/.*:6166\//,'').replace(/\?.*/,'')}:${c.lineNumber+1}`;
 const incl=new Map();let tot=0;
 for(const [id,us] of cnt){const k=K(nodes.get(id).callFrame);self.set(k,(self.get(k)||0)+us);tot+=us;const seen=new Set();let x=id;while(x!==undefined){const kk=K(nodes.get(x).callFrame);if(!seen.has(kk)&&nodes.get(x).callFrame.url.includes('/src/')){seen.add(kk);incl.set(kk,(incl.get(kk)||0)+us);}x=parent.get(x);}}
 const top=m=>[...m].sort((a,b)=>b[1]-a[1]).slice(0,16).map(([k,v])=>[k,+(v/1000).toFixed(1)]);
 out[n]={p95:r.frames.p95,up:r.upMs,undo,lt:r.ltMax,gid:r.gid,self:top(self),incl:top(incl),totMs:+(tot/1000).toFixed(0)};
 console.log('##',n,'p95',r.frames.p95,'up',r.upMs,'undo',undo,'ltmax',r.ltMax,'gid',r.gid);for(const t of out[n].self.slice(0,10))console.log('  self',t[1],t[0]);for(const t of out[n].incl.slice(0,14))console.log('  incl',t[1],t[0]);
}
fs.writeFileSync(`data/profile_${proj}_t${thr}.json`,JSON.stringify(out,null,1));await b.close();
