import {describe,it,expect} from 'vitest';
import {newBrushLibrary,restoreBrushLibrary,stockPresets,legacyAirbrushPreset} from '../src/core/brushes';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {newProject,activeLayer,validateProject,type Stroke} from '../src/core/model';

describe('v145 coloring repair compatibility',()=>{
 it('keeps one stock Airbrush and migrates the retired selection',()=>{
  const old=newBrushLibrary();old.presets.push({...legacyAirbrushPreset,settings:{...legacyAirbrushPreset.settings,size:81,color:'#1255aa'}});old.brushId='airbrush';
  const next=restoreBrushLibrary(JSON.parse(JSON.stringify(old)));
  expect(next.presets.filter(p=>p.name==='Airbrush')).toHaveLength(1);expect(next.presets.some(p=>p.id==='airbrush')).toBe(false);expect(next.brushId).toBe('color-air');expect(next.presets.find(p=>p.id==='color-air')!.settings).toMatchObject({size:81,color:'#1255aa'});expect(restoreBrushLibrary(next)).toEqual(next);
 });
 it('preserves a named custom copy of the retired Airbrush',()=>{
  const old=newBrushLibrary();old.presets.push({...legacyAirbrushPreset,id:'custom-spray',name:'My spray',custom:true,settings:{...legacyAirbrushPreset.settings,size:77}});old.brushId='custom-spray';
  const next=restoreBrushLibrary(old);expect(next.brushId).toBe('custom-spray');expect(next.presets.find(p=>p.id==='custom-spray')!.settings).toMatchObject({size:77,brushKind:'airbrush',flow:.08});
 });
 it('versions new texture and blender marks without upgrading saved artwork',()=>{
  for(const id of ['color-texture','color-blender']){const settings=stockPresets.find(p=>p.id===id)!.settings,s:Stroke={...settings,...brushStrokeMetadata(settings),id,kind:'stroke',tool:'brush',points:[{x:30,y:40,p:.7}]};expect(s.coloringAppearanceVersion).toBe(3);const p=newProject();activeLayer(p).operations=[s];expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);delete s.coloringAppearanceVersion;delete s.blendPreserveAlpha;expect(activeLayer(validateProject(JSON.parse(JSON.stringify(p)))).operations[0]).not.toHaveProperty('coloringAppearanceVersion');}
  const settings=stockPresets.find(p=>p.id==='color-solid')!.settings,p=newProject();activeLayer(p).operations=[{...settings,...brushStrokeMetadata(settings),id:'bad',kind:'stroke',tool:'brush',points:[{x:30,y:40,p:1}],coloringAppearanceVersion:2}];expect(()=>validateProject(p)).toThrow('Invalid coloring appearance');
 });
 it('upgrades unchanged defaults while retaining artist overrides',()=>{
  const old=newBrushLibrary(),p=old.presets.find(p=>p.id==='color-texture')!;delete p.defaults.coloringAppearanceVersion;delete p.settings.coloringAppearanceVersion;p.defaults.flow=.9;p.settings.flow=.9;p.defaults.pressureFlow=true;p.settings.pressureFlow=true;
  expect(restoreBrushLibrary(old).presets.find(p=>p.id==='color-texture')!.settings).toMatchObject({flow:.95,pressureFlow:false,coloringAppearanceVersion:3});p.settings.flow=.42;p.settings.size=117;
  expect(restoreBrushLibrary(old).presets.find(p=>p.id==='color-texture')!.settings).toMatchObject({flow:.42,size:117,pressureFlow:false});
 });
});
