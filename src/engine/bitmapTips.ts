import type {BitmapMask} from '../core/bitmapBrush';
import type {NatureSettings} from '../core/natureBrush';
import {colorChannels,natureCanvas,natureNoise,naturePaletteSize} from './natureTips';

export type BitmapAtlas={canvas:HTMLCanvasElement;pixels:number;colors:number};
const alphaCache=new WeakMap<BitmapMask,Uint8Array>();
export function bitmapAlpha(mask:BitmapMask){
 let alpha=alphaCache.get(mask);
 if(!alpha){
  alpha=Uint8Array.from(atob(mask.alpha),c=>c.charCodeAt(0));
  alphaCache.set(mask,alpha);
 }
 return alpha;
}
const sources=new Map<BitmapMask,HTMLCanvasElement>();
let sourceBytes=0;
const thumbnailCache=new WeakMap<BitmapMask,HTMLCanvasElement>();
function maskCanvas(mask:BitmapMask){
 let canvas=sources.get(mask);
 if(canvas){sources.delete(mask);sources.set(mask,canvas);return canvas;}
 canvas=natureCanvas(mask.width,mask.height);
 const c=canvas.getContext('2d')!,pixels=c.createImageData(mask.width,mask.height),data=bitmapAlpha(mask);
 for(let i=0,j=0;i<data.length;i++,j+=4){
  pixels.data[j]=pixels.data[j+1]=pixels.data[j+2]=255;pixels.data[j+3]=data[i];
 }
 c.putImageData(pixels,0,0);
 sources.set(mask,canvas);sourceBytes+=canvas.width*canvas.height*4;
 while(sourceBytes>24*1024*1024&&sources.size>1){
  const oldest=sources.keys().next().value!,previous=sources.get(oldest)!;
  sourceBytes-=previous.width*previous.height*4;sources.delete(oldest);
 }
 return canvas;
}
export function drawBitmapThumbnail(ctx:CanvasRenderingContext2D,mask:BitmapMask,w:number,h:number){
 let thumbnail=thumbnailCache.get(mask);
 if(!thumbnail){
  const side=64,scale=side/Math.max(mask.width,mask.height);
  thumbnail=natureCanvas(Math.max(1,Math.round(mask.width*scale)),Math.max(1,Math.round(mask.height*scale)));
  const c=thumbnail.getContext('2d')!;c.imageSmoothingQuality='high';
  c.drawImage(maskCanvas(mask),0,0,thumbnail.width,thumbnail.height);thumbnailCache.set(mask,thumbnail);
 }
 const scale=Math.min((w-8)/thumbnail.width,(h-6)/thumbnail.height),width=thumbnail.width*scale,height=thumbnail.height*scale;
 ctx.drawImage(thumbnail,(w-width)/2,(h-height)/2,width,height);
}
export function bitmapPaletteSize(size:number){
 return size<=64?64:size<=128?128:size<=256?256:512;
}
const paletteCache=new Map<string,BitmapAtlas>();
const masks=new WeakMap<BitmapMask,number>();
let nextMask=0,paletteBytes=0;
const maskKey=(mask:BitmapMask)=>{
 let key=masks.get(mask);if(key===undefined){key=++nextMask;masks.set(mask,key);}
 return key;
};
const blendTexture=(mode:NonNullable<NatureSettings['bitmap']>['textureMode'],a:number,b:number)=>{
 switch(mode){
  case 'darken':return Math.min(a,b);
  case 'subtract':return Math.max(0,a-(1-b));
  case 'overlay':return Math.min(a,a<.5?2*a*b:1-2*(1-a)*(1-b));
  default:return a*b;
 }
};
function mipData(mask:BitmapMask,pixels:number){
 const surface=natureCanvas(pixels,pixels),ctx=surface.getContext('2d',{willReadFrequently:true})!;
 const ratio=pixels/Math.max(mask.width,mask.height),w=mask.width*ratio,h=mask.height*ratio;
 ctx.imageSmoothingQuality='high';ctx.drawImage(maskCanvas(mask),(pixels-w)/2,(pixels-h)/2,w,h);
 return ctx.getImageData(0,0,pixels,pixels).data;
}
const mips=new Map<string,Uint8ClampedArray>();
let mipBytes=0;
function mip(mask:BitmapMask,size:number){
 const key=maskKey(mask)+'|'+size,cached=mips.get(key);
 if(cached){mips.delete(key);mips.set(key,cached);return cached;}
 const result=mipData(mask,size);mips.set(key,result);mipBytes+=result.byteLength;
 while(mipBytes>32*1024*1024&&mips.size>1){
  const oldest=mips.keys().next().value!;mipBytes-=mips.get(oldest)!.byteLength;mips.delete(oldest);
 }
 return result;
}
export function bitmapAtlases(settings:NatureSettings,color:string,size:number):BitmapAtlas[]{
 const bitmap=settings.bitmap!;
 return bitmap.tips.map(mask=>bitmapAtlas(mask,settings,color,size));
}
function bitmapAtlas(mask:BitmapMask,s:NatureSettings,color:string,size:number):BitmapAtlas{
 const b=s.bitmap!,grain=b.grain,pixels=bitmapPaletteSize(size*(1+s.sizeJitter));
 const count=s.mix||s.hue||s.saturation||s.brightness?naturePaletteSize:1;
 const key=[maskKey(mask),pixels,color,s.mix?s.second:'',s.hue,s.saturation,s.brightness,s.grain,s.scale,grain?maskKey(grain):0,b.textureMode].join('|');
 const existing=paletteCache.get(key);
 if(existing){paletteCache.delete(key);paletteCache.set(key,existing);return existing;}
 const surface=natureCanvas(pixels*count,pixels),ctx=surface.getContext('2d')!;
 const image=ctx.createImageData(pixels,pixels),d=image.data,src=mip(mask,pixels),tile=grain?bitmapAlpha(grain):undefined;
 const main=parseInt(color.slice(1),16),second=parseInt(s.second.slice(1),16);
 const tileScale=grain?Math.max(.1,s.scale*pixels/Math.max(grain.width,grain.height)):1;
 for(let j=0;j<count;j++){
  const turn=(natureNoise(122,j,1)*2-1)*s.hue/100,sat=(natureNoise(122,j,2)*2-1)*s.saturation/100,light=(natureNoise(122,j,3)*2-1)*s.brightness/200;
  const a=colorChannels(main,turn,sat,light),c=colorChannels(second,turn,sat,light),mix=s.mix?natureNoise(122,j,0):0;
  const red=a[0]+(c[0]-a[0])*mix,green=a[1]+(c[1]-a[1])*mix,blue=a[2]+(c[2]-a[2])*mix;
  for(let p=0;p<pixels*pixels;p++){
   const i=p*4,alpha=src[i+3]/255;
   let adjusted=alpha;
   if(grain&&tile&&s.grain&&alpha){
    const x=Math.floor((p%pixels)/tileScale)%grain.width,y=Math.floor(Math.floor(p/pixels)/tileScale)%grain.height;
    adjusted=alpha+(blendTexture(b.textureMode,alpha,tile[y*grain.width+x]/255)-alpha)*s.grain;
   }
   d[i]=red;d[i+1]=green;d[i+2]=blue;d[i+3]=adjusted*255;
  }
  ctx.putImageData(image,j*pixels,0);
 }
 const atlas={canvas:surface,pixels,colors:count};
 paletteCache.set(key,atlas);paletteBytes+=surface.width*surface.height*4;
 while(paletteBytes>48*1024*1024&&paletteCache.size>1){
  const first=paletteCache.keys().next().value!;
  const old=paletteCache.get(first)!;paletteBytes-=old.canvas.width*old.canvas.height*4;paletteCache.delete(first);
 }
 return atlas;
}
export const secondaryBitmapTip=maskCanvas;
