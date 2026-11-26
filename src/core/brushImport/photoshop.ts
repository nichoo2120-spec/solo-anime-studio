import {readAbr,type Brush} from 'ag-psd/dist/abr';
import type {BitmapBlendMode,BitmapMask} from '../bitmapBrush';
import type {DualMode} from '../brushShape';
import {encodeBitmapMask} from './mask';
import {brushLimit,type BrushImportAsset,type ImportProgress} from './types';

const textureModes:Partial<Record<string,BitmapBlendMode>>={multiply:'multiply',darken:'darken',subtract:'subtract',overlay:'overlay'};
const dualModes:Partial<Record<string,DualMode>>={multiply:'multiply',darken:'darken',subtract:'subtract',overlay:'overlay',lighten:'lighten',screen:'screen','linear burn':'subtract','linear height':'height'};
const normalizedName=(name:string|undefined)=>name?.replace(/\0/g,'').replace(/^\$\$\$\/[^=]*=/,'').trim();

export async function importPhotoshop(bytes:Uint8Array,progress:ImportProgress=()=>{}):Promise<BrushImportAsset[]>{
 const version=bytes.length>=4?new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint16(0):0;
 if(![1,2,6,7,9,10].includes(version))throw Error('This file is not a supported Photoshop ABR brush pack.');
 let pack:ReturnType<typeof readAbr>;
 try{pack=readAbr(bytes,{totalMemoryLimit:192*1024*1024});}
 catch{throw Error('Could not read the Photoshop ABR file. Check that the brush pack is complete and uses an ABR export version supported by Studio.');}
 const source=new Map(pack.samples.map(sample=>[sample.id,sample]));
 const patterns=new Map(pack.patterns.map(pattern=>[pattern.id,pattern]));
 const decoded=new Map<string,Promise<BitmapMask|undefined>>();
 function readSample(id:string){
  let pending=decoded.get(id);
  if(!pending){
   const s=source.get(id);
   pending=s?encodeBitmapMask(s.alpha,s.bounds.w,s.bounds.h).catch(()=>undefined):Promise.resolve(undefined);
   decoded.set(id,pending);
  }
  return pending;
 }
 async function readPattern(id:string){
  const p=patterns.get(id);
  if(!p)return;
  const alpha=new Uint8Array(p.bounds.w*p.bounds.h);
  for(let i=0,j=0;i<alpha.length;i++,j+=4)alpha[i]=Math.round((.2126*p.data[j]+.7152*p.data[j+1]+.0722*p.data[j+2])*p.data[j+3]/255);
  return encodeBitmapMask(alpha,p.bounds.w,p.bounds.h).catch(()=>undefined);
 }
 const result:BrushImportAsset[]=[],used=new Set<string>();
 const presets=pack.brushes.filter((b):b is Brush&{shape:Extract<Brush['shape'],{type:'sampled'}>}=>b.shape.type==='sampled');
 const total=presets.length+pack.samples.length;
 let completed=0;
 for(const brush of presets){
  if(result.length>=brushLimit)break;
  progress(++completed,total);
  const s=brush.shape,d=brush.shapeDynamics,v=brush.scatter,c=brush.colorDynamics,t=brush.texture;
  const tip=await readSample(s.sampledData);if(!tip)continue;
  used.add(s.sampledData);
  const grain=t?await readPattern(t.id):undefined;
  const imported:BrushImportAsset={
   name:normalizedName(brush.name)||normalizedName(s.name)||'Brush '+(result.length+1),
   tips:[tip],size:s.size||Math.max(tip.width,tip.height),angle:-s.angle,roundness:s.roundness>0?s.roundness:1,
   flipX:s.flipX,flipY:s.flipY,pressureWidth:d?.sizeDynamics.control==='pen pressure',
   opacity:brush.toolOptions?brush.toolOptions.opacity/100:undefined,flow:brush.toolOptions?brush.toolOptions.flow/100:undefined,
   bothAxes:v?.bothAxes??false,countJitter:v?.countDynamics.jitter,
   roundnessJitter:d?.roundnessDynamics.jitter,minRoundness:d?.minimumRoundness,minSize:d?.minimumDiameter,
   grain,textureMode:t?textureModes[t.blendMode]:undefined,
   settings:{
    spacing:s.spacing>0?s.spacing:brush.spacing,scatter:v?.scatterDynamics.jitter,count:v?.count,
    sizeJitter:d?.sizeDynamics.jitter,rotation:d?d.angleDynamics.jitter*180:undefined,
    flipX:d?.flipX,flipY:d?.flipY,follow:d?.angleDynamics.control==='direction'||d?.angleDynamics.control==='initial direction',
    hue:c?c.hue*100:undefined,saturation:c?c.saturation*100:undefined,brightness:c?c.brightness*100:undefined,
    mix:c?c.foregroundBackground.jitter>0||c.foregroundBackground.control!=='off':undefined,
    grain:t?.depth,scale:t?.scale,opacityJitter:brush.transfer?.opacityDynamics.jitter,
   },
  };
  const dual=brush.dualBrush;
  if(dual?.shape.type==='sampled'){
   const mask=await readSample(dual.shape.sampledData);
   if(mask){
    used.add(dual.shape.sampledData);
    imported.dual={mask,size:dual.shape.size,spacing:dual.spacing,count:dual.count,scatter:dual.useScatter?dual.scatterDynamics.jitter:0,mode:dualModes[dual.blendMode]??'multiply'};
   }
  }
  result.push(imported);
 }
 for(const sample of pack.samples){
  if(result.length>=brushLimit)break;
  progress(++completed,total);
  if(used.has(sample.id))continue;
  const tip=await readSample(sample.id);
  if(tip)result.push({name:'Brush '+(result.length+1),tips:[tip],size:Math.max(sample.bounds.w,sample.bounds.h)});
 }
 if(!result.length)throw Error('The Photoshop pack has no readable sampled brush tips.');
 return result;
}
