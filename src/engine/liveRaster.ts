import {LiveDryBristleV3} from './dryBristleV3';
import {LiveDryBristleV2} from './dryBristleV2';
import {strokeRasterBounds} from './paintCompositing';
import {tintMix,MixColorRaster,mixColorChangeRegion} from './mixing';
import {LivePaintingRaster} from './LivePaintingRaster';
import type {Stroke,Point} from '../core/model';
import {drawModernStroke} from './brushRaster';
import type {Cubic} from './strokeGeometry';
import {strokeGeometry} from './strokeGeometry';
import {paintSamples} from './paintPass';
import {paintColorFilter} from './paintColorFilter';
export type RasterRegion={x:number;y:number;width:number;height:number};
const samePoint=(a:Point,b:Point)=>a.x===b.x&&a.y===b.y&&a.p===b.p&&a.v===b.v;
const sameCurve=(a:Cubic,b:Cubic)=>samePoint(a.a,b.a)&&samePoint(a.c1,b.c1)&&samePoint(a.c2,b.c2)&&samePoint(a.b,b.b);
/** Retain unchanged pixels. Invalidate the union of the old/new curve tail,
 * including the moving end-taper footprint. Full redraw on reflow/unknown data. */
export class LiveStrokeRaster{
 private mixColors?:MixColorRaster;private mixGeometry?:ReturnType<typeof strokeGeometry>;private mixId='';
 private painting=new LivePaintingRaster();private dryV2=new LiveDryBristleV2();private dryV3=new LiveDryBristleV3();private unmixed?:LiveStrokeRaster;private mixSurface?:HTMLCanvasElement;
 private id='';private previous?:ReturnType<typeof strokeGeometry>;private hadSingle=false;
 private settled?:HTMLCanvasElement;private paintMask?:HTMLCanvasElement;private settledCurves=0;
 private filtered=false;
 /** Area changed on the scratch surface by the last paint. Undefined means full canvas. */
 lastRegion?:RasterRegion;
 reset(){this.dryV2.reset();this.dryV3.reset();this.mixColors?.reset();this.mixColors=undefined;this.mixGeometry=undefined;this.mixId='';this.unmixed?.reset();this.unmixed=undefined;if(this.mixSurface)this.mixSurface.width=this.mixSurface.height=0;this.mixSurface=undefined;this.painting.reset();this.id='';this.previous=undefined;this.lastRegion=undefined;this.settledCurves=0;for(const c of [this.settled,this.paintMask])if(c)c.width=c.height=0;this.settled=this.paintMask=undefined;}
 paint(ctx:CanvasRenderingContext2D,stroke:Stroke,geometry:ReturnType<typeof strokeGeometry>){
  if(stroke.mixStops?.length&&stroke.mixVersion===2){
   const surface=this.mixSurface??=document.createElement('canvas');if(surface.width!==ctx.canvas.width)surface.width=ctx.canvas.width;if(surface.height!==ctx.canvas.height)surface.height=ctx.canvas.height;
   const raw=this.unmixed??=new LiveStrokeRaster();raw.paint(surface.getContext('2d')!,{...stroke,mixStops:undefined},geometry);
   let dirty=raw.lastRegion;
   // Native ink redraws its full alpha path to avoid clip tessellation seams.
   // Its unchanged curve prefix still permits a cropped colour update.
   const old=this.mixGeometry;if(!dirty&&this.mixId===stroke.id&&old?.cubics.length&&geometry.cubics.length){let prefix=0;while(prefix<Math.min(old.cubics.length,geometry.cubics.length)&&sameCurve(old.cubics[prefix],geometry.cubics[prefix]))prefix++;for(const list of [old.cubics,geometry.cubics]){let i=list.length,travel=0;const span=Math.max(64,stroke.size*12)*(stroke.taperEnd??0);while(i>0&&travel<span){i--;travel+=Math.hypot(list[i].b.x-list[i].a.x,list[i].b.y-list[i].a.y);}prefix=Math.min(prefix,i);}if(prefix){let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;for(const c of [...old.cubics.slice(prefix),...geometry.cubics.slice(prefix)])for(const p of [c.a,c.c1,c.c2,c.b]){left=Math.min(left,p.x);top=Math.min(top,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}if(Number.isFinite(left))dirty={x:Math.max(0,Math.floor(left-stroke.size)),y:Math.max(0,Math.floor(top-stroke.size)),width:Math.ceil(right-left+stroke.size*2),height:Math.ceil(bottom-top+stroke.size*2)};}}
   let region:RasterRegion|undefined;if(dirty&&this.mixId===stroke.id&&this.mixColors){const color=mixColorChangeRegion(this.mixColors.stops,stroke.mixStops,stroke.size,ctx.canvas.width,ctx.canvas.height);if(color!==undefined){const x=Math.min(dirty.x,color?.x??dirty.x),y=Math.min(dirty.y,color?.y??dirty.y),right=Math.max(dirty.x+dirty.width,color?color.x+color.width:0),bottom=Math.max(dirty.y+dirty.height,color?color.y+color.height:0);region={x,y,width:Math.max(0,Math.min(ctx.canvas.width,right)-x),height:Math.max(0,Math.min(ctx.canvas.height,bottom)-y)};}}
   if(region){ctx.clearRect(region.x,region.y,region.width,region.height);ctx.drawImage(surface,region.x,region.y,region.width,region.height,region.x,region.y,region.width,region.height);}else{ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.drawImage(surface,0,0);}
   tintMix(ctx,stroke,region,this.mixColors??=new MixColorRaster());this.mixGeometry=geometry;this.mixId=stroke.id;this.lastRegion=region??strokeRasterBounds(stroke,ctx.canvas.width,ctx.canvas.height);return this.lastRegion.width*this.lastRegion.height;
  }
  if(stroke.mixStops?.length){const surface=this.mixSurface??=document.createElement('canvas');if(surface.width!==ctx.canvas.width)surface.width=ctx.canvas.width;if(surface.height!==ctx.canvas.height)surface.height=ctx.canvas.height;const raw=this.unmixed??=new LiveStrokeRaster();raw.paint(surface.getContext('2d')!,{...stroke,mixStops:undefined},geometry);ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.drawImage(surface,0,0);tintMix(ctx,stroke);this.lastRegion=undefined;return ctx.canvas.width*ctx.canvas.height;}
  if(stroke.dryBristleVersion===3){const pixels=this.dryV3.paint(ctx,stroke,geometry);this.lastRegion=this.dryV3.lastRegion;return pixels;}
  if(stroke.dryBristleVersion===2){const pixels=this.dryV2.paint(ctx,stroke,geometry);this.lastRegion=this.dryV2.lastRegion;return pixels;}
  if(stroke.paintTipVersion===2){const pixels=this.painting.paint(ctx,stroke,geometry);this.lastRegion=this.painting.lastRegion;return pixels;}
  const old=this.previous,curves=geometry.cubics;let prefix=0;
  if(this.id===stroke.id&&old&&!this.hadSingle&&curves.length){while(prefix<Math.min(old.cubics.length,curves.length)&&sameCurve(old.cubics[prefix],curves[prefix]))prefix++;
   // Endpoint chord lengths are lower bounds on arc lengths: this conservatively
   // includes at least the entire old and new end-taper region.
   const endLength=Math.max(64,stroke.size*12)*(stroke.taperEnd??0);
   for(const list of [old.cubics,curves]){let i=list.length,travel=0;while(i>0&&travel<endLength){i--;travel+=Math.hypot(list[i].b.x-list[i].a.x,list[i].b.y-list[i].a.y);}prefix=Math.min(prefix,i);}
  }
  if(stroke.paintTipVersion===1&&old&&old.cubics.reduce((n,c)=>n+Math.hypot(c.b.x-c.a.x,c.b.y-c.a.y),0)<.5)prefix=0;
  let region:RasterRegion|undefined;
  const native=stroke.paintTipVersion!==1&&((stroke.flatNibVersion===1&&!stroke.textureStrength&&!(stroke.pressure&&stroke.pressureOpacity))||(stroke.engineVersion===10&&stroke.size>=64&&!stroke.pressureOpacity&&!stroke.textureStrength&&['technical','eraser-hard','g-pen','mapping','brush-pen','flat'].includes(stroke.brushKind??'technical'))||!stroke.pressureOpacity&&!stroke.taperStart&&!stroke.taperEnd&&!(stroke.pressure&&stroke.pressureWidth!==false)&&!stroke.velocityTaper&&(!stroke.brushKind||stroke.brushKind==='technical'||stroke.brushKind==='eraser-hard'));
  // Both pressure nibs and ordinary ink can repaint only the changed tail.
  // Native Canvas stroke tessellation changes at clip boundaries. Redraw those
  // paths on the full scratch surface so preview and full rendering agree.
  const pencil=stroke.engineVersion===9&&!!stroke.brushKind?.startsWith('graphite-');
  // Graphite uses round contact with radius at most half the brush size.
  // Keep the same path/taper window, but avoid processing a full diameter of
  // empty paper on every side of that window.
  const compactNib=pencil||stroke.paintTipVersion!==1&&stroke.paintNibVersion===1&&['paint','marker','eraser-soft','dry-round','watercolor'].includes(stroke.brushKind??'');
  if(!native&&this.id===stroke.id&&old&&!this.hadSingle&&curves.length&&prefix>0){const points=[...old.cubics.slice(prefix),...curves.slice(prefix)].flatMap(c=>[c.a,c.c1,c.c2,c.b]),pad=stroke.size*(compactNib?.5:1)+4;if(points.length){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of points){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}const x=Math.max(0,Math.floor(minX-pad)),y=Math.max(0,Math.floor(minY-pad));region={x,y,width:Math.max(0,Math.min(ctx.canvas.width,Math.ceil(maxX+pad))-x),height:Math.max(0,Math.min(ctx.canvas.height,Math.ceil(maxY+pad))-y)};}}
  const maskedInk=stroke.engineVersion===10&&['technical','eraser-hard','g-pen','mapping','brush-pen'].includes(stroke.brushKind??'')&&(stroke.pressure&&stroke.pressureOpacity||!!stroke.textureStrength);
  const cachedMask=(stroke.paintTipVersion===1||pencil||(maskedInk||stroke.paintNibVersion===1&&['paint','marker','eraser-soft','dry-round','dry-grain','watercolor'].includes(stroke.brushKind??''))&&stroke.size>=32)&&(!stroke.taperStart||pencil||stroke.paintTipVersion===1)&&!stroke.perspective&&!stroke.transform&&(stroke.paintTipVersion===1||pencil||!stroke.pressure||stroke.pressureWidth===false||stroke.size*(stroke.minSize??.06)>=1.5);
  if(cachedMask&&curves.length){
   const filtered=!!paintColorFilter(stroke);if(filtered!==this.filtered){for(const c of [this.settled,this.paintMask])if(c)c.width=c.height=0;this.settled=this.paintMask=undefined;this.settledCurves=0;this.filtered=filtered;}
   const settled=this.settled??=document.createElement('canvas'),mask=this.paintMask??=document.createElement('canvas');
   const reset=this.id!==stroke.id||prefix<this.settledCurves||settled.width!==ctx.canvas.width||settled.height!==ctx.canvas.height;
   if(reset){settled.width=ctx.canvas.width;settled.height=ctx.canvas.height;const sc=settled.getContext('2d',filtered?undefined:{willReadFrequently:true})!;sc.fillStyle='#000';sc.fillRect(0,0,settled.width,settled.height);this.settledCurves=0;}
   if(mask.width!==ctx.canvas.width)mask.width=ctx.canvas.width;if(mask.height!==ctx.canvas.height)mask.height=ctx.canvas.height;
   const samples=paintSamples(geometry,stroke.paintTipVersion===1?.18:pencil?.5:['dry-round','dry-grain','watercolor'].includes(stroke.brushKind??'')?.8:.18);
   const end=(n:number)=>n?samples.ends[n-1]:0;
   if(prefix>this.settledCurves){drawModernStroke(ctx,stroke,'live',geometry,undefined,{samples,from:end(this.settledCurves),to:end(prefix),mask:settled,append:true});this.settledCurves=prefix;}
   if(region)ctx.clearRect(region.x,region.y,region.width,region.height);else ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
   if(!region||region.width&&region.height)drawModernStroke(ctx,stroke,'live',geometry,region,{samples,from:end(this.settledCurves),to:samples.points.length,mask,base:settled});
  }else if(region){if(region.width&&region.height){ctx.clearRect(region.x,region.y,region.width,region.height);drawModernStroke(ctx,stroke,'live',geometry,region);}}
  else{ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);drawModernStroke(ctx,stroke,'live',geometry);}
  this.id=stroke.id;this.previous=geometry;this.hadSingle=!curves.length;this.lastRegion=region;return region?region.width*region.height:ctx.canvas.width*ctx.canvas.height;
 }
}
