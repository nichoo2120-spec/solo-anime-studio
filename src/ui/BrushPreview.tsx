import {useEffect} from 'react';
import type {BrushSettings} from '../engine/StudioEngine';
import {brushStrokeMetadata} from '../core/paintTips';
import {coloringPreview} from '../engine/coloringPreview';
import {useSurfaceSize} from './useSurfaceSize';
export function BrushPreview({settings,section}:{settings:BrushSettings;section:string}){
 const {ref,width,height,dpr}=useSurfaceSize<HTMLCanvasElement>(400,43);
 useEffect(()=>{const frame=requestAnimationFrame(()=>{const c=ref.current;if(!c)return;
  c.width=Math.max(1,Math.round(width*dpr));c.height=Math.max(1,Math.round(height*dpr));const ctx=c.getContext('2d')!,scale=c.width/width;
  // Render directly into device pixels instead of stretching a fixed 500x54 bitmap.
  const size=Math.min(30,Math.sqrt(settings.size/150)*30)*scale,points=Array.from({length:180},(_,i)=>{const t=i/179;return {x:(12+t*(width-24))*scale,y:(height*.5-Math.sin(t*Math.PI*2)*height*.15+(section==='smoothing'?Math.sin(i*.7)*1.5:0))*scale,p:.2+Math.sin(t*Math.PI)*.8};});
  const s={...settings,...brushStrokeMetadata(settings),size,inkProfileLength:settings.inkProfileLength===undefined?undefined:settings.inkProfileLength*scale,inkFlowLength:settings.inkFlowLength===undefined?undefined:settings.inkFlowLength*scale,inkGrainScale:(settings.inkGrainScale??1)*scale,inkImageScale:(settings.inkImageScale??1)*scale,kind:'stroke' as const,id:'preview',tool:'brush' as const,points,color:'#d9e2e5',pressure:settings.pressure};
  coloringPreview(ctx,s);ctx.globalCompositeOperation='destination-in';ctx.globalAlpha=settings.opacity;ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
 });return()=>cancelAnimationFrame(frame);},[settings,section,width,height,dpr,ref]);
 return <canvas ref={ref} width="400" height="43" className="brush-studio-preview" aria-label="Rendered brush preview"/>;
}

