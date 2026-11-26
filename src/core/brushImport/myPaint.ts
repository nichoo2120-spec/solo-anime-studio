import {roundBrushMask} from './mask';
import {packName,type BrushImportAsset} from './types';

type JsonBrushSetting={base_value?:unknown;inputs?:Record<string,unknown>};
const finite=(v:unknown,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?v:fallback;
const clamp=(v:number,low:number,high:number)=>Math.max(low,Math.min(high,v));
const unit=(v:number)=>clamp(v,0,1);

export async function importMyPaint(bytes:Uint8Array,fileName:string):Promise<BrushImportAsset[]>{
 if(bytes.length>1024*1024)throw Error('The MyPaint preset settings are too large.');
 let parsed:{name?:unknown;version?:unknown;settings?:Record<string,JsonBrushSetting>};
 try{parsed=JSON.parse(new TextDecoder().decode(bytes));}
 catch{throw Error('Could not read the MyPaint MYB. Export the brush as a JSON preset.');}
 const settings=parsed?.settings;
 if(!settings||typeof settings!=='object'||Array.isArray(settings)||![2,3].includes(Number(parsed.version)))throw Error('The MyPaint preset settings or version are unsupported.');
 const value=(name:string,fallback=0)=>finite(settings[name]?.base_value,fallback);
 const curve=(setting:string,input:string):unknown[]=>{
  const selected=settings[setting]?.inputs?.[input];return Array.isArray(selected)?selected:[];
 };
 const excursion=(setting:string,input='random')=>{
  let range=0;
  for(const point of curve(setting,input))if(Array.isArray(point))range=Math.max(range,Math.abs(finite(point[1],0)));
  return range;
 };
 const radius=clamp(value('radius_logarithmic',2),-2,6);
 const actualDabs=value('dabs_per_actual_radius',1.5),baseDabs=value('dabs_per_basic_radius',0);
 const alpha=value('opaque',1)*value('opaque_multiply',1);
 const angle=((value('elliptical_dab_angle')+180)%360+360)%360-180;
 const tip=await roundBrushMask(unit(value('hardness',.8)));
 return [{
  name:typeof parsed.name==='string'&&parsed.name.trim()?parsed.name:packName(fileName),
  tips:[tip],size:2*Math.exp(radius),angle,roundness:1/clamp(value('elliptical_dab_ratio',1),1,20),
  opacity:unit(alpha),pressureWidth:curve('radius_logarithmic','pressure').length>0,
  pressureOpacity:curve('opaque','pressure').length>0||curve('opaque_multiply','pressure').length>0,
  settings:{
   spacing:1/(2*Math.max(.25,actualDabs+baseDabs)),scatter:unit((value('offset_by_random')+excursion('offset_by_random'))*.5),
   sizeJitter:unit(1-Math.exp(-Math.max(value('radius_by_random'),excursion('radius_logarithmic')))),
   rotation:clamp(excursion('elliptical_dab_angle'),0,180),
   follow:curve('elliptical_dab_angle','direction').length>0,
   hue:unit(excursion('change_color_h'))*100,
   saturation:unit(Math.max(excursion('change_color_hsl_s'),excursion('change_color_hsv_s')))*100,
   brightness:unit(Math.max(excursion('change_color_l'),excursion('change_color_v')))*100,
   opacityJitter:unit(Math.max(excursion('opaque'),excursion('opaque_multiply'))),
  },
 }];
}
