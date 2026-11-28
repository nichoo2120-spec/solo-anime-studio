import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';

const url=process.env.SOLO_STUDIO_URL??'http://127.0.0.1:5173';
const browser=await chromium.launch({channel:process.env.BLEND_BROWSER??'msedge',headless:process.env.BLEND_HEADFUL!=='1'});
const page=await browser.newPage({viewport:{width:1440,height:960}});
const metrics=['preset','size','requested','active','adapter','frames','frameP95Ms','intervalP95Ms','inputToCanvasMs','penUpMs','undoMs','input','dabs','pickup','mask','mix','composite','present','worker'];
const rows=[metrics];
const save=()=>writeFileSync(process.env.BLEND_CSV??'blend-performance.csv',rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n');
try{
 await page.goto(url);
 const presets=await page.evaluate(async()=> (await import('/src/core/brushes.ts')).stockPresets.filter(p=>p.category!=='Eraser').map(p=>p.id));
 for(const requested of (process.env.BLEND_ENGINES??'CPU,GPU').split(',')){
  for(const preset of (process.env.BLEND_PRESETS?.split(',')??presets))for(const size of [150,300,500]){
   const row=await page.evaluate(async({requested,preset,size})=>{
    const load=p=>import(p);
    const {newProject,activeLayer}=await load('/src/core/model.ts'),{DocumentStore}=await load('/src/core/history.ts');
    const {StudioEngine}=await load('/src/engine/StudioEngine.ts'),{stockPresets}=await load('/src/core/brushes.ts');
    const {blendTiming}=await load('/src/engine/blendTiming.ts');
    localStorage.setItem('solo.blendEngine',requested);
    const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve)),project=newProject('Mixer timing',1920,1080);
    const swatch=(x,color)=>({id:color,kind:'stroke',tool:'brush',size:400,pressure:false,response:1,opacity:1,color,points:[{x,y:100,p:1},{x,y:900,p:1}]});
    activeLayer(project).operations=[swatch(460,'#00cc30'),swatch(840,'#d51609')];
    const store=new DocumentStore(project),host=document.createElement('div'),canvas=document.createElement('canvas');
    host.style.cssText='position:fixed;inset:0';canvas.style.cssText='display:block;width:1920px;height:1080px';
    host.append(canvas);document.body.append(host);
    let held=false;canvas.setPointerCapture=()=>{held=true};canvas.hasPointerCapture=()=>held;canvas.releasePointerCapture=()=>{held=false};
    const engine=new StudioEngine(canvas,store,()=>{});
    const send=(type,x)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:19,isPrimary:true,button:0,buttons:type==='pointerup'?0:1,pointerType:'pen',clientX:x,clientY:440+Math.sin(x/40)*8,pressure:.3}));
    try{
     engine.setView({x:0,y:0,zoom:1,rotation:0});engine.setInput('brush',{...stockPresets.find(p=>p.id===preset).settings,size,opacity:1,bbEnabled:true,pressure:true});
     await frame();await frame();
     send('pointerdown',602);send('pointermove',635);await frame();send('pointerup',635);await engine.renderer.whenSettled();engine.historyNavigation('undo');await frame();
     blendTiming.enabled=true;blendTiming.history.length=0;
     const times=[],intervals=[];const render=engine.render.bind(engine);
     let first,initial,prior;
     engine.render=()=>{const t=performance.now();render();if(engine.drawing){times.push(performance.now()-t);if(prior!==undefined)intervals.push(t-prior);prior=t;if(first===undefined&&engine.blendWorker.presentedMixerSamples)first=performance.now()-initial;}};
     initial=performance.now();send('pointerdown',620);await frame();
     for(let i=1;i<=20;i++){send('pointermove',620+i*10);await frame();}
     const start=performance.now();send('pointerup',820);await engine.renderer.whenSettled();const penUp=performance.now()-start;
     const undoStart=performance.now();engine.historyNavigation('undo');await frame();const undo=performance.now()-undoStart;
     const stages=['input','dabs','pickup','mask','mix','composite','present','worker'];
     const p95=a=>a.length?+a.sort((a,b)=>a-b)[Math.ceil(a.length*.95)-1].toFixed(2):null;
     return [preset,size,requested,window.soloBlendStatus?.active??'CPU',window.soloBlendStatus?.adapter??'',times.length,p95(times),p95(intervals),first,penUp,undo,...stages.map(k=>p95(blendTiming.history.map(r=>r[k])))];
    }finally{blendTiming.enabled=false;engine.dispose();host.remove();}
   },{requested,preset,size});
   rows.push(row);save();console.log(row.slice(0,11).join(' '));
  }
 }
}finally{await browser.close();}

