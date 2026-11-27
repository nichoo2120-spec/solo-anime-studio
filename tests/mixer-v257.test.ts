import {describe,expect,it} from 'vitest';
import {stockPresets} from '../src/core/brushes';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {blendModes,blendRenderStyles} from '../src/core/brushBlend';
import {mixerPresets,mixerRecipe} from '../src/core/mixerBrush';
describe('Mixer Brush capture',()=>{
 it('routes every stock paint preset, mode, style and opacity through v9',()=>{
  for(const preset of stockPresets.filter(p=>p.category!=='Eraser'))
   for(const opacity of [.44,1])for(const bbMode of blendModes)
    for(const bbRenderStyle of Object.keys(blendRenderStyles) as (keyof typeof blendRenderStyles)[]){
     const s=brushStrokeMetadata({...preset.settings,opacity,bbMode,bbRenderStyle,bbEnabled:true} as typeof preset.settings,true);
     expect(s.brushBlendVersion,preset.id).toBe(9);
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
