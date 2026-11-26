import {validBitmapMask} from '../bitmapBrush';
import type {AlphaSource,BrushImportAsset,ImportProgress} from './types';

export function importInWorker(file:File,mode:AlphaSource,progress:ImportProgress){
 return new Promise<BrushImportAsset[]>((resolve,reject)=>{
  const brushes:BrushImportAsset[]=[];
  const worker=new Worker(new URL('./import.worker.ts',import.meta.url),{type:'module'});
  const finish=(error:Error)=>{worker.terminate();reject(error);};
  worker.onerror=()=>finish(Error('The brush import worker could not read the file.'));
  worker.onmessageerror=()=>finish(Error('The imported brush could not be transferred.'));
  worker.onmessage=event=>{
   const data=event.data as {error?:string;brushes?:BrushImportAsset[];done?:boolean;current:number;total:number};
   if(data.error){finish(Error(data.error));return;}
   if(data.brushes){
    for(const brush of data.brushes){
     if(!brush.tips.length||!brush.tips.every(validBitmapMask)||brush.grain&&!validBitmapMask(brush.grain)||brush.dual&&!validBitmapMask(brush.dual.mask)){
      finish(Error('An imported brush tip has invalid pixel data.'));return;
     }
     brushes.push(brush);
    }
    return;
   }
   if(data.done){worker.terminate();resolve(brushes);return;}
   progress(data.current,data.total);
  };
  worker.postMessage({file,mode});
 });
}
