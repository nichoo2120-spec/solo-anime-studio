import {bitmapMaxSide,type BitmapMask} from '../bitmapBrush';
import type {AlphaSource} from './types';

export async function encodeBitmapMask(source:Uint8Array,width:number,height:number):Promise<BitmapMask>{
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||source.length!==width*height)throw Error('Invalid brush tip dimensions.');
 const ratio=Math.min(1,bitmapMaxSide/Math.max(width,height));
 const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
 const data=new Uint8Array(w*h+4);
 const dimensions=new DataView(data.buffer);dimensions.setUint16(0,w);dimensions.setUint16(2,h);
 if(ratio===1)data.set(source,4);
 else{
  // Area averages preserve narrow pen marks and grain when reducing large tips.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const left=Math.floor(x*width/w),right=Math.floor((x+1)*width/w);
   const top=Math.floor(y*height/h),bottom=Math.floor((y+1)*height/h);
   let sum=0;
   for(let sy=top;sy<bottom;sy++)for(let sx=left;sx<right;sx++)sum+=source[sy*width+sx];
   data[4+y*w+x]=Math.round(sum/((right-left)*(bottom-top)));
  }
 }
 if(!data.subarray(4).some(v=>v!==0))throw Error('The brush tip is empty.');
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
 const id='mask-'+Array.from(digest,v=>v.toString(16).padStart(2,'0')).join('');
 let bytes='';
 for(let i=4;i<data.length;i+=8192)bytes+=String.fromCharCode(...data.subarray(i,i+8192));
 return {id,width:w,height:h,alpha:btoa(bytes)};
}

export async function decodeBrushImage(blob:Blob,mode:AlphaSource|'light'='auto'){
 let bitmap:ImageBitmap;
 try{bitmap=await createImageBitmap(blob);}catch{throw Error('Could not decode this PNG or JPEG brush tip.');}
 try{
  const {width,height}=bitmap;
  if(width>16384||height>16384||width*height>32*1024*1024)throw Error('The brush image is too large to decode.');
  const ratio=Math.min(1,bitmapMaxSide/Math.max(width,height));
  const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
  const surface=new OffscreenCanvas(w,h),ctx=surface.getContext('2d',{willReadFrequently:true})!;
  ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,w,h);
  const rgba=ctx.getImageData(0,0,w,h).data,alpha=new Uint8Array(w*h);
  let useAlpha=mode==='alpha';
  if(mode==='auto')for(let i=3;i<rgba.length;i+=4)if(rgba[i]!==255){useAlpha=true;break;}
  for(let i=0,j=0;i<alpha.length;i++,j+=4){
   const luminance=(54*rgba[j]+183*rgba[j+1]+19*rgba[j+2])/256;
   alpha[i]=useAlpha?rgba[j+3]:Math.round((mode==='light'?luminance:255-luminance)*rgba[j+3]/255);
  }
  return {mask:await encodeBitmapMask(alpha,w,h),size:Math.max(width,height)};
 }finally{bitmap.close();}
}

export function roundBrushMask(hardness=.7,roundness=1){
 const size=112,alpha=new Uint8Array(size*size);
 for(let y=0,i=0;y<size;y++)for(let x=0;x<size;x++,i++){
  const r=Math.hypot(((x+.5)/size-.5)*2,((y+.5)/size-.5)*2/Math.max(.05,roundness));
  alpha[i]=Math.round(255*Math.max(0,Math.min(1,(1-r)/Math.max(.02,1-hardness))));
 }
 return encodeBitmapMask(alpha,size,size);
}
