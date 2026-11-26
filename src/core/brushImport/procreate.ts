import {parse} from '@plist/binary.parse';
import {brushArchive,imageBlob} from './archives';
import {decodeBrushImage,roundBrushMask} from './mask';
import {brushLimit,packName,type BrushImportAsset,type ImportProgress} from './types';

type Dictionary=Record<string,unknown>;
const dict=(value:unknown):Dictionary|undefined=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&!ArrayBuffer.isView(value)?value as Dictionary:undefined;
const num=(raw:Dictionary, key:string,fallback:number)=>typeof raw[key]==='number'&&Number.isFinite(raw[key])?raw[key] as number:fallback;
const unit=(value:number)=>Math.max(0,Math.min(1,value));

function brushSettings(data:Uint8Array):Dictionary{
 if(data.length<40||data.length>4*1024*1024)throw Error('Invalid Procreate brush settings archive.');
 const archive=dict(parse(Uint8Array.from(data).buffer));
 if(!archive)throw Error('Invalid Procreate brush settings archive.');
 const objects=Array.isArray(archive.$objects)?archive.$objects:[];
 const take=(value:unknown)=>{
  const uid=dict(value)?.CF$UID;
  return typeof uid==='number'&&Number.isInteger(uid)?objects[uid]:value;
 };
 const top=dict(archive.$top);
 const root=take(top?(top.root??Object.values(top)[0]):archive);
 const result:Dictionary=Object.create(null),seen=new Set<Dictionary>();
 function walk(value:unknown,depth:number){
  const record=dict(take(value));
  if(!record||depth>18||seen.has(record))return;
  seen.add(record);
  const keys=record['NS.keys'],values=record['NS.objects'];
  if(Array.isArray(keys)&&Array.isArray(values)){
   for(let i=0;i<Math.min(keys.length,values.length);i++){
    const key=take(keys[i]);if(typeof key==='string')add(key,take(values[i]),depth);
   }
  }
  for(const [key,v] of Object.entries(record))if(!key.startsWith('$')&&!key.startsWith('NS.'))add(key,take(v),depth);
 }
 function add(key:string,value:unknown,depth:number){
  if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')result[key]=value;
  else walk(value,depth+1);
 }
 walk(root,0);
 if(!Object.keys(result).length)throw Error('No Procreate brush settings were found.');
 return result;
}

const relevant=(name:string)=>/(?:^|\/)(?:brush\.archive|shape\.(?:png|jpe?g)|grain\.(?:png|jpe?g))$/i.test(name)||/\.brush$/i.test(name);
export async function importProcreate(bytes:Uint8Array,fileName:string,progress:ImportProgress):Promise<BrushImportAsset[]>{
 const entries=brushArchive(bytes,relevant);
 const lower=new Map(Object.entries(entries).map(([name,data])=>[name.toLowerCase(),data]));
 const roots=[...lower.keys()].filter(key=>key.endsWith('brush.archive')&&!/(^|\/)reset\//.test(key)).slice(0,brushLimit);
 const nested=[...lower.entries()].filter(([key])=>key.endsWith('.brush'));
 const results:BrushImportAsset[]=[];
 let index=0;
 for(const archive of roots){
  progress(++index,roots.length+nested.length);
  try{
   const s=brushSettings(lower.get(archive)!);
   const prefix=archive.slice(0,-'brush.archive'.length);
   const image=(name:string)=>{
    const item=lower.get(prefix+name+'.png')??lower.get(prefix+name+'.jpg')??lower.get(prefix+name+'.jpeg');
    return item?imageBlob(item):undefined;
   };
   const shape=image('shape'),grain=image('grain');
   const builtin=String(s.bundledShapePath??'');
   const tip=shape?(await decodeBrushImage(shape,s.shapeInverted?'luminance':'light')).mask:await roundBrushMask(/soft|air/i.test(builtin)?.2:.94,/oval|ellipse/i.test(builtin)?.62:1);
   const size=num(s,'paintSize',.25),min=num(s,'minSize',0),max=num(s,'maxSize',1);
   const name=typeof s.name==='string'&&s.name!=='$null'?s.name:typeof s.paintName==='string'?s.paintName:packName(prefix.split('/').filter(Boolean).at(-1)??fileName);
   const angle=(num(s,'shapeAngle',num(s,'shapeRotation',0))*360+180)%360-180;
   const texture=grain?await decodeBrushImage(grain,s.textureInverted?'luminance':'light').then(r=>r.mask).catch(()=>undefined):undefined;
   results.push({
    name,tips:[tip],grain:texture,size:size>1.5?size:100*(min+(max-min)*unit(size)),angle,roundness:unit(num(s,'shapeRoundness',1)),
    pressureMinSize:unit(1-num(s,'dynamicsPressureSize',0)),pressureWidth:num(s,'dynamicsPressureSize',0)>0,
    opacity:unit(num(s,'paintOpacity',1)),flow:unit(num(s,'dynamicsGlazedFlow',1)),
    countJitter:unit(num(s,'shapeCountJitter',0)),roundnessJitter:unit(num(s,'shapeRoundnessJitter',0)),
    settings:{
     spacing:num(s,'plotSpacing',num(s,'spacing',.1)),scatter:num(s,'plotJitter',num(s,'jitter',0)),count:Math.max(1,num(s,'shapeCount',1)),
     sizeJitter:unit(num(s,'dynamicsJitterSize',0)),opacityJitter:unit(num(s,'dynamicsJitterOpacity',0)),
     rotation:s.shapeRandomise||s.shapeRandomizedRotation?180:180*unit(num(s,'shapeScatter',0)),follow:'shapeAngle' in s?num(s,'shapeRotation',0)>=.5:!!s.oriented,
     flipX:!!(s.shapeFlipXJitter??s.shapeFlipX),flipY:!!(s.shapeFlipYJitter??s.shapeFlipY),
     hue:100*unit(num(s,'dynamicsJitterHue',0)),saturation:100*unit(num(s,'dynamicsJitterSaturation',0)),
     brightness:100*unit(Math.max(num(s,'dynamicsJitterLightness',0),num(s,'dynamicsJitterDarkness',0))),mix:num(s,'dynamicsJitterSecondaryColor',0)>0,
     grain:texture?unit(num(s,'grainDepth',1)):0,scale:num(s,'textureScale',num(s,'grainScale',1)),
    },
   });
  }catch{/* Other complete brushes in a pack remain importable. */}
 }
 for(const [name,data] of nested){
  if(results.length>=brushLimit)break;
  progress(++index,roots.length+nested.length);
  // Embedded .brush entries may not introduce another nested archive level.
  try{if(fileName.toLowerCase().endsWith('.brushset'))results.push(...(await importProcreate(data,name,()=>{})).slice(0,brushLimit-results.length));}catch{/* Skip unreadable entries. */}
 }
 if(!results.length)throw Error('No readable Procreate Brush.archive and tip were found in the file.');
 return results;
}
