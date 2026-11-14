import type {Stroke} from '../core/model';
import {compositePaintStroke,strokeRasterBounds} from './paintCompositing';
import {resetWetSmudgeCaches} from './wetSmudge';
import {resetGentleBlend,applyGentleBlend} from './gentleBlend';
import {LiveStrokeRaster} from './liveRaster';
import {strokeGeometry} from './strokeGeometry';
import {finalGeometry} from './geometryCache';
import {applyNativeBrushMix} from './nativeBrushMix';
import {resetPigmentMix} from './pigmentMix';
import {drawStroke} from './renderer';
import {resetDryBristleV3MixModel} from './dryBristleV3';
import type {RasterRegion} from './liveRaster';
Object.defineProperty(globalThis,'document',{value:{createElement:(tag:string)=>{if(tag!=='canvas')throw Error('Unsupported worker element');return new OffscreenCanvas(1,1);}}});
type Message={kind:'begin'|'update'|'cancel';token:number;serial:number;width:number;height:number;base?:ImageBitmap;readFrequently?:boolean;stroke:Stroke;final:boolean};
const worker=self as unknown as {onmessage:(e:MessageEvent<Message>)=>void;postMessage:(data:unknown,transfer?:Transferable[])=>void};
let token=0,base:OffscreenCanvas|undefined,target:OffscreenCanvas|undefined,region:RasterRegion|undefined;
let nativeMask:OffscreenCanvas|undefined;let nativeStrokeRaster:LiveStrokeRaster|undefined;
const union=(a:RasterRegion|undefined,b:RasterRegion)=>{if(!a)return b;const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return{x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};};
// An unchanged native mask can report Infinity/-Infinity extrema. Never let
// those poison the accumulated region or become a zero-width bitmap crop.
function finiteRegion(value:RasterRegion,width:number,height:number,fallback:()=>RasterRegion):RasterRegion{
 const valid=(r:RasterRegion)=>[r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0;
 const backup=valid(value)?undefined:fallback();
 const r=valid(value)?value:backup&&valid(backup)?backup:{x:0,y:0,width:1,height:1};
 const x=Math.max(0,Math.min(width-1,Math.floor(r.x))),y=Math.max(0,Math.min(height-1,Math.floor(r.y)));
 return{x,y,width:Math.max(1,Math.min(width,Math.ceil(r.x+r.width))-x),height:Math.max(1,Math.min(height,Math.ceil(r.y+r.height))-y)};
}
worker.onmessage=async({data:j})=>{
 try{
  if(j.kind!=='update'){resetWetSmudgeCaches();resetGentleBlend();nativeStrokeRaster?.reset();nativeStrokeRaster=undefined;nativeMask=undefined;if(base)base.width=base.height=0;if(target)target.width=target.height=0;token=j.token;region=undefined;base=target=undefined;
   if(j.kind==='begin'){base=new OffscreenCanvas(j.width,j.height);target=new OffscreenCanvas(j.width,j.height);base.getContext('2d',{willReadFrequently:j.readFrequently!==false})!.drawImage(j.base!,0,0);target.getContext('2d',{willReadFrequently:j.readFrequently!==false})!.drawImage(j.base!,0,0);j.base!.close();}return;
  }
  if(j.token!==token||!base||!target)return;
  const s=j.stroke,tc=target.getContext('2d')! as unknown as CanvasRenderingContext2D,bc=base as unknown as HTMLCanvasElement;
  // v3 sends only the new dab rectangle. Previously the entire accumulated
  // stroke was read/transferred on EVERY pointer update, causing long stalls.
  let r:RasterRegion;
  // Bounds fitting is expensive on long strokes. Evaluate at most once, and
  // only if the incremental raster has no valid changed region.
  let bounds:RasterRegion|undefined;
  let geometry:ReturnType<typeof strokeGeometry>|undefined;
  const currentGeometry=()=>geometry??=j.final?finalGeometry(s):strokeGeometry(s,'live');
  const fullBounds=()=>bounds??=strokeRasterBounds(s,target!.width,target!.height,currentGeometry());
  if(!!s.nativeMixVersion){
   if(!nativeMask||nativeMask.width!==target.width||nativeMask.height!==target.height){nativeMask=new OffscreenCanvas(target.width,target.height);nativeStrokeRaster=new LiveStrokeRaster();}
   // On pen up generate the canonical final brush mask from scratch (off-thread),
   // then replay once against the immutable original layer. The union region
   // also removes provisional pixels that the final fitted geometry no longer covers.
   if(j.final){nativeStrokeRaster!.reset();resetPigmentMix(tc.canvas);nativeMask.width=target.width;nativeMask.height=target.height;tc.clearRect(0,0,target.width,target.height);tc.drawImage(bc,0,0);}
   const maskContext=nativeMask.getContext('2d')! as unknown as CanvasRenderingContext2D;
   if(j.final&&s.nativeMixVersion===3){resetDryBristleV3MixModel(s);drawStroke(maskContext,s,'final',currentGeometry());}
   else nativeStrokeRaster!.paint(maskContext,s,currentGeometry());
   let updated=finiteRegion(j.final?fullBounds():nativeStrokeRaster!.lastRegion??fullBounds(),target.width,target.height,fullBounds);
   if(s.nativeMixVersion===3&&!j.final){const halo=Math.ceil(s.size*1.5+12);updated=finiteRegion({x:updated.x-halo,y:updated.y-halo,width:updated.width+halo*2,height:updated.height+halo*2},target.width,target.height,fullBounds);}
   // Repaint/transfer only the changed tail while the pointer moves. The
   // accumulated union is bookkeeping for the FINAL correction only: the
   // final fitted stroke can shrink outside the last provisional footprint.
   region=union(region,updated);
   r=j.final?region:updated;
   if(r.width<1||r.height<1)r={x:0,y:0,width:1,height:1};
   applyNativeBrushMix(tc,nativeMask as unknown as HTMLCanvasElement,s,0,0,j.final&&s.nativeMixVersion===3?fullBounds():r,bc);
  }else if(s.smudgeVersion===3){r=applyGentleBlend(tc,bc,s,0,0,{x:0,y:0,width:target.width,height:target.height},bc)??{x:0,y:0,width:1,height:1};}
  else{
   r=region=union(region,s.points.length?strokeRasterBounds(s,target.width,target.height):{x:0,y:0,width:target.width,height:target.height});
   compositePaintStroke(tc,bc,s,0,0,r,bc);
  }
  r=finiteRegion(r,target.width,target.height,fullBounds);
  const bitmap=await createImageBitmap(target,r.x,r.y,r.width,r.height);
  if(j.token!==token){bitmap.close();return;}
  worker.postMessage({token:j.token,serial:j.serial,bitmap,region:r,final:j.final},[bitmap]);
 }catch(error){worker.postMessage({token:j.token,serial:j.serial,error:String(error)});}
};
