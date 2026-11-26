import {importBrushFile} from './index';
import type {AlphaSource} from './types';

self.onmessage=async(event:MessageEvent<{file:File;mode:AlphaSource}>)=>{
 const {file,mode}=event.data;
 try{
  const brushes=await importBrushFile(file,mode,(current,total)=>self.postMessage({current,total}));
  // Deliver a pack in small messages so the UI never has to deserialize
  // tens of megabytes of brush data in one browser task.
  for(let at=0;at<brushes.length;at+=8)self.postMessage({brushes:brushes.slice(at,at+8)});
  self.postMessage({done:true});
 }catch(error){
  self.postMessage({error:error instanceof Error?error.message:'The brush file could not be read.'});
 }
};
