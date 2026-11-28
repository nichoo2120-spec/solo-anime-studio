import {describe,expect,it} from 'vitest';
import {stockPresets} from '../src/core/brushes';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {blendModes,blendRenderStyles} from '../src/core/brushBlend';
import {mixerPresets,mixerRecipe} from '../src/core/mixerBrush';
describe('Mixer Brush capture',()=>{
 it('routes every stock paint preset, mode, style and opacity through v10',()=>{
  for(const preset of stockPresets.filter(p=>p.category!=='Eraser'))
   for(const opacity of [.44,1])for(const bbMode of blendModes)
    for(const bbRenderStyle of Object.keys(blendRenderStyles) as (keyof typeof blendRenderStyles)[]){
     const s=brushStrokeMetadata({...preset.settings,opacity,bbMode,bbRenderStyle,bbEnabled:true} as typeof preset.settings,true);
     expect(s.brushBlendVersion,preset.id).toBe(10);
     expect(s.silkBlendVersion).toBeUndefined();
     if(preset.id.startsWith('water-'))expect(s.watercolorEngine).toBe(1);
    }
 });
 it('keeps ten mixer recipes and starts with clean unloaded paint',()=>{
  expect(mixerPresets).toHaveLength(10);
  for(const [name,wet] of mixerPresets)expect(mixerRecipe(name)?.bbWetness).toBe(wet);
  const s=brushStrokeMetadata({...stockPresets[0].settings,bbEnabled:true});
  expect(s).toMatchObject({bbClean:true,bbPaintLoad:0,bbReload:false});
 });
});

import {mixerField} from '../src/engine/mixerReservoir';
import type {Stroke} from '../src/core/model';
const image=(w:number,h:number)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}) as ImageData;
const ctx={createImageData:image} as CanvasRenderingContext2D;
function swatch(patch:Partial<Stroke>={},striped=false,loop=false,pressure=.65){
 const source=image(140,60);
 for(let y=0;y<60;y++)for(let x=0;x<140;x++){
  const color=x<40?(striped&&(y%12)<6?[20,210,20]:[170,30,190]):[255,255,255];
  source.data.set([...color,255],(y*140+x)*4);
 }
 const points=[{x:22,y:30,p:pressure},{x:115,y:30,p:pressure}];
 if(loop)points.push(points[0],points[1]);
 const stroke={id:'mixer-test',kind:'stroke',tool:'brush',color:'#ff0000',size:24,opacity:1,response:1,pressure:false,points,
  bbFlow:1,bbWetness:.7,bbMix:.2,bbCapacity:.2,bbTaper:.2,bbSolidLoad:true,...patch} as Stroke;
 return new Uint8ClampedArray(mixerField(ctx,source,stroke,points,0,0,1,16).data);
}
describe('mixer pigment transport',()=>{
 it('carries striped pigment into white without going below either endpoint',()=>{
  const a=swatch({},true),at=(x:number,y:number,c:number)=>a[(y*140+x)*4+c];
  expect(Math.abs(at(48,27,1)-at(48,33,1))).toBeGreaterThan(5);
  const plain=swatch();
  for(let x=40;x<100;x++){const k=(30*140+x)*4;
   for(const [c,min] of [170,30,190].entries())expect(plain[k+c]).toBeGreaterThanOrEqual(min-1);
  }
 });
 it('exhausts a light load and leaves no previous pigment on a clean stroke',()=>{
  const before=swatch(),low=swatch({bbPaintLoad:1,bbCapacity:.01,bbMix:0});
  const diff=(x:number)=>{const k=(30*140+x)*4;return Math.abs(before[k+1]-low[k+1]);};
  expect(diff(25)).toBeGreaterThan(diff(110));
  expect(swatch()).toEqual(before);
 });
 it('limits coverage on a retraced path to the same flow ceiling',()=>{
  const a=swatch({bbFlow:.44}),b=swatch({bbFlow:.44},false,true);
  for(let x=22;x<115;x++){const k=(30*140+x)*4+3;expect(b[k]).toBe(a[k]);expect(b[k]).toBeLessThanOrEqual(113);}
 });
});

it('carries a violet wash into white with a gradual falloff and preserves green variation',()=>{
 const wash={watercolorBlendVersion:1 as const,pressure:true,bbPressureWet:true,bbPressureMix:true};
 const a=swatch(wash,false,false,.18), b=swatch(wash,true,false,.18);
 const green=(data:Uint8ClampedArray,x:number,y:number)=>data[(y*140+x)*4+1];
 expect(green(a,45,30)).toBeLessThan(green(a,60,30));
 expect(green(a,60,30)).toBeLessThan(green(a,90,30));
 expect(Math.abs(green(b,48,27)-green(b,48,33))).toBeGreaterThan(3);
});
