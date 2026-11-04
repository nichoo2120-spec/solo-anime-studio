import {stockPresets} from '/src/core/brushes';
import {brushStrokeMetadata,watercolorSeedFor} from '/src/core/paintTips';
import {watercolorVelocity} from '/src/engine/watercolorPigment';
import {drawStroke} from '/src/engine/renderer';
import {compositePaintStroke,strokeRasterBounds} from '/src/engine/paintCompositing';
const make=(W:number,H:number)=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;};
function stroke(op:any,index:number){
 const pr=stockPresets.find(p=>p.id===op.preset);if(!pr)throw Error('Unknown preset '+op.preset);
 const b={...pr.settings,...op.ov},path=op.path,id=op.id??'base_'+index,dx=path.x1-path.x0,dy=path.y1-path.y0,L=Math.hypot(dx,dy),step=Math.max(.5,(op.speed??.4)*8),n=Math.max(1,Math.ceil(L/step));let velocity=.65;
 const points=Array.from({length:n+1},(_,i)=>{const t=i/n,p={x:path.x0+dx*t,y:path.y0+dy*t+(path.kind==='sine'?(path.amp??50)*Math.sin(t*Math.PI*2):0),p:op.pressure??1,v:velocity};if(i)velocity=watercolorVelocity(Math.hypot(dx/n,dy/n),8,velocity);p.v=velocity;return p;});
 return {...b,...brushStrokeMetadata(b),id,kind:'stroke' as const,tool:'brush' as const,color:op.color??b.color,points,size:b.size,opacity:b.opacity,pressure:op.pressure!==undefined,response:b.response??1,captureZoom:1,stabilization:0,smoothness:0,pressureWidth:true,pressureOpacity:false,taperStart:0,taperEnd:0,velocityTaper:false,colorSeed:watercolorSeedFor(id)};
}
async function render(options:any){
 const {W,H}=options,base=make(W,H),bc=base.getContext('2d',{willReadFrequently:true})!;const mask=make(W,H),mc=mask.getContext('2d')!;let index=0;
 const paint=(ctx:CanvasRenderingContext2D,op:any)=>{const s=stroke(op,index++);mc.clearRect(0,0,W,H);drawStroke(mc,s);compositePaintStroke(ctx,mask,s,0,0,strokeRasterBounds(s,W,H));return s;};
 for(const op of options.base??[])paint(bc,op);const out=make(W,H),ctx=out.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(base,0,0);const strokes=[];for(const op of options.ops??[])strokes.push(paint(ctx,op));const white=make(W,H),wc=white.getContext('2d')!;wc.fillStyle=options.paper??'#ffffff';wc.fillRect(0,0,W,H);wc.drawImage(out,0,0);return {white:white.toDataURL(),raw:out.toDataURL(),base:base.toDataURL(),strokes};
}
(window as any).H={render,stroke};
