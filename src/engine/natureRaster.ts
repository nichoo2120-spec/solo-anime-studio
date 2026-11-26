import {bitmapAtlases,secondaryBitmapTip,type BitmapAtlas} from './bitmapTips';
import type {Stroke} from '../core/model';
import type {NatureSettings} from '../core/natureBrush';
import type {DualMode} from '../core/brushShape';
import {natureCanvas,natureNoise,naturePalette,secondaryNatureAtlas,naturePaletteSize,natureTipPixels} from './natureTips';
import {paintingNib} from './paintingTips';
import {paintSamples} from './paintPass';
import {pressureResponse,taperFactor,type strokeGeometry} from './strokeGeometry';
import {widthResponse,opacityResponse} from './pressureChannels';
import type {RasterRegion} from './liveRaster';

type Geometry=ReturnType<typeof strokeGeometry>;
const tau=Math.PI*2,angles=72,stride=8;
const cos=Float64Array.from({length:angles},(_,i)=>Math.cos(i*tau/angles));
const sin=Float64Array.from({length:angles},(_,i)=>Math.sin(i*tau/angles));
const angleBucket=(angle:number)=>((Math.round(angle*angles/tau)%angles)+angles)%angles;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));

class Dabs{
 values=new Float64Array(stride*64);
 length=0;
 reserve(count:number){
  if(count*stride<=this.values.length)return;
  const more=new Float64Array(2**Math.ceil(Math.log2(count))*stride);
  more.set(this.values);this.values=more;
 }
 push(x:number,y:number,w:number,h:number,angle:number,alpha:number,color:number,tip=0){
  const i=this.length;
  const v=this.values;v[i]=x;v[i+1]=y;v[i+2]=w;v[i+3]=h;v[i+4]=angle;v[i+5]=alpha;v[i+6]=color;v[i+7]=tip;
  this.length+=stride;
 }
}
class NaturePlan{
 main=new Dabs();
 dual=new Dabs();
}
type Bounds={left:number;top:number;right:number;bottom:number};
const empty=():Bounds=>({left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity});
function reach(v:Float64Array,i:number){return Math.hypot(v[i+2],v[i+3])*.5+2;}
function include(bounds:Bounds,list:Dabs,start:number){
 const v=list.values;
 for(let i=start;i<list.length;i+=stride){
  const r=reach(v,i);
  bounds.left=Math.min(bounds.left,v[i]-r);bounds.right=Math.max(bounds.right,v[i]+r);
  bounds.top=Math.min(bounds.top,v[i+1]-r);bounds.bottom=Math.max(bounds.bottom,v[i+1]+r);
 }
}
function firstDifference(a:Dabs,b:Dabs){
 const end=Math.min(a.length,b.length);
 for(let i=0;i<end;i++)if(a.values[i]!==b.values[i])return i-i%stride;
 return end;
}
function enclosing(bounds:Bounds,limit:RasterRegion):RasterRegion|undefined{
 if(!Number.isFinite(bounds.left))return;
 const x=Math.max(limit.x,Math.floor(bounds.left)),y=Math.max(limit.y,Math.floor(bounds.top));
 return {x,y,width:Math.max(0,Math.min(limit.x+limit.width,Math.ceil(bounds.right))-x),height:Math.max(0,Math.min(limit.y+limit.height,Math.ceil(bounds.bottom))-y)};
}

class NaturePlanner{
 private rawArc=new Float64Array(128);
 private pressure=new Float64Array(1025);
 private paletteSettings?:NatureSettings;
 private paletteColor='';
 private responseKey='';
 private atlas?:HTMLCanvasElement|BitmapAtlas[];
 private paletteSize=0;
 palette(s:Stroke){
  if(this.paletteSettings===s.nature&&this.paletteColor===s.color&&this.paletteSize===s.size&&this.atlas)return this.atlas;
  this.paletteSettings=s.nature;this.paletteColor=s.color;this.paletteSize=s.size;
  return this.atlas=s.nature!.bitmap?bitmapAtlases(s.nature!,s.color,s.size):naturePalette(s.nature!,s.color);
 }
 plan(s:Stroke,g:Geometry,out:NaturePlan){
  const n=s.nature!,bitmap=n.bitmap,samples=paintSamples(g,Math.max(.18,Math.min(.65,s.size*.004))),{points,arc,total}=samples;
  out.main.length=out.dual.length=0;
  if(!points.length||n.density===0)return;
  const key=s.pressure?`${s.response}:${s.pressureCurve?.map(p=>p.x+','+p.y).join(';')??''}`:'';
  if(s.pressure&&key!==this.responseKey){
   for(let i=0;i<=1024;i++)this.pressure[i]=pressureResponse((i/1024)**s.response,s.pressureCurve);
   this.responseKey=key;
  }
  const raw=s.points;
  if(s.tsTilt&&raw.length){
   if(raw.length>this.rawArc.length)this.rawArc=new Float64Array(2**Math.ceil(Math.log2(raw.length)));
   this.rawArc[0]=0;
   for(let i=1;i<raw.length;i++)this.rawArc[i]=this.rawArc[i-1]+Math.hypot(raw[i].x-raw[i-1].x,raw[i].y-raw[i-1].y);
  }
  const sx=(s.tsScaleX??1)*(s.tsFlipX?-1:1),sy=(s.tsScaleY??1)*(s.tsRoundness??1)*(s.tsFlipY?-1:1);
  const begin=(s.tsAngle??0)*Math.PI/180,jitter=n.rotation*Math.PI/180,baseStep=Math.max(.75,s.size*n.spacing);
  out.main.reserve((Math.floor(total/baseStep)+2)*n.count);
  let segment=1,rawIndex=0,dab=0,included=false;
  for(let distance=0;distance<=total;distance+=baseStep,dab++){
   while(segment<points.length-1&&arc[segment]<distance)segment++;
   const a=points[Math.min(points.length-1,segment-1)],b=points[segment]??a;
   const span=(arc[segment]??0)-(arc[segment-1]??0),t=span?(distance-arc[segment-1])/span:0;
   const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
   const theta=Math.atan2(b.y-a.y,b.x-a.x),pressure=s.pressure?this.pressure[Math.round(clamp(a.p+(b.p-a.p)*t)*1024)]:1;
   const speed=(a.v??1)+((b.v??1)-(a.v??1))*t;
   const width=s.pressure&&s.pressureWidth!==false||s.velocityTaper?widthResponse(pressure*(s.velocityTaper?speed:1),s):1;
   const taper=taperFactor(distance,total,s.taperStart,s.taperEnd,Math.max(64,s.size*12));
   const level=(s.flow??1)*(s.pressure&&s.pressureFlow?pressure:1)*(s.pressure&&s.pressureOpacity?opacityResponse(pressure,s):1);
   let turn=begin+(s.tsFollow?theta+Math.PI/2:n.follow?theta:0),lean=1;
   if(s.tsTilt&&raw.length){
    const target=(total?distance/total:0)*this.rawArc[raw.length-1];
    while(rawIndex<raw.length-1&&this.rawArc[rawIndex]<target)rawIndex++;
    const pt=raw[rawIndex] as typeof raw[number]&{az?:number;alt?:number};
    turn+=(pt.az??0)*Math.PI/180;lean+=1.5*(1-clamp((pt.alt??90)/90));
   }
   const count=bitmap?n.count-Math.round((n.count-1)*bitmap.countJitter*natureNoise(n.seed,dab,13)):n.count;
   for(let k=0;k<count;k++){
    const i=dab*12+k;
    if((included||k>0||dab>0)&&natureNoise(n.seed,i,0)>n.density)continue;
    const offset=n.scatter*s.size,dx=(natureNoise(n.seed,i,1)*2-1)*offset,dy=(natureNoise(n.seed,i,2)*2-1)*offset;
    const xx=x+(bitmap&&!bitmap.bothAxes?-Math.sin(theta)*dx:dx),yy=y+(bitmap&&!bitmap.bothAxes?Math.cos(theta)*dx:dy);
    const rand=natureNoise(n.seed,i,3);
    const factor=bitmap?Math.max(bitmap.minSize??.01,1-rand*n.sizeJitter):1+(rand*2-1)*n.sizeJitter;
    const size=Math.max(.5,Math.round(s.size*width*taper*factor*4)/4);
    const angle=angleBucket(turn+(natureNoise(n.seed,i,4)*2-1)*jitter),alpha=clamp(level*(1-n.opacityJitter*natureNoise(n.seed,i,5)));
    let tip=0,round=1;
    if(bitmap){
     const bins=bitmap.tips.length;
     if(bins>1)switch(bitmap.selection){
      case 'sequence':tip=(dab*n.count+k)%bins;break;
      case 'pressure':tip=Math.min(bins-1,Math.floor(pressure*bins));break;
      case 'direction':tip=Math.min(bins-1,Math.floor(((theta+tau)%tau)/tau*bins));break;
      case 'velocity':tip=Math.min(bins-1,Math.floor(clamp(speed)*bins));break;
      default:tip=Math.floor(natureNoise(n.seed,i,12)*bins);
     }
     round=Math.max(.05,bitmap.minRoundness??0,1-bitmap.roundnessJitter*natureNoise(n.seed,i,14));
    }
    if(alpha>0){out.main.push(xx,yy,size*sx*lean*(n.flipX&&natureNoise(n.seed,i,6)<.5?-1:1),size*sy*round*(n.flipY&&natureNoise(n.seed,i,7)<.5?-1:1),angle,alpha,Math.floor(natureNoise(n.seed,i,8)*naturePaletteSize),tip);included=true;}
   }
  }
  if(!s.dbTip)return;
  const size=s.size*(s.dbScale??.45),spacing=Math.max(.75,size*(s.dbSpacing??.25)),scatter=s.size*(s.dbScatter??0),count=s.dbCount??1;
  out.dual.reserve((Math.floor(total/spacing)+2)*count);
  segment=1;dab=0;
  for(let distance=0;distance<=total;distance+=spacing,dab++){
   while(segment<points.length-1&&arc[segment]<distance)segment++;
   const a=points[Math.min(points.length-1,segment-1)],b=points[segment]??a;
   const span=(arc[segment]??0)-(arc[segment-1]??0),t=span?(distance-arc[segment-1])/span:0;
   const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
   for(let k=0;k<count;k++){
    const i=dab*5+k;
    out.dual.push(x+(natureNoise(n.seed,i,9)*2-1)*scatter,y+(natureNoise(n.seed,i,10)*2-1)*scatter,size,size,angleBucket(natureNoise(n.seed,i,11)*tau),1,i&3);
   }
  }
 }
 reset(){this.paletteSettings=undefined;this.paletteColor='';this.atlas=undefined;}
}

function matrix(ctx:CanvasRenderingContext2D,m:DOMMatrix,v:Float64Array,i:number,x:number,y:number){
 const angle=v[i+4],c=cos[angle],s=sin[angle],w=v[i+2],h=v[i+3];
 const tx=v[i]-x,ty=v[i+1]-y;
 ctx.setTransform((m.a*c+m.c*s)*w,(m.b*c+m.d*s)*w,(-m.a*s+m.c*c)*h,(-m.b*s+m.d*c)*h,m.a*tx+m.c*ty+m.e,m.b*tx+m.d*ty+m.f);
}
function inside(v:Float64Array,i:number,clip?:RasterRegion){
 if(!clip)return true;
 const radius=reach(v,i),x=v[i],y=v[i+1];
 return x+radius>=clip.x&&y+radius>=clip.y&&x-radius<=clip.x+clip.width&&y-radius<=clip.y+clip.height;
}
function paintMain(ctx:CanvasRenderingContext2D,list:Dabs,atlas:HTMLCanvasElement|BitmapAtlas[],clip?:RasterRegion,x=0,y=0){
 const m=ctx.getTransform(),v=list.values,alpha=ctx.globalAlpha,res=natureTipPixels;
 for(let i=0;i<list.length;i+=stride)if(inside(v,i,clip)){
  matrix(ctx,m,v,i,x,y);ctx.globalAlpha=alpha*v[i+5];
  if(Array.isArray(atlas)){
   const stamp=atlas[v[i+7]],p=stamp.pixels;
   ctx.drawImage(stamp.canvas,(stamp.colors===1?0:v[i+6])*p,0,p,p,-.5,-.5,1,1);
  }else ctx.drawImage(atlas,v[i+6]*res,0,res,res,-.5,-.5,1,1);
 }
 ctx.setTransform(m);ctx.globalAlpha=alpha;
}
function dualAlpha(mode:DualMode,a:number,b:number){
 switch(mode){
  case 'darken':return Math.min(a,b);
  case 'overlay':return Math.min(a,a<.5?2*a*b:1-2*(1-a)*(1-b));
  case 'subtract':return Math.max(0,a-b);
  case 'lighten':return Math.max(a,b);
  case 'screen':return 1-(1-a)*(1-b);
  case 'height':return clamp((a-(1-b))*2);
  default:return a*b;
 }
}
let dualMain:HTMLCanvasElement|undefined,dualMask:HTMLCanvasElement|undefined;
const fit=(c:HTMLCanvasElement|undefined,w:number,h:number)=>{
 if(!c)return natureCanvas(w,h);
 if(c.width<w)c.width=Math.ceil(w/64)*64;if(c.height<h)c.height=Math.ceil(h/64)*64;
 return c;
};
function paint(ctx:CanvasRenderingContext2D,s:Stroke,plan:NaturePlan,atlas:HTMLCanvasElement|BitmapAtlas[],clip?:RasterRegion){
 if(!s.dbTip){paintMain(ctx,plan.main,atlas,clip);return;}
 const bounds=empty();include(bounds,plan.main,0);
 const m=ctx.getTransform().inverse(),cw=ctx.canvas.width,ch=ctx.canvas.height;
 const minX=Math.floor(m.e+Math.min(0,m.a*cw)+Math.min(0,m.c*ch)),minY=Math.floor(m.f+Math.min(0,m.b*cw)+Math.min(0,m.d*ch));
 const maxX=Math.ceil(m.e+Math.max(0,m.a*cw)+Math.max(0,m.c*ch)),maxY=Math.ceil(m.f+Math.max(0,m.b*cw)+Math.max(0,m.d*ch));
 const area=enclosing(bounds,clip??{x:minX,y:minY,width:maxX-minX,height:maxY-minY});
 if(!area?.width||!area.height)return;
 const {x,y,width:w,height:h}=area;
 dualMain=fit(dualMain,w,h);dualMask=fit(dualMask,w,h);
 const a=dualMain.getContext('2d',{willReadFrequently:true})!,b=dualMask.getContext('2d',{willReadFrequently:true})!;
 a.resetTransform();b.resetTransform();a.clearRect(0,0,w,h);b.clearRect(0,0,w,h);
 paintMain(a,plan.main,atlas,area,x,y);
 const transform=b.getTransform(),v=plan.dual.values,tip=s.dbTip;
 const bitmap=s.dbBitmap?secondaryBitmapTip(s.dbBitmap):undefined;
 const bw=bitmap?bitmap.width/Math.max(bitmap.width,bitmap.height):0,bh=bitmap?bitmap.height/Math.max(bitmap.width,bitmap.height):0;
 const secondary=s.dbNatureTip?secondaryNatureAtlas(s.dbNatureTip,s.dbTexture??0):undefined;
 const tips=bitmap?undefined:Array.from({length:4},(_,i)=>paintingNib(tip,s.dbHardness??.7,s.dbTexture??0,i,0));
 for(let i=0;i<plan.dual.length;i+=stride)if(inside(v,i,area)){
  matrix(b,transform,v,i,x,y);
  if(bitmap)b.drawImage(bitmap,-bw*.5,-bh*.5,bw,bh);
  else if(secondary)b.drawImage(secondary,0,0,natureTipPixels,natureTipPixels,-.5,-.5,1,1);
  else {const nib=tips![v[i+6]];b.drawImage(nib.canvas,nib.x,nib.y,nib.w,nib.h);}
 }
 b.resetTransform();
 const image=a.getImageData(0,0,w,h),main=image.data,mask=b.getImageData(0,0,w,h).data;
 const mode=s.dbMode??'multiply',amount=s.dbAmount??1;
 for(let i=3;i<main.length;i+=4)if(main[i]){
  const before=main[i]/255;main[i]=Math.round(255*(before+(dualAlpha(mode,before,mask[i]/255)-before)*amount));
 }
 a.putImageData(image,0,0);ctx.drawImage(dualMain,0,0,w,h,x,y,w,h);
}

const canonical=new NaturePlan(),planner=new NaturePlanner();
export function drawNatureStroke(ctx:CanvasRenderingContext2D,s:Stroke,g:Geometry,clip?:RasterRegion){
 if(!s.nature)return;
 planner.plan(s,g,canonical);paint(ctx,s,canonical,planner.palette(s),clip);
}
export function natureExtent(s:Stroke){
 const n=s.nature!;
 const sx=(s.tsScaleX??1)*(s.tsTilt?2.5:1),sy=(s.tsScaleY??1)*(s.tsRoundness??1);
 return Math.hypot(sx,sy)*.5*Math.max(1,s.maxSize??1)*(1+n.sizeJitter)+n.scatter;
}

export class LiveNatureRaster{
 private current=new NaturePlan();
 private previous=new NaturePlan();
 private planner=new NaturePlanner();
 private id='';
 private canvas?:HTMLCanvasElement;
 reset(){this.id='';this.canvas=undefined;this.planner.reset();}
 paint(ctx:CanvasRenderingContext2D,s:Stroke,g:Geometry){
  const current=this.current,old=this.previous;
  this.planner.plan(s,g,current);
  const same=this.id===s.id&&this.canvas===ctx.canvas;
  const bounds=empty();
  const main=same&&!s.dbTip?firstDifference(old.main,current.main):0;
  const dual=same&&!s.dbTip?firstDifference(old.dual,current.dual):0;
  if(this.canvas===ctx.canvas){include(bounds,old.main,main);include(bounds,old.dual,dual);}
  include(bounds,current.main,main);include(bounds,current.dual,dual);
  const region=enclosing(bounds,{x:0,y:0,width:ctx.canvas.width,height:ctx.canvas.height});
  if(region?.width&&region.height){
   const {x,y,width,height}=region;
   ctx.clearRect(x,y,width,height);ctx.save();ctx.beginPath();ctx.rect(x,y,width,height);ctx.clip();
   paint(ctx,s,current,this.planner.palette(s),s.dbTip?undefined:region);ctx.restore();
  }
  this.previous=current;this.current=old;this.canvas=ctx.canvas;this.id=s.id;
  return region??{x:0,y:0,width:0,height:0};
 }
}
