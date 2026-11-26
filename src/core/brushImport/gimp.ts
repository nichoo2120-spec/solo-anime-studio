import {bitmapMaxTips,type BitmapMask,type BitmapTipSelection} from '../bitmapBrush';
import {encodeBitmapMask} from './mask';
import {packName,type BrushImportAsset,type ImportProgress} from './types';

const text=new TextDecoder();
const gimpMagic=0x47494d50;
const selectors:Record<string,BitmapTipSelection>={
 incremental:'sequence',random:'random',pressure:'pressure',angular:'direction',velocity:'velocity',
};
function gbr(data:Uint8Array,offset:number){
 if(offset+20>data.length)throw Error('The GIMP brush header is truncated.');
 const v=new DataView(data.buffer,data.byteOffset,data.byteLength);
 const header=v.getUint32(offset),version=v.getUint32(offset+4);
 const w=v.getUint32(offset+8),h=v.getUint32(offset+12),format=v.getUint32(offset+16);
 if(![1,2,3].includes(version)||w<1||h<1||w*h>32*1024*1024)throw Error('The GIMP brush dimensions or version are unsupported.');
 const base=version===1?20:28,channels=version===3&&format===18?2:format;
 if(header<base||header>base+65536||offset+header+w*h*channels>data.length||!(version===3?channels===2:[1,4].includes(channels)))throw Error('The GIMP brush tip is invalid or truncated.');
 if(version!==1&&v.getUint32(offset+20)!==gimpMagic)throw Error('This file is not a GIMP brush.');
 const name=text.decode(data.subarray(offset+base,offset+header)).split('\0')[0];
 const spacing=version===1?.25:v.getUint32(offset+24)/100;
 const start=offset+header,end=start+w*h*channels;
 let alpha;
 if(channels===1)alpha=data.subarray(start,end);
 else{
  alpha=new Uint8Array(w*h);
  for(let i=0;i<alpha.length;i++){
   if(channels===4)alpha[i]=data[start+i*4+3];
   else{
    const half=v.getUint16(start+i*2),exp=half>>10&31,mantissa=half&1023;
    const value=half&32768?0:exp===0?mantissa*2**-24:exp===31?1:(1+mantissa/1024)*2**(exp-15);
    alpha[i]=Math.round(255*Math.min(1,value));
   }
  }
 }
 return {name,spacing,w,h,end,alpha};
}
export async function importGimp(data:Uint8Array,fileName:string,progress:ImportProgress):Promise<BrushImportAsset[]>{
 if(fileName.toLowerCase().endsWith('.gbr')){
  const r=gbr(data,0),tip=await encodeBitmapMask(r.alpha,r.w,r.h);
  return [{name:r.name.trim()||packName(fileName),size:Math.max(r.w,r.h),tips:[tip],settings:{spacing:r.spacing||.25}}];
 }
 const top=data.subarray(0,8192),first=top.indexOf(10),second=first>=0?top.indexOf(10,first+1):-1;
 if(first<1||second<0)throw Error('This GIMP GIH is missing its image-pipe header.');
 const name=text.decode(top.subarray(0,first)).trim(),metadata=text.decode(top.subarray(first+1,second)).trim();
 const count=Number(/^\d+/.exec(metadata)?.[0]);
 if(!Number.isInteger(count)||count<1||count>bitmapMaxTips)throw Error('Studio supports GIMP image pipes containing 1 to '+bitmapMaxTips+' tips.');
 const options=new Map([...metadata.matchAll(/([a-z]+\d*):([^\s]+)/gi)].map(m=>[m[1].toLowerCase(),m[2].toLowerCase()]));
 const selection=options.get('sel0')??options.get('selection')??'random';
 const tips:BitmapMask[]=[];
 let offset=second+1,size=0,tipSpacing=.25;
 for(let i=0;i<count;i++){
  progress(i,count);
  const r=gbr(data,offset);offset=r.end;
  if(i===0)tipSpacing=r.spacing||.25;
  size=Math.max(size,r.w,r.h);
  try{tips.push(await encodeBitmapMask(r.alpha,r.w,r.h));}catch{/* Entirely blank cells cannot leave paint. */}
 }
 const step=Number(options.get('step'));
 if(!tips.length)throw Error('The GIMP image pipe has no non-empty brush cells.');
 return [{name:name||packName(fileName),size,tips,selection:selectors[selection]??'random',settings:{spacing:Number.isFinite(step)&&step>0?step/100:tipSpacing}}];
}
