import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
// Run alone: this includes the same 1400x500 base copy and readback as the
// supplied benchmark, with 160 moves rather than its 126.
const root=process.env.PERF_ROOT??process.cwd(),tag=process.env.PERF_TAG??'after';const server=await createServer({root,server:{host:'127.0.0.1',port:5543,strictPort:true}});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-gpu']});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5543/exp/h.html');await page.waitForFunction(()=>window.H);
 const rows=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts'),{brushStrokeMetadata,watercolorSeedFor}=await import('/src/core/paintTips.ts'),{compositePaintStroke,strokeRasterBounds}=await import('/src/engine/paintCompositing.ts'),{resetWetSmudgeCaches}=await import('/src/engine/wetSmudge.ts');
  const rows=[],W=1400,H=500;
  for(const preset of ['smudge-bristle','blender-soft','wet-mix','color-blender'])for(const size of [30,130])for(let rep=0;rep<3;rep++){
   resetWetSmudgeCaches();const base=document.createElement('canvas');base.width=W;base.height=H;const bc=base.getContext('2d');bc.fillStyle='#d62828';bc.fillRect(0,0,700,H);bc.fillStyle='#1d4ed8';bc.fillRect(700,0,700,H);
   const b={...stockPresets.find(p=>p.id===preset).settings,size},id='160-move-'+preset+'-'+size+'-'+rep,s={...b,...brushStrokeMetadata(b),id,kind:'stroke',tool:'brush',points:[],size,color:'#000000',opacity:1,pressure:false,response:1,captureZoom:1,stabilization:0,smoothness:0,pressureWidth:true,pressureOpacity:false,taperStart:0,taperEnd:0,velocityTaper:false,colorSeed:watercolorSeedFor(id)};
   const target=document.createElement('canvas');target.width=W;target.height=H;const tc=target.getContext('2d',{willReadFrequently:true}),mask=document.createElement('canvas');mask.width=W;mask.height=H;const timings=[];
   let reads=0;const read=CanvasRenderingContext2D.prototype.getImageData;CanvasRenderingContext2D.prototype.getImageData=function(...a){reads++;return read.apply(this,a);};for(let i=0;i<160;i++){
    const x=70+i*8;s.points=[...s.points,{x,y:250,p:1,v:.65}];const st={...s},t=performance.now();tc.clearRect(0,0,W,H);tc.drawImage(base,0,0);compositePaintStroke(tc,mask,st,0,0,strokeRasterBounds(st,W,H),base);tc.getImageData(x,250,1,1);timings.push(performance.now()-t);
   }
   CanvasRenderingContext2D.prototype.getImageData=read;const sorted=[...timings].sort((a,b)=>a-b);rows.push({preset,size,rep,reads,n:timings.length,mean:timings.reduce((a,b)=>a+b,0)/160,p95:sorted[Math.floor(160*.95)],max:sorted.at(-1),over16:timings.filter(n=>n>16).length,timings});
  }resetWetSmudgeCaches();return rows;
 });
 const report={method:'160 updates per gesture, three repetitions, 1400x500 canvas; full base copy + 1px completion readback retained; CPU1; normal mouse-speed straight path, pressure disabled',rows};
 fs.writeFileSync(`validation/v156-${tag}-smudge-performance.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify(rows.map(({timings,...r})=>r),null,2));
}finally{await browser.close();await server.close();}
