import {describe,it,expect} from 'vitest';
import {newBrushLibrary,restoreBrushLibrary,stockPresets,updatePreset} from '../src/core/brushes';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {newProject,activeLayer,validateProject,type Stroke} from '../src/core/model';
import {mirrorMatrix,mirrorPivot,reflectedStroke} from '../src/engine/symmetry';
import {transformedStroke,projectiveStroke} from '../src/engine/strokeSelection';
import {watercolorShapes} from '../src/engine/watercolorShapes';
describe('independent watercolor choices and mirror pivot',()=>{
 it('stores all 25 physical-shape/material pairs and three painting modes',()=>{
  for(const preset of stockPresets.filter(p=>p.id.startsWith('water-')))for(const shape of watercolorShapes)for(const mode of ['wet','glaze','even'] as const){
   const settings={...preset.settings,watercolorShape:shape.id,watercolorMode:mode};
   const library=restoreBrushLibrary(updatePreset(newBrushLibrary(),preset.id,settings));expect(library.presets.find(p=>p.id===preset.id)!.settings).toMatchObject({watercolorShape:shape.id,watercolorMode:mode});
   const p=newProject(),stroke:Stroke={...settings,...brushStrokeMetadata(settings),id:'test',kind:'stroke',tool:'brush',points:[{x:20,y:20,p:.7}]};activeLayer(p).operations=[stroke];expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  }
 });
 it('rejects invalid saved controls without accepting shapes on other families',()=>{
  const p=newProject(),settings=stockPresets.find(p=>p.id==='water-smooth')!.settings,s:Stroke={...settings,...brushStrokeMetadata(settings),id:'s',kind:'stroke',tool:'brush',points:[{x:2,y:3,p:1}]};
  for(const patch of [{watercolorShape:'dagger'},{watercolorMode:'multiply'},{watercolorEngine:undefined},{mixVersion:1},{rasterTransformVersion:1}]){activeLayer(p).operations=[{...s,...patch} as Stroke];expect(()=>validateProject(p)).toThrow();}
 });
 it('reflects source pigment without changing path, pressure, speed, colour samples or seed',()=>{
  const settings=stockPresets.find(p=>p.id==='water-rough')!.settings,s:Stroke={...settings,...brushStrokeMetadata(settings),id:'source',kind:'stroke',tool:'brush',watercolorSeed:246,points:[{x:33,y:40,p:.2,v:.3},{x:90,y:110,p:.9,v:.8}],mixStops:[{x:33,y:40,color:'#3388aa'}]},m=mirrorMatrix({enabled:true,axis:'vertical',center:.5,pivot:{x:.3,y:.6}},{width:1000,height:800}),other=reflectedStroke(s,m,'copy');
  expect(m).toEqual([-1,0,0,1,600,0]);expect(other.points).toEqual(s.points);expect(other.mixStops).toEqual(s.mixStops);expect(other.watercolorSeed).toBe(s.watercolorSeed);expect(other.rasterSourceId).toBe('source');
  const p=newProject();for(const stroke of [other,transformedStroke(other,[1,0,0,1,10,20]),projectiveStroke(other,[1,0,0,0,1,0,.0001,0,1])]){activeLayer(p).operations=[stroke];expect(()=>validateProject(p)).not.toThrow();}
  expect(mirrorPivot({enabled:true,axis:'horizontal',center:.4},{width:1000,height:800})).toEqual({x:400,y:320});expect(mirrorMatrix({enabled:true,axis:'horizontal',center:.5,pivot:{x:.2,y:.7}},{width:1000,height:800})).toEqual([1,0,0,-1,0,1120]);
 });
});
