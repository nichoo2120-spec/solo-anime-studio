import {SmudgeRollback} from './SmudgeRollback';
import type {Stroke} from '../core/model';
import type {RasterRegion} from './liveRaster';
import {finalGeometry} from './geometryCache';
import {paintSamples} from './paintPass';
import {paintDabs,type PaintDab} from './paintDabs';
import {physicalPaintNib} from './paintNib';
import {projectPoint} from './perspectiveWarp';
import {mixStrokeSignature} from './mixStrokeSignature';

const N=24;
type Checkpoint={bounds?:RasterRegion;load:Float32Array;previousArc:number;loaded:boolean};
const canvas=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const same=(a:PaintDab,b:PaintDab)=>a.x===b.x&&a.y===b.y&&a.radius===b.radius&&a.angle===b.angle&&a.arc===b.arc&&a.level===b.level&&a.tail===b.tail;
const key=mixStrokeSignature;
function union(a:RasterRegion|undefined,b:RasterRegion):RasterRegion{if(!a)return {...b};const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return {x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};}

function contactMatrix(s:Stroke,dab:PaintDab){
 const r=dab.radius,co=Math.cos(dab.angle),si=Math.sin(dab.angle),m=s.transform??[1,0,0,1,0,0];let a=r*(m[0]*co+m[2]*si),b=r*(m[1]*co+m[3]*si),c=r*(-m[0]*si+m[2]*co),d=r*(-m[1]*si+m[3]*co),e=m[0]*dab.x+m[2]*dab.y+m[4],f=m[1]*dab.x+m[3]*dab.y+m[5];
 if(s.perspective){const center=projectPoint(dab,s.perspective),u=projectPoint({x:dab.x+r*co,y:dab.y+r*si},s.perspective),v=projectPoint({x:dab.x-r*si,y:dab.y+r*co},s.perspective);a=u.x-center.x;b=u.y-center.y;c=v.x-center.x;d=v.y-center.y;e=center.x;f=center.y;}
 return [a,b,c,d,e,f] as const;
}
function contactBounds(m:readonly number[],width:number,height:number){const [a,b,c,d,e,f]=m,padX=Math.abs(a)+Math.abs(c)+2,padY=Math.abs(b)+Math.abs(d)+2,x=Math.max(0,Math.floor(e-padX)),y=Math.max(0,Math.floor(f-padY)),right=Math.min(width,Math.ceil(e+padX)),bottom=Math.min(height,Math.ceil(f+padY));return right>x&&bottom>y?{x,y,width:right-x,height:bottom-y}:undefined;}

/** A real moving contact carries a two-dimensional brush load. Only newly
 * travelled contacts are simulated; short checkpoints handle a revised tail.
 * There is no global color-field averaging or whole-stroke blur. */
class SmudgeGesture{
 readonly base:HTMLCanvasElement;readonly work:HTMLCanvasElement;readonly signature:string;
 private ownsBase=false;private readonly seeded=new Set<number>();private readonly tileColumns:number;
 private sample=canvas(N,N);private pigment=canvas(N,N);private stamp=canvas(128,128);private opacityBase=canvas(1,1);private opacityWork=canvas(1,1);
 private load=new Float32Array(N*N*4);private loaded=false;private previousArc=0;
 private old:PaintDab[]=[];private processed=0;private rollback=new SmudgeRollback<Checkpoint>();private bounds?:RasterRegion;
 constructor(source:HTMLCanvasElement,s:Stroke,private readonly retainRollback=true){this.signature=key(s);this.tileColumns=Math.ceil(source.width/64);if(retainRollback)this.base=source;else{this.base=canvas(source.width,source.height);this.base.getContext('2d')!.drawImage(source,0,0);this.ownsBase=true;}this.work=canvas(source.width,source.height);if(!retainRollback){this.work.getContext('2d')!.drawImage(this.base,0,0);for(let y=0;y<source.height;y+=64)for(let x=0;x<source.width;x+=64)this.seeded.add(Math.floor(y/64)*this.tileColumns+Math.floor(x/64));}}
 private seedWork(r:RasterRegion){const x0=Math.max(0,Math.floor(r.x/64)*64),y0=Math.max(0,Math.floor(r.y/64)*64),x1=Math.min(this.work.width,Math.ceil((r.x+r.width)/64)*64),y1=Math.min(this.work.height,Math.ceil((r.y+r.height)/64)*64),wc=this.work.getContext('2d')!;for(let y=y0;y<y1;y+=64)for(let x=x0;x<x1;x+=64){const key=Math.floor(y/64)*this.tileColumns+Math.floor(x/64);if(this.seeded.has(key))continue;const w=Math.min(64,this.work.width-x),h=Math.min(64,this.work.height-y);wc.drawImage(this.base,x,y,w,h,x,y,w,h);this.seeded.add(key);}}
 prepareRegion(r:RasterRegion){this.seedWork(r);}
 dispose(){if(this.ownsBase)this.base.width=this.base.height=0;for(const c of [this.work,this.sample,this.pigment,this.stamp,this.opacityBase,this.opacityWork])c.width=c.height=0;this.rollback.clear();}
 matchesSource(ctx:CanvasRenderingContext2D,s:Stroke,dabs:PaintDab[]){
  if(ctx.canvas.width!==this.base.width||ctx.canvas.height!==this.base.height)return false;let b=this.bounds;for(const dab of dabs){const q=contactBounds(contactMatrix(s,dab),ctx.canvas.width,ctx.canvas.height);if(q)b=union(b,q);}if(!b)return true;const a=this.base.getContext('2d')!.getImageData(b.x,b.y,b.width,b.height).data,c=ctx.getImageData(b.x,b.y,b.width,b.height).data;for(let i=0;i<a.length;i++)if(a[i]!==c[i])return false;return true;
 }
 private reset(count:number):RasterRegion|undefined{
  const wc=this.work.getContext('2d')!,restored=this.rollback.restore(wc,count);
  if(restored){const cp=restored.state;this.load.set(cp.load);this.processed=restored.count;this.bounds=cp.bounds?{...cp.bounds}:undefined;this.previousArc=cp.previousArc;this.loaded=cp.loaded;}
  else{const dirty=this.bounds;if(dirty){wc.clearRect(dirty.x,dirty.y,dirty.width,dirty.height);wc.drawImage(this.base,dirty.x,dirty.y,dirty.width,dirty.height,dirty.x,dirty.y,dirty.width,dirty.height);}this.load.fill(0);this.processed=0;this.bounds=undefined;this.previousArc=0;this.loaded=false;this.rollback.clear();return dirty;}
  return this.bounds?{...this.bounds}:undefined;
 }
 update(s:Stroke,dabs:PaintDab[]):RasterRegion|undefined{
  let prefix=0;while(prefix<Math.min(this.old.length,dabs.length)&&same(this.old[prefix],dabs[prefix]))prefix++;let dirty:RasterRegion|undefined;if(prefix<this.processed)dirty=this.reset(prefix);
  const wc=this.work.getContext('2d')!,sc=this.sample.getContext('2d',{willReadFrequently:true})!,pc=this.pigment.getContext('2d')!,tc=this.stamp.getContext('2d')!,paint=pc.createImageData(N,N);
  const start=this.processed;for(let i=start;i<dabs.length;i++){
   if(this.retainRollback&&(i===start||i%4===0)){let region:RasterRegion|undefined;for(let j=i;j<Math.min(dabs.length,(Math.floor(i/4)+1)*4);j++){const r=contactBounds(contactMatrix(s,dabs[j]),this.work.width,this.work.height);if(r)region=union(region,r);}this.rollback.remember(this.work,i,{load:this.load.slice(),previousArc:this.previousArc,loaded:this.loaded,bounds:this.bounds?{...this.bounds}:undefined},region);}
    const dab=dabs[i],r=dab.radius;if(r>.001){
    const matrix=contactMatrix(s,dab),[a,b,c,d,e,f]=matrix;
    const determinant=a*d-b*c;if(Math.abs(determinant)>1e-8){
     const affected=contactBounds(matrix,this.work.width,this.work.height);if(affected){this.seedWork(affected);dirty=union(dirty,affected);}
     sc.resetTransform();sc.clearRect(0,0,N,N);const q=N*.5;sc.setTransform(q*d/determinant,-q*b/determinant,-q*c/determinant,q*a/determinant,q-q*(d*e-c*f)/determinant,q+q*(b*e-a*f)/determinant);sc.imageSmoothingEnabled=true;sc.imageSmoothingQuality='low';const sampleBounds=contactBounds(matrix,this.work.width,this.work.height);if(sampleBounds){const q=sampleBounds;sc.drawImage(this.work,q.x,q.y,q.width,q.height,q.x,q.y,q.width,q.height);}sc.resetTransform();const under=sc.getImageData(0,0,N,N).data,travel=Math.max(0,dab.arc-this.previousArc),pickup=1-Math.exp(-travel/Math.max(1,s.size*.28));
     for(let j=0;j<under.length;j+=4){const alpha=under[j+3]/255;for(let channel=0;channel<3;channel++){const value=under[j+channel]*alpha;this.load[j+channel]=this.loaded?this.load[j+channel]+(value-this.load[j+channel])*pickup:value;}this.load[j+3]=this.loaded?this.load[j+3]+(alpha-this.load[j+3])*pickup:alpha;const mass=this.load[j+3];for(let channel=0;channel<3;channel++)paint.data[j+channel]=mass>1e-7?Math.round(this.load[j+channel]/mass):0;paint.data[j+3]=Math.round(mass*255);}
     pc.putImageData(paint,0,0);const nib=physicalPaintNib(s,dab.arc,1);if(this.stamp.width!==nib.side){this.stamp.width=this.stamp.height=nib.side;}
     tc.resetTransform();tc.globalAlpha=1;tc.globalCompositeOperation='source-over';tc.clearRect(0,0,nib.side,nib.side);tc.drawImage(this.pigment,0,0,nib.side,nib.side);tc.globalCompositeOperation='destination-in';tc.drawImage(nib.alpha,0,0);tc.globalCompositeOperation='source-over';
     if(this.loaded&&travel>0&&dab.level>0){const amount=1-Math.exp(-dab.level*travel/Math.max(.5,s.size*.06)*1.5);wc.save();wc.setTransform(a,b,c,d,e,f);wc.globalAlpha=amount;wc.globalCompositeOperation=s.blendPreserveAlpha?'source-atop':'source-over';wc.drawImage(this.stamp,-1,-1,2,2);wc.restore();}
     const dabBounds=contactBounds(matrix,this.work.width,this.work.height);if(dabBounds)this.bounds=union(this.bounds,dabBounds);this.loaded=true;
    }
   }
   this.previousArc=dab.arc;this.processed=i+1;
  }
  this.old=dabs;
  return dirty;
 }
 present(ctx:CanvasRenderingContext2D,s:Stroke,region:RasterRegion){
  const x=Math.max(0,region.x),y=Math.max(0,region.y),w=Math.min(ctx.canvas.width,region.x+region.width)-x,h=Math.min(ctx.canvas.height,region.y+region.height)-y;if(w<=0||h<=0)return;
  this.seedWork({x,y,width:w,height:h});
  if(s.opacity===1){ctx.clearRect(x,y,w,h);ctx.drawImage(this.work,x,y,w,h,x,y,w,h);return;}
  for(const c of [this.opacityBase,this.opacityWork]){if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;}
  const bc=this.opacityBase.getContext('2d',{willReadFrequently:true})!,wc=this.opacityWork.getContext('2d',{willReadFrequently:true})!;bc.clearRect(0,0,w,h);wc.clearRect(0,0,w,h);bc.drawImage(this.base,x,y,w,h,0,0,w,h);wc.drawImage(this.work,x,y,w,h,0,0,w,h);
  const original=bc.getImageData(0,0,w,h),after=wc.getImageData(0,0,w,h).data,data=original.data,t=s.opacity;
  for(let i=0;i<data.length;i+=4){const a=data[i+3]/255,b=after[i+3]/255,alpha=a*(1-t)+b*t;for(let c=0;c<3;c++)data[i+c]=alpha?Math.round((data[i+c]*a*(1-t)+after[i+c]*b*t)/alpha):0;data[i+3]=Math.round(alpha*255);}ctx.putImageData(original,x,y);
 }
}
let live:{id:string;source:HTMLCanvasElement;gesture:SmudgeGesture}|undefined,canonical:SmudgeGesture|undefined;
export function applyBristleSmudge(ctx:CanvasRenderingContext2D,_mask:HTMLCanvasElement,s:Stroke,_sourceX:number,_sourceY:number,region:RasterRegion,base?:HTMLCanvasElement,liveMixPreview=false):RasterRegion|undefined{
 if(s.opacity<=0||s.flow===0||!s.points.length)return;const signature=key(s),dabs=paintDabs(s,paintSamples(finalGeometry(s),.18),liveMixPreview);let gesture:SmudgeGesture;
 if(base){if(!live||live.id!==s.id||live.source!==base||live.gesture.signature!==signature||live.gesture.base.width!==base.width||live.gesture.base.height!==base.height){live?.gesture.dispose();live={id:s.id,source:base,gesture:new SmudgeGesture(base,s)};}gesture=live.gesture;}
 else if(live?.gesture.signature===signature&&live.gesture.matchesSource(ctx,s,dabs))gesture=live.gesture;
 else{canonical?.dispose();canonical=new SmudgeGesture(ctx.canvas,s,false);gesture=canonical;}
 const dirty=gesture.update(s,dabs);gesture.present(ctx,s,liveMixPreview?dirty??{x:0,y:0,width:0,height:0}:region);return dirty;
}
