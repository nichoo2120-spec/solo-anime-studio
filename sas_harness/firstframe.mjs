import {open,sel,field} from './lib.mjs';import fs from 'fs';
const [ver,dpr='2',w='2048',h='1152']=process.argv.slice(2);
const {b,pg,cdp}=await open(ver,+dpr,{w:+w,h:+h});
await pg.locator('input[type=file][accept=".json,.solo.json"]').setInputFiles('proj/busy.solo.json');await pg.waitForTimeout(4000);
const box=await pg.getByLabel('Drawing canvas',{exact:true}).boundingBox();
await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
const B=[['ink','Ink',null],['dry-ink','Paint','dry-ink-bristle'],['solid','Paint','color-solid'],['blender','Paint','color-blender']];const out=[];
for(const [n,cat,id] of B){await pg.keyboard.press('b');await sel(pg,'Brush category',cat);if(cat==='Paint'){await sel(pg,'Brush family','all');await sel(pg,'Brush preset',id);}await field(pg,'Size',30);
 for(let r=0;r<5;r++){await pg.mouse.move(5,5);await pg.waitForTimeout(1500);
  const x=box.x+box.width*.3,y=box.y+box.height*(.3+.08*r);
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y,buttons:0,pointerType:'pen'});
  await pg.evaluate(()=>{window.__S.lt=[];window.__S.on=true;});
  const t0=Date.now();await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1,pointerType:'pen',force:.5});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+4,y:y+2,button:'left',buttons:1,pointerType:'pen',force:.5});
  await pg.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const down=Date.now()-t0;
  for(let i=1;i<=20;i++)await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+4+i*15,y:y+2,button:'left',buttons:1,pointerType:'pen',force:.5});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+304,y:y+2,button:'left',buttons:0,pointerType:'pen'});
  await pg.waitForTimeout(500);const lt=await pg.evaluate(()=>{window.__S.on=false;return Math.max(0,...window.__S.lt)});
  await pg.keyboard.press('Control+z');out.push({brush:n,down,lt});}
}
const med=a=>[...a].sort((x,y)=>x-y)[a.length>>1];const s={};for(const n of B.map(x=>x[0])){const r=out.filter(o=>o.brush===n);s[n]={firstFrame_med:med(r.map(o=>o.down)),longtask_med:med(r.map(o=>+o.lt.toFixed(0)))};}
console.log(ver,dpr,JSON.stringify(s));fs.writeFileSync(`data/ff_${ver}_d${dpr}.json`,JSON.stringify({s,out}));await b.close();
