export type ImportedGrain={name:string;pixels:string};
export type ImportedGrainControls={inkImage?:ImportedGrain;inkImageAmount?:number;inkImageScale?:number;inkImageInvert?:boolean};
export function validImportedGrain(v:unknown):v is ImportedGrain{if(!v||typeof v!=='object')return false;const q=v as ImportedGrain;return typeof q.name==='string'&&q.name.length>0&&q.name.length<=80&&typeof q.pixels==='string'&&/^[A-Za-z0-9+/]{5462}==$/.test(q.pixels);}
const decoded=new Map<string,Uint8Array>();
/** Grain is stored as a compact 64x64 luminance tile, not a linked local file. */
export function importedGrainSampler(s:ImportedGrainControls&{inkTipVersion?:1}){
 if(s.inkTipVersion!==1||!s.inkImage||!(s.inkImageAmount??1))return;
 const key=s.inkImage.pixels;let tile=decoded.get(key);if(!tile){tile=Uint8Array.from(atob(key),c=>c.charCodeAt(0));if(decoded.size>=16)decoded.delete(decoded.keys().next().value!);decoded.set(key,tile);}
 const data=tile,scale=s.inkImageScale??1,amount=s.inkImageAmount??1,invert=!!s.inkImageInvert;
 return (x:number,y:number)=>{const tx=((Math.floor(x/scale)%64)+64)%64,ty=((Math.floor(y/scale)%64)+64)%64,value=data[ty*64+tx]/255;return 1-amount*(invert?value:1-value);};
}
export async function importGrainImage(file:File):Promise<ImportedGrain>{
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('Choose a PNG, JPG or WebP image under 10 MB.');
 const image=await createImageBitmap(file);try{const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.fillStyle='#fff';ctx.fillRect(0,0,64,64);ctx.drawImage(image,0,0,64,64);const data=ctx.getImageData(0,0,64,64).data;let bytes='';for(let i=0;i<data.length;i+=4)bytes+=String.fromCharCode(Math.round(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722));return {name:file.name.slice(0,80)||'Imported grain',pixels:btoa(bytes)};}finally{image.close();}
}

