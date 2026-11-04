import {describe,it,expect} from 'vitest';
import {stockPresets,legacyAirbrushPreset,newBrushLibrary,restoreBrushLibrary} from '../src/core/brushes';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {newProject,activeLayer,validateProject,type Stroke} from '../src/core/model';
import {dryLiftSpan} from '../src/core/dryBrush';
import oldPresets from './fixtures/stock-v146.json';
describe('Phase 2.1 opt-in contracts',()=>{
 it('keeps all 26 old preset settings and families intact, apart from the approved classic label',()=>{
  for(const old of oldPresets){if(old.id==='color-blender')continue;// v0.5.166 intentionally replaced the default Blender
const current=old.id==='airbrush'?legacyAirbrushPreset:stockPresets.find(p=>p.id===old.id)!;expect(current.settings).toEqual(old.settings);expect(current.defaults).toEqual(old.defaults);expect(current.category).toEqual(old.category);expect(current.family).toEqual(old.family);expect(current.name).toEqual(old.id==='dry'?'Dry Brush (old)':old.name);}
 });
 it('uses renderer three only for the new stock choices and captures their material',()=>{
  for(const [id,material]of [['dry-ink-bristle','ink'],['dry-paint','paint']]as const){const p=stockPresets.find(p=>p.id===id)!;expect(brushStrokeMetadata(p.settings)).toMatchObject({dryBristleVersion:3,dryMaterial:material});}expect(stockPresets.filter(p=>p.settings.dryBristleVersion===3)).toHaveLength(2);
 });
 it('retains version one metadata and validation without adding a material field',()=>{
  const source=stockPresets.find(p=>p.id==='dry-paint')!.settings,settings={...source,dryBristleVersion:1 as const,dryMaterial:undefined,opacity:.9},metadata=brushStrokeMetadata(settings),p=newProject();expect(metadata.dryBristleVersion).toBe(1);expect(metadata.dryMaterial).toBeUndefined();const s:Stroke={...settings,...metadata,kind:'stroke',tool:'brush',id:'saved-v147',points:[{x:80,y:80,p:.8,v:.65}]};activeLayer(p).operations=[s];expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);expect(p.version).toBe(3);
 });
 it('uses a short changing contact span only for version two',()=>{expect(dryLiftSpan({size:130,dryBristleVersion:2,dryLift:.8})).toBe(16);expect(dryLiftSpan({size:130,dryBristleVersion:1,dryLift:.8})).toBeCloseTo(195.2);});
 it('upgrades untouched new-stock opacity while preserving an artist adjustment and custom version one',()=>{
  const library=newBrushLibrary(),p=library.presets.find(p=>p.id==='dry-paint')!;p.defaults={...p.defaults,dryBristleVersion:1,dryMaterial:undefined,opacity:.9};p.settings={...p.defaults};expect(restoreBrushLibrary(library).presets.find(q=>q.id===p.id)!.settings.opacity).toBe(1);p.settings.opacity=.73;expect(restoreBrushLibrary(library).presets.find(q=>q.id===p.id)!.settings.opacity).toBe(.73);library.presets.push({...p,id:'custom-v147-dry',name:'My old dry',custom:true});expect(restoreBrushLibrary(library).presets.find(q=>q.id==='custom-v147-dry')!.settings.dryBristleVersion).toBe(1);
 });
 it('rejects an unsupported material and prevents material fields on legacy strokes',()=>{
  const p=newProject(),settings=stockPresets.find(p=>p.id==='dry-paint')!.settings,s:Stroke={...settings,...brushStrokeMetadata(settings),kind:'stroke',tool:'brush',id:'invalid-material',points:[{x:80,y:80,p:1}]};for(const patch of [{dryMaterial:'oil'},{dryBristleVersion:1,dryMaterial:'paint'}]){activeLayer(p).operations=[{...s,...patch}as Stroke];expect(()=>validateProject(p)).toThrow();}
 });
});
