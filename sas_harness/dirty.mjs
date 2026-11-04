import {open,sel,field,penStroke} from './lib.mjs';import fs from 'fs';
const [ver='v156',proj='busy']=process.argv.slice(2);
const {b,pg,cdp}=await open(ver,2,{});
await pg.evaluate(()=>{const S=window.__S;S.clr=[];const cr=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(x,y,w,h){if(S.on&&this.canvas.getAttribute&&this.canvas.getAttribute('aria-label')==='Drawing canvas'){const m=this.getTransform();S.clr.push((w*m.a)*(h*m.d)/(this.canvas.width*this.canvas.height));}return cr.call(this,x,y,w,h)};});
await pg.locator('input[type=file][accept=".json,.solo.json"]').setInputFiles(`proj/${proj}.solo.json`);await pg.waitForTimeout(5000);
const box=await pg.getByLabel('Drawing canvas',{exact:true}).boundingBox();try{await pg.getByLabel('Select Color',{exact:true}).click();}catch{}
await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});const out=[];
for(const [n,cat,id,size] of [['ink70','Ink',null,70],['pencil70','Pencil',null,70],['solid70','Paint','color-solid',70],['smudge30','Paint','smudge-bristle',30],['dryink70','Paint','dry-ink-bristle',70]]){
 await sel(pg,'Brush category',cat);if(cat==='Paint'){await sel(pg,'Brush family','all');await sel(pg,'Brush preset',id);}
 await field(pg,'Size',size);await pg.mouse.move(5,5);await pg.waitForTimeout(600);
 await pg.evaluate(()=>window.__S.clr=[]);const r=await penStroke(pg,cdp,box,{n:200});
 const c=await pg.evaluate(()=>window.__S.clr);const q=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?{n:s.length,first:+a[0].toFixed(2),p50:+s[s.length>>1].toFixed(2),last:+a.at(-1).toFixed(2),max:+s.at(-1).toFixed(2)}:{}};
 const row={n,p95:r.frames.p95,dirtyFrac:q(c),full:c.filter(x=>x>.99).length};out.push(row);console.log(JSON.stringify(row));
 await pg.keyboard.press('Control+z');await pg.waitForTimeout(800);
}
fs.writeFileSync(`data/dirty_${ver}.json`,JSON.stringify(out,null,1));await b.close();
