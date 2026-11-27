import {secondaryBitmapTip} from './bitmapTips';
import type {BitmapMask} from '../core/bitmapBrush';
/** v0.5.241 Stamp engine for Tip shape (stretch / squeeze) and Dual Brush.
 *
 * In plain words:
 * - The brush's tip image (its painting tip and texture) is stamped along the
 *   line. Each stamp can be squeezed (Roundness), stretched (Scale X / Y),
 *   turned (Angle, optionally following the line or the pen tilt) and flipped.
 * - Dual Brush stamps a second tip along the same line (its own size, spacing
 *   and scatter) and combines the two by a blend mode, like Photoshop.
 * - Everything is a pure function of the saved stroke, so live == reload.
 */
import {drawNatureStroke,natureExtent} from './natureRaster';
import type {NatureTip} from '../core/natureBrush';
import {secondaryNatureAtlas,natureTipPixels} from './natureTips';
import type {Point,Stroke} from '../core/model';
import type {DualMode} from '../core/brushShape';
import {paintingNib,erodePaintingGrain,paintHash} from './paintingTips';
import {paintSamples,type PaintSamples} from './paintPass';
import {pressureResponse,taperFactor,type strokeGeometry} from './strokeGeometry';
import {widthResponse,opacityResponse} from './pressureChannels';
import type {RasterRegion} from './liveRaster';

const clamp=(v:number)=>v<0?0:v>1?1:v;
const idSeed=(id:string)=>{let h=2166136261;for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);return (h>>>0)%100003;};
type Canvasish=HTMLCanvasElement;
const make=(w:number,h:number):Canvasish=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
let surfaceA:Canvasish|undefined,surfaceB:Canvasish|undefined;
const fit=(c:Canvasish|undefined,w:number,h:number)=>{if(!c)return make(w,h);if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;return c;};

export type StampDab={x:number;y:number;rx:number;ry:number;angle:number;level:number;index:number};
/** The largest half-extent of a stamp relative to the brush size (bounds padding). */
export function stampExtent(s:Stroke){
 if(s.natureVersion===1)return natureExtent(s);
 const sx=s.tsScaleX??1,sy=(s.tsScaleY??1)*(s.tsRoundness??1),main=Math.max(sx,sy)*.75;
 if(s.brushBlendVersion===4||s.brushBlendVersion===6||(s.brushBlendVersion===7||(s.brushBlendVersion===8||s.brushBlendVersion===9))){
  const tilt=s.tsTilt?2.5:1;
  const dual=s.dbTip?(s.dbScale??.45)*.75+(s.dbScatter??0)*1.04:0;
  return Math.max(Math.max(sx*tilt,sy)*.75,dual,.6);
 }
 const dual=s.dbTip?(s.dbScale??.45)*.75+(s.dbScatter??0)*.5:0;
 return Math.max(main,dual,.6);
}
function tiltAt(raw:Point[],cum:number[],f:number){
 if(!raw.length)return undefined;const total=cum[cum.length-1]||0,target=f*total;let i=1;while(i<cum.length-1&&cum[i]<target)i++;
 const a=raw[Math.max(0,i-1)] as Point&{az?:number;alt?:number},b=(raw[i]??a) as Point&{az?:number;alt?:number};
 if(a.az===undefined&&b.az===undefined)return undefined;const span=(cum[i]??0)-(cum[i-1]??0),t=span>0?clamp((target-(cum[i-1]??0))/span):0;
 let d=(b.az??a.az!)-(a.az??b.az!);while(d>180)d-=360;while(d<-180)d+=360;
 return {az:(a.az??b.az!)+d*t,alt:(a.alt??b.alt??90)+((b.alt??a.alt??90)-(a.alt??b.alt??90))*t};
}
/** Main dabs: position, size, shape and level along the stroke. */
export function stampDabs(s:Stroke,samples:PaintSamples):StampDab[]{
 const out:StampDab[]=[];if(!samples.points.length)return out;
 const raw=s.points,cum:number[]=[0];for(let i=1;i<raw.length;i++)cum.push(cum[i-1]+Math.hypot(raw[i].x-raw[i-1].x,raw[i].y-raw[i-1].y));
 const spacing=Math.max(.02,Math.min(.5,s.tipSpacing??.1)),sx=(s.tsScaleX??1)*(s.tsFlipX?-1:1),sy=(s.tsScaleY??1)*(s.tsRoundness??1)*(s.tsFlipY?-1:1),base=(s.tsAngle??0)*Math.PI/180;
 let segment=1,d=0,index=0;
 const at=(dist:number)=>{
  while(segment<samples.points.length-1&&samples.arc[segment]<dist)segment++;
  const a=samples.points[Math.max(0,segment-1)]??samples.points[0],b=samples.points[segment]??a,start=samples.arc[segment-1]??0,span=(samples.arc[segment]??0)-start,t=span?clamp((dist-start)/span):0;
  const p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,p:a.p+(b.p-a.p)*t,v:(a.v??.65)+((b.v??.65)-(a.v??.65))*t};
  const pressure=s.pressure?pressureResponse(p.p**s.response,s.pressureCurve):1;
  const width=s.pressure&&s.pressureWidth!==false||s.velocityTaper?widthResponse(pressure*(s.velocityTaper?p.v:1),s):1;
  const radius=Math.max(.35,s.size*.5*width*taperFactor(dist,samples.total,s.taperStart,s.taperEnd,Math.max(64,s.size*12)));
  let angle=base,rx=radius*Math.abs(sx),ry=radius*Math.abs(sy);
  // Follow: the tip's width lies across the line, like a real flat brush.
  if(s.tsFollow&&samples.points.length>1)angle+=Math.atan2(b.y-a.y,b.x-a.x)+Math.PI/2;
  if(s.tsTilt){const tilt=tiltAt(raw,cum,samples.total?dist/samples.total:0);if(tilt){angle+=tilt.az*Math.PI/180;const lean=1-clamp(tilt.alt/90);rx*=1+1.5*lean;}}
  const level=clamp((s.flow??1)*(s.pressure&&s.pressureFlow?pressure:1)*(s.pressure&&s.pressureOpacity?opacityResponse(pressure,s):1));
  out.push({x:p.x,y:p.y,rx:rx*Math.sign(sx||1),ry:ry*Math.sign(sy||1),angle,level,index:index++});return radius;
 };
 for(;;){const r=at(Math.min(d,samples.total));if(d>=samples.total)break;d+=Math.max(.4,2*r*Math.min(Math.abs(sx),Math.abs(sy),1)*spacing);}
 return out;
}
/** Second-tip dabs (Dual Brush): own size, spacing, scatter and count. */
export function dualDabs(s:Stroke,samples:PaintSamples):StampDab[]{
 const out:StampDab[]=[];if(!s.dbTip||!samples.points.length)return out;
 const D=Math.max(1,s.size*(s.dbScale??.45)),step=Math.max(.5,D*(s.dbSpacing??.25)),count=Math.max(1,Math.min(5,Math.round(s.dbCount??1))),scatter=(s.dbScatter??0)*s.size,seed=idSeed(s.id);
 let segment=1,index=0;
 for(let d=0;d<=samples.total+1e-6;d+=step){
  while(segment<samples.points.length-1&&samples.arc[segment]<d)segment++;
  const a=samples.points[Math.max(0,segment-1)]??samples.points[0],b=samples.points[segment]??a,start=samples.arc[segment-1]??0,span=(samples.arc[segment]??0)-start,t=span?clamp((d-start)/span):0;
  const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,len=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;
  for(let k=0;k<count;k++){const h1=paintHash(index*7+k*131+seed,91)-.5,h2=paintHash(index*13+k*17+seed,37)-.5,h3=paintHash(index*5+k*29+seed,53);
   out.push({x:x+nx*h1*2*scatter+(b.x-a.x)/len*h2*scatter*.5,y:y+ny*h1*2*scatter+(b.y-a.y)/len*h2*scatter*.5,rx:D*.5,ry:D*.5,angle:h3*Math.PI*2,level:1,index:index*count+k});}
  index++;
 }
 return out;
}
function stamp(ctx:CanvasRenderingContext2D,dabs:StampDab[],tip:Parameters<typeof paintingNib>[0],hardness:number,texture:number,ox:number,oy:number,nature?:NatureTip,bitmap?:BitmapMask){
 const image=bitmap?secondaryBitmapTip(bitmap):undefined;
 const max=image?Math.max(image.width,image.height):1;
 const atlas=nature?secondaryNatureAtlas(nature,texture):undefined;
 for(const d of dabs){if(d.level<=0)continue;const nib=paintingNib(tip,hardness,texture,d.index&3,0);
  ctx.setTransform(1,0,0,1,0,0);ctx.translate(d.x-ox,d.y-oy);ctx.rotate(d.angle);ctx.scale(d.rx*2,d.ry*2);ctx.globalAlpha=d.level;if(image){const w=image.width/max,h=image.height/max;ctx.drawImage(image,-w*.5,-h*.5,w,h);}else if(atlas){const p=natureTipPixels;ctx.drawImage(atlas,0,0,p,p,-.5,-.5,1,1);}else ctx.drawImage(nib.canvas,nib.x,nib.y,nib.w,nib.h);}
 ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;
}
const combine=(mode:DualMode,a:number,b:number,amount:number)=>{
 let r:number;
 switch(mode){
  case 'darken':r=Math.min(a,b);break;
  case 'overlay':r=a<.5?2*a*b:1-2*(1-a)*(1-b);r=Math.min(r,a);break;
  case 'subtract':r=Math.max(0,a-b);break;
  case 'lighten':r=Math.max(a,b)*(a>0?1:0);break;
  case 'screen':r=(1-(1-a)*(1-b))*(a>0?1:0);break;
  case 'height':r=clamp((a-(1-b))*2);break;
  default:r=a*b;
 }
 return a+(r-a)*amount;
};
/** Bounds of a stamp stroke on a canvas. */
export function stampBounds(s:Stroke,width:number,height:number,g:ReturnType<typeof strokeGeometry>):RasterRegion{
 const pad=Math.ceil(s.size*stampExtent(s)+6);let l=Infinity,t=Infinity,r=-Infinity,b=-Infinity;
 for(const p of [...g.points,...g.cubics.flatMap(c=>[c.c1,c.c2])]){l=Math.min(l,p.x);t=Math.min(t,p.y);r=Math.max(r,p.x);b=Math.max(b,p.y);}
 if(!Number.isFinite(l))return {x:0,y:0,width:0,height:0};
 const x=Math.max(0,Math.floor(l-pad)),y=Math.max(0,Math.floor(t-pad));return {x,y,width:Math.max(0,Math.min(width,Math.ceil(r+pad))-x),height:Math.max(0,Math.min(height,Math.ceil(b+pad))-y)};
}
/** Draw the whole stamp stroke (colour with coverage alpha) onto ctx. */
export type StampPlan={samples:PaintSamples;dabs:StampDab[];dual:StampDab[]};
/** All dabs of a stamp stroke (main and second tip). */
export function stampPlan(s:Stroke,g:ReturnType<typeof strokeGeometry>):StampPlan{const samples=paintSamples(g,.25);return {samples,dabs:stampDabs(s,samples),dual:s.dbTip?dualDabs(s,samples):[]};}
/** Conservative half-size of one dab on the canvas (the nib image reaches about 0.72 of rx*2). */
const dabReach=(d:StampDab)=>Math.max(Math.abs(d.rx),Math.abs(d.ry))*1.5+3;
const sameDab=(a:StampDab,b:StampDab)=>a.x===b.x&&a.y===b.y&&a.rx===b.rx&&a.ry===b.ry&&a.angle===b.angle&&a.level===b.level&&a.index===b.index;
/** Area covered by dabs that differ between two plans (undefined: nothing changed). */
export function stampChange(before:StampDab[],after:StampDab[]):RasterRegion|undefined{
 let i=0;const n=Math.min(before.length,after.length);while(i<n&&sameDab(before[i],after[i]))i++;
 let l=Infinity,t=Infinity,r=-Infinity,b=-Infinity;
 for(const list of [before,after])for(let k=i;k<list.length;k++){const d=list[k],e=dabReach(d);l=Math.min(l,d.x-e);t=Math.min(t,d.y-e);r=Math.max(r,d.x+e);b=Math.max(b,d.y+e);}
 if(!Number.isFinite(l))return undefined;const x=Math.floor(l),y=Math.floor(t);return {x,y,width:Math.ceil(r)-x,height:Math.ceil(b)-y};
}
const touches=(d:StampDab,box:RasterRegion)=>{const e=dabReach(d);return d.x+e>=box.x&&d.x-e<=box.x+box.width&&d.y+e>=box.y&&d.y-e<=box.y+box.height;};
export function drawStampStroke(ctx:CanvasRenderingContext2D,s:Stroke,g:ReturnType<typeof strokeGeometry>,clip?:RasterRegion,given?:StampPlan):RasterRegion|undefined{
 // Work in document space; the context's transform is applied when drawing.
 if(s.natureVersion===1){drawNatureStroke(ctx,s,g,clip);return clip;}
 const m=ctx.getTransform(),inv=m.inverse(),corners=[[0,0],[ctx.canvas.width,0],[0,ctx.canvas.height],[ctx.canvas.width,ctx.canvas.height]].map(([x,y])=>({x:inv.a*x+inv.c*y+inv.e,y:inv.b*x+inv.d*y+inv.f}));
 const vl=Math.floor(Math.min(...corners.map(c=>c.x))),vt=Math.floor(Math.min(...corners.map(c=>c.y))),vr=Math.ceil(Math.max(...corners.map(c=>c.x))),vb=Math.ceil(Math.max(...corners.map(c=>c.y)));
 const full=stampBounds(s,1e7,1e7,g);let x0=Math.max(full.x,vl),y0=Math.max(full.y,vt),x1=Math.min(full.x+full.width,vr),y1=Math.min(full.y+full.height,vb);
 // Live redraw of only the changed area: the result is per pixel the same as a full redraw.
 if(clip){x0=Math.max(x0,clip.x);y0=Math.max(y0,clip.y);x1=Math.min(x1,clip.x+clip.width);y1=Math.min(y1,clip.y+clip.height);}
 const box={x:x0,y:y0,width:Math.max(0,x1-x0),height:Math.max(0,y1-y0)};
 if(!box.width||!box.height||!s.stampTip)return undefined;
 const plan=given??stampPlan(s,g),dabs=clip?plan.dabs.filter(d=>touches(d,box)):plan.dabs,dual=clip?plan.dual.filter(d=>touches(d,box)):plan.dual;
 const A=surfaceA=fit(surfaceA,box.width,box.height),ac=A.getContext('2d',{willReadFrequently:!!s.dbTip})!;ac.clearRect(0,0,box.width,box.height);
 stamp(ac,dabs,s.stampTip,s.stampHardness??.7,s.stampTexture??0,box.x,box.y);
 if(s.dbTip){
  const B=surfaceB=fit(surfaceB,box.width,box.height),bc=B.getContext('2d',{willReadFrequently:true})!;bc.clearRect(0,0,box.width,box.height);
  stamp(bc,dual,s.dbTip,s.dbHardness??.7,s.dbTexture??0,box.x,box.y,s.dbNatureTip,s.dbBitmap);
  if(!s.dbNatureTip&&!s.dbBitmap&&(s.dbTexture??0)>0)erodePaintingGrain(bc,s.dbTip,(s.dbTexture??0)*.8,box.x,box.y,box.width,box.height);
  const ai=ac.getImageData(0,0,box.width,box.height),bi=bc.getImageData(0,0,box.width,box.height),a=ai.data,b=bi.data,mode=s.dbMode??'multiply',amount=s.dbAmount??1;
  for(let i=3;i<a.length;i+=4){if(!a[i])continue;a[i]=Math.round(255*combine(mode,a[i]/255,b[i]/255,amount));}
  ac.putImageData(ai,0,0);
 }
 if((s.stampTexture??0)>0)erodePaintingGrain(ac,s.stampTip,(s.stampTexture??0)*.6,box.x,box.y,box.width,box.height);
 ac.globalCompositeOperation='source-in';ac.fillStyle=s.color;ac.fillRect(0,0,box.width,box.height);ac.globalCompositeOperation='source-over';
 ctx.drawImage(A,box.x,box.y);
 return box;
}
