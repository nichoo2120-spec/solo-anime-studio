import {importGimp} from './gimp';
import {unzlibSync} from 'fflate';
import type {BitmapMask} from '../bitmapBrush';
import {brushArchive,imageBlob} from './archives';
import {decodeBrushImage,encodeBitmapMask,roundBrushMask} from './mask';
import {brushLimit,packName,type BrushImportAsset,type ImportProgress} from './types';

const utf8=new TextDecoder(),presetLimit=16*1024*1024;
const basename=(name:string)=>name.replace(/\\/g,'/').split('/').at(-1)!.toLowerCase();
const num=(value:unknown,fallback:number)=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):fallback;
const unit=(value:number)=>Math.max(0,Math.min(1,value));
const on=(value:string|undefined)=>value==='1'||value==='true';
const unescapeXml=(xml:string)=>xml.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi,(match,key:string)=>{
 const entity=key.toLowerCase();
 if(entity.startsWith('#')){
  const code=entity.startsWith('#x')?parseInt(entity.slice(2),16):Number(entity.slice(1));
  return Number.isInteger(code)&&code>=0&&code<=0x10ffff?String.fromCodePoint(code):match;
 }
 return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[entity]??match;
});
function attributes(tag:string){
 const result:Record<string,string>=Object.create(null);
 for(const m of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))result[m[1]]=unescapeXml(m[2]??m[3]);
 return result;
}
function content(text:string){
 const cdata=/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(text);
 return cdata?cdata[1]:unescapeXml(text);
}
let inflateBuffer:Uint8Array|undefined;
function inflatePreset(data:Uint8Array){
 const output=unzlibSync(data,{out:inflateBuffer??=new Uint8Array(presetLimit)});
 if(output.length>=presetLimit)throw Error('The Krita brush settings are too large.');
 return utf8.decode(output);
}
function presetXml(data:Uint8Array){
 const magic=[137,80,78,71,13,10,26,10];
 if(!magic.every((value,index)=>data[index]===value))throw Error('This file is not a Krita PNG-based KPP preset.');
 const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
 for(let at=8;at+12<=data.length;){
  const size=view.getUint32(at),start=at+8,end=start+size;
  if(end+4>data.length)throw Error('The Krita brush file is truncated.');
  const tag=utf8.decode(data.subarray(at+4,start));at=end+4;
  if(tag==='IEND')break;
  if(!['tEXt','zTXt','iTXt'].includes(tag))continue;
  const chunk=data.subarray(start,end),zero=chunk.indexOf(0);
  if(zero!==6||utf8.decode(chunk.subarray(0,zero))!=='preset')continue;
  if(size>presetLimit)throw Error('The Krita brush settings are too large.');
  if(tag==='tEXt')return utf8.decode(chunk.subarray(zero+1));
  if(tag==='zTXt'&&chunk[zero+1]===0)return inflatePreset(chunk.subarray(zero+2));
  if(tag==='iTXt'&&chunk[zero+2]===0){
   const language=chunk.indexOf(0,zero+3),keyword=language>=0?chunk.indexOf(0,language+1):-1;
   if(keyword>=0)return chunk[zero+1]?inflatePreset(chunk.subarray(keyword+1)):utf8.decode(chunk.subarray(keyword+1));
  }
 }
 throw Error('This Krita KPP has no preset settings.');
}
function preset(data:Uint8Array){
 const xml=presetXml(data).replace(/<curve><!\[CDATA\[([\s\S]*?)\]\]><\/curve>/g,'<curve>$1</curve>');
 const head=/<Preset\b([^>]*)>/i.exec(xml);
 if(!head)throw Error('The Krita preset settings are invalid.');
 const attrib=attributes(head[1]),params:Record<string,string>=Object.create(null),resources=new Map<string,Uint8Array>();
 for(const found of xml.matchAll(/<param\b([^>]*?)(?:\/>|>([\s\S]*?)<\/param>)/gi)){
  const key=attributes(found[1]).name;if(key)params[key]=content(found[2]??'');
 }
 for(const found of xml.matchAll(/<resource\b([^>]*?)>([\s\S]*?)<\/resource>/gi)){
  const {filename}=attributes(found[1]);if(!filename)continue;
  try{resources.set(basename(filename),Uint8Array.from(atob(content(found[2]).replace(/\s/g,'')),c=>c.charCodeAt(0)));}catch{/* Only malformed embedded resources are skipped. */}
 }
 return {attrib,params,resources};
}

async function autoTip(shape:Record<string,string>){
 const ratio=Math.max(.05,unit(num(shape.ratio,1))),fade=unit(num(shape.hfade,1));
 if(shape.type!=='rect'&&shape.id!=='gauss')return roundBrushMask(fade,ratio);
 const w=160,d=new Uint8Array(w*w);
 for(let i=0;i<d.length;i++){
  const x=Math.abs((i%w+.5)/w-.5)*2,y=Math.abs((Math.floor(i/w)+.5)/w-.5)*2/ratio;
  const r=shape.type==='rect'?Math.max(x,y):Math.hypot(x,y);
  const slope=shape.id==='gauss'?Math.exp(-r*r/(2*(.12+.4*fade)**2))*(1-r**8):unit((1-r)/Math.max(.01,1-fade));
  d[i]=r>=1?0:Math.round(slope*255);
 }
 return encodeBitmapMask(d,w,w);
}

async function linkedTip(filename:string,data:Uint8Array):Promise<Pick<BrushImportAsset,'tips'|'size'|'selection'>>{
 if(/\.(gbr|gih)$/i.test(filename))return (await importGimp(data,filename,()=>{}))[0];
 if(/\.(png|jpe?g|webp)$/i.test(filename)){
  const {mask,size}=await decodeBrushImage(imageBlob(data),'luminance');
  return {tips:[mask],size};
 }
 throw Error('The linked Krita tip format is unsupported.');
}

async function importKritaPreset(data:Uint8Array,fileName:string,files:Map<string,Uint8Array>):Promise<BrushImportAsset>{
 const {attrib,params,resources}=preset(data);
 const engine=attrib.paintopid??params.paintop;
 if(engine&&['filter','clone','deform','liquify','mypaintbrush'].includes(engine))throw Error('This Krita paint engine cannot be represented as bitmap dabs.');
 const lookup=(name:string)=>resources.get(basename(name))??files.get(basename(name));
 const definition=params.brush_definition??'',head=attributes(/<Brush\b([^>]*)>/i.exec(definition)?.[1]??'');
 const generator=attributes(/<MaskGenerator\b([^>]*)>/i.exec(definition)?.[1]??'');
 let tips:BitmapMask[],selection:BrushImportAsset['selection'],size=num(generator.diameter,36);
 if(head.filename){
  const bytes=lookup(head.filename);
  if(!bytes)throw Error('The Krita tip “'+head.filename+'” is missing. Import a bundle or a KPP with embedded resources.');
  const tip=await linkedTip(head.filename,bytes);tips=tip.tips;selection=tip.selection;size=tip.size*num(head.scale,1);
 }else if(head.type&&head.type!=='auto_brush')throw Error('The Krita preset does not include a supported bitmap or generated tip.');
 else tips=[await autoTip(generator)];
 let grain:BitmapMask|undefined;
 if(on(params['Texture/Pattern/Enabled'])){
  try{
   const texture=params['Texture/Pattern/Pattern'];
   const file=params['Texture/Pattern/PatternFileName']??'';
   const bytes=texture?Uint8Array.from(atob(texture.replace(/\s/g,'')),c=>c.charCodeAt(0)):lookup(file);
   if(bytes)grain=(await decodeBrushImage(imageBlob(bytes),on(params['Texture/Pattern/Invert'])?'luminance':'light')).mask;
  }catch{/* A missing optional grain does not invalidate the tip. */}
 }
 const activeSensor=(option:string,pattern:RegExp)=>on(params['Pressure'+option]??params[option+'UseCurve'])&&pattern.test(params[option+'Sensor']??'');
 const angle=((num(head.angle,0)*180/Math.PI+180)%360+360)%360-180;
 const name=attrib.name?.trim()||packName(fileName);
 return {
  name,tips,size,angle,grain,selection,
  pressureWidth:activeSensor('Size',/pressure/i),
  roundnessJitter:activeSensor('Ratio',/fuzzy|random/i)?1:0,
  settings:{
   spacing:on(head.useAutoSpacing)?num(head.autoSpacingCoeff,1)*.1:num(head.spacing,.1),
   scatter:on(params.PressureScatter)?num(params.ScatterAmount,0):0,
   count:Math.max(1,num(params['Spray/particleCount'],1)),
   sizeJitter:activeSensor('Size',/fuzzy|random/i)?1:0,
   rotation:activeSensor('Rotation',/fuzzy|random/i)?180:0,
   follow:activeSensor('Rotation',/drawingangle/i),
   hue:activeSensor('Hue',/fuzzy|random/i)?100:0,
   saturation:activeSensor('Saturation',/fuzzy|random/i)?100:0,
   brightness:activeSensor('Value',/fuzzy|random/i)?100:0,
   opacityJitter:activeSensor('Opacity',/fuzzy|random/i)?1:0,
   grain:grain?num(params['Texture/Pattern/Strength']??params['Texture/Strength/Value'],1):0,
   scale:num(params['Texture/Pattern/Scale'],1),
  },
 };
}
export async function importKrita(data:Uint8Array,fileName:string,progress:ImportProgress){
 if(fileName.toLowerCase().endsWith('.kpp'))return [await importKritaPreset(data,fileName,new Map())];
 const files=brushArchive(data,name=>/\.(kpp|png|jpe?g|webp|gbr|gih)$/i.test(name));
 const res=new Map(Object.entries(files).map(([name,bytes])=>[basename(name),bytes]));
 const presets=Object.entries(files).filter(([name])=>/\.kpp$/i.test(name)).slice(0,brushLimit),result:BrushImportAsset[]=[];
 for(const [i,[name,bytes]] of presets.entries()){
  progress(i,presets.length);
  try{result.push(await importKritaPreset(bytes,basename(name),res));}catch{/* Other supported presets in the bundle remain importable. */}
 }
 if(!result.length)throw Error('The Krita bundle contains no readable brush presets with supported tips.');
 return result;
}
