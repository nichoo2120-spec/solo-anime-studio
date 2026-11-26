import {decodeBrushImage} from './mask';
import {importMyPaint} from './myPaint';
import {importGimp} from './gimp';
import {importKrita} from './krita';
import {importClipStudio} from './clipStudio';
import {importProcreate} from './procreate';
import {importPhotoshop} from './photoshop';
import {brushAccept,importLimit,packName,type AlphaSource,type BrushImportAsset,type ImportProgress} from './types';

export async function importBrushFile(file:File,mode:AlphaSource,progress:ImportProgress):Promise<BrushImportAsset[]>{
 if(file.size===0||file.size>importLimit)throw Error('Choose a brush file between 1 byte and 50 MB.');
 const extension=file.name.split('.').at(-1)?.toLowerCase();
 progress(0,1);
 if(extension==='abr'){
  return importPhotoshop(new Uint8Array(await file.arrayBuffer()),progress);
 }
 if(extension==='brush'||extension==='brushset')return importProcreate(new Uint8Array(await file.arrayBuffer()),file.name,progress);
 if(extension==='sut')return importClipStudio(new Uint8Array(await file.arrayBuffer()),file.name,progress);
 if(extension==='bundle'||extension==='kpp')return importKrita(new Uint8Array(await file.arrayBuffer()),file.name,progress);
 if(extension==='gbr'||extension==='gih')return importGimp(new Uint8Array(await file.arrayBuffer()),file.name,progress);
 if(extension==='myb')return importMyPaint(new Uint8Array(await file.arrayBuffer()),file.name);
 if(extension==='png'||extension==='jpg'||extension==='jpeg'){
  const {mask,size}=await decodeBrushImage(file,mode);
  return [{name:packName(file.name),size,tips:[mask]}];
 }
 throw Error('Unsupported brush format. Choose '+brushAccept+'.');
}
