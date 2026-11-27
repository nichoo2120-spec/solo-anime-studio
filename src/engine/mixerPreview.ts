import type {Stroke} from '../core/model';
import {drawStroke} from './renderer';
import type {RasterRegion} from './liveRaster';
const canvas=()=>document.createElement('canvas');
const nibCache=new Map<string,HTMLCanvasElement>();

/** A provisional colour transfer at the pen, replaced by worker pixels. It
 * never owns a layer, goes into history, or supplies saved-stroke pixels. */
export class MixerPreview{
 readonly surface=canvas();
 private nib=canvas();
 private patch=canvas();
 private count=0;
 presentedSamples=0;
 begin(source:HTMLCanvasElement,s:Stroke,signature:string){
  this.count=this.presentedSamples=0;
  if(this.surface.width!==source.width)this.surface.width=source.width;
  if(this.surface.height!==source.height)this.surface.height=source.height;
  const ctx=this.surface.getContext('2d')!;ctx.globalCompositeOperation='copy';ctx.drawImage(source,0,0);ctx.globalCompositeOperation='source-over';
  const properties=JSON.parse(signature);
  for(const key of ['id','rasterSourceId','watercolorSeed','colorSeed','dryBristleSeed','color','bbCarry'])delete properties[key];
  properties.size=Math.round(s.size/8);properties.tipAngle=Math.round((s.tipAngle??0)/5);
  const key=JSON.stringify(properties),side=64,existing=nibCache.get(key);
  if(this.patch.width!==side)this.patch.width=this.patch.height=side;
  if(existing){this.nib=existing;return;}
  this.nib=canvas();this.nib.width=this.nib.height=side;
  const nib={...s,size:side*.65,id:s.rasterSourceId??s.id,color:'#ffffff',pressure:false,
   points:[{x:side/2,y:side/2,p:1}],taperStart:0,taperEnd:0};
  drawStroke(this.nib.getContext('2d')!,nib);nibCache.set(key,this.nib);
  if(nibCache.size>48)nibCache.delete(nibCache.keys().next().value!);
 }
 replace(source:HTMLCanvasElement,r:RasterRegion){
  const ctx=this.surface.getContext('2d')!;ctx.clearRect(r.x,r.y,r.width,r.height);
  ctx.drawImage(source,r.x,r.y,r.width,r.height,r.x,r.y,r.width,r.height);
 }
 bounds(s:Stroke):RasterRegion|undefined{
  if(this.count>=s.points.length)return;
  let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  for(let i=Math.max(0,this.count-1);i<s.points.length;i++){
   const p=s.points[i];x=Math.min(x,p.x);y=Math.min(y,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);
  }
  const pad=s.size+2;
  return {x:Math.floor(x-pad),y:Math.floor(y-pad),width:Math.ceil(right-x+2*pad),height:Math.ceil(bottom-y+2*pad)};
 }
 paint(s:Stroke,base:HTMLCanvasElement){
  if(this.count===s.points.length)return this.surface;
  const ctx=this.surface.getContext('2d')!,patch=this.patch.getContext('2d')!,side=this.patch.width;
  const step=Math.max(1,s.size*.12);
  for(let i=this.count;i<s.points.length;i++){
   const p=s.points[i],a=s.points[Math.max(0,i-1)],dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy);
   const pieces=Math.max(1,Math.ceil(d/step));
   for(let n=1;n<=pieces;n++){
    const t=n/pieces,x=a.x+dx*t,y=a.y+dy*t,pressure=a.p+(p.p-a.p)*t;
    const width=s.size/.65*(s.pressure&&s.pressureWidth!==false?Math.max(s.minSize??.1,pressure):1);
    const drag=Math.min(d,s.size*(s.bbStretch??.5)),ox=d?dx/d*drag:0,oy=d?dy/d*drag:0;
    patch.clearRect(0,0,side,side);
    if(s.bbWetness===0){patch.fillStyle=s.color;patch.fillRect(0,0,side,side);}
    else{
     patch.drawImage(base,x-width/2-ox,y-width/2-oy,width,width,0,0,side,side);
     if(s.bbPaintLoad){patch.globalAlpha=s.bbPaintLoad*(1-(s.bbMix??.5));patch.fillStyle=s.color;patch.fillRect(0,0,side,side);patch.globalAlpha=1;}
    }
    patch.globalCompositeOperation='destination-in';patch.drawImage(this.nib,0,0);
    patch.globalCompositeOperation='source-over';
    ctx.globalAlpha=s.opacity*(s.bbFlow??.6)*(s.bbAmount??1);
    ctx.drawImage(this.patch,x-width/2,y-width/2,width,width);
   }
  }
  ctx.globalAlpha=1;this.count=this.presentedSamples=s.points.length;
  return this.surface;
 }
}
