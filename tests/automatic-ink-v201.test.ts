import {describe,it,expect} from 'vitest';
import {inkFlowFactor} from '../src/core/inkFlow';
import {newBrushLibrary,restoreBrushLibrary,sanitizeBrush,stockPresets} from '../src/core/brushes';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {newProject,validateProject,type Stroke} from '../src/core/model';
describe('automatic ink passages',()=>{
 for(const id of ['studio-ink','contour-flow'])it(`${id} saves automatic flow while old strokes stay unchanged`,()=>{
  const settings=stockPresets.find(p=>p.id===id)!.settings;
  const stroke:Stroke={...settings,...brushStrokeMetadata(settings),kind:'stroke',tool:'brush',id:'flow',points:[{x:10,y:10,p:.5},{x:200,y:10,p:.5}]};
  const p=newProject();p.layers[0].operations=[stroke];
  expect(validateProject(JSON.parse(JSON.stringify(p))).layers[0].operations[0]).toEqual(stroke);
  expect(stroke.inkFlowVersion).toBe(1);expect(settings.pressureWidth).toBe(false);
  const length=settings.inkFlowLength!;expect(inkFlowFactor(stroke,length/2)).toBeCloseTo(1);expect(inkFlowFactor(stroke,length)).toBeCloseTo(1-settings.inkFlowAmount!);
  expect(inkFlowFactor({...stroke,inkFlowVersion:undefined},length)).toBe(1);
  for(const bad of [{inkFlowVersion:2},{inkFlowAmount:NaN},{inkFlowLength:0},{brushKind:'technical'}]){const invalid=JSON.parse(JSON.stringify(p));Object.assign(invalid.layers[0].operations[0],bad);expect(()=>validateProject(invalid)).toThrow();}
 });
 it('upgrades stock defaults while keeping customized settings and old custom copies',()=>{
  const library=newBrushLibrary(),preset=library.presets.find(p=>p.id==='contour-flow')!;
  delete preset.defaults.inkFlowAmount;delete preset.defaults.inkFlowLength;delete preset.settings.inkFlowAmount;delete preset.settings.inkFlowLength;
  preset.defaults.pressureWidth=preset.settings.pressureWidth=true;preset.defaults.velocityTaper=preset.settings.velocityTaper=true;preset.settings.size=27;
  library.presets.push({...structuredClone(preset),id:'my-old-ink',name:'My old ink',custom:true});
  const restored=restoreBrushLibrary(library),stock=restored.presets.find(p=>p.id==='contour-flow')!,custom=restored.presets.find(p=>p.id==='my-old-ink')!;
  expect(stock.settings.size).toBe(27);expect(stock.settings.inkFlowAmount).toBe(.92);expect(stock.settings.pressureWidth).toBe(false);expect(stock.settings.velocityTaper).toBe(false);
  expect(custom.settings.inkFlowAmount).toBeUndefined();expect(custom.settings.pressureWidth).toBe(true);expect(brushStrokeMetadata(custom.settings).inkFlowVersion).toBeUndefined();
 });
 it('bounds persisted controls',()=>{const s=stockPresets.find(p=>p.id==='studio-ink')!.settings;expect(sanitizeBrush({...s,inkFlowAmount:5,inkFlowLength:-1},s)).toMatchObject({inkFlowAmount:1,inkFlowLength:24});});
});

