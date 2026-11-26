import {unzipSync} from 'fflate';

const expandedLimit=192*1024*1024;
/** Decode only the supported file types and bound their advertised expansion. */
export function brushArchive(bytes:Uint8Array,include:(name:string)=>boolean){
 let expanded=0,entries=0;
 return unzipSync(bytes,{filter(entry){
  if(entry.name.length>1024||entry.name.startsWith('__MACOSX/')||!include(entry.name))return false;
  if(++entries>3000||(expanded+=entry.originalSize)>expandedLimit||entry.originalSize>64*1024*1024)throw Error('The brush archive expands beyond the supported size.');
  return true;
 }});
}

export const imageBlob=(data:Uint8Array)=>new Blob([Uint8Array.from(data)]);
