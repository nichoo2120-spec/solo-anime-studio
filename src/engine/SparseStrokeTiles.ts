import type {Point,Stroke} from '../core/model';
import {drawModernStroke} from './brushRaster';
import {finalGeometry} from './geometryCache';
import {compositePaintStroke,strokeRasterBounds} from './paintCompositing';
import type {RasterRegion} from './liveRaster';
import {LivePaintingRaster} from './LivePaintingRaster';

const side=512,gutter=24,maxCachedTiles=48;
type Position={x:number;y:number};
type StrokeEntry={stroke:Stroke;geometry:ReturnType<typeof finalGeometry>};
type IndexedStroke={stroke:Stroke;tiles:string[]};
type Tile=Position&{entries:StrokeEntry[]};
type CachedTile={context:CanvasRenderingContext2D;painted:number};
type LiveTile={context:CanvasRenderingContext2D;base?:HTMLCanvasElement;valid:boolean;raster:LivePaintingRaster;ink:CanvasRenderingContext2D};
const key=(x:number,y:number)=>`${x}:${y}`;
const midpoint=(a:Position,b:Position)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const samePoint=(a:Point,b:Point)=>a.x===b.x&&a.y===b.y&&a.p===b.p&&a.v===b.v;
function surface(width:number,height:number){
 const canvas=document.createElement('canvas');
 canvas.width=width;canvas.height=height;
 return canvas.getContext('2d',{willReadFrequently:true})!;
}

/** Cache paint on demand in signed project coordinates. The editable strokes
 * are the source of truth, independent of the camera and the cache budget. */
export class SparseStrokeTiles{
 private readonly index=new Map<string,Tile>();
 private readonly cache=new Map<Tile,CachedTile>();
 private readonly history:IndexedStroke[]=[];
 private scratch?:CanvasRenderingContext2D;
 private preview?:CanvasRenderingContext2D;
 private previousPreview?:StrokeEntry;
 private readonly liveTiles=new Map<string,LiveTile>();
 constructor(private readonly page?:{width:number;height:number}){}

 append(stroke:Stroke){
  if(!supportsSparseStroke(stroke))throw Error('Brush is not supported by the sparse stroke renderer.');
  const entry={stroke,geometry:finalGeometry(stroke)},positions=this.strokeTiles(entry);
  for(const [id,position] of positions){
   let tile=this.index.get(id);
   if(!tile){tile={...position,entries:[]};this.index.set(id,tile);}
   tile.entries.push(entry);
   const live=this.liveTiles.get(id);if(live)live.valid=false;
  }
  this.history.push({stroke,tiles:[...positions.keys()]});
 }

 private strokeTiles({stroke,geometry}:StrokeEntry){
  const positions=new Map<string,Position>(),pad=stroke.size+12;
  const indexPart=(a:Position,b:Position,c:Position,d:Position)=>{
   const minX=Math.min(a.x,b.x,c.x,d.x),maxX=Math.max(a.x,b.x,c.x,d.x);
   const minY=Math.min(a.y,b.y,c.y,d.y),maxY=Math.max(a.y,b.y,c.y,d.y);
   if(maxX-minX>side||maxY-minY>side){
    const ab=midpoint(a,b),bc=midpoint(b,c),cd=midpoint(c,d);
    const abc=midpoint(ab,bc),bcd=midpoint(bc,cd),mid=midpoint(abc,bcd);
    indexPart(a,ab,abc,mid);indexPart(mid,bcd,cd,d);return;
   }
   for(let row=Math.floor((minY-pad)/side);row<=Math.floor((maxY+pad)/side);row++){
    for(let column=Math.floor((minX-pad)/side);column<=Math.floor((maxX+pad)/side);column++){
     const x=column*side,y=row*side;
     if(this.page&&x>=0&&y>=0&&x+side<=this.page.width&&y+side<=this.page.height)continue;
     positions.set(key(column,row),{x,y});
    }
   }
  };
  if(geometry.cubics.length){for(const c of geometry.cubics)indexPart(c.a,c.c1,c.c2,c.b);}
  else for(const p of geometry.points)indexPart(p,p,p,p);
  return positions;
 }

 /** Synchronize from a layer's immutable operations after undo, redo or edit. */
 synchronize(strokes:readonly Stroke[]){
  let prefix=0;
  while(prefix<this.history.length&&this.history[prefix].stroke===strokes[prefix])prefix++;
  for(let i=prefix;i<strokes.length;i++)if(!supportsSparseStroke(strokes[i]))throw Error('Brush is not supported by the sparse stroke renderer.');
  while(this.history.length>prefix){
   const previous=this.history.pop()!;
   for(const id of previous.tiles){
    const tile=this.index.get(id)!;
    tile.entries.pop();
    const live=this.liveTiles.get(id);if(live)live.valid=false;
    this.evict(tile);
    if(!tile.entries.length)this.index.delete(id);
   }
  }
  for(let i=prefix;i<strokes.length;i++)this.append(strokes[i]);
 }

 /** The target transform maps world coordinates to the viewer or shot crop. */
 paint(target:CanvasRenderingContext2D,region:RasterRegion,live?:Stroke){
  const right=region.x+region.width,bottom=region.y+region.height;
  const visible=(tile:Position)=>tile.x<right&&tile.x+side>region.x&&tile.y<bottom&&tile.y+side>region.y;
  const preview=live?{stroke:live,geometry:finalGeometry(live)}:undefined;
  this.updatePreviewCache(preview);
  const liveTiles=preview?this.strokeTiles(preview):undefined;
  const blit=(tile:Position,pixels:HTMLCanvasElement)=>target.drawImage(pixels,gutter,gutter,side,side,tile.x,tile.y,side,side);
  for(const [id,tile] of this.index){
   if(!visible(tile))continue;
   const base=this.raster(tile).canvas;
   blit(tile,preview&&liveTiles?.delete(id)?this.paintPreview(id,tile,preview,base):base);
  }
  if(preview&&liveTiles)for(const [id,tile] of liveTiles)if(visible(tile))blit(tile,this.paintPreview(id,tile,preview));
 }

 private updatePreviewCache(next:StrokeEntry|undefined){
  const previous=this.previousPreview;
  this.previousPreview=undefined;
  if(!next||next.stroke.coloringEngine!==1||next.stroke.taperEnd||
    (next.stroke.brushTip!=='color-soft'&&next.stroke.brushTip!=='color-solid')){this.clearLiveTiles();return;}
  this.previousPreview=next;
  if(previous?.stroke.id!==next.stroke.id){this.clearLiveTiles();return;}
  const old=previous.geometry.cubics,curves=next.geometry.cubics;
  let prefix=0;
  while(prefix<old.length&&prefix<curves.length){
   const a=old[prefix],b=curves[prefix];
   if(!samePoint(a.a,b.a)||!samePoint(a.c1,b.c1)||!samePoint(a.c2,b.c2)||!samePoint(a.b,b.b))break;
   prefix++;
  }
  if(!prefix){for(const tile of this.liveTiles.values())tile.valid=false;return;}
  // The last fitted curve can change its terminal dab when the path grows.
  // Include it in the repaint even if its control points were preserved.
  if(prefix===Math.min(old.length,curves.length))prefix--;
  for(const entry of [previous,next]){
   const tail={...entry.geometry,cubics:entry.geometry.cubics.slice(prefix)};
   for(const id of this.strokeTiles({stroke:entry.stroke,geometry:tail}).keys()){
    const tile=this.liveTiles.get(id);if(tile)tile.valid=false;
   }
  }
 }

 private clearLiveTiles(){
  for(const {context,ink,raster} of this.liveTiles.values()){context.canvas.width=context.canvas.height=0;ink.canvas.width=ink.canvas.height=0;raster.reset();}
  this.liveTiles.clear();
 }

 private raster(tile:Tile){
  const extent=side+gutter*2;
  const cached=this.cache.get(tile)??{context:surface(extent,extent),painted:0},ctx=cached.context;
  this.cache.delete(tile);this.cache.set(tile,cached);
  if(cached.painted===tile.entries.length)return ctx;
  for(let i=cached.painted;i<tile.entries.length;i++)this.paintEntry(ctx,tile,tile.entries[i]);
  cached.painted=tile.entries.length;
  if(this.cache.size>maxCachedTiles)this.evict(this.cache.keys().next().value!);
  return ctx;
 }

 private paintPreview(id:string,tile:Position,entry:StrokeEntry,base?:HTMLCanvasElement){
  const extent=side+gutter*2;
  let preview:CanvasRenderingContext2D;
  let live:LiveTile|undefined;
  if(this.previousPreview){
   const cached=this.liveTiles.get(id)??{context:surface(extent,extent),valid:false,raster:new LivePaintingRaster(),ink:surface(extent,extent)};
   this.liveTiles.delete(id);this.liveTiles.set(id,cached);
   if(this.liveTiles.size>8){
    const oldest=this.liveTiles.keys().next().value!,{context,ink,raster}=this.liveTiles.get(oldest)!;
    context.canvas.width=context.canvas.height=0;ink.canvas.width=ink.canvas.height=0;raster.reset();this.liveTiles.delete(oldest);
   }
   if(cached.valid&&cached.base===base)return cached.context.canvas;
   cached.valid=true;cached.base=base;preview=cached.context;live=cached;
  }else preview=this.preview??=surface(extent,extent);
  preview.clearRect(0,0,extent,extent);
  if(base)preview.drawImage(base,0,0);
  this.paintEntry(preview,tile,entry,live);
  return preview.canvas;
 }

 private paintEntry(target:CanvasRenderingContext2D,tile:Position,{stroke,geometry}:StrokeEntry,live?:LiveTile){
  const extent=side+gutter*2,scratch=live?.ink??(this.scratch??=surface(extent,extent));
  const origin={x:tile.x-gutter,y:tile.y-gutter};
  const local=(p:Point)=>({...p,x:p.x-origin.x,y:p.y-origin.y});
  const translated={points:geometry.points.map(local),cubics:geometry.cubics.map(c=>({a:local(c.a),c1:local(c.c1),c2:local(c.c2),b:local(c.b)}))};
  const region=strokeRasterBounds(stroke,extent,extent,translated);
  if(!region.width||!region.height)return;
  if(live)live.raster.paint(scratch,stroke,translated);
  else{scratch.clearRect(region.x,region.y,region.width,region.height);drawModernStroke(scratch,stroke,'final',translated,undefined,undefined,origin);}
  compositePaintStroke(target,scratch.canvas,stroke,0,0,region);
 }

 private evict(tile:Tile){
  const cached=this.cache.get(tile);
  if(cached){cached.context.canvas.width=cached.context.canvas.height=0;this.cache.delete(tile);}
 }

 get cachedTiles(){return this.cache.size;}
 dispose(){for(const tile of this.cache.keys())this.evict(tile);for(const ctx of [this.scratch,this.preview])if(ctx)ctx.canvas.width=ctx.canvas.height=0;this.scratch=this.preview=undefined;this.previousPreview=undefined;this.clearLiveTiles();this.index.clear();this.history.length=0;}
}

export function supportsSparseStroke(s:Partial<Stroke>){
 if(s.transform||s.perspective||s.nativeMixVersion||s.mixStops?.length)return false;
 return s.engineVersion===9&&!!s.brushKind?.startsWith('graphite-')||
  s.paintTipVersion===2&&s.coloringEngine===1&&(s.brushTip==='color-soft'||s.brushTip==='color-solid')||
  s.engineVersion===10&&s.tool==='eraser'&&s.brushKind==='eraser-hard';
}
