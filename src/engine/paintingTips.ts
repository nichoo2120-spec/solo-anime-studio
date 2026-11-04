import type {PaintTip} from '../core/paintTips';
import {isWatercolorTip,isNewWatercolorTip} from '../core/paintTips';
import {watercolorCoverage} from './watercolorTips';
import {erodeWatercolorGrain} from './watercolorGrain';
const SIDE=128,clamp=(v:number)=>Math.max(0,Math.min(1,v));
export function paintHash(x:number,y:number){let h=Math.imul(x+37,374761393)^Math.imul(y+83,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
export function paintNoise(x:number,y:number){const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b,s=u*u*(3-2*u),t=v*v*(3-2*v);return (paintHash(a,b)*(1-s)+paintHash(a+1,b)*s)*(1-t)+(paintHash(a,b+1)*(1-s)+paintHash(a+1,b+1)*s)*t;}
const ease=(v:number)=>{v=clamp(v);return v*v*(3-2*v);};
/** Painting tips have a smooth envelope. Pigment grain belongs to the drawing,
 * so a string of overlapping nibs cannot print a row of identical grain tiles. */

export function mixedCoverage(tipA:PaintTip,tipB:PaintTip,blend:number,u:number,v:number,hardness:number,texture:number,variant=0){
 const a=paintingCoverage(tipA,u,v,hardness,texture,variant);
 const b=paintingCoverage(tipB,u,v,hardness,texture,variant+1);
 return a*(1-blend)+b*blend;
}
export function paintingCoverage(tip:PaintTip,u:number,v:number,hardness:number,texture:number,variant=0,watercolor=false){
 if(isNewWatercolorTip(tip)){const flat=tip==='water-flat'||tip==='water-gradient';return flat?(Math.abs(u)<=.22&&Math.abs(v)<=1?1:0):(u*u+v*v<=1?1:0);}
 if(watercolor&&isWatercolorTip(tip))return watercolorCoverage(tip,u,v,hardness);
 const h=clamp(hardness),t=clamp(texture),seed=variant*11.37;
 if(tip==='soft-round'||tip==='wash'){
  const r=Math.hypot(u,v),edge=tip==='wash'?.91+.045*(paintNoise(u*5+seed+31,v*5+17)-.5):.96,core=h*.91;
  return ease((edge-r)/Math.max(.025,edge-core));
 }
 if(tip==='flat-bristle'||tip==='bristle'||tip==='felt'){
  const width=tip==='bristle'?.60:tip==='felt'?.38:.40;
  // A rounded longitudinal falloff joins adjacent dabs without a sawtooth edge.
  const longitudinal=ease((.96-Math.abs(u))/(tip==='felt'?.14:.32));
  const lateral=ease((width-Math.abs(v))/Math.max(.035,(1-h)*width*.9+.035));
  const fibers=paintNoise(v*60+31+seed,u*.6+13),tufts=paintNoise(u*7+seed+11,v*21+43);
  return longitudinal*lateral*(tip==='felt'?1:1-t*(.18+.55*(1-fibers))*(.45+.55*tufts));
 }
 const rough=.94+.035*(paintNoise(u*9+seed+11,v*9+33)-.5),body=ease((rough-Math.max(Math.abs(u),Math.abs(v)))/Math.max(.04,.24*(1-h)));
 return body*(1-t*.22*(1-paintNoise(u*22+seed+19,v*22+37)));
}
type Nib={canvas:HTMLCanvasElement;x:number;y:number;w:number;h:number};
const nibs=new Map<string,Nib>(),outlines=new Map<string,Path2D>();
export function paintingNib(tip:PaintTip,hardness:number,texture:number,variant:number,angle:number,watercolor=false):Nib{
 const key=[tip,hardness,texture,variant,angle,watercolor].join(':');const old=nibs.get(key);if(old){nibs.delete(key);nibs.set(key,old);return old;}
 const co=Math.cos(angle),si=Math.sin(angle),extent=tip==='soft-round'||tip==='wash'?1:Math.abs(co)+Math.abs(si),half=Math.ceil(SIDE*.5*extent)+2,side=half*2,coverage=new Uint8Array(side*side);let left=side,top=side,right=0,bottom=0;
 for(let y=0;y<side;y++)for(let x=0;x<side;x++){const dx=(x+.5-half)*2/SIDE,dy=(y+.5-half)*2/SIDE,a=Math.round(255*paintingCoverage(tip,dx*co+dy*si,-dx*si+dy*co,hardness,texture,variant,watercolor));coverage[y*side+x]=a;if(a){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}}
 left=Math.max(0,left-2);top=Math.max(0,top-2);right=Math.min(side,right+3);bottom=Math.min(side,bottom+3);const canvas=document.createElement('canvas');canvas.width=right-left;canvas.height=bottom-top;const ctx=canvas.getContext('2d')!,img=ctx.createImageData(canvas.width,canvas.height);
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const j=(y*canvas.width+x)*4;img.data[j]=img.data[j+1]=img.data[j+2]=255;img.data[j+3]=coverage[(top+y)*side+left+x];}ctx.putImageData(img,0,0);
 const nib={canvas,x:(left-half)/SIDE,y:(top-half)/SIDE,w:canvas.width/SIDE,h:canvas.height/SIDE};nibs.set(key,nib);if(nibs.size>96){const first=nibs.keys().next().value!,entry=nibs.get(first)!;entry.canvas.width=entry.canvas.height=0;nibs.delete(first);}return nib;
}

export function mixedNib(tipA:PaintTip,tipB:PaintTip,blend:number,hardness:number,texture:number,variant:number,angle:number):Nib{
 const key=['mix',tipA,tipB,blend.toFixed(2),hardness,texture,variant,angle].join(':');const old=nibs.get(key);if(old){nibs.delete(key);nibs.set(key,old);return old;}
 const co=Math.cos(angle),si=Math.sin(angle),extent=1,half=Math.ceil(SIDE*.5*extent)+2,side=half*2,coverage=new Uint8Array(side*side);let left=side,top=side,right=0,bottom=0;
 for(let y=0;y<side;y++)for(let x=0;x<side;x++){const dx=(x+.5-half)*2/SIDE,dy=(y+.5-half)*2/SIDE,a=Math.round(255*mixedCoverage(tipA,tipB,blend,dx*co+dy*si,-dx*si+dy*co,hardness,texture,variant));coverage[y*side+x]=a;if(a){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}}
 left=Math.max(0,left-2);top=Math.max(0,top-2);right=Math.min(side,right+3);bottom=Math.min(side,bottom+3);const canvas=document.createElement('canvas');canvas.width=right-left;canvas.height=bottom-top;const ctx=canvas.getContext('2d')!,img=ctx.createImageData(canvas.width,canvas.height);
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const j=(y*canvas.width+x)*4;img.data[j]=img.data[j+1]=img.data[j+2]=255;img.data[j+3]=coverage[(top+y)*side+left+x];}ctx.putImageData(img,0,0);
 const nib={canvas,x:(left-half)/SIDE,y:(top-half)/SIDE,w:canvas.width/SIDE,h:canvas.height/SIDE};nibs.set(key,nib);if(nibs.size>96){const first=nibs.keys().next().value!,entry=nibs.get(first)!;entry.canvas.width=entry.canvas.height=0;nibs.delete(first);}return nib;
}
export function paintingOutline(tip:PaintTip,hardness:number,texture:number,watercolor=false){
 const key=[tip,hardness,texture,watercolor].join(':');let path=outlines.get(key);if(path)return path;path=new Path2D();for(let i=0;i<80;i++){const a=i*Math.PI*2/80,co=Math.cos(a),si=Math.sin(a);let edge=0;for(let r=0;r<.72;r+=1/SIDE)if(paintingCoverage(tip,2*co*r,2*si*r,hardness,texture,0,watercolor)>.035)edge=r;const x=co*edge,y=si*edge;if(i)path.lineTo(x,y);else path.moveTo(x,y);}path.closePath();if(outlines.size>=32)outlines.delete(outlines.keys().next().value!);outlines.set(key,path);return path;
}
const TILE=128,papers=new Map<string,HTMLCanvasElement>();
function paperTile(tip:PaintTip,tx:number,ty:number){
 const family=tip==='chalk'?'chalk':'paint',key=[family,tx,ty].join(':');let c=papers.get(key);if(c){papers.delete(key);papers.set(key,c);return c;}c=document.createElement('canvas');c.width=c.height=TILE;const ctx=c.getContext('2d')!,img=ctx.createImageData(TILE,TILE);
 for(let y=0;y<TILE;y++)for(let x=0;x<TILE;x++){const wx=tx*TILE+x,wy=ty*TILE+y,n=paintHash(wx,wy),j=(y*TILE+x)*4;let erosion=n<.14?.48:n<.3?.20:.035;
  if(family==='chalk')erosion=Math.max(erosion,(1-paintNoise(wx*.13+19,wy*.13+43))*.74)+(n<.19?.15:0);
  img.data[j]=img.data[j+1]=img.data[j+2]=255;img.data[j+3]=Math.round(255*clamp(erosion));
 }ctx.putImageData(img,0,0);papers.set(key,c);if(papers.size>256){const first=papers.keys().next().value!,entry=papers.get(first)!;entry.width=entry.height=0;papers.delete(first);}return c;
}
/** Global noise coordinates join exactly across cached tiles. There is no
 * repeating 512px watercolor cell and no discontinuity at tile boundaries. */
export function erodePaintingGrain(ctx:CanvasRenderingContext2D,tip:PaintTip,strength:number,x:number,y:number,w:number,h:number){
 if(tip==='wash'){erodeWatercolorGrain(ctx,strength,x,y,w,h);return;}
 if(strength<=0)return;ctx.save();ctx.globalCompositeOperation='destination-out';ctx.globalAlpha=clamp(strength);ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();for(let ty=Math.floor(y/TILE);ty*TILE<y+h;ty++)for(let tx=Math.floor(x/TILE);tx*TILE<x+w;tx++)ctx.drawImage(paperTile(tip,tx,ty),tx*TILE-x,ty*TILE-y);ctx.restore();
}
