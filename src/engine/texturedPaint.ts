import type {Stroke,Point} from '../core/model';
import {pressureResponse,taperFactor,type strokeGeometry} from './strokeGeometry';
import {widthResponse,opacityResponse} from './pressureChannels';
import {paintSamples,type PaintPass,type PaintSamples} from './paintPass';
import {paintTipStamp,paintPaperPattern} from './texturedPaintTip';
import {erodeWatercolorGrain} from './watercolorGrain';
import {paintColorFilter} from './paintColorFilter';
import type {RasterRegion} from './liveRaster';
let pooled:HTMLCanvasElement|undefined,colorSurface:HTMLCanvasElement|undefined;
type Dab={point:Point;distance:number;radius:number;opacity:number;index:number};
const dabCache=new WeakMap<PaintSamples,{key:string;dabs:Dab[];tip:Dab}>();
let liveDabs:{key:string;samples:PaintSamples;dabs:Dab[]}|undefined;
export function drawTexturedPaint(ctx:CanvasRenderingContext2D,s:Stroke,g:ReturnType<typeof strokeGeometry>,region?:RasterRegion,pass?:PaintPass){
 const tip=s.brushTip;if(!tip||tip==='round')return;
 const samples=pass?.samples??paintSamples(g,.18),points=samples.points;if(!points.length)return;
 const pad=Math.ceil(s.size*.75+4);let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const p of points){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
 const x=Math.max(0,Math.floor(Math.max(minX-pad,region?.x??0))),y=Math.max(0,Math.floor(Math.max(minY-pad,region?.y??0))),right=Math.min(ctx.canvas.width,Math.ceil(Math.min(maxX+pad,region?region.x+region.width:ctx.canvas.width))),bottom=Math.min(ctx.canvas.height,Math.ceil(Math.min(maxY+pad,region?region.y+region.height:ctx.canvas.height))),w=right-x,h=bottom-y;if(w<=0||h<=0)return;
 const filter=paintColorFilter(s),mask=pass?.mask??(pooled??=document.createElement('canvas'));if(mask.width!==ctx.canvas.width)mask.width=ctx.canvas.width;if(mask.height!==ctx.canvas.height)mask.height=ctx.canvas.height;
 const mc=mask.getContext('2d',{alpha:false,...(filter?{}:{willReadFrequently:true})})!;mc.save();mc.globalAlpha=1;mc.globalCompositeOperation='source-over';if(!pass?.append){if(pass?.base)mc.drawImage(pass.base,x,y,w,h,x,y,w,h);else{mc.fillStyle='#000';mc.fillRect(x,y,w,h);}}mc.globalCompositeOperation='lighten';
 const texture=s.textureStrength??.5,angle=(s.tipAngle??0)*Math.PI/180;
 const channels=(p:Point,d:number)=>{const value=s.pressure?pressureResponse(Math.pow(p.p,s.response),s.pressureCurve):1,factor=s.pressure&&s.pressureWidth!==false||s.velocityTaper?widthResponse(value*(s.velocityTaper?p.v??1:1),s):1;return {radius:s.size*.5*factor*taperFactor(d,samples.total,s.taperStart,s.taperEnd,Math.max(64,s.size*12)),opacity:s.pressure&&s.pressureOpacity?opacityResponse(value,s):1};};
 // Arc-based spacing is independent of event count. Advance every canonical
 // dab, even when painting only a settled prefix or a clipped working tail.
 const key=JSON.stringify({...s,points:undefined});let prepared=dabCache.get(samples);
 if(!prepared||prepared.key!==key){let dabs:Dab[]=[];let next=0,startIndex=1;
  if(pass&&liveDabs?.key===key&&samples.total>=.5&&liveDabs.samples.total>=.5){
   const old=liveDabs.samples;let prefix=0;while(prefix<Math.min(points.length,old.points.length)){const a=points[prefix],b=old.points[prefix];if(a.x!==b.x||a.y!==b.y||a.p!==b.p||a.v!==b.v)break;prefix++;}
   const endSpan=Math.max(64,s.size*12)*(s.taperEnd??0),stable=Math.min(samples.arc[prefix-1]??0,old.arc[prefix-1]??0,samples.total-endSpan,old.total-endSpan);
   let count=0;while(count<liveDabs.dabs.length&&liveDabs.dabs[count].distance<stable-1e-7)count++;dabs=liveDabs.dabs.slice(0,count);const last=dabs.at(-1);if(last){next=last.distance+Math.max(.25,last.radius*2*(s.tipSpacing??.08));startIndex=Math.max(1,last.index);}
  }
  if(points.length===1)dabs.push({point:points[0],distance:0,index:0,...channels(points[0],0)});
  for(let i=startIndex;i<points.length;i++){const a=points[i-1],b=points[i],start=samples.arc[i-1],length=samples.arc[i]-start;if(length<.00001)continue;
   while(next<=samples.arc[i]+1e-7){const t=Math.max(0,Math.min(1,(next-start)/length)),point={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,p:a.p+(b.p-a.p)*t,v:(a.v??1)+((b.v??1)-(a.v??1))*t},value=channels(point,next);dabs.push({point,distance:next,index:next===0?0:i,...value});next+=Math.max(.25,value.radius*2*(s.tipSpacing??.08));}
  }
  const point=points.at(-1)!;prepared={key,dabs,tip:{point,distance:samples.total,index:points.length-1,...channels(point,samples.total)}};dabCache.set(samples,prepared);if(pass)liveDabs={key,samples,dabs};
 }
 const dab=({point:p,distance:d,radius,opacity}:Dab)=>{if(radius<.001||opacity<=0||p.x<x-pad||p.x>right+pad||p.y<y-pad||p.y>bottom+pad)return;const variant=Math.floor(d/Math.max(1,s.size*.7))%3,nib=paintTipStamp(tip,texture,opacity,variant,angle),d2=radius*2;mc.drawImage(nib.canvas,p.x+nib.x*d2,p.y+nib.y*d2,nib.w*d2,nib.h*d2);};
 for(const p of prepared.dabs)if(p.index>=(pass?.from??0)&&p.index<(pass?.to??points.length))dab(p);
 // This moving endpoint is never baked into the settled mask.
 if(!pass?.append)dab(prepared.tip);
 mc.restore();if(pass?.append)return;
 const color=colorSurface??=document.createElement('canvas');if(color.width!==w)color.width=w;if(color.height!==h)color.height=h;const cc=color.getContext('2d')!;cc.save();cc.clearRect(0,0,w,h);
 if(filter){cc.filter=filter;cc.drawImage(mask,x,y,w,h,0,0,w,h);cc.filter='none';}
 else{const img=mc.getImageData(x,y,w,h),rgb=s.color.slice(1).match(/../g)!.map(v=>parseInt(v,16));for(let i=0;i<img.data.length;i+=4){const a=img.data[i];img.data[i]=rgb[0];img.data[i+1]=rgb[1];img.data[i+2]=rgb[2];img.data[i+3]=a;}cc.putImageData(img,0,0);}
 if(tip==='wash')erodeWatercolorGrain(cc,texture,x,y,w,h);
 else if(texture>0){cc.globalCompositeOperation='destination-out';cc.globalAlpha=Math.min(1,texture);cc.fillStyle=cc.createPattern(paintPaperPattern(tip),'repeat')!;cc.translate(-x,-y);cc.fillRect(x,y,w,h);}cc.restore();ctx.drawImage(color,0,0,w,h,x,y,w,h);
}
