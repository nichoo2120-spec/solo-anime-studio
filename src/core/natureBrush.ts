export const natureCategory='Texture / Nature' as const;
export const naturePresets=[
 ['grass-short','Short grass','#769b46','#425f2f'],
 ['grass-tall','Tall grass','#668f53','#354c32'],
 ['grass-edge','Grass edge','#638640','#344d32'],
 ['leaves-round','Leaves (round)','#75954a','#3a663d'],
 ['leaves-pointed','Leaves (pointed)','#659d58','#315b44'],
 ['leaves-falling','Falling leaves','#d88242','#ac4f42'],
 ['foliage-clump','Foliage clump','#68924d','#314e38'],
 ['rock-surface','Rock surface','#96938c','#676c73'],
 ['rock-pebbles','Pebbles / gravel','#aaa29a','#6c716e'],
 ['rock-cliff','Cliff texture','#8d8584','#606b78'],
 ['cloud-soft','Soft fluffy cloud','#eef3f6','#abbed9'],
 ['cloud-cumulus','Cumulus','#fff4e6','#bdcde4'],
 ['cloud-streak','Thin streak clouds','#e2eaf5','#abbdd6'],
 ['cloud-highlight','Cloud edge highlight','#fff7e7','#d9e8ff'],
 ['water-foam','Wave foam','#ffffff','#9ee2eb'],
 ['water-ripples','Water ripples','#89dcdf','#358da9'],
 ['water-sparkle','Sea sparkle','#ffffec','#9de7ef'],
 ['water-crest','Wave crest','#b8f3ee','#399eb2'],
 ['flowers','Flowers','#ec99a9','#ebc682'],
 ['wood-grain','Bark / wood grain','#bf9675','#735546'],
 ['dirt-soil','Dirt / soil','#ad845e','#7d694f'],
 ['snow','Snow','#f4faff','#bbd8f5'],
 ['stars','Stars','#fff4d0','#bad7ff'],
] as const;
export type NatureTip=typeof naturePresets[number][0];
export const isNatureTip=(value:unknown):value is NatureTip=>naturePresets.some(([id])=>id===value);
export function natureTipFromKind(kind?:string):NatureTip|undefined{
 const tip=kind?.startsWith('nature-')?kind.slice(7):undefined;
 return isNatureTip(tip)?tip:undefined;
}


export const natureNumbers=[
 ['scatter','Scatter amount',0,1,.32],
 ['count','Count per dab',1,12,2],
 ['sizeJitter','Size jitter',0,1,.35],
 ['rotation','Rotation jitter',0,180,22],
 ['hue','Hue jitter',0,100,8],
 ['saturation','Saturation jitter',0,100,12],
 ['brightness','Brightness jitter',0,100,14],
 ['density','Density',0,1,.83],
 ['spacing','Spacing',.06,2,.34],
 ['opacityJitter','Opacity jitter',0,1,.25],
 ['grain','Grain / texture strength',0,1,.18],
 ['scale','Texture scale',.25,4,1],
 ['seed','Seed',0,4294967295,1],
] as const;
export const natureFlags=[
 ['follow','Follow stroke direction'],
 ['mix','Use main + second color mix'],
 ['flipX','Random flip X'],
 ['flipY','Random flip Y'],
] as const;
export type NatureSettings=Record<typeof natureNumbers[number][0],number>&Record<typeof natureFlags[number][0],boolean>&{tip:NatureTip;second:string};
export type NatureControls={natureVersion?:1;nature?:NatureSettings};
const hex=(v:unknown):v is string=>typeof v==='string'&&/^#[\da-f]{6}$/i.test(v);
const numeric=(v:unknown,min:number,max:number,d:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):d;

export function natureSettings(tip:NatureTip,raw?:Partial<NatureSettings>):NatureSettings{
 const preset=naturePresets.find(([id])=>id===tip)!;
 const grass=tip.startsWith('grass'),cloud=tip.startsWith('cloud'),water=tip.startsWith('water'),bark=tip==='wood-grain';
 const result:NatureSettings={tip,second:preset[3],scatter:grass?.14:bark?.08:cloud?.23:.32,count:tip==='foliage-clump'||cloud||bark?1:2,sizeJitter:.35,rotation:grass?12:bark?6:water||cloud?9:75,hue:8,saturation:12,brightness:14,density:.85,spacing:tip==='grass-edge'?.23:.34,opacityJitter:.25,grain:cloud?.09:.18,scale:1,seed:1250+naturePresets.indexOf(preset),follow:false,mix:!tip.includes('foam')&&!tip.includes('highlight'),flipX:true,flipY:false};
 if(!raw)return result;
 for(const [key,,min,max] of natureNumbers){const value=numeric(raw[key],min,max,result[key]);result[key]=key==='count'||key==='seed'?Math.round(value):value;}
 for(const [key] of natureFlags)if(typeof raw[key]==='boolean')result[key]=raw[key];
 if(hex(raw.second))result.second=raw.second;
 return result;
}
export function validNatureStroke(o:Record<string,unknown>){
 if(o.natureVersion===undefined&&o.nature===undefined)return true;
 if(o.natureVersion!==1||o.stampVersion!==1||o.tool!=='brush'||o.nativeMixVersion!==undefined||o.silkBlendVersion!==undefined)return false;
 const data=o.nature as Partial<NatureSettings>|undefined;
 if(!data||!isNatureTip(data.tip)||!hex(data.second))return false;
 for(const [key,,min,max] of natureNumbers){
  const v=data[key];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(key==='count'||key==='seed')&&!Number.isInteger(v))return false;
 }
 return natureFlags.every(([key])=>typeof data[key]==='boolean');
}
