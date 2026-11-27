import {blendPressureFactor, effectiveBlendStyle} from '../core/brushBlend';
import type {Point, Stroke} from '../core/model';
import type {BlendSnapshot} from './brushBlendStyles';
import type {RasterRegion} from './liveRaster';
import {paintHash, paintNoise} from './paintingTips';
import {pressureResponse, taperFactor} from './strokeGeometry';
import {widthResponse} from './pressureChannels';
import {defaultWatercolorShape, watercolorFootprint} from './watercolorShapes';
import {colorNibFootprint} from './colorNibs';
import {coloringSoftTip} from './coloringSoftTip';
import {stampExtent} from './stampBrush';

type Ctx = CanvasRenderingContext2D;
type CanvasSource = HTMLCanvasElement | OffscreenCanvas;
type Dab = Point & {dx:number;dy:number;distance:number;total:number;step:number};
const clamp = (v:number) => Math.max(0,Math.min(1,v));
const ease = (v:number) => {const t=clamp(v);return t*t*(3-2*t);};
const lerp = (a:number,b:number,t:number) => a+(b-a)*t;
const make = () => document.createElement('canvas');
const seedFor = (id:string) => {
 let seed=2166136261;
 for(let i=0;i<id.length;i++)seed=Math.imul(seed^id.charCodeAt(i),16777619);
 return seed>>>0;
};

/** Keep spacing tied to travel, including on the last partial interval. */
function forDabs(points:readonly Point[],spacing:number,paint:(dab:Dab)=>void){
 if(!points.length)return;
 const lengths=new Float64Array(points.length);
 for(let i=1;i<points.length;i++)lengths[i]=lengths[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
 const total=lengths[lengths.length-1];
 if(!total){paint({...points[0],dx:1,dy:0,distance:0,total,step:spacing});return;}
 let i=1,previous=-spacing;
 for(let distance=0;;distance=Math.min(total,distance+spacing)){
  while(i<points.length-1&&lengths[i]<=distance)i++;
  const a=points[i-1],b=points[i],span=lengths[i]-lengths[i-1],t=span?clamp((distance-lengths[i-1])/span):0;
  const dx=(b.x-a.x)/(span||1),dy=(b.y-a.y)/(span||1);
  paint({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),p:lerp(a.p,b.p,t),v:lerp(a.v??1,b.v??1,t),
   dx:dx||dy?dx:1,dy,distance,total,step:distance-previous});
  if(distance>=total)break;
  previous=distance;
 }
}

const tips=new Map<string,HTMLCanvasElement>(),tipSize=112,tipExtent=1.45;
/** Cache in nib coordinates so world position, width and rotation can vary cheaply. */
function softTip(points:readonly {x:number;y:number}[],key:string,feather:number,texture:number,rough:boolean,seed:number){
 const existing=tips.get(key);
 if(existing)return existing;
 const tip=make();tip.width=tip.height=tipSize;
 const ctx=tip.getContext('2d')!,image=ctx.createImageData(tipSize,tipSize),data=image.data;
 for(let row=0;row<tipSize;row++)for(let col=0;col<tipSize;col++){
  const x=((col+.5)*2/tipSize-1)*tipExtent,y=((row+.5)*2/tipSize-1)*tipExtent;
  let inside=false,closest=Infinity;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
   const a=points[j],b=points[i],dx=b.x-a.x,dy=b.y-a.y;
   if((a.y>y)!==(b.y>y)&&x<a.x+dx*(y-a.y)/dy)inside=!inside;
   const t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy));
   closest=Math.min(closest,(x-a.x-dx*t)**2+(y-a.y-dy*t)**2);
  }
  const grain=texture?paintNoise(col*.24+seed,row*.31):.5;
  const edge=(inside?1:-1)*Math.sqrt(closest);
  const alpha=ease(.5+(edge-(rough?(grain-.38)*texture*.24:0))/feather)*
   (1-texture*(rough?.64:.2)*ease((grain-.28)/.65));
  const k=(row*tipSize+col)*4;
  data[k]=data[k+1]=data[k+2]=255;data[k+3]=Math.round(255*alpha);
 }
 ctx.putImageData(image,0,0);tips.set(key,tip);
 if(tips.size>64)tips.delete(tips.keys().next().value!);
 return tip;
}

export function usesCharacterTip(s:Stroke){
 return s.brushBlendVersion===7&&s.stampVersion!==1&&
  (s.watercolorEngine===1&&!!s.brushTip?.startsWith('water-')||s.brushTip==='color-blender'||s.brushTip==='color-air');
}

function airbrushTip(nib:NonNullable<Stroke['colorNib']>,hardness:number){
 const key='air:'+nib+':'+hardness,existing=tips.get(key);
 if(existing)return existing;
 const source=coloringSoftTip(nib,'color-air',hardness,1);
 const canvas=make();canvas.width=source.width;canvas.height=source.height;
 const image=source.getContext('2d')!.getImageData(0,0,source.width,source.height);
 for(let i=0;i<image.data.length;i+=4){
  image.data[i+3]=image.data[i];image.data[i]=image.data[i+1]=image.data[i+2]=255;
 }
 canvas.getContext('2d')!.putImageData(image,0,0);tips.set(key,canvas);
 if(tips.size>64)tips.delete(tips.keys().next().value!);
 return canvas;
}

/** Watercolor uses the Paint outline and pen channels, with a cached feathered
 * nib. Its colour transport is computed on the layer's pigment field. */
export function drawCharacterTip(ctx:Ctx,s:Stroke,points:readonly Point[]){
 const water=s.watercolorEngine===1,air=s.brushTip==='color-air',shape=s.watercolorShape??defaultWatercolorShape(s.brushTip);
 const nib=s.colorNib??(air?'oval':'round'),outline=water?watercolorFootprint(shape):colorNibFootprint(nib);
 const rough=s.brushTip==='water-rough',wet=s.bbWetness??.4;
 const texture=Math.round((s.bbTextureKeep??0)*10)/10;
 const feather=Math.round((water?.07+(s.edgeSoftness??.2)*.12+wet*.15:.08+(1-(s.hardness??.7))*.28)*40)/40;
 const seed=rough?seedFor(s.rasterSourceId??s.id)&7:0;
 const tip=air?airbrushTip(nib,s.hardness??0):softTip(outline,[water?'water':'mix',water?shape:nib,rough,texture,feather,seed].join(':'),Math.max(.05,feather),texture,rough,seed);
 const base=(s.tipAngle??0)*Math.PI/180,follow=water?shape==='angular'||shape==='filbert'||shape==='mop':s.colorNibFollow===true;
 const scale=water?(shape==='liner'?.2:1)*(s.brushTip==='water-wet'?1+wet*.18:1):1;
 const spacing=Math.max(.4,s.size*Math.min(.17,Math.max(.045,(s.tipSpacing??.08)*1.45))*scale);
 ctx.save();
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='low';
 forDabs(points,spacing,p=>{
  const response=s.pressure?pressureResponse(clamp(p.p)**s.response,s.pressureCurve):1;
  const width=s.pressure&&s.pressureWidth!==false||s.velocityTaper?widthResponse(response*(s.velocityTaper?p.v??1:1),s):1;
  const radius=s.size*.5*scale*width*taperFactor(p.distance,p.total,s.taperStart,s.taperEnd,Math.max(64,s.size*12));
  if(radius<.01)return;
  const angle=base+(follow?Math.atan2(p.dy,p.dx)+(water?0:Math.PI/2):0),size=radius*(air?1:tipExtent);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.drawImage(tip,-size,-size,size*2,size*2);ctx.restore();
 });
 ctx.restore();
}

let pickup:HTMLCanvasElement|undefined,field:HTMLCanvasElement|undefined,blurLayer:HTMLCanvasElement|undefined,patch:HTMLCanvasElement|undefined;
let paper:HTMLCanvasElement|undefined;
function paperAlpha(){
 if(paper)return paper;
 const canvas=make(),size=128;canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d')!,image=ctx.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4;
  image.data[i]=image.data[i+1]=image.data[i+2]=255;
  image.data[i+3]=Math.round(46*paintHash(x,y));
 }
 ctx.putImageData(image,0,0);paper=canvas;
 return canvas;
}
const snapshots=new WeakMap<BlendSnapshot,HTMLCanvasElement>();
function sampleCanvas(sample:BlendSnapshot){
 let canvas=snapshots.get(sample);
 if(!canvas){
  canvas=make();canvas.width=sample.width;canvas.height=sample.height;
  const ctx=canvas.getContext('2d')!,image=ctx.createImageData(sample.width,sample.height);
  image.data.set(sample.data);ctx.putImageData(image,0,0);snapshots.set(sample,canvas);
 }
 return canvas;
}
function buffer(canvas:HTMLCanvasElement,w:number,h:number,read=false){
 if(canvas.width<w||canvas.height<h||canvas.width*canvas.height>Math.max(65536,w*h*4)){
  canvas.width=Math.ceil(w/64)*64;canvas.height=Math.ceil(h/64)*64;
 }
 const ctx=canvas.getContext('2d',read?{willReadFrequently:true}:undefined)!;
 ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='low';return ctx;
}

/** One document sampling matrix shared by cropped and full source canvases. */
function drawCrop(ctx:Ctx,source:CanvasSource,sourceX:number,sourceY:number,x:number,y:number,width:number,height:number,scale=1){
 const left=Math.max(0,x-sourceX),top=Math.max(0,y-sourceY);
 const right=Math.min(source.width,x-sourceX+width*scale),bottom=Math.min(source.height,y-sourceY+height*scale);
 if(right<=left||bottom<=top)return false;
 const w=right-left,h=bottom-top;
 ctx.drawImage(source,left,top,w,h,(left+sourceX-x)/scale,(top+sourceY-y)/scale,w/scale,h/scale);
 return true;
}

/** Samples a continuous document-aligned pigment grid in premultiplied alpha.
 * Transparent paper cannot add black or reduce the opacity of existing paint. */
function sampleGrid(image:ImageData,x:number,y:number,out:Float64Array){
 out.fill(0);
 const left=Math.floor(x-.5),top=Math.floor(y-.5),fx=x-.5-left,fy=y-.5-top;
 for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
  const u=left+dx,v=top+dy;
  if(u<0||v<0||u>=image.width||v>=image.height)continue;
  const j=(v*image.width+u)*4,weight=(dx?fx:1-fx)*(dy?fy:1-fy)*image.data[j+3]/255;
  out[0]+=image.data[j]*weight;out[1]+=image.data[j+1]*weight;out[2]+=image.data[j+2]*weight;out[3]+=weight;
 }
}

function restoreRegion(ctx:Ctx,read:Ctx|undefined,box:RasterRegion|undefined){
 if(!read||read===ctx||!box)return;
 const {x,y,width,height}=box;
 ctx.clearRect(x,y,width,height);ctx.drawImage(read.canvas,x,y,width,height,x,y,width,height);
}
function blendFootprint(s:Stroke,transformScale:number){
 const style=effectiveBlendStyle(s.bbStyle??'soft',s.bbRenderStyle);
 const mode=s.bbMode??'soft',wet=clamp((s.bbWetness??.4)*(mode==='dry'?.48:mode==='wet'?1.12:1));
 const blur=s.bbRenderStyle==='blur'?1:clamp(s.bbBlur??0),radius=s.size*(s.stampVersion===1?Math.max(.65,stampExtent(s)):.65)*transformScale;
 const filteredBlur=blur*ease((blur-.2)/.35);
 const gaussian=filteredBlur>.001,localBlur=blur-filteredBlur;
 const kernel=gaussian?radius*(.14+.34*wet):0;
 const reach=radius*(1.18+wet*.37);
 // The contact atlas is at most 1.5 radii wide, including feather. Its
 // destination can be smaller than the read halo, particularly for wet dabs.
 const pad=Math.ceil((usesCharacterTip(s)&&!s.perspective?Math.min(reach,s.size*.76*transformScale):reach)+2);
 return {style,mode,wet,blur,radius,filteredBlur,gaussian,localBlur,kernel,reach,pad};
}

/** A saved all-layers sample must retain the same source halo as the worker. */
export function characterBlendReadReach(s:Stroke,transformScale:number){
 const {pad,kernel}=blendFootprint(s,transformScale);
 return pad+Math.ceil(kernel*3)+8;
}

export function renderCharacterBlend(ctx:Ctx,mask:CanvasSource,s:Stroke,points:readonly Point[],
 maskX:number,maskY:number,read:Ctx=ctx,previous?:RasterRegion,sample?:BlendSnapshot,carry?:Float32Array,transformScale=1):RasterRegion|undefined{
 const {style,mode,wet,blur,radius,filteredBlur,gaussian,localBlur,kernel,reach,pad}=blendFootprint(s,transformScale);
 const softness=s.bbSoftness??.5,water=style==='water',gradient=s.brushTip==='water-gradient';
 const rough=s.brushTip==='water-rough',flat=s.brushTip==='water-flat';
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(const p of points){left=Math.min(left,p.x);top=Math.min(top,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
 const x=Math.max(0,Math.floor(left-pad)),y=Math.max(0,Math.floor(top-pad));
 const x1=Math.min(ctx.canvas.width,Math.ceil(right+pad)),y1=Math.min(ctx.canvas.height,Math.ceil(bottom+pad));
 const w=x1-x,h=y1-y,amount=s.opacity*(s.bbAmount??.85)*(s.bbStrength??1);
 if(!points.length||w<=0||h<=0||amount<=0){restoreRegion(ctx,read,previous);return previous;}
 const scale=s.size>200?4:s.size>64?2:1,step=Math.max(.5,s.size*transformScale*Math.max(.08,Math.min(.35,(s.tipSpacing??.08)*(scale>1?2.8:1.45))));
 // The halo includes the complete blur support. The grid has one document
 // origin for the entire dirty region and is never restarted at tile edges.
 const gx=Math.floor((x-kernel*3-2)/scale)*scale,gy=Math.floor((y-kernel*3-2)/scale)*scale;
 const cw=Math.ceil((x1+kernel*3+2-gx)/scale),ch=Math.ceil((y1+kernel*3+2-gy)/scale);
 const inCtx=buffer(pickup??=make(),cw,ch,true),out=buffer(field??=make(),cw,ch);
 const source=sample?sampleCanvas(sample):read.canvas;
 drawCrop(inCtx,source,sample?.x??0,sample?.y??0,gx,gy,cw,ch,scale);
 const image=blur===1?undefined:inCtx.getImageData(0,0,cw,ch),picked=new Float64Array(4),reservoir=new Float64Array(4),blurSample=new Float64Array(4);
 const mix=s.bbMix??.55,drag=s.bbStretch??.45,load=s.bbPaintLoad??0,flow=s.bbFlow??.6;
 const hold=s.size*(.12+drag*1.5+(s.bbColorCarry??.6)*.45)/Math.max(.01,s.bbPickup??.5);
 const seed=seedFor(s.rasterSourceId??s.id),texture=s.bbTextureKeep??0,rim=s.bbEdgeDarkness??0;
 const colour=parseInt(s.color.slice(1),16),reds=colour>>16&255,greens=colour>>8&255,blues=colour&255;
 if(carry)for(let i=0;i<carry.length;i+=4)for(let c=0;c<4;c++)reservoir[c]+=carry[i+c]/(carry.length/4)/(c===3?255:1);
 const streaks=(rough||flat||style==='oil'||style==='dry')&&texture>.02&&blur<1;
 forDabs(points,step,p=>{
  const cx=(p.x-gx)/scale,cy=(p.y-gy)/scale,r=reach/scale;
  const trailing=radius*(.15+drag*.42)*(1-blur)/scale;
  if(image)sampleGrid(image,cx-p.dx*trailing,cy-p.dy*trailing,picked);
  if(image&&localBlur>0){
   // A light blend of diffusion uses symmetric samples from the same
   // premultiplied grid. Larger blur settings use the spatial filter.
   const spread=r*.33;
   for(const [x,y] of [[cx-spread,cy],[cx+spread,cy],[cx,cy-spread],[cx,cy+spread]]){
    sampleGrid(image,x,y,blurSample);
    for(let c=0;c<4;c++)picked[c]=lerp(picked[c],blurSample[c],localBlur*.25);
   }
  }
  if(!p.distance&&!carry)reservoir.set(picked);
  else{
   const charge=(1-Math.exp(-p.step/Math.max(1,hold)))*picked[3];
   for(let c=0;c<4;c++)reservoir[c]=lerp(reservoir[c],picked[c],charge);
  }
  const colorAlpha=lerp(reservoir[3],picked[3],mix);
  if(colorAlpha<=.001&&load<=0&&blur===0)return;
  const norm=1/Math.max(.001,colorAlpha);
  const red=Math.round(lerp(lerp(reservoir[0],picked[0],mix)*norm,reds,load));
  const green=Math.round(lerp(lerp(reservoir[1],picked[1],mix)*norm,greens,load));
  const blue=Math.round(lerp(lerp(reservoir[2],picked[2],mix)*norm,blues,load));
  const pressure=s.pressure&&s.bbPressure?blendPressureFactor(p.p/.4,s.bbMinPressure??.7,s.bbPressureCurve??'linear'):1;
  const fade=gradient?Math.exp(-p.distance/(s.size*(.8+drag))*(s.pigmentDepletion??.9)):mode==='dry'?Math.exp(-p.distance/(s.size*(1+drag*3))):1;
  const strength=clamp(amount*pressure*fade*(.7+flow*.8)*(p.step/step));
  const alpha=(blur>0?lerp(clamp(colorAlpha+load),1,blur):clamp(colorAlpha+load))*strength;
  const color=(a:number,dark=1)=>`rgba(${Math.round(red*dark)},${Math.round(green*dark)},${Math.round(blue*dark)},${clamp(a)})`;
  const gradientFill=out.createRadialGradient(cx,cy,0,cx,cy,r);
  gradientFill.addColorStop(0,color(alpha*(water?1-rim*.46:1)));
  gradientFill.addColorStop(water?.49:.57-softness*.22,color(alpha*(water?.91-rim*.24:.84)));
  gradientFill.addColorStop(water?.72:.79,color(alpha*(water?.54+rim*.39:.39),water?1-rim*.23:1));
  gradientFill.addColorStop(1,color(0));
  out.fillStyle=gradientFill;out.fillRect(cx-r,cy-r,r*2,r*2);
  if(!streaks)return;
  out.save();out.translate(cx,cy);out.rotate(Math.atan2(p.dy,p.dx));
  for(let lane=0;lane<7;lane++){
   const cross=((lane+.5)/7-.5)*r*1.4,ink=paintHash(seed+lane,Math.floor(p.distance/(s.size*.45+1)));
   const streak=out.createLinearGradient(-r*.61,0,r*.61,0);
   streak.addColorStop(0,color(0));streak.addColorStop(.5,color(alpha*texture*ink*.24));streak.addColorStop(1,color(0));
   out.fillStyle=streak;out.fillRect(-r*.61,cross,r*1.22,Math.max(.42,r*(flat?.045:.025)));
  }
  out.restore();
 });
 if(gaussian){
  const factor=scale===4?4:scale===2?2:1,w=Math.ceil(cw/factor),h=Math.ceil(ch/factor);
  const bc=buffer(blurLayer??=make(),w,h);
  bc.save();
  bc.filter='blur('+(kernel/(scale*factor))+'px)';
  bc.drawImage(pickup,0,0,cw,ch,0,0,w,h);
  bc.restore();
  bc.globalCompositeOperation='destination-in';
  bc.drawImage(field,0,0,cw,ch,0,0,w,h);
  bc.globalCompositeOperation='source-over';
  if(blur===1)out.clearRect(0,0,cw,ch);
  out.globalAlpha=filteredBlur;out.drawImage(blurLayer,0,0,w,h,0,0,cw,ch);out.globalAlpha=1;
 }
 const target=buffer(patch??=make(),w,h);
 target.drawImage(field,0,0,cw,ch,gx-x,gy-y,cw*scale,ch*scale);
 target.globalCompositeOperation='destination-in';
 // Gate every changed pixel using the original, full-resolution alpha.
 if(!drawCrop(target,mask,maskX,maskY,x,y,w,h))target.clearRect(0,0,w,h);
 if(texture>0&&blur<1&&style!=='air'){
  const noise=target.createPattern(paperAlpha(),'repeat');
  if(noise){
   const strength=texture*(1-blur);
   target.save();target.translate(-x,-y);
   target.globalCompositeOperation='destination-out';target.globalAlpha=strength;
   target.fillStyle=noise;target.fillRect(x,y,w,h);target.restore();
  }
 }
 target.globalCompositeOperation='source-over';
 const dirty=previous?{
  x:Math.min(x,previous.x),y:Math.min(y,previous.y),
  width:Math.max(x1,previous.x+previous.width)-Math.min(x,previous.x),
  height:Math.max(y1,previous.y+previous.height)-Math.min(y,previous.y),
 }:{x,y,width:w,height:h};
 restoreRegion(ctx,read,dirty);
 ctx.save();ctx.globalCompositeOperation=s.bbProtectAlpha||style==='ink'||style==='pencil'?'source-atop':'source-over';
 ctx.drawImage(patch,0,0,w,h,x,y,w,h);ctx.restore();
 return dirty;
}
