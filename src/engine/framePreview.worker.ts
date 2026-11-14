import type {Project} from '../core/model';
import {LayerRenderer} from './renderer';
Object.defineProperty(globalThis,'document',{value:{createElement:(tag:string)=>{if(tag!=='canvas')throw Error('Unsupported preview element');return new OffscreenCanvas(1,1);}}});
const worker=self as unknown as {onmessage:(event:MessageEvent<{id:number;project:Project;maxWidth?:number;color?:string|null}>)=>void;postMessage:(data:unknown,transfer:Transferable[])=>void};
worker.onmessage=async({data:j})=>{
 const renderer=new LayerRenderer(false);let original:HTMLCanvasElement|undefined,result:OffscreenCanvas|undefined;
 try{
  await renderer.prepare(j.project);original=renderer.composite(j.project,{transparent:true,includeReferences:false});
  const ratio=j.maxWidth?Math.min(1,j.maxWidth/original.width):1;
  result=new OffscreenCanvas(Math.max(1,Math.round(original.width*ratio)),Math.max(1,Math.round(original.height*ratio)));
  const ctx=result.getContext('2d')!;ctx.drawImage(original,0,0,result.width,result.height);
  if(j.color){ctx.globalCompositeOperation='source-in';ctx.fillStyle=j.color;ctx.fillRect(0,0,result.width,result.height);}
  const bitmap=result.transferToImageBitmap();worker.postMessage({id:j.id,bitmap},[bitmap]);
 }catch(error){worker.postMessage({id:j.id,error:String(error)},[]);}
 finally{renderer.clear();if(original)original.width=original.height=0;if(result)result.width=result.height=0;}
};
