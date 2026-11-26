import initSqlJs,{type Database,type SqlValue} from 'sql.js';
import wasm from 'sql.js/dist/sql-wasm-browser.wasm?url';
import {bitmapMaxTips,type BitmapMask} from '../bitmapBrush';
import {imageBlob} from './archives';
import {decodeClipLayer} from './clipLayer';
import {decodeBrushImage,encodeBitmapMask,roundBrushMask} from './mask';
import {brushLimit,packName,type BrushImportAsset,type ImportProgress} from './types';

const utf8=new TextDecoder(),utf16=new TextDecoder('utf-16le');
type Row=Record<string,SqlValue>;
const pct=(n:number)=>Math.max(0,Math.min(1,n/100));
const num=(r:Row,k:string,fallback=0)=>typeof r[k]==='number'&&Number.isFinite(r[k])?r[k] as number:fallback;
function query(db:Database,sql:string,params:SqlValue[]=[]):Row[]{
 const result=db.exec(sql,params)[0];
 return result?result.values.map(values=>Object.fromEntries(result.columns.map((name,i)=>[name,values[i]]))):[];
}
function paths(value:SqlValue|undefined){
 if(typeof value==='string')return [value];
 if(!(value instanceof Uint8Array)||value.length<8)return [];
 const v=new DataView(value.buffer,value.byteOffset,value.byteLength),result:string[]=[];
 const count=Math.min(v.getUint32(4),bitmapMaxTips);
 let offset=v.getUint32(0);
 for(let i=0;i<count&&offset+8<=value.length;i++){
  const length=v.getUint32(offset),bytes=v.getUint32(offset+4);
  if(length<8||offset+length>value.length||bytes>length-8||bytes%2)break;
  result.push(utf16.decode(value.subarray(offset+8,offset+8+bytes)).replace(/\0+$/,''));
  offset+=length;
 }
 return result;
}
function tarImages(data:Uint8Array){
 const files=new Map<string,Uint8Array>();
 for(let at=0;at+512<=data.length;){
  const name=utf8.decode(data.subarray(at,at+100)).split('\0')[0];
  if(!name)break;
  const label=utf8.decode(data.subarray(at+124,at+136)).split('\0')[0].trim();
  if(!/^[0-7]+$/.test(label))break;
  const length=parseInt(label,8),start=at+512;
  if(start+length>data.length)break;
  if(/\.(?:layer|png|jpe?g)$/i.test(name))files.set(name,data.subarray(start,start+length));
  at=start+Math.ceil(length/512)*512;
 }
 return files;
}
async function material(data:Uint8Array,grain:boolean):Promise<BitmapMask|undefined>{
 const files=tarImages(data);
 for(const [name,bytes] of files){
  if(!name.endsWith('.layer'))continue;
  try{
   const pixels=decodeClipLayer(bytes);
   if(!pixels)continue;
   const {alpha,tone,width,height}=pixels;
   if(grain)for(let i=0;i<alpha.length;i++)alpha[i]=Math.round(255+(tone[i]-255)*alpha[i]/255);
   else if(alpha.every(v=>v===255)&&tone.some(v=>v!==tone[0]))for(let i=0;i<alpha.length;i++)alpha[i]=255-tone[i];
   return await encodeBitmapMask(alpha,width,height);
  }catch{/* Fall back to a material image supported by the browser. */}
 }
 const preview=[...files.entries()].find(([key])=>/\.(png|jpe?g)$/i.test(key))?.[1]??data;
 return (await decodeBrushImage(imageBlob(preview),grain?'light':'auto').catch(()=>undefined))?.mask;
}
const effector=(value:SqlValue|undefined)=>{
 if(!(value instanceof Uint8Array)||value.length<28)return {enabled:0,pressure:0,random:0};
 const view=new DataView(value.buffer,value.byteOffset,value.byteLength),enabled=view.getUint32(8);
 return {enabled,pressure:pct(view.getInt32(12)),random:1-pct(view.getInt32(24))};
};
let sqlModule:ReturnType<typeof initSqlJs>|undefined;

export async function importClipStudio(bytes:Uint8Array,fileName:string,progress:ImportProgress):Promise<BrushImportAsset[]>{
 if(utf8.decode(bytes.subarray(0,16))!=='SQLite format 3\0')throw Error('This file is not a Clip Studio SUT database.');
 const inNode=typeof self==='undefined';
 const SQL=await (sqlModule??=initSqlJs(inNode?undefined:{locateFile:()=>wasm}));
 const db=new SQL.Database(bytes);
 try{
  db.run('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;');
  const tables=new Set(query(db,"SELECT name FROM sqlite_master WHERE type='table'").map(row=>row.name));
  if(!tables.has('Node')||!tables.has('Variant'))throw Error('The Clip Studio SUT is missing its brush settings tables.');
  const nodes=query(db,'SELECT NodeName, NodeVariantID FROM Node WHERE NodeVariantID != 0 LIMIT '+brushLimit);
  const materialFields=tables.has('MaterialFile')?new Set(query(db,'PRAGMA table_info(MaterialFile)').map(row=>row.name)):new Set();
  const cached=new Map<string,Promise<BitmapMask|undefined>>();
  const image=(path:string,grain=false)=>{
   const key=path+'|'+grain;
   let pending=cached.get(key);
   if(pending)return pending;
   const row=query(db,materialFields.has('OriginalPath')&&path?'SELECT FileData FROM MaterialFile WHERE OriginalPath = ? LIMIT 1':'SELECT FileData FROM MaterialFile LIMIT 1',materialFields.has('OriginalPath')&&path?[path]:[])[0];
   pending=row?.FileData instanceof Uint8Array?material(row.FileData,grain):Promise.resolve(undefined);
   cached.set(key,pending);return pending;
  };
  const results:BrushImportAsset[]=[];
  for(const [i,node] of nodes.entries()){
   progress(i,nodes.length);
   const row=query(db,'SELECT * FROM Variant WHERE VariantID = ? LIMIT 1',[node.NodeVariantID])[0];
   if(!row)continue;
   const references=paths(row.BrushPatternImageArray);
   const tips:BitmapMask[]=[];
   if(materialFields.has('FileData')){
    for(const path of references){const tip=await image(path);if(tip)tips.push(tip);}
    if(!tips.length&&!references.length&&row.BrushUsePatternImage!==0){
     const first=await image('');if(first)tips.push(first);
    }
   }
   if(!tips.length&&references.length)continue;
   if(!tips.length)tips.push(await roundBrushMask(pct(num(row,'BrushHardness',90))));
   const interval=num(row,'BrushAutoIntervalType'),spacing=interval?([0,.5,.25,.1][interval]??.25):num(row,'BrushInterval',25)/100;
   const duration=effector(row.BrushSizeEffector),rotation=effector(row.BrushRotationEffector);
   const size=num(row,'BrushSize',36),texture=paths(row.TextureImage)[0],dual=paths(row.DualPatternImageArray)[0];
   const grain=texture&&materialFields.has('FileData')?await image(texture,true):undefined;
   const dualTip=dual&&materialFields.has('FileData')&&row.UseDualBrush?await image(dual):undefined;
   results.push({
    name:typeof node.NodeName==='string'&&node.NodeName.trim()?node.NodeName:packName(fileName),tips,size,
    angle:-num(row,'BrushRotation'),roundness:pct(num(row,'BrushThickness',100)),
    pressureWidth:!!(duration.enabled&16),pressureMinSize:duration.pressure,grain,opacity:pct(num(row,'Opacity',100)),flow:pct(num(row,'BrushFlow',100)),
    textureMode:num(row,'TextureCompositeMode')===1?'subtract':'multiply',
    settings:{spacing,scatter:row.BrushUseSpray?num(row,'SprayDeviation',40)/100:0,
     count:row.BrushUseSpray?num(row,'SprayDensity',2):1,
     sizeJitter:duration.enabled&128?duration.random:0,rotation:rotation.enabled&128?rotation.random*180:0,follow:!!(rotation.enabled&64),
     grain:grain?pct(num(row,'TextureDensity',100)):0,scale:num(row,'TextureScale',100)/100},
    dual:dualTip?{mask:dualTip,size:num(row,'DualSize',size),spacing:num(row,'DualInterval',25)/100,count:num(row,'DualSprayDensity',1),scatter:num(row,'DualSprayDeviation',0)/100,mode:'multiply'}:undefined,
   });
  }
  if(!results.length)throw Error('The Clip Studio SUT contains no readable brush and material.');
  return results;
 }finally{db.close();}
}
