import {validBitmapMask,type BitmapMask} from '../bitmapBrush';
import type {Project} from '../model';

/** Export one copy of each mask, even if hundreds of strokes share the brush. */
export function encodeProjectBrushMasks(project:Project){
 const masks:Record<string,BitmapMask>=Object.create(null);
 const content=JSON.stringify(project,(_key,value)=>{
  if(!value||typeof value!=='object'||typeof value.alpha!=='string'||!validBitmapMask(value))return value;
  const existing=masks[value.id];
  if(existing&&(existing.alpha!==value.alpha||existing.width!==value.width||existing.height!==value.height))throw Error('Brush tip ID conflict.');
  masks[value.id]=value;
  return {brushMaskRef:value.id};
 });
 if(!Object.keys(masks).length)return content;
 return content.slice(0,-1)+',"brushMasks":'+JSON.stringify(masks)+'}';
}

export function decodeProjectBrushMasks(project:unknown){
 if(!project||typeof project!=='object'||!('brushMasks' in project))return project;
 const root=project as Record<string,unknown>,masks=root.brushMasks;
 if(!masks||typeof masks!=='object'||Array.isArray(masks))throw Error('Invalid project brush tip library.');
 const entries=Object.entries(masks);
 if(entries.length>8192||entries.some(([id,mask])=>!validBitmapMask(mask)||mask.id!==id))throw Error('Invalid project brush tip library.');
 const byId=new Map<string,BitmapMask>(entries as [string,BitmapMask][]);
 delete root.brushMasks;
 const pending=[root];
 while(pending.length){
  const node=pending.pop()!;
  for(const key of Object.keys(node)){
   const value=node[key];if(!value||typeof value!=='object')continue;
   if('brushMaskRef' in value){
    const mask=typeof value.brushMaskRef==='string'?byId.get(value.brushMaskRef):undefined;
    if(!mask||Object.keys(value).length!==1)throw Error('A brush tip is missing from the project backup.');
    node[key]=mask;
   }else pending.push(value as Record<string,unknown>);
  }
 }
 return root;
}
