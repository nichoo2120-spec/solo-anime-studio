import {watercolorPresets as stockPresets} from './fixtures/watercolor-presets';
import {describe,it,expect} from 'vitest';
import {newBrushLibrary,restoreBrushLibrary} from '../src/core/brushes';
import {brushStrokeMetadata,isWatercolorTip} from '../src/core/paintTips';
import {watercolorCoverage} from '../src/engine/watercolorTips';
import {newProject,activeLayer,validateProject,type Stroke} from '../src/core/model';
describe('reference-guided watercolor',()=>{
 it('retains all five historical profiles as saved-art fixtures',()=>{expect(stockPresets.slice(0,5).map(p=>p.settings.brushTip)).toEqual(['wash-flat','wash','wash-dagger','wash-cats-tongue','wash-liner']);expect(stockPresets).toHaveLength(8);});
 it('has a loaded belly, distinct flat/asymmetric/lens silhouettes, and hardness-controlled edges',()=>{
  expect(watercolorCoverage('wash',.6,0,.65)).toBe(1);expect(watercolorCoverage('wash',1,0,.65)).toBe(0);
  expect(watercolorCoverage('wash-flat',.8,.3,.6)).toBeGreaterThan(.9);expect(watercolorCoverage('wash-flat',0,.7,.6)).toBe(0);
  expect(watercolorCoverage('wash-dagger',-.65,.35,.6)).toBeGreaterThan(watercolorCoverage('wash-dagger',.65,.35,.6));
  expect(watercolorCoverage('wash-cats-tongue',.8,.3,.6)).toBe(0);
  expect(watercolorCoverage('wash',.91,0,0)).toBeLessThan(watercolorCoverage('wash',.91,0,1));
 });
 it('versions new water strokes without upgrading saved art or other brush families',()=>{
  const preset=stockPresets.find(p=>p.id==='watercolor-round')!,stroke:Stroke={...preset.settings,...brushStrokeMetadata(preset.settings),id:'water',kind:'stroke',tool:'brush',points:[{x:20,y:30,p:.5}]},p=newProject();activeLayer(p).operations=[stroke];expect(stroke.watercolorVersion).toBe(3);expect(validateProject(p)).toBeTruthy();
  const old={...stroke,brushTip:'wash' as const,watercolorVersion:undefined,watercolorMaterialVersion:undefined,watercolorSeed:undefined};activeLayer(p).operations=[old];expect(validateProject(p).layers.flatMap(l=>l.operations).find(o=>o.kind==='stroke')).not.toHaveProperty('watercolorVersion',1);
  for(const version of [0,4,'1']){activeLayer(p).operations=[{...stroke,watercolorVersion:version} as Stroke];expect(()=>validateProject(p)).toThrow();}
  expect(brushStrokeMetadata({brushTip:'bristle',brushKind:'paint'}).watercolorVersion).toBeUndefined();
 });
});
