import {strokePigment,movementLoad} from './watercolorPigment';
import {watercolorMaterial} from './watercolorMaterial';
import type {Stroke,Point} from '../core/model';
import {pressureResponse,taperFactor,type strokeGeometry} from './strokeGeometry';
import {widthResponse,opacityResponse} from './pressureChannels';
import {watercolorCoverage} from './watercolorTips';
import {paintSamples,type PaintPass} from './paintPass';
import {paintColorFilter} from './paintColorFilter';
import {finishWatercolor} from './watercolorFinish';
import {finishPaper} from './watercolorV2';
import type {RasterRegion} from './liveRaster';
type XY={x:number;y:number};
let pooled:HTMLCanvasElement|undefined,alpha:HTMLCanvasElement|undefined;
const outlines=new Map<string,XY[]>();
function outline(s:Stroke){
 const key=[s.brushTip,s.tipAngle].join(':');let found=outlines.get(key);if(found)return found;
 const angle=(s.tipAngle??0)*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle);found=[];
 for(let i=0;i<32;i++){const a=i*Math.PI/16,c=Math.cos(a),d=Math.sin(a);let lo=0,hi=1.5;for(let j=0;j<14;j++){const r=(lo+hi)/2;if(watercolorCoverage(s.brushTip!,r*c,r*d,1)>.5)lo=r;else hi=r;}found.push({x:(c*co-d*si)*lo,y:(c*si+d*co)*lo});}
 if(outlines.size>=64)outlines.delete(outlines.keys().next().value!);outlines.set(key,found);return found;
}
const cross=(a:XY,b:XY,c:XY)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
/** Convex hull of two homothetic footprints is their continuous linear sweep,
 * rather than a sequence of independently alpha-composited impressions. */
function hull(points:XY[]){
 points.sort((a,b)=>a.x-b.x||a.y-b.y);const lower:XY[]=[],upper:XY[]=[];
 for(const p of points){while(lower.length>1&&cross(lower.at(-2)!,lower.at(-1)!,p)<=0)lower.pop();lower.push(p);}
 for(let i=points.length-1;i>=0;i--){const p=points[i];while(upper.length>1&&cross(upper.at(-2)!,upper.at(-1)!,p)<=0)upper.pop();upper.push(p);}lower.pop();upper.pop();return lower.concat(upper);
}
export function drawWatercolorSweep(ctx:CanvasRenderingContext2D,s:Stroke,g:ReturnType<typeof strokeGeometry>,region?:RasterRegion,pass?:PaintPass){
 const samples=pass?.samples??paintSamples(g,.18),points=samples.points;if(!points.length)return;
 const pad=s.size*.76+4;let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;for(const p of points){left=Math.min(left,p.x);top=Math.min(top,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
 const x=Math.max(0,Math.floor(Math.max(left-pad,region?.x??0))),y=Math.max(0,Math.floor(Math.max(top-pad,region?.y??0))),endX=Math.min(ctx.canvas.width,Math.ceil(Math.min(right+pad,region?region.x+region.width:ctx.canvas.width))),endY=Math.min(ctx.canvas.height,Math.ceil(Math.min(bottom+pad,region?region.y+region.height:ctx.canvas.height))),w=endX-x,h=endY-y;if(w<=0||h<=0)return;
 const mask=pass?.mask??(pooled??=document.createElement('canvas'));if(mask.width!==ctx.canvas.width)mask.width=ctx.canvas.width;if(mask.height!==ctx.canvas.height)mask.height=ctx.canvas.height;const mc=mask.getContext('2d')!;
 mc.save();mc.globalAlpha=1;mc.globalCompositeOperation='source-over';if(!pass?.append){if(!region)mc.clearRect(0,0,mask.width,mask.height);mc.fillStyle='#000';mc.fillRect(x,y,w,h);if(pass?.base)mc.drawImage(pass.base,x,y,w,h,x,y,w,h);}
 mc.beginPath();mc.rect(x,y,w,h);mc.clip();mc.globalCompositeOperation='lighten';
 const material=s.watercolorMaterialVersion?watercolorMaterial(s):undefined,shape=outline(s),feather=material?material.feather+material.softness*(1-(s.hardness??.65)):s.watercolorStyle==='bloom'?.22:.025+.085*(1-(s.hardness??.65)),layers=s.watercolorStyle==='bloom'?4:2;
 const channels=(p:Point,d:number)=>{const pressure=s.pressure?pressureResponse(Math.pow(p.p,s.response),s.pressureCurve):1,width=s.pressure&&s.pressureWidth!==false||s.velocityTaper?widthResponse(pressure*(s.velocityTaper?p.v??1:1),s):1;const flow=(s.flow??.2)*(s.pressure&&s.pressureFlow?pressure:1)*(s.pressure&&s.pressureOpacity?opacityResponse(pressure,s):1)*(s.watercolorMaterialVersion===2?movementLoad(s,p):1);return {radius:s.size*.5*width*taperFactor(d,samples.total,s.taperStart,s.taperEnd,Math.max(64,s.size*12)),load:flow>=1?1:1-Math.pow(1-flow,3.6)};};
 const from=pass?.from??0,to=pass?.to??points.length;
 const segment=(a:Point,b:Point,ai:number,bi:number)=>{
  if(Math.max(a.x,b.x)+pad<x||Math.min(a.x,b.x)-pad>endX||Math.max(a.y,b.y)+pad<y||Math.min(a.y,b.y)-pad>endY)return;
  const ca=channels(a,samples.arc[ai]??0),cb=channels(b,samples.arc[bi]??0);if(Math.max(ca.radius,cb.radius)<.001)return;
  for(let layer=0;layer<layers;layer++){
   const t=(layer+1)/layers,k=1-feather*t,coverage=t*t*(3-2*t),ra=ca.radius*k,rb=cb.radius*k,polygon=hull([...shape.map(q=>({x:a.x+q.x*ra,y:a.y+q.y*ra})),...shape.map(q=>({x:b.x+q.x*rb,y:b.y+q.y*rb}))]);if(!polygon.length)continue;
   const aa=Math.round(255*ca.load*coverage),ba=Math.round(255*cb.load*coverage);
   if(Math.abs(aa-ba)>3&&Math.hypot(a.x-b.x,a.y-b.y)>.001){const gradient=mc.createLinearGradient(a.x,a.y,b.x,b.y);gradient.addColorStop(0,`rgb(${aa} ${aa} ${aa})`);gradient.addColorStop(1,`rgb(${ba} ${ba} ${ba})`);mc.fillStyle=gradient;}else{const load=Math.round((aa+ba)*.5);mc.fillStyle=`rgb(${load} ${load} ${load})`;}
   mc.beginPath();mc.moveTo(polygon[0].x,polygon[0].y);for(let j=1;j<polygon.length;j++)mc.lineTo(polygon[j].x,polygon[j].y);mc.closePath();mc.fill();
  }
 };
 if(from===0)segment(points[0],points[0],0,0);
 for(let i=Math.max(1,from);i<to;i++)segment(points[i-1],points[i],i-1,i);
 mc.restore();if(pass?.append)return;
 const pigment=s.watercolorMaterialVersion===2?strokePigment(s,samples):undefined;
 if(s.size>24){finishWatercolor(ctx,s,mask,x,y,w,h,true,pigment);finishPaper(ctx,s,x,y,w,h);return;}
 const a=alpha??=document.createElement('canvas');if(a.width!==mask.width)a.width=mask.width;if(a.height!==mask.height)a.height=mask.height;const ac=a.getContext('2d')!;if(!region)ac.clearRect(0,0,a.width,a.height);else ac.clearRect(x,y,w,h);const filter=paintColorFilter({...s,paintTipVersion:1,color:'#ffffff'});
 if(filter){ac.save();ac.filter=filter;ac.drawImage(mask,x,y,w,h,x,y,w,h);ac.restore();}else{const image=mc.getImageData(x,y,w,h);for(let i=0;i<image.data.length;i+=4){const value=image.data[i];image.data[i]=image.data[i+1]=image.data[i+2]=255;image.data[i+3]=value;}ac.putImageData(image,x,y);}
 finishWatercolor(ctx,s,a,x,y,w,h,false,pigment);finishPaper(ctx,s,x,y,w,h);
}
