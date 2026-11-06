import {editLayer,newLayer,uid,type ImageOperation,type Project} from '../core/model';
import type {DocumentStore} from '../core/history';
import {makeCanvas,context,type LayerRenderer} from './renderer';
import {shotFrame} from '../core/shotFrame';
import {syncActiveFrame} from '../animation/timeline';
export class ReferenceController{
 constructor(private store:DocumentStore,private renderer:()=>LayerRenderer,private notify:(m:string)=>void,private drawing:()=>boolean=()=>false){}
 async import(file:File,asReference=true){
  if(this.drawing()){this.notify('Finish the canvas operation before importing an image.');return;}
  const p=this.store.getSnapshot(),revision=this.store.revision;
  if(p.layers.length>=100){this.notify('The scene already has 100 layers.');return;}
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>15*1024*1024){this.notify('Choose a PNG, JPEG or WebP image up to 15 MB.');return;}
  try{
   const bitmap=await createImageBitmap(file);
   const ratio=Math.min(1,(asReference?2048:4096)/Math.max(bitmap.width,bitmap.height));
   const c=makeCanvas(Math.max(1,Math.round(bitmap.width*ratio)),Math.max(1,Math.round(bitmap.height*ratio)));
   try{context(c).drawImage(bitmap,0,0,c.width,c.height);}finally{bitmap.close();}
   const frame=shotFrame(p);
   const scale=asReference?Math.min(1,p.width*.5/c.width,p.height*.7/c.height):Math.min(1,frame.width/c.width,frame.height/c.height);
   const width=c.width*scale,height=c.height*scale;
   const x=asReference?p.width*.08:frame.x+(frame.width-width)/2;
   const y=asReference?p.height*.12:frame.y+(frame.height-height)/2;
   const layer={...newLayer(file.name.slice(0,100)),reference:asReference};
   const image:ImageOperation={id:uid(),kind:'image',png:c.toDataURL(),x,y,width,height};
   const next:Project=syncActiveFrame({...p,version:p.version>=3?p.version:3,layers:[{...layer,operations:[image]},...p.layers],activeLayerId:layer.id});
   await this.renderer().prepare(next);
   if(this.store.revision!==revision||this.drawing()){this.notify('The scene changed while loading the image. Import it again.');return;}
   this.store.commit(next,asReference?'Import reference image':'Import image layer');
  }catch(e){this.notify('Image import failed: '+String(e));}
 }
 update(id:string,patch:{x:number;y:number;width:number;height:number;opacity:number}){const p=this.store.getSnapshot(),l=p.layers.find(l=>l.id===id);if(!l?.reference)return;if(l.locked){this.notify('Unlock the reference position before moving or resizing.');return;}if(![patch.x,patch.y,patch.width,patch.height,patch.opacity].every(Number.isFinite)||patch.width<1||patch.height<1||patch.width>8192||patch.height>8192||Math.abs(patch.x)>1e6||Math.abs(patch.y)>1e6){this.notify('Reference dimensions must be 1–8192 px.');return;}this.store.commit(editLayer(p,l.id,{opacity:Math.max(0,Math.min(1,patch.opacity)),operations:l.operations.map(o=>o.kind==='image'?{...o,inShot:undefined,inPreviousStage:undefined,x:patch.x,y:patch.y,width:patch.width,height:patch.height}:o)}),'Move / resize reference');}
}
