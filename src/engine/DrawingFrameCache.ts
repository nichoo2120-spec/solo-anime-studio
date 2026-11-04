import type {Project,Stroke,Layer} from '../core/model';
import type {View} from '../core/geometry';
import {blendOperation,type LayerRenderer} from './renderer';
import type {strokeGeometry} from './strokeGeometry';
import type {RasterRegion} from './liveRaster';
import {dryRasterPadding} from '../core/dryBrush';

type Geometry=ReturnType<typeof strokeGeometry>;
export type DrawingFrameKey={project:Project;renderer:LayerRenderer;revision:number;target:string;width:number;height:number;dpr:number;view:View};
const sameKey=(a:DrawingFrameKey,b:DrawingFrameKey)=>a.project===b.project&&a.renderer===b.renderer&&a.revision===b.revision&&a.target===b.target&&a.width===b.width&&a.height===b.height&&a.dpr===b.dpr&&a.view.x===b.view.x&&a.view.y===b.view.y&&a.view.zoom===b.view.zoom&&a.view.rotation===b.view.rotation;
const sameView=(a:DrawingFrameKey,b:DrawingFrameKey)=>a.project.id===b.project.id&&a.project.width===b.project.width&&a.project.height===b.project.height&&a.renderer===b.renderer&&a.revision===b.revision&&a.width===b.width&&a.height===b.height&&a.dpr===b.dpr&&a.view.x===b.view.x&&a.view.y===b.view.y&&a.view.zoom===b.view.zoom&&a.view.rotation===b.view.rotation;

/** Integer device-pixel clip: filtering and page-edge antialiasing must not
 * acquire a second fractional clip boundary while a stroke grows. */
export function drawingScreenRegion(region:RasterRegion,view:View,dpr:number,width:number,height:number):RasterRegion{
 const co=Math.cos(view.rotation)*view.zoom,si=Math.sin(view.rotation)*view.zoom;
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(const x of [region.x,region.x+region.width])for(const y of [region.y,region.y+region.height]){
  const X=(view.x+co*x-si*y)*dpr,Y=(view.y+si*x+co*y)*dpr;left=Math.min(left,X);right=Math.max(right,X);top=Math.min(top,Y);bottom=Math.max(bottom,Y);
 }
 const x=Math.max(0,Math.min(width,Math.floor(left)-3)),y=Math.max(0,Math.min(height,Math.floor(top)-3));
 return{x,y,width:Math.max(0,Math.min(width,Math.ceil(right)+3)-x),height:Math.max(0,Math.min(height,Math.ceil(bottom)+3)-y)};
}

/** Retain the exact pixels below the drawing layer. Upper layers keep their
 * individual existing caches and blend operations; flattening them together
 * would change multiply/screen/opacity against the newly painted pixels. */
export class DrawingFrameCache{
 private key?:DrawingFrameKey;
 private prefix?:HTMLCanvasElement;
 private prefixReady=false;
 private lastStroke='';
 private geometry?:Geometry;
 private below=new Set<string>();
 private above=new Set<string>();
 private ink=new Map<string,{surface:HTMLCanvasElement;ready:boolean;layer?:Layer}>();
 private captured=false;
 private readonly maxBytes=128*1024*1024;

 invalidate(){this.key=undefined;this.prefixReady=false;this.lastStroke='';this.geometry=undefined;this.below.clear();this.above.clear();for(const c of this.ink.values())c.ready=false;}
 clear(){this.invalidate();if(this.prefix)this.prefix.width=this.prefix.height=0;this.prefix=undefined;for(const c of this.ink.values())c.surface.width=c.surface.height=0;this.ink.clear();}

 private prepare(key:DrawingFrameKey){
  const compatible=!!this.key&&sameKey(this.key,key);
  if(!compatible){
   const old=this.key,stable=!!old&&sameView(old,key),index=key.project.layers.findIndex(l=>l.id===key.target),below=key.project.layers.slice(index+1),oldBelow=old?.project.layers.slice(old.project.layers.findIndex(l=>l.id===old.target)+1);
   // A warm frame is only safe when its exact immutable project snapshot
   // still owns the cached pixels. Layer identity alone is insufficient:
   // committing a stroke can replace a project while retaining lower layers.
   // Never display a prefix captured under another snapshot on first pen-down.
   this.prefixReady=this.prefixReady&&!!old&&old.project===key.project&&stable&&old.target===key.target&&!!oldBelow&&below.length===oldBelow.length&&below.every((l,i)=>l===oldBelow[i]);
   this.below=new Set(below.map(l=>l.id));this.above=new Set(key.project.layers.slice(0,index).map(l=>l.id));
   for(const [id,c]of this.ink){if(!this.above.has(id)||c.surface.width!==key.width||c.surface.height!==key.height){c.surface.width=c.surface.height=0;this.ink.delete(id);}else c.ready=c.ready&&stable&&c.layer===key.project.layers.find(l=>l.id===id);}
  }
  this.key={...key,view:{...key.view}};this.captured=false;
  return compatible;
 }
 /** Capture already-rendered static ink at idle, with no extra scene render. */
 warm(key:DrawingFrameKey){this.prepare(key);this.lastStroke='';this.geometry=undefined;}
 begin(key:DrawingFrameKey,stroke:Stroke,geometry:Geometry,rasterRegion?:RasterRegion){
  const compatible=this.prepare(key),previous=compatible&&this.lastStroke===stroke.id?this.geometry:undefined;
  if(!previous)return undefined;
  let region=rasterRegion;
  if(!region){
   const pad=stroke.dryBristleVersion?dryRasterPadding(stroke):stroke.size*Math.max(1,stroke.maxSize??1)+8;
   const equalPoint=(a:{x:number;y:number;p:number;v?:number},b:typeof a)=>a.x===b.x&&a.y===b.y&&a.p===b.p&&a.v===b.v;
   const curves=geometry.cubics,old=previous?.cubics??[];let prefix=0;
   while(prefix<Math.min(old.length,curves.length)){const a=old[prefix],b=curves[prefix];if(!equalPoint(a.a,b.a)||!equalPoint(a.c1,b.c1)||!equalPoint(a.c2,b.c2)||!equalPoint(a.b,b.b))break;prefix++;}
   // Native joins can change at the last common segment. Keep two complete
   // common segments and both moving end tapers, rather than the whole stroke.
   prefix=Math.max(0,prefix-2);
   const length=(g:Geometry)=>g.cubics.reduce((n,c)=>n+Math.hypot(c.b.x-c.a.x,c.b.y-c.a.y),0),local=stroke.engineVersion===10&&stroke.size>=64&&!stroke.pressureOpacity;
   const span=(g:Geometry)=>local?Math.min(length(g)*.45,Math.max(32,stroke.size*2)):Math.max(64,stroke.size*12);
   if(previous&&stroke.taperStart&&local&&span(previous)!==span(geometry))prefix=0;
   for(const g of previous?[previous,geometry]:[geometry]){let i=g.cubics.length,travel=0;while(i>0&&travel<span(g)*(stroke.taperEnd??0)){i--;travel+=Math.hypot(g.cubics[i].b.x-g.cubics[i].a.x,g.cubics[i].b.y-g.cubics[i].a.y);}prefix=Math.min(prefix,Math.max(0,i-2));}
   let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
   for(const g of previous?[previous,geometry]:[geometry]){
    const points=g.cubics.length?g.cubics.slice(prefix).flatMap(c=>[c.a,c.c1,c.c2,c.b]):g.points;
    for(const p of points){left=Math.min(left,p.x);top=Math.min(top,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
   }
   if(!Number.isFinite(left))return undefined;
   region={x:left-pad,y:top-pad,width:right-left+pad*2,height:bottom-top+pad*2};
  }
  return drawingScreenRegion(region,key.view,key.dpr,key.width,key.height);
 }

 restore(ctx:CanvasRenderingContext2D,region?:RasterRegion){
  if(!this.prefixReady||!this.prefix)return undefined;
  ctx.save();ctx.resetTransform();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  // Integer-pixel clear + source-over preserves the prefix's exact alpha,
  // without the copy blend mode's expensive isolated Canvas layer.
  if(region){if(region.width&&region.height){ctx.clearRect(region.x,region.y,region.width,region.height);ctx.drawImage(this.prefix,region.x,region.y,region.width,region.height,region.x,region.y,region.width,region.height);}}
  else{ctx.clearRect(0,0,this.prefix.width,this.prefix.height);ctx.drawImage(this.prefix,0,0);}
  ctx.restore();return this.below;
 }

 capture(ctx:CanvasRenderingContext2D){
  if(this.prefixReady||!this.key||this.key.width*this.key.height*4>this.maxBytes)return;
  let bytes=this.key.width*this.key.height*4+[...this.ink.values()].reduce((n,c)=>n+c.surface.width*c.surface.height*4,0);
  for(const [id,c]of [...this.ink].reverse()){if(bytes<=256*1024*1024)break;bytes-=c.surface.width*c.surface.height*4;c.surface.width=c.surface.height=0;this.ink.delete(id);}
  const c=this.prefix??=document.createElement('canvas');if(c.width!==this.key.width)c.width=this.key.width;if(c.height!==this.key.height)c.height=this.key.height;
  const out=c.getContext('2d')!;out.resetTransform();out.globalAlpha=1;out.globalCompositeOperation='copy';out.drawImage(ctx.canvas,0,0);out.globalCompositeOperation='source-over';this.prefixReady=true;this.captured=true;
 }

 /** Retain exact display-resolution ink, before layer opacity/blending, so
  * walking several upper layers cannot evict the live layer's ink cache. */
 rememberInk(layer:string,source:HTMLCanvasElement|undefined){
  if(!source||!this.key||!this.above.has(layer))return;
  let entry=this.ink.get(layer);if(entry?.ready)return;
  const bytes=source.width*source.height*4;let total=(this.prefix?.width??0)*(this.prefix?.height??0)*4+bytes;
  for(const [id,c]of this.ink)if(id!==layer)total+=c.surface.width*c.surface.height*4;
  if(total>256*1024*1024)return;
  if(!entry){entry={surface:document.createElement('canvas'),ready:false};this.ink.set(layer,entry);}
  const c=entry.surface;if(c.width!==source.width)c.width=source.width;if(c.height!==source.height)c.height=source.height;
  const out=c.getContext('2d')!;out.globalAlpha=1;out.globalCompositeOperation='copy';out.drawImage(source,0,0);out.globalCompositeOperation='source-over';entry.ready=true;entry.layer=this.key.project.layers.find(l=>l.id===layer);
 }

 paintInk(ctx:CanvasRenderingContext2D,layer:Layer){
  const entry=this.ink.get(layer.id);if(!entry?.ready||!this.above.has(layer.id))return false;
  ctx.save();ctx.resetTransform();ctx.globalAlpha=layer.opacity;ctx.globalCompositeOperation=blendOperation(layer.blend);ctx.drawImage(entry.surface,0,0);ctx.restore();return true;
 }

 finish(stroke:Stroke,geometry:Geometry){this.lastStroke=stroke.id;this.geometry=geometry;}
 status(){return{bytes:(this.prefix?.width??0)*(this.prefix?.height??0)*4+[...this.ink.values()].reduce((n,c)=>n+c.surface.width*c.surface.height*4,0),ready:this.prefixReady,captured:this.captured};}
}
