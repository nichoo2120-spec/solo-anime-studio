import {applyNativeBrushMix} from './nativeBrushMix';
import {applyWetSmudge} from './wetSmudge';
import {applyGentleBlend} from './gentleBlend';
import {dryRasterPadding} from '../core/dryBrush';
import {applyBristleSmudge} from './bristleSmudge';
import {applyColorSmudge} from './colorSmudge';
import {applyColorBlend} from './colorBlend';
import {projectPoint} from './perspectiveWarp';
import type {Stroke} from '../core/model';
import {finalGeometry} from './geometryCache';
import type {RasterRegion} from './liveRaster';
/** Bounds include pressure envelopes, wet edges and transformed control points. */
export function strokeRasterBounds(s:Stroke,width:number,height:number):RasterRegion{
 const g=finalGeometry(s);let pad=(s.dryBristleVersion===1||s.dryBristleVersion===2||s.dryBristleVersion===3)?dryRasterPadding(s):s.brushKind==='airbrush'?s.size*1.4+9:s.size+8;let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(const p of [...g.points,...g.cubics.flatMap(c=>[c.c1,c.c2])]){left=Math.min(left,p.x);top=Math.min(top,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
 if(s.transform||s.perspective){const [a,b,c,d,e,f]=s.transform??[1,0,0,1,0,0],trace=a*a+b*b+c*c+d*d,det=a*d-b*c;pad*=Math.max(1,Math.sqrt((trace+Math.sqrt(Math.max(0,trace*trace-4*det*det)))*.5));const corners=[{x:left,y:top},{x:right,y:top},{x:left,y:bottom},{x:right,y:bottom}].map(p=>s.perspective?projectPoint(p,s.perspective):({x:a*p.x+c*p.y+e,y:b*p.x+d*p.y+f}));left=Math.min(...corners.map(p=>p.x));right=Math.max(...corners.map(p=>p.x));top=Math.min(...corners.map(p=>p.y));bottom=Math.max(...corners.map(p=>p.y));}
 const x=Math.max(0,Math.min(width,Math.floor(left-pad))),y=Math.max(0,Math.min(height,Math.floor(top-pad)));
 return {x,y,width:Math.max(0,Math.min(width,Math.ceil(right+pad))-x),height:Math.max(0,Math.min(height,Math.ceil(bottom+pad))-y)};
}
/** The layer boundary owns opacity. New watercolor modes never alter coverage
 * inside a stroke. Historical strokes and ordinary brushes use Canvas unchanged. */
export function compositePaintStroke(ctx:CanvasRenderingContext2D,source:HTMLCanvasElement,s:Stroke,sourceX=0,sourceY=0,region?:RasterRegion,blendBase?:HTMLCanvasElement){
 if(!!s.nativeMixVersion&&s.tool==='brush'){applyNativeBrushMix(ctx,source,s,sourceX,sourceY,region??strokeRasterBounds(s,ctx.canvas.width,ctx.canvas.height),blendBase);return;}
 if(s.smudgeVersion===3&&s.coloringEngine===1&&s.brushTip==='color-blender'&&s.tool!=='eraser'){applyGentleBlend(ctx,source,s,sourceX,sourceY,region??strokeRasterBounds(s,ctx.canvas.width,ctx.canvas.height),blendBase);return;}
 if(s.smudgeVersion===2&&s.coloringEngine===1&&s.brushTip==='color-blender'&&s.tool!=='eraser'){applyWetSmudge(ctx,source,s,sourceX,sourceY,region??strokeRasterBounds(s,ctx.canvas.width,ctx.canvas.height),blendBase);return;}
 if(s.coloringEngine===1&&s.brushTip==='color-blender'&&s.tool!=='eraser'){(s.coloringAppearanceVersion===3?applyBristleSmudge:s.coloringAppearanceVersion===2?applyColorSmudge:applyColorBlend)(ctx,source,s,sourceX,sourceY,region??strokeRasterBounds(s,ctx.canvas.width,ctx.canvas.height),blendBase);return;}
 if(s.tool==='eraser'||s.watercolorEngine!==1||!s.watercolorMode||s.watercolorMode==='glaze'){
  ctx.save();ctx.globalCompositeOperation=s.tool==='eraser'?'destination-out':'source-over';ctx.globalAlpha=s.opacity;
  if(region){const r=region;if(r.width&&r.height)ctx.drawImage(source,r.x-sourceX,r.y-sourceY,r.width,r.height,r.x,r.y,r.width,r.height);}else ctx.drawImage(source,sourceX,sourceY);ctx.restore();return;
 }
 const r=region??strokeRasterBounds(s,ctx.canvas.width,ctx.canvas.height),x=Math.max(r.x,sourceX),y=Math.max(r.y,sourceY),right=Math.min(r.x+r.width,sourceX+source.width,ctx.canvas.width),bottom=Math.min(r.y+r.height,sourceY+source.height,ctx.canvas.height),w=right-x,h=bottom-y;
 if(w<=0||h<=0||s.opacity<=0)return;
 const src=source.getContext('2d')!.getImageData(x-sourceX,y-sourceY,w,h).data,dest=ctx.getImageData(x,y,w,h),data=dest.data,wet=Math.max(0,Math.min(1,s.waterAmount??.4));
 for(let i=0;i<data.length;i+=4){const a=src[i+3]/255*s.opacity;if(a<=0)continue;const d=data[i+3]/255;
  if(d===0){data[i]=src[i];data[i+1]=src[i+1];data[i+2]=src[i+2];data[i+3]=Math.round(a*255);continue;}
  const union=d+a*(1-d),same=(data[i]-src[i])**2+(data[i+1]-src[i+1])**2+(data[i+2]-src[i+2])**2<=144;
  if(s.watercolorMode==='even'&&!same){for(let j=0;j<3;j++)data[i+j]=Math.round((src[i+j]*a+data[i+j]*d*(1-a))/union);data[i+3]=Math.round(union*255);continue;}
  const coverage=s.watercolorMode==='even'?Math.max(d,a):Math.max(d,a)+(union-Math.max(d,a))*(.12+.35*(1-wet));
  const t=a/(a+d);for(let j=0;j<3;j++)data[i+j]=Math.round(data[i+j]+(src[i+j]-data[i+j])*t);data[i+3]=Math.round(coverage*255);
 }
 ctx.putImageData(dest,x,y);
}
