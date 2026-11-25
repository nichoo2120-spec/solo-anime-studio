import {projectPoint} from './perspectiveWarp';
import type {Stroke} from '../core/model';
import {importedGrainSampler} from '../core/importedGrain';
import {widthPointExtent} from '../core/widthPoints';
import type {strokeGeometry} from './strokeGeometry';

export const hasInkEdgeEffect=(s:Stroke)=>s.inkEdgeVersion===1&&(
 (s.inkAntialiasing??'low')!=='low'||(s.inkEdgeSharpness??1)<1||!!s.textureStrength||!!(s.inkImage&&(s.inkImageAmount??1)>0)
);

let edgeSurface:OffscreenCanvas|HTMLCanvasElement|undefined;

/** Apply optional coverage adjustments to an isolated device-pixel rectangle.
 * The default Low mode fills directly with native Canvas edge coverage. */
export function fillInkPaths(ctx:CanvasRenderingContext2D,s:Stroke,g:ReturnType<typeof strokeGeometry>,paths:readonly Path2D[],projected=false){
 if(!hasInkEdgeEffect(s)){
  ctx.fillStyle=s.color;
  for(const path of paths)ctx.fill(path);
  return;
 }
 const m=ctx.getTransform(),radius=s.size*.5*Math.max(1,s.maxSize??1)*widthPointExtent(s);
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 const include=(p:{x:number;y:number})=>{
  const x=m.a*p.x+m.c*p.y+m.e,y=m.b*p.x+m.d*p.y+m.f;
  left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
 };
 const visit=projected&&s.perspective?(p:{x:number;y:number})=>{
  for(const dx of [-radius,radius])for(const dy of [-radius,radius])include(projectPoint({x:p.x+dx,y:p.y+dy},s.perspective!));
 }:include;
 for(const p of g.points)visit(p);
 for(const c of g.cubics){visit(c.c1);visit(c.c2);}
 if(!Number.isFinite(left))return;
 const padX=radius*Math.hypot(m.a,m.c)+3,padY=radius*Math.hypot(m.b,m.d)+3;
 const x=Math.max(0,Math.floor(left-padX)),y=Math.max(0,Math.floor(top-padY));
 const w=Math.min(ctx.canvas.width,Math.ceil(right+padX))-x,h=Math.min(ctx.canvas.height,Math.ceil(bottom+padY))-y;
 if(w<=0||h<=0)return;
 const surface=edgeSurface??=(typeof OffscreenCanvas==='undefined'?document.createElement('canvas'):new OffscreenCanvas(1,1));
 if(surface.width<w)surface.width=Math.ceil(w/64)*64;
 if(surface.height<h)surface.height=Math.ceil(h/64)*64;
 const mask=surface.getContext('2d',{willReadFrequently:true})! as CanvasRenderingContext2D;
 mask.resetTransform();mask.clearRect(0,0,w,h);
 mask.setTransform(m.a,m.b,m.c,m.d,m.e-x,m.f-y);
 mask.fillStyle=s.color;
 for(const path of paths)mask.fill(path);
 const image=mask.getImageData(0,0,w,h),pixels=image.data,alpha=new Uint8Array(w*h);
 for(let i=0;i<alpha.length;i++)alpha[i]=pixels[i*4+3];
 const mode=s.inkAntialiasing??'low',softness=1-(s.inkEdgeSharpness??1);
 const spread=mode==='off'?0:(mode==='normal'?.10:0)+softness*.14;
 const grain=importedGrainSampler(s),texture=s.textureStrength??0,inv=grain||texture?m.inverse():undefined;
 const r=parseInt(s.color.slice(1,3),16),gColor=parseInt(s.color.slice(3,5),16),b=parseInt(s.color.slice(5,7),16);
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){
  const index=j*w+i,at=index*4,a=alpha[index];
  let coverage=mode==='off'?(a>=128?255:0):a;
  if(spread){
   const sum=(i?alpha[index-1]:0)+(i+1<w?alpha[index+1]:0)+(j?alpha[index-w]:0)+(j+1<h?alpha[index+w]:0);
   coverage+=spread*(sum-4*a);
  }
  if(coverage>0&&inv){
   const sx=x+i+.5,sy=y+j+.5,px=inv.a*sx+inv.c*sy+inv.e,py=inv.b*sx+inv.d*sy+inv.f;
   if(texture){
    const scale=s.inkGrainScale??1;
    const hash=Math.imul(Math.floor(px*1.4/scale)^Math.imul(Math.floor(py*1.4/scale),374761393),668265263);
    coverage*=1-texture*((hash^(hash>>>13))&1023)/1023;
   }
   if(grain)coverage*=grain(px,py);
  }
  pixels[at]=r;pixels[at+1]=gColor;pixels[at+2]=b;pixels[at+3]=Math.round(coverage);
 }
 mask.putImageData(image,0,0);
 ctx.save();ctx.resetTransform();ctx.imageSmoothingEnabled=false;ctx.drawImage(surface,0,0,w,h,x,y,w,h);ctx.restore();
}
