// Standalone render harness (experiment only). Drives the REAL engine: LayerRenderer.get -> drawStroke -> compositePaintStroke.
import {stockPresets,legacyAirbrushPreset} from '../src/core/brushes';
import {brushStrokeMetadata,watercolorSeedFor} from '../src/core/paintTips';
import {LayerRenderer} from '../src/engine/renderer';
import {strokeSnapshot} from '../src/engine/geometryCache';
import {Pickup} from '../src/engine/mixing';
import {watercolorVelocity} from '../src/engine/watercolorPigment';
import type {Stroke,Point,Layer,Project} from '../src/core/model';
const all=[...stockPresets,legacyAirbrushPreset];
let uidn=0;
export type Spec={preset:string;ov?:Record<string,any>;path:any;speed?:number;pressure?:null|number|'ramp'|'bell';id?:string;color?:string;mouse?:boolean};
function genPath(path:any,speed:number,pressure:Spec['pressure']):Point[]{
 // polyline of "pointer events" 8 ms apart; speed in px/ms (screen px at zoom 1)
 let poly:{x:number;y:number}[]=[];
 if(path.kind==='pts')poly=path.pts;
 else if(path.kind==='line')poly=[{x:path.x0,y:path.y0},{x:path.x1,y:path.y1}];
 else if(path.kind==='sine'){const n=200;for(let i=0;i<=n;i++){const t=i/n;poly.push({x:path.x0+(path.x1-path.x0)*t,y:path.y0+path.amp*Math.sin(t*Math.PI*2*(path.cycles??1))});}}
 else if(path.kind==='arc'){const n=200;for(let i=0;i<=n;i++){const t=i/n;poly.push({x:path.x0+(path.x1-path.x0)*t,y:path.y0-path.amp*Math.sin(t*Math.PI)});}}
 else if(path.kind==='zigzag'){const n=path.n??6;for(let i=0;i<=n;i++){poly.push({x:path.x0+(path.x1-path.x0)*i/n,y:path.y0+(i%2?path.amp:-path.amp)});}}
 const seg:number[]=[0];for(let i=1;i<poly.length;i++)seg.push(seg[i-1]+Math.hypot(poly[i].x-poly[i-1].x,poly[i].y-poly[i-1].y));
 const total=seg[seg.length-1],step=Math.max(.4,speed*8),pts:Point[]=[];let d=0,j=1,last:Point|undefined,v=.65;
 const at=(d:number)=>{while(j<poly.length-1&&seg[j]<d)j++;const a=poly[j-1],b=poly[j],t=(d-seg[j-1])/Math.max(1e-9,seg[j]-seg[j-1]);return {x:a.x+(b.x-a.x)*Math.min(1,Math.max(0,t)),y:a.y+(b.y-a.y)*Math.min(1,Math.max(0,t))};};
 for(;;){const q=at(Math.min(d,total));const t=total?Math.min(d,total)/total:0;
  let p=1;if(typeof pressure==='number')p=pressure;else if(pressure==='ramp')p=.15+.85*t;else if(pressure==='bell')p=.15+.85*Math.sin(Math.PI*t);
  const pt:Point={x:q.x,y:q.y,p};
  if(last){v=watercolorVelocity(Math.hypot(pt.x-last.x,pt.y-last.y),8,last.v??.65);}pt.v=last?v:.65;pts.push(pt);last=pt;
  if(d>=total)break;d=Math.min(total,d+step);}
 return pts;
}
function mk(spec:Spec):Stroke{
 const pr=all.find(p=>p.id===spec.preset)!,b={...pr.settings,...(spec.ov??{})} as any;
 const id=spec.id??('h'+(uidn++)+spec.preset);
 const pts=genPath(spec.path,spec.speed??.6,spec.pressure??null);
 const s:any={id,kind:'stroke',tool:'brush',points:pts,size:b.size,opacity:b.opacity,color:spec.color??spec.ov?.color??'#000000',pressure:spec.pressure!=null&&!spec.mouse,response:b.response,...brushStrokeMetadata(b),captureZoom:1,stabilization:b.stabilization,smoothness:b.smoothness??0,pressureWidth:b.pressureWidth??true,pressureOpacity:b.pressureOpacity??false,pressureCurve:b.pressureCurve?.map((p:any)=>({...p})),taperStart:b.taperStart??0,taperEnd:b.taperEnd??0,brushKind:b.brushKind,textureStrength:b.textureStrength,minSize:b.minSize,maxSize:b.maxSize,minOpacity:b.minOpacity,maxOpacity:b.maxOpacity,velocityTaper:false};
 if(s.dryBristleVersion===1||s.dryBristleVersion===2)s.dryBristleSeed=watercolorSeedFor(id);
 if(s.coloringEngine===1)s.colorSeed=watercolorSeedFor(id);
 if(s.watercolorMaterialVersion===2||s.watercolorEngine===1)s.watercolorSeed=watercolorSeedFor(id);
 if(!(s.dryBristleVersion===1||s.dryBristleVersion===2||s.coloringEngine===1||s.watercolorEngine===1)){for(const p of s.points)delete p.v;}
 return s as Stroke;
}
function toPng(c:HTMLCanvasElement){return c.toDataURL('image/png');}
import {drawDryBristle,applyTooth,type DryParams} from './dryBristle';
(window as any).H={
 proto(opts:{W:number;H:number;paper?:string;color?:string;path:any;speed?:number;pressure?:any;params:DryParams&{tooth?:number;toothScale?:number};under?:boolean}){
  const pts=genPath(opts.path,opts.speed??.5,opts.pressure??null);const c=document.createElement('canvas');c.width=opts.W;c.height=opts.H;const t0=performance.now();
  drawDryBristle(c,pts,opts.params);if((opts.params.tooth??0)>0)applyTooth(c,opts.color??'#000000',{tooth:opts.params.tooth!,scale:opts.params.toothScale??2,seed:opts.params.seed+5,blur:(opts.params as any).blur,wash:(opts.params as any).wash});else{const x=c.getContext('2d')!;x.save();x.globalCompositeOperation='source-in';x.fillStyle=opts.color??'#000000';x.fillRect(0,0,c.width,c.height);x.restore();}
  const ms=performance.now()-t0;const w=document.createElement('canvas');w.width=opts.W;w.height=opts.H;const wc=w.getContext('2d')!;wc.fillStyle=opts.paper??'#ffffff';wc.fillRect(0,0,opts.W,opts.H);wc.drawImage(c,0,0);return {layer:toPng(c),white:toPng(w),ms,npts:pts.length};
 },
 presets:()=>all.map(p=>({id:p.id,name:p.name,category:p.category,family:p.family,settings:p.settings,meta:brushStrokeMetadata(p.settings as any)})),
 render(opts:{W:number;H:number;paper?:string;ops:Spec[];base?:Spec[]}){
  const W=opts.W,Hh=opts.H,renderer=new LayerRenderer();
  const project={width:W,height:Hh} as Project;
  let layer:Layer={id:'L',name:'L',visible:true,locked:false,opacity:1,operations:[],kind:'raster'};
  const run=(spec:Spec)=>{
   const s=mk(spec);
   // emulate StudioEngine: mixColors (non-watercolor) / wet watercolor take a pickup snapshot at contact when the layer is non-empty
   const wet=s.watercolorMode==='wet'||!s.watercolorMode&&(spec.ov?.mixColors??all.find(p=>p.id===spec.preset)!.settings.mixColors);
   if(s.brushTip!=='color-blender'&&wet&&layer.operations.length>0){s.mixStops=[];const amt=spec.ov?.mixAmount??(all.find(p=>p.id===spec.preset)!.settings as any).mixAmount??.55;const pk=new Pickup(renderer.get(layer,project),amt);pk.update(s);}
   const snap=strokeSnapshot(s);layer={...layer,operations:[...layer.operations,snap]};return snap;
  };
  for(const b of opts.base??[])run(b);
  const baseCanvas=document.createElement('canvas');baseCanvas.width=W;baseCanvas.height=Hh;baseCanvas.getContext('2d')!.drawImage(renderer.get(layer,project),0,0);
  const t0=performance.now();
  for(const o of opts.ops)run(o);
  const out=renderer.get(layer,project);const ms=performance.now()-t0;
  const white=document.createElement('canvas');white.width=W;white.height=Hh;const wc=white.getContext('2d')!;wc.fillStyle=opts.paper??'#ffffff';wc.fillRect(0,0,W,Hh);wc.drawImage(out,0,0);
  const strokes=layer.operations.slice(opts.base?.length??0) as Stroke[];
  return {layer:toPng(out),white:toPng(white),base:toPng(baseCanvas),ms,npts:strokes.map(s=>s.points.length)};
 }
};
import {dryBristleDiagnostics} from '../src/engine/dryBristle';
(window as any).D=dryBristleDiagnostics;
import {dryBristleV2Diagnostics} from '../src/engine/dryBristleV2';(window as any).D2=dryBristleV2Diagnostics;
