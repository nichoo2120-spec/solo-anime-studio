import {describe,it,expect} from 'vitest';
import {stockPresets,newBrushLibrary,restoreBrushLibrary,activePreset} from '../src/core/brushes';
import {selectablePaintTips,isNewWatercolorTip} from '../src/core/paintTips';
import {watercolorPresets} from './fixtures/watercolor-presets';

describe('five-only watercolor library migration',()=>{
 it('rejects all eight retired identities even when custom flags and tip settings changed',()=>{
  const lib=newBrushLibrary(),ordinary=stockPresets.find(p=>p.id==='paint')!;
  for(const retired of watercolorPresets){
   const old={...ordinary,id:retired.id,name:retired.name,custom:true};
   const restored=restoreBrushLibrary({...lib,brushId:old.id,presets:[...lib.presets,old]});
   expect(restored.presets.some(p=>p.id===old.id)).toBe(false);
   expect(activePreset(restored).id).toBe('soft-paint');
   expect(restoreBrushLibrary(restored)).toEqual(restored);
  }
 });
 it('retains new watercolor custom presets and ordinary custom tools',()=>{
  const lib=newBrushLibrary(),smooth=stockPresets.find(p=>p.id==='water-smooth')!,pencil=lib.presets[0];
  const customs=[{...smooth,id:'custom-smooth',name:'My smooth brush',custom:true},{...pencil,id:'custom-pencil',name:'My pencil',custom:true}];
  const restored=restoreBrushLibrary({...lib,brushId:'custom-smooth',presets:[...lib.presets,...customs]});
  expect(activePreset(restored).name).toBe('My smooth brush');
  expect(restored.presets.filter(p=>p.custom).map(p=>p.id)).toEqual(['custom-smooth','custom-pencil']);
  expect(restored.presets.filter(p=>!p.custom&&isNewWatercolorTip(p.settings.brushTip))).toHaveLength(5);
  expect(selectablePaintTips.filter(t=>isNewWatercolorTip(t.id))).toHaveLength(5);
 });
});
