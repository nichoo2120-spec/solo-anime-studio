// v0.5.175: pen-up, undo and redo frames may redraw only a band. Each such
// frame must be byte-identical (max diff 0) to a forced full redraw.
import {createServer} from 'vite';import {chromium} from '@playwright/test';import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:5553,strictPort:true}});await server.listen();const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
let bands=0,cases=0;
try{for(const dpr of [1,2]){const page=await browser.newPage({viewport:{width:1200,height:850},deviceScaleFactor:dpr});await page.goto('http://127.0.0.1:5553/tests/drawing-v155.html');await page.waitForFunction(()=>window.DRAWING_TEST);
 for(const [index,[preset,size,options]] of [['hb',45,{}],['technical',45,{}],['g-pen',60,{}],['color-solid',70,{}],['dry-ink-bristle',90,{}],['eraser-hard',65,{}],['smudge-bristle',30,{}],['color-solid',40,{zoom:2}],['hb',35,{rotation:.18}],['color-solid',40,{mirror:true}]].entries()){
  const r=await page.evaluate(async({preset,size,options,id})=>{const h=window.DRAWING_TEST,e=h.engine,I=e,frame=()=>new Promise(r=>requestAnimationFrame(()=>r()));await h.scene(id,options);h.brush(preset,size);await h.ready();
   const canvas=document.querySelector('#drawing'),ctx=canvas.getContext('2d');const out=[];
   // Every render that used a band is compared, at once, with a forced full redraw.
   const render=I.render.bind(I),rec=I.performance.record.bind(I.performance);let bandFrames=[],busy=false;
   const compare=used=>{busy=true;const a=ctx.getImageData(0,0,canvas.width,canvas.height).data;I.lastExactFrame=undefined;I.drawingFrames.invalidate();render();const b=ctx.getImageData(0,0,canvas.width,canvas.height).data;busy=false;let max=0,changed=0;for(let j=0;j<a.length;j++){const d=Math.abs(a[j]-b[j]);if(d){changed++;if(d>max)max=d;}}bandFrames.push({band:used,max,changed});};
   // Any render that used a band (whatever called it) is compared, right after it finishes, with a forced full redraw.
   I.performance.record=(k,v)=>{if(k==='commitBandPixels'&&v>0&&!busy)queueMicrotask(()=>compare(v));return rec(k,v);};
   const check=async(step)=>{await frame();await frame();const bf=bandFrames;bandFrames=[];for(const x of bf)out.push({step:step+'-bandframe',...x});const used=undefined;const a=ctx.getImageData(0,0,canvas.width,canvas.height).data;I.lastExactFrame=undefined;I.drawingFrames.invalidate();I.render();const b=ctx.getImageData(0,0,canvas.width,canvas.height).data;let max=0,changed=0;for(let j=0;j<a.length;j++){const d=Math.abs(a[j]-b[j]);if(d){changed++;if(d>max)max=d;}}out.push({step,band:used?used.width*used.height:-1,max,changed});};
   const plain=async()=>{const rect=canvas.getBoundingClientRect(),begin=performance.now(),n=48;for(let i=0;i<=n;i++){const t=i/n,x=80+640*t,y=160+100*Math.sin(t*Math.PI*3),p=.18+.8*Math.sin(t*Math.PI)**2,v=e.view,co=Math.cos(v.rotation)*v.zoom,si=Math.sin(v.rotation)*v.zoom;const ev=new PointerEvent(i===0?'pointerdown':i===n?'pointerup':'pointermove',{pointerId:42,isPrimary:true,pointerType:'pen',button:0,buttons:i===n?0:1,pressure:p,clientX:rect.left+v.x+co*x-si*y,clientY:rect.top+v.y+si*x+co*y});Object.defineProperty(ev,'timeStamp',{value:begin+i*8});canvas.dispatchEvent(ev);if(i%4===0)await frame();}};
   await h.draw(id,48,options);await check('penup-forced');await plain();await check('penup');
   for(const step of ['undo','redo','undo','redo']){h.store[step]();await check(step);}
   return out;},{preset,size,options,id:'band-'+index});
  for(const x of r){cases++;if(x.band>=0)bands++;console.log(JSON.stringify({dpr,preset,options,...x}));if(x.band>=0||preset!=='smudge-bristle')assert.equal(x.max,0,`band frame differs from full redraw: ${preset} ${x.step} dpr${dpr}`);}
 }await page.close();}
 console.log(`${cases} pen-up/undo/redo frames checked; every band frame identical to full redraw (${bands} used a band) PASS`);
}finally{await browser.close();await server.close();}
