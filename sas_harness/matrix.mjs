import {open,sel,field,penStroke,canvases} from './lib.mjs';import fs from 'fs';
const [ver,dpr,thr,state,sizesArg,brArg,vw,vh]=process.argv.slice(2);const sizes=(sizesArg||'30,70,150').split(',').map(Number);
const w=+(vw||2048),h=+(vh||1152);const tag=`${ver}_d${dpr}_t${thr}_${state}_${w}${process.env.REP?"_r"+process.env.REP:""}`;const out=`data/m_${tag}.json`;fs.mkdirSync('data',{recursive:true});
const {b,pg,cdp,errs}=await open(ver,+dpr,{throttle:1,w,h});
if(state!=='empty'){await pg.locator('input[type=file][accept=".json,.solo.json"]').setInputFiles(`proj/${state}.solo.json`);await pg.waitForTimeout(4000);}
const box=await pg.getByLabel('Drawing canvas',{exact:true}).boundingBox();
try{await pg.getByLabel('Select Color',{exact:true}).click();}catch{}
const cats={};for(const c of ['Pencil','Ink','Paint']){await sel(pg,'Brush category',c);if(c==='Paint')await sel(pg,'Brush family','all');cats[c]=await pg.getByLabel('Brush preset',{exact:true}).evaluate(s=>[...s.options].map(o=>o.value));}
let B=[['ink','Ink',cats.Ink[0]],['pencil','Pencil',cats.Pencil[0]],['dry-ink','Paint','dry-ink-bristle'],['dry-paint','Paint','dry-paint'],['solid','Paint','color-solid'],['blender','Paint','color-blender'],['smudge-bristle','Paint','smudge-bristle'],['blender-soft','Paint','blender-soft'],['wet-mix','Paint','wet-mix'],['eraser','E',null]];
if(brArg)B=B.filter(x=>brArg.split(',').includes(x[0]));
if(thr>1)await cdp.send('Emulation.setCPUThrottlingRate',{rate:+thr});
const res={ver,dpr:+dpr,thr:+thr,state,w,h,canvases:await canvases(pg),rows:[]};let first=true;
for(const [name,cat,id] of B){
 if(id&&!cats[cat].includes(id))continue;
 if(cat==='E'){await pg.keyboard.press('e');}else{await pg.keyboard.press('b');await sel(pg,'Brush category',cat);if(cat==='Paint')await sel(pg,'Brush family','all');await sel(pg,'Brush preset',id);}
 for(const size of sizes){
  await field(pg,'Size',size);await pg.mouse.move(5,5);await pg.waitForTimeout(400);
  const r=await penStroke(pg,cdp,box,{n:200});r.firstStroke=first;first=false;
  const u0=Date.now();await pg.keyboard.press('Control+z');await pg.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));r.undoMs=Date.now()-u0;
  res.rows.push({brush:name,size,...r});console.log(tag,name,size,'p50',r.frames.p50,'p95',r.frames.p95,'n',r.frames.n,'over50',r.over50,'lt',r.longtasks,r.ltMax,'lat95',r.lat.p95,'raf95',r.raf.p95,'gid',r.gid,r.gidMpx,'up',r.upMs,'undo',r.undoMs);
  await pg.waitForTimeout(300);
 }
}
res.errs=errs;fs.writeFileSync(out,JSON.stringify(res,null,1));await b.close();
