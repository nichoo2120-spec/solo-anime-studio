import {useEffect,useCallback,useRef} from 'react';
import type {BrushSettings} from '../engine/StudioEngine';
import type {Stroke} from '../core/model';
import {brushStrokeMetadata} from '../core/paintTips';
import {drawModernStroke} from '../engine/brushRaster';
import {compositePaintStroke} from '../engine/paintCompositing';
import {Pickup} from '../engine/mixing';
import {useSurfaceSize} from './useSurfaceSize';
type PreviewOptions={settings:BrushSettings;section:string;eraser?:boolean;width:number;height:number;dpr:number};
/** The same brush raster and layer compositing used by the drawing canvas. */
export function renderBrushPreview(c:HTMLCanvasElement,mask:HTMLCanvasElement,{settings,eraser=false,width,height,dpr}:PreviewOptions){
 const W=Math.max(1,Math.round(width*dpr)),H=Math.max(1,Math.round(height*dpr));
 if(c.width!==W)c.width=W;if(c.height!==H)c.height=H;if(mask.width!==W)mask.width=W;if(mask.height!==H)mask.height=H;
 const ctx=c.getContext('2d')!,mc=mask.getContext('2d')!,scale=W/width;
 for(const out of [ctx,mc]){out.resetTransform();out.globalAlpha=1;out.globalCompositeOperation='source-over';out.filter='none';out.clearRect(0,0,W,H);}
 const size=Math.min(30,Math.sqrt(settings.size/150)*30)*scale;
 // One natural gesture in every section. Never add periodic hand jitter to
 // demonstrate smoothing: it invents a rope-like stroke the artist did not draw.
 const points=Array.from({length:180},(_,i)=>{const t=i/179;return {x:(12+t*(width-24))*scale,y:(height*.5-Math.sin(t*Math.PI*2)*height*.15)*scale,p:.06+Math.sin(t*Math.PI)*.94,v:.2+.8*Math.sin(t*Math.PI*2)**2};});
 const mix=!eraser&&!!settings.nativeMixEnabled,pickup=!eraser&&!mix&&!!(settings.mixColors||settings.watercolorMode==='wet'),blender=settings.brushTip==='color-blender';
 const s:Stroke={...settings,...brushStrokeMetadata(settings),size,captureZoom:1/scale,inkProfileLength:settings.inkProfileLength===undefined?undefined:settings.inkProfileLength*scale,inkFlowLength:settings.inkFlowLength===undefined?undefined:settings.inkFlowLength*scale,inkGrainScale:(settings.inkGrainScale??1)*scale,inkImageScale:(settings.inkImageScale??1)*scale,kind:'stroke',id:'preview',tool:eraser?'eraser':'brush',points,color:mix?settings.color:'#d9e2e5',pressure:settings.pressure,
  nativeMixVersion:mix?3:undefined,nativeMixAmount:mix?settings.mixAmount??.58:undefined,nativeMixRadius:mix?Math.max(.02,Math.min(1,(settings.mixPickupLen??1)/2)):undefined,nativeMixPaintLoad:mix?settings.mixPaintLoad??0:undefined};
 // Mixing and erasing need existing paint to act on; a blank thumbnail hides
 // their controls. Keep this sample local and independent of the artist's scene.
 if(mix||pickup||eraser||blender){const colors=['#53828f','#ba8b74','#7f829f'];for(let i=0;i<3;i++){ctx.fillStyle=colors[i];ctx.fillRect((10+i*(width-20)/3)*scale,6*scale,(width-20)/3*scale,(height-12)*scale);}}
 if(pickup){s.mixStops=[];s.mixVersion=2;new Pickup(c,settings.mixAmount??.55).update(s);}
 drawModernStroke(mc,s);
 if(blender&&!mix&&!eraser){
  // Blender's live compositor retains a gesture for its target surface. Each
  // thumbnail is a fresh gesture over the sample paint, never an append to it.
  const sample=document.createElement('canvas');sample.width=W;sample.height=H;const out=sample.getContext('2d')!;out.drawImage(c,0,0);compositePaintStroke(out,mask,s);ctx.clearRect(0,0,W,H);ctx.drawImage(sample,0,0);
 }else compositePaintStroke(ctx,mask,s);
 c.dataset.previewMode=eraser?'eraser':mix?'mix':pickup?'pickup':'paint';
}
export function BrushPreview({settings,section,eraser=false}:{settings:BrushSettings;section:string;eraser?:boolean}){
 const {ref,width,height,dpr}=useSurfaceSize<HTMLCanvasElement>(400,43),frame=useRef(0),mask=useRef<HTMLCanvasElement|null>(null),revision=useRef(0);
 const latest=useRef({settings,section,eraser,width,height,dpr});latest.current={settings,section,eraser,width,height,dpr};
 const paint=useCallback(()=>{frame.current=0;const c=ref.current;if(!c)return;const source=mask.current??=document.createElement('canvas');renderBrushPreview(c,source,latest.current);c.dataset.previewRevision=String(++revision.current);},[ref]);
 // Coalesce to the next frame, without cancelling it whenever a slider emits.
 // Its callback reads the newest values, so continuous motion cannot starve it.
 useEffect(()=>{if(!frame.current)frame.current=requestAnimationFrame(paint);},[settings,section,eraser,width,height,dpr,paint]);
 useEffect(()=>()=>{cancelAnimationFrame(frame.current);frame.current=0;if(mask.current)mask.current.width=mask.current.height=0;},[]);
 return <canvas ref={ref} width="400" height="43" className="brush-studio-preview" aria-label="Rendered brush preview" title="Live brush preview · updates while you adjust settings"/>;
}
