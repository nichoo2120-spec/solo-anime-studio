import {StudioEngine} from '../src/engine/StudioEngine';
import {DocumentStore} from '../src/core/history';
import {validateProject} from '../src/core/model';
import {stockPresets} from '../src/core/brushes';
import {performanceScene} from './performance-v155-fixture';
const canvas=document.querySelector<HTMLCanvasElement>('#drawing')!,store=new DocumentStore(performanceScene(960,640)),engine=new StudioEngine(canvas,store,()=>{}),internals=engine as any;
canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
const frame=()=>new Promise<void>(r=>requestAnimationFrame(()=>r()));
async function ready(){await frame();await frame();}
async function scene(id:string,options:any={}){
 const stage=document.querySelector<HTMLElement>('#stage')!;stage.style.width=(options.resize?.[0]??1000)+'px';stage.style.height=(options.resize?.[1]??700)+'px';await ready();
 const p=performanceScene(960,640);p.id=id;p.name=id;if(options.blends){p.layers[0]={...p.layers[0],opacity:.53,blend:'multiply'};p.layers[1]={...p.layers[1],opacity:.67,blend:'screen'};p.layers[4]={...p.layers[4],opacity:.71};}if(options.bottom)p.activeLayerId=p.layers.at(-1)!.id;
 await engine.load(validateProject(p));engine.setView({x:options.panX??20,y:options.panY??25,zoom:options.zoom??.95,rotation:options.rotation??0});engine.mirrorDrawing.enabled=!!options.mirror;engine.mirrorDrawing.axis=options.axis??'vertical';engine.mirrorDrawing.showLine=true;engine.mirrorDrawing.pivot={x:.37,y:.61};await ready();
}
function brush(id:string,size:number){const preset=stockPresets.find(p=>p.id===id)!;engine.setInput(preset.category==='Eraser'?'eraser':'brush',{...preset.settings,size,pressure:true,smoothness:18,stabilization:.08},preset);}
async function draw(id:string,samples=48,options:any={}){
 const savedUUID=crypto.randomUUID;let uuid=0;crypto.randomUUID=()=>`${id}-${uuid++}`as `${string}-${string}-${string}-${string}-${string}`;
 const diffs:any[]=[];let maxBytes=0;const rect=canvas.getBoundingClientRect(),begin=performance.now();
 for(let i=0;i<=samples;i++){
  const t=i/samples,x=options.edge?2+130*t:(options.x0??80)+(options.length??640)*t,y=(options.y0??160)+(options.amplitude??100)*Math.sin(t*Math.PI*3),p=options.pressure===false?1:.18+.8*Math.sin(t*Math.PI)**2,view=engine.view,co=Math.cos(view.rotation)*view.zoom,si=Math.sin(view.rotation)*view.zoom;
  const event=new PointerEvent(i===0?'pointerdown':i===samples?'pointerup':'pointermove',{pointerId:41,isPrimary:true,pointerType:'pen',button:0,buttons:i===samples?0:1,pressure:p,clientX:rect.left+view.x+co*x-si*y,clientY:rect.top+view.y+si*x+co*y});Object.defineProperty(event,'timeStamp',{value:begin+i*8});canvas.dispatchEvent(event);
  if(i%4===0||i===samples){await frame();
   const ctx=canvas.getContext('2d')!,before=ctx.getImageData(0,0,canvas.width,canvas.height),status=internals.drawingFrames.status();maxBytes=Math.max(maxBytes,status.bytes);
   internals.drawingFrames.invalidate();internals.render();const after=ctx.getImageData(0,0,canvas.width,canvas.height).data;let max=0,changed=0;
   for(let j=0;j<after.length;j+=4){let different=false;for(let k=0;k<4;k++){const d=Math.abs(before.data[j+k]-after[j+k]);max=Math.max(max,d);different||=!!d;}if(different)changed++;}
   diffs.push({sample:i,max,changed,pixels:canvas.width*canvas.height});
  }
 }
 crypto.randomUUID=savedUUID;await ready();return{diffs,maxBytes,operations:store.getSnapshot().layers.flatMap(l=>l.operations).length,png:canvas.toDataURL()};
}
(window as any).DRAWING_TEST={scene,brush,draw,engine,store,ready};
