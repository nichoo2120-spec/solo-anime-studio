import type {Stroke} from '../core/model';
import {strokeGeometry} from './strokeGeometry';
import {drawSolidInkV10} from './solidInkV10';
import {drawFlatInk} from './flatInk';
type Geometry=ReturnType<typeof strokeGeometry>;
type Job={token:number;width:number;height:number;matrix:[number,number,number,number,number,number];parts:{stroke:Stroke;geometry?:Geometry}[];base?:ImageBitmap};
const native=(s:Stroke)=>!s.inkProfileVersion&&!s.inkTipVersion&&!s.pressureOpacity&&!s.taperStart&&!s.taperEnd&&!(s.pressure&&s.pressureWidth!==false)&&!s.velocityTaper&&['technical','eraser-hard'].includes(s.brushKind??'technical');
function draw(ctx:OffscreenCanvasRenderingContext2D,s:Stroke,g:Geometry,quality:number){
 if(!g.points.length)return;ctx.save();if(s.transform)ctx.transform(...s.transform);
 if(native(s)){ctx.fillStyle=ctx.strokeStyle=s.color;const p=new Path2D();if(!g.cubics.length){p.arc(g.points[0].x,g.points[0].y,s.size/2,0,Math.PI*2);ctx.fill(p);}else{p.moveTo(g.points[0].x,g.points[0].y);for(const c of g.cubics)p.bezierCurveTo(c.c1.x,c.c1.y,c.c2.x,c.c2.y,c.b.x,c.b.y);ctx.lineWidth=s.size;ctx.lineCap=ctx.lineJoin='round';ctx.stroke(p);}}
 else{const paths:Path2D[]=[];if(s.flatNibVersion===1)drawFlatInk(ctx as unknown as CanvasRenderingContext2D,s,g,undefined,quality,paths);else drawSolidInkV10(ctx as unknown as CanvasRenderingContext2D,s,g,undefined,quality,paths);ctx.fillStyle=s.color;for(const p of paths)ctx.fill(p);}
 ctx.restore();
}
/** Same display paths, transform and isolated opacity as InkDisplay. Finishing a
 * wheel gesture must not block the UI while these contours are reconstructed. */
self.onmessage=({data:j}:MessageEvent<Job>)=>{try{
 const out=new OffscreenCanvas(j.width,j.height),ctx=out.getContext('2d')!,scale=Math.hypot(j.matrix[0],j.matrix[1]),quality=Math.max(1,Math.ceil(scale*2-1e-6)/2);let mask:OffscreenCanvas|undefined;
 if(j.base){ctx.setTransform(...j.matrix);ctx.imageSmoothingEnabled=scale<=1+1e-7;ctx.imageSmoothingQuality='high';ctx.drawImage(j.base,0,0);ctx.resetTransform();}
 for(const {stroke:s,geometry} of j.parts){if(!s.opacity)continue;const g=geometry??strokeGeometry(s);
  if(native(s)||s.tool==='brush'&&s.opacity===1){ctx.setTransform(...j.matrix);ctx.globalAlpha=s.opacity;ctx.globalCompositeOperation=s.tool==='eraser'?'destination-out':'source-over';draw(ctx,s,g,quality);ctx.resetTransform();}
  else{mask??=new OffscreenCanvas(j.width,j.height);const mc=mask.getContext('2d')!;mc.resetTransform();mc.clearRect(0,0,j.width,j.height);mc.setTransform(...j.matrix);draw(mc,s,g,quality);ctx.globalAlpha=s.opacity;ctx.globalCompositeOperation=s.tool==='eraser'?'destination-out':'source-over';ctx.drawImage(mask,0,0);}
 }
 const bitmap=out.transferToImageBitmap();(self as unknown as Worker).postMessage({token:j.token,bitmap},[bitmap]);if(mask)mask.width=mask.height=0;
 }catch(error){(self as unknown as Worker).postMessage({token:j.token,error:String(error)});}finally{j.base?.close();}};

