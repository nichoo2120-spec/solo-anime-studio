import type {Point,Stroke} from '../core/model';
import type {RasterRegion} from './liveRaster';
import {pressureResponse} from './strokeGeometry';
import {widthResponse} from './pressureChannels';
import {projectPoint} from './perspectiveWarp';

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const canvas=(width:number,height:number)=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
type Gesture={id:string;signature:string;base:HTMLCanvasElement;field:HTMLCanvasElement;reservoir:HTMLCanvasElement;sample:HTMLCanvasElement;contact:HTMLCanvasElement;count:number;last?:Point;until:number;loaded:boolean};
const gestures=new WeakMap<HTMLCanvasElement,Gesture>();
let effect:HTMLCanvasElement|undefined;

/** Per-stroke carried pigment, with optional artist-selected paint load and no pixel readbacks.
 * Contacts follow fixed document distance along the captured path. The full
 * native brush raster alone defines final pressure, texture, edge and taper.
 * Immutable-base worker calls append; canonical replay always starts afresh.
 */
export function resetPigmentMix(target:HTMLCanvasElement){gestures.delete(target);}
export function applyPigmentMix(ctx:CanvasRenderingContext2D,mask:HTMLCanvasElement,s:Stroke,sourceX:number,sourceY:number,dirty?:RasterRegion,base?:HTMLCanvasElement){
 const amount=clamp(s.nativeMixAmount??.58)*clamp(s.opacity);
 if(!amount||s.flow===0||!s.points.length)return;
 const width=ctx.canvas.width,height=ctx.canvas.height,source=base??ctx.canvas;
 const signature=JSON.stringify({...s,points:undefined,mixStops:undefined});
 let g=base?gestures.get(ctx.canvas):undefined;
 const previous=g&&s.points[g.count-1];
 if(!g||g.id!==s.id||g.signature!==signature||g.base!==source||g.count>s.points.length||g.last&&(!previous||previous.x!==g.last.x||previous.y!==g.last.y||previous.p!==g.last.p)){
  const side=Math.max(8,Math.min(256,Math.ceil(s.size*1.5+8)));
  g={id:s.id,signature,base:source,field:canvas(width,height),reservoir:canvas(side,side),sample:canvas(side,side),contact:canvas(side,side),count:0,until:0,loaded:false};
  if(base)gestures.set(ctx.canvas,g);
 }
 const field=g.field.getContext('2d')!,reservoir=g.reservoir.getContext('2d')!,sample=g.sample.getContext('2d')!,contact=g.contact.getContext('2d')!,side=g.reservoir.width;
 const feather=contact.createRadialGradient(side/2,side/2,side*.35,side/2,side/2,side*.5);
 feather.addColorStop(0,'white');feather.addColorStop(1,'rgba(255,255,255,0)');
 const map=(p:Point):Point=>s.perspective?{...p,...projectPoint(p,s.perspective)}:s.transform?{...p,x:s.transform[0]*p.x+s.transform[2]*p.y+s.transform[4],y:s.transform[1]*p.x+s.transform[3]*p.y+s.transform[5]}:p;
 const affineScale=s.transform?Math.max(Math.hypot(s.transform[0],s.transform[1]),Math.hypot(s.transform[2],s.transform[3])):1;
 const paintLoad=clamp(s.nativeMixPaintLoad??0);
 const spacing=Math.max(.6,Math.min(12,s.size*.1));
 const deposit=(raw:Point,travel:number)=>{
  const p=map(raw),pressure=s.pressure?pressureResponse(clamp(raw.p)**s.response,s.pressureCurve):1;
  const contactWidth=s.pressure&&s.pressureWidth!==false?widthResponse(pressure,s):1;
  let scale=affineScale;
  if(s.perspective){const q=projectPoint({...raw,x:raw.x+1},s.perspective),r=projectPoint({...raw,y:raw.y+1},s.perspective);scale=Math.max(Math.hypot(q.x-p.x,q.y-p.y),Math.hypot(r.x-p.x,r.y-p.y));}
  const span=Math.max(3,Math.min(Math.max(width,height)*2,s.size*scale*contactWidth*1.5+8)),x=p.x-span/2,y=p.y-span/2;
  sample.clearRect(0,0,side,side);sample.drawImage(source,x,y,span,span,0,0,side,side);
  if(!g!.loaded){
   reservoir.drawImage(g!.sample,0,0);g!.loaded=true;
   if(paintLoad){reservoir.save();reservoir.globalCompositeOperation='destination-out';reservoir.globalAlpha=paintLoad;reservoir.fillRect(0,0,side,side);reservoir.globalCompositeOperation='lighter';reservoir.fillStyle=s.color;reservoir.fillRect(0,0,side,side);reservoir.restore();}
  }
  else{
   const hold=Math.max(3,s.size*(.45+2.5*(s.nativeMixRadius??.5)));
   const rate=1-Math.exp(-travel/hold*(.35+.65*pressure));
   // Premultiplied linear interpolation keeps opaque pigment opaque. Source-over
   // here would attenuate alpha twice and leave artificial translucent bands.
   reservoir.save();reservoir.globalCompositeOperation='destination-out';reservoir.globalAlpha=rate;reservoir.fillRect(0,0,side,side);
   reservoir.globalCompositeOperation='lighter';reservoir.globalAlpha=rate*(1-paintLoad);reservoir.drawImage(g!.sample,0,0);
   if(paintLoad){reservoir.globalAlpha=rate*paintLoad;reservoir.fillStyle=s.color;reservoir.fillRect(0,0,side,side);}reservoir.restore();
  }
  contact.clearRect(0,0,side,side);contact.drawImage(g!.reservoir,0,0);
  contact.globalCompositeOperation='destination-in';contact.fillStyle=feather;contact.fillRect(0,0,side,side);contact.globalCompositeOperation='source-over';
  field.drawImage(g!.contact,x,y,span,span);
 };
 for(let i=g.count;i<s.points.length;i++){
  const b=s.points[i],a=i?s.points[i-1]:b;
  if(!i){deposit(b,0);g.until=spacing;}
  else{
   const length=Math.hypot(b.x-a.x,b.y-a.y);
   let distance=g.until;
   while(length>0&&distance<=length+1e-8){const t=Math.min(1,distance/length);deposit({...b,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,p:a.p+(b.p-a.p)*t},spacing);distance+=spacing;}
   g.until=distance-length;
  }
 }
 g.count=s.points.length;g.last={...s.points.at(-1)!};
 const rect=dirty??{x:0,y:0,width,height};
 const x=Math.max(0,Math.floor(rect.x)),y=Math.max(0,Math.floor(rect.y)),right=Math.min(width,Math.ceil(rect.x+rect.width)),bottom=Math.min(height,Math.ceil(rect.y+rect.height));
 const w=right-x,h=bottom-y;if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return;
 effect??=canvas(1,1);if(effect.width!==w)effect.width=w;if(effect.height!==h)effect.height=h;
 const ec=effect.getContext('2d')!;ec.clearRect(0,0,w,h);ec.drawImage(g.field,x,y,w,h,0,0,w,h);
 ec.globalCompositeOperation='destination-in';ec.drawImage(mask,sourceX-x,sourceY-y);ec.globalCompositeOperation='source-over';
 ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 if(base){ctx.clearRect(x,y,w,h);ctx.drawImage(base,x,y,w,h,x,y,w,h);}
 // Source-over retains opaque canvas coverage and can carry sampled pigment
 // onto empty paper. The previous source-atop path categorically prevented it.
 ctx.globalAlpha=amount;ctx.drawImage(effect,x,y);ctx.restore();
}
