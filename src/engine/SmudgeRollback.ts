import type {RasterRegion} from './liveRaster';

type Entry<State>={count:number;state:State;region?:RasterRegion;pixels?:ImageData;bytes:number};

/** Undo only the contact area changed by an update, rather than copying the
 * entire growing stroke or reading pixels back for every dab. Small groups of
 * contacts share a single pixel patch and the matching pigment state. */
export class SmudgeRollback<State>{
 private entries:Entry<State>[]=[];
 private bytes=0;
 constructor(private readonly maxBytes=16*1024*1024,private readonly maxEntries=64){}
 private release(entry:Entry<State>){entry.pixels=undefined;this.bytes-=entry.bytes;}
 clear(){for(const e of this.entries)this.release(e);this.entries=[];}
 remember(source:HTMLCanvasElement,count:number,state:State,region?:RasterRegion){
  const bytes=region?region.width*region.height*4:0;
  // An oversized update cannot leave a hole in the rollback chain. Older
  // checkpoints must be discarded so callers use their original-source fallback.
  if(bytes>this.maxBytes){this.clear();return;}
  const pixels=region&&bytes?source.getContext('2d')!.getImageData(region.x,region.y,region.width,region.height):undefined;
  this.entries.push({count,state,region,pixels,bytes});this.bytes+=bytes;
  while(this.entries.length>this.maxEntries||this.bytes>this.maxBytes)this.release(this.entries.shift()!);
 }
 restore(ctx:CanvasRenderingContext2D,prefix:number):{count:number;state:State}|undefined{
  let index=this.entries.length-1;while(index>=0&&this.entries[index].count>prefix)index--;
  if(index<0)return undefined;
  const chosen=this.entries[index];
  for(let i=this.entries.length-1;i>=index;i--){const e=this.entries[i];if(e.pixels&&e.region)ctx.putImageData(e.pixels,e.region.x,e.region.y);}
  for(const e of this.entries.splice(index))this.release(e);
  return{count:chosen.count,state:chosen.state};
 }
 status(){return{entries:this.entries.length,bytes:this.bytes};}
}
