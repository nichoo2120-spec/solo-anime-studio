import {blendPressureFactor,effectiveBlendStyle} from '../core/brushBlend';
import {widthResponse} from './pressureChannels';
import {pressureResponse} from './strokeGeometry';
import type {Point,Stroke} from '../core/model';

/** The pickup image follows the nib. All four channels are linear and premultiplied. */
const side=24, pickup=new Float32Array(side*side*4), sample=new Float32Array(4), loadedImage=new Float32Array(side*side*4);
const linear=Float32Array.from({length:256},(_,i)=>{
 const x=i/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
});
const encoded=Uint8Array.from({length:4097},(_,i)=>{
 const x=i/4096;return Math.round(255*(x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055));
});
const clamp=(x:number)=>Math.min(1,Math.max(0,x));
function sampleLinear(bytes:Uint8ClampedArray,w:number,h:number,x:number,y:number,out:Float32Array){
 x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));
 const left=Math.floor(x),top=Math.floor(y),fx=x-left,fy=y-top;
 out.fill(0);
 for(let j=0;j<2;j++)for(let i=0;i<2;i++){
  const k=(Math.min(h-1,top+j)*w+Math.min(w-1,left+i))*4;
  const a=bytes[k+3]/255*(i?fx:1-fx)*(j?fy:1-fy);
  for(let c=0;c<3;c++)out[c]+=a*linear[bytes[k+c]];
  out[3]+=a;
 }
}
let coverage=new Float32Array(0),owner=new Int32Array(0),fraction=new Float32Array(0);
const previousPickup=new Float32Array(side*side*4);
let field:ImageData|undefined;
export function mixerField(ctx:CanvasRenderingContext2D,input:ImageData,s:Stroke,points:readonly Point[],
 originX:number,originY:number,pitch:number,extent:number,carry?:Float32Array){
 const {width:w,height:h,data:src}=input;
 if(!field||field.width!==w||field.height!==h)field=ctx.createImageData(w,h);
 if(coverage.length<w*h){coverage=new Float32Array(w*h);owner=new Int32Array(w*h);fraction=new Float32Array(w*h);}
 coverage.fill(-1,0,w*h);field.data.fill(0);pickup.fill(0);
 const output=field.data,rgb=parseInt(s.color.slice(1),16);
 const loaded=[linear[rgb>>16&255],linear[rgb>>8&255],linear[rgb&255]];
 const carrySide=carry?Math.round(Math.sqrt(carry.length/4)):0;
 const wash=s.watercolorBlendVersion===1;
 const capacity=s.bbCapacity??.45,drag=s.bbStretch??.5,flow=s.bbFlow??.6;
 const style=effectiveBlendStyle(s.bbStyle??'soft',s.bbRenderStyle);
 const wet=clamp((s.bbWetness??.5)*(style==='dry'||s.bbMode==='dry'?.7:style==='water'?1.08:1)),mix=s.bbMix??.5;
 const spacing=Math.max(.5,s.size*Math.max(.025,Math.min(.15,s.tipSpacing??.08)));
 let total=0;for(let i=1;i<points.length;i++)total+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
 // Two passes keep memory independent of stroke length. First assign each
 // grid cell to its closest swept segment. Then shade that cell exactly once.
 let previousX=0,previousY=0;
 for(let pass=0;pass<2;pass++){
 let segment=1,start=0,ordinal=0;
 for(let distance=0;;distance=Math.min(total,distance+spacing),ordinal++){
  let a=points[Math.max(0,segment-1)],b=points[segment]??a;
  let length=Math.hypot(b.x-a.x,b.y-a.y);
  while(segment<points.length-1&&start+length<distance){
   start+=length;segment++;a=b;b=points[segment];length=Math.hypot(b.x-a.x,b.y-a.y);
  }
  const t=length?clamp((distance-start)/length):0,p=a.p+(b.p-a.p)*t;
  const cx=(a.x+(b.x-a.x)*t-originX)/pitch-.5,cy=(a.y+(b.y-a.y)*t-originY)/pitch-.5;
  const dx=length?(b.x-a.x)/length:1,dy=length?(b.y-a.y)/length:0;
  const contact=wash||s.brushBlendVersion===10?Math.sqrt(clamp(p/.4)):p;
  const reachRadius=Math.max(1,extent/pitch);
  const widthResponseAtContact=s.brushBlendVersion===10&&s.pressure&&s.pressureWidth!==false?widthResponse(pressureResponse(clamp(p)**s.response,s.pressureCurve),s):1;
  const r=s.brushBlendVersion===10?Math.max(1,s.size*.5*widthResponseAtContact/pitch):reachRadius;
  const moisture=wet*(s.pressure&&s.bbPressureWet?contact:1);
  const localMix=mix*(s.pressure&&s.bbPressureMix?contact:1);
  const strength=s.pressure&&s.bbPressure?blendPressureFactor(p/.4,s.bbMinPressure??.7,s.bbPressureCurve??'linear'):1;
  const refill=1-Math.exp(-spacing*(s.bbPickup??.5)*moisture/Math.max(1,s.size*(.18+drag+.35*(s.bbColorCarry??.6))));
  if(pass===1)previousPickup.set(pickup);
  if(pass===1)for(let v=0;v<side;v++)for(let u=0;u<side;u++){
   const k=(v*side+u)*4;
   sampleLinear(src,w,h,cx+(u/(side-1)-.5)*2*r,cy+(v/(side-1)-.5)*2*r,sample);
   if(!distance){
    for(let c=0;c<4;c++)loadedImage[k+c]=s.bbSolidLoad||!sample[3]?(c===3?1:loaded[c]):sample[c];
   }
   if(!distance&&carry){
    const n=Math.round(v*(carrySide-1)/(side-1))*carrySide+Math.round(u*(carrySide-1)/(side-1)),alpha=carry[n*4+3]/255;
    for(let c=0;c<3;c++)pickup[k+c]=linear[Math.min(255,Math.round(carry[n*4+c]/(alpha||1)))]*alpha;
    pickup[k+3]=alpha;
   }
   const charge=!distance&&carry&&s.brushBlendVersion===10?Math.max(refill,moisture*.5):distance||carry?refill:1;
   for(let c=0;c<4;c++){
    let pigment=pickup[k+c];
    if(wash&&distance){
     // Let adjacent bristles exchange a little wet pigment on each contact.
     const left=k-(u?4:0),right=k+(u<side-1?4:0);
     const up=k-(v?side*4:0),down=k+(v<side-1?side*4:0);
     const adjacent=(previousPickup[left+c]+previousPickup[right+c]+previousPickup[up+c]+previousPickup[down+c])*.25;
     pigment+=(adjacent-pigment)*moisture*.5;
    }
    pickup[k+c]=pigment+(sample[c]-pigment)*charge;
   }
  }
  const tail=s.bbTaper??.12,fadeLength=Math.max(1,s.size*(.3+capacity*5));
  const charge=(s.bbPaintLoad??0)*Math.exp(-distance/fadeLength);
  const entry=total&&tail?Math.min(1,(distance+s.size*.15)/(s.size*(.15+tail))):1;
  const exit=total&&tail?Math.min(1,(total-distance+s.size*.15)/(s.size*(.15+tail))):1;
  const width=entry*exit,reach=reachRadius*1.45+2;
  if(!ordinal){previousX=cx;previousY=cy;}
  const sx=cx-previousX,sy=cy-previousY,span=sx*sx+sy*sy||1;
  for(let y=Math.max(0,Math.floor(Math.min(cy,previousY)-reach));y<=Math.min(h-1,Math.ceil(Math.max(cy,previousY)+reach));y++){
   for(let x=Math.max(0,Math.floor(Math.min(cx,previousX)-reach));x<=Math.min(w-1,Math.ceil(Math.max(cx,previousX)+reach));x++){
    const index=y*w+x,k=index*4;
    if(!pass){
     const f=clamp(((x-previousX)*sx+(y-previousY)*sy)/span);
     const ex=x-previousX-sx*f,ey=y-previousY-sy*f,score=1-(ex*ex+ey*ey)/(reach*reach);
     if(score>=0&&score>coverage[index]){coverage[index]=score;owner[index]=ordinal;fraction[index]=f;}
     continue;
    }
    if(coverage[index]<0||owner[index]!==ordinal)continue;
    const f=ordinal?fraction[index]:1;
    const nx=(x-previousX-sx*f)/r,ny=(y-previousY-sy*f)/r;
    const u=clamp(nx*.5+.5)*(side-1),v=clamp(ny*.5+.5)*(side-1);
    const u0=Math.floor(u),v0=Math.floor(v),fx=u-u0,fy=v-v0;
    const offset=Math.min(distance/pitch,r*drag*.65);
    sampleLinear(src,w,h,x-dx*offset,y-dy*offset,sample);
    const dry=1-moisture*(1-capacity)*(1-Math.exp(-distance/fadeLength));
    const rim=clamp(nx*nx+ny*ny)*(s.bbEdgeDarkness??0);
    const dragged=clamp(localMix*moisture*(.85+.3*(s.bbTextureKeep??.5))*(1-.25*rim)),paint=charge*(1-localMix);
    for(let c=0;c<4;c++){
     const row=v0*side,row1=Math.min(side-1,v0+1)*side,u1=Math.min(side-1,u0+1);
     const top=pickup[(row+u0)*4+c]*(1-fx)+pickup[(row+u1)*4+c]*fx;
     const bottom=pickup[(row1+u0)*4+c]*(1-fx)+pickup[(row1+u1)*4+c]*fx;
     const oldTop=previousPickup[(row+u0)*4+c]*(1-fx)+previousPickup[(row+u1)*4+c]*fx;
     const oldBottom=previousPickup[(row1+u0)*4+c]*(1-fx)+previousPickup[(row1+u1)*4+c]*fx;
     const carried=(top*(1-fy)+bottom*fy)*f+(oldTop*(1-fy)+oldBottom*fy)*(1-f);
     const direct=wash?dragged*(1-.8*moisture):dragged;
     sample[c]=carried*(1-direct)+sample[c]*direct;
     const loadTop=loadedImage[(row+u0)*4+c]*(1-fx)+loadedImage[(row+u1)*4+c]*fx;
     const loadBottom=loadedImage[(row1+u0)*4+c]*(1-fx)+loadedImage[(row1+u1)*4+c]*fx;
     sample[c]=sample[c]*(1-paint)+(loadTop*(1-fy)+loadBottom*fy)*paint;
    }
    // Exhaustion returns to local canvas pigment, which preserves authored
    // grain contrast on an even wash while dragged stripes gradually weaken.
    const baseAlpha=src[k+3]/255,activity=dry*width;
    for(let c=0;c<3;c++)sample[c]=sample[c]*activity+baseAlpha*linear[src[k+c]]*(1-activity);
    sample[3]=sample[3]*activity+baseAlpha*(1-activity);
    const alpha=sample[3];if(alpha<=0)continue;
    for(let c=0;c<3;c++)output[k+c]=encoded[Math.round(4096*clamp(sample[c]/alpha))];
    const edge=wash&&s.brushBlendVersion!==10?clamp(1-(nx*nx+ny*ny)):1;
    const feather=edge*edge*(3-2*edge);
    output[k+3]=Math.round(255*alpha*flow*strength*feather);
   }
  }
  previousX=cx;previousY=cy;
  if(distance>=total)break;
 }
 }
 return field;
}
