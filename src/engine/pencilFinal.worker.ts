import {strokeRasterBounds} from './paintCompositing';
import type {Stroke} from '../core/model';
import {drawModernStroke} from './brushRaster';
import type {strokeGeometry} from './strokeGeometry';
// The pencil renderer only asks for scratch canvases. Saved rendering uses the
// same cropped mask and pixel conversion here, with worker-owned surfaces.
Object.defineProperty(globalThis,'document',{value:{createElement:(tag:string)=>{if(tag!=='canvas')throw Error('Unsupported scratch element');return new OffscreenCanvas(1,1);}}});
const worker=self as unknown as {onmessage:(e:MessageEvent<{token:number;stroke:Stroke;geometry:ReturnType<typeof strokeGeometry>;width:number;height:number}>)=>void;postMessage:(data:unknown,transfer?:Transferable[])=>void};
worker.onmessage=async({data:j})=>{try{const c=new OffscreenCanvas(j.width,j.height),ctx=c.getContext('2d',{willReadFrequently:true})!;drawModernStroke(ctx as unknown as CanvasRenderingContext2D,j.stroke,'final',j.geometry);const rect=strokeRasterBounds(j.stroke,j.width,j.height),bitmap=await createImageBitmap(c,rect.x,rect.y,rect.width,rect.height);worker.postMessage({token:j.token,bitmap,rect},[bitmap]);c.width=c.height=0;}catch(error){worker.postMessage({token:j.token,error:String(error)});}};
