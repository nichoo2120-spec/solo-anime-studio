import {open,sel,field,penStroke,PORT} from './lib.mjs';import fs from 'fs';
PORT.dev156=6166;const [thr='4']=process.argv.slice(2);
const {b,pg,cdp}=await open('dev156',2,{});await pg.waitForTimeout(4000);
await pg.locator('input[type=file][accept=".json,.solo.json"]').setInputFiles(`proj/busy.solo.json`);await pg.waitForTimeout(6000);
const box=await pg.getByLabel('Drawing canvas',{exact:true}).boundingBox();try{await pg.getByLabel('Select Color',{exact:true}).click();}catch{}
await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:200});
await cdp.send('Emulation.setCPUThrottlingRate',{rate:+thr});const out={};
for(const [n,cat,id,size] of [['solid30','Paint','color-solid',30],['solid150','Paint','color-solid',150],['dryink30','Paint','dry-ink-bristle',30],['pencil150','Pencil',null,150],['smudge150','Paint','smudge-bristle',150]]){
 await sel(pg,'Brush category',cat);if(cat==='Paint'){await sel(pg,'Brush family','all');await sel(pg,'Brush preset',id);}
 await field(pg,'Size',size);await pg.mouse.move(5,5);await pg.waitForTimeout(800);
 await penStroke(pg,cdp,box,{n:200});await pg.waitForTimeout(1500);
 await cdp.send('Profiler.start');const u0=Date.now();await pg.keyboard.press('Control+z');await pg.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const undo=Date.now()-u0;const {profile}=await cdp.send('Profiler.stop');
 const cnt=new Map();profile.samples.forEach((s,i)=>cnt.set(s,(cnt.get(s)||0)+(profile.timeDeltas[i]||0)));const nodes=new Map(profile.nodes.map(n=>[n.id,n]));const parent=new Map();for(const n of profile.nodes)for(const c of n.children||[])parent.set(c,n.id);
 const K=c=>`${c.functionName||'(anon)'} ${c.url.replace(/.*:6166\//,'').replace(/\?.*/,'')}:${c.lineNumber+1}`;const incl=new Map(),self=new Map();
 for(const [id,us] of cnt){self.set(K(nodes.get(id).callFrame),(self.get(K(nodes.get(id).callFrame))||0)+us);const seen=new Set();let x=id;while(x!==undefined){const c=nodes.get(x).callFrame,kk=K(c);if(!seen.has(kk)&&c.url.includes('/src/')){seen.add(kk);incl.set(kk,(incl.get(kk)||0)+us);}x=parent.get(x);}}
 const top=m=>[...m].sort((a,b)=>b[1]-a[1]).slice(0,14).map(([k,v])=>[k,+(v/1000).toFixed(1)]);out[n]={undo,incl:top(incl),self:top(self)};
 console.log('##',n,'undo',undo);for(const t of out[n].incl)console.log('  incl',t[1],t[0]);for(const t of out[n].self.slice(0,6))console.log('  self',t[1],t[0]);
 await pg.waitForTimeout(800);
}
fs.writeFileSync(`data/undoprof_t${thr}.json`,JSON.stringify(out,null,1));await b.close();
