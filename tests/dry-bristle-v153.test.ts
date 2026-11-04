import {describe,it,expect} from 'vitest';
import {stockPresets,newBrushLibrary,restoreBrushLibrary} from '../src/core/brushes';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {newProject,activeLayer,validateProject,type Stroke} from '../src/core/model';

describe('v153 saved dry renderer routing',()=>{
 it('records version three only on the two stock dry bristle choices',()=>{
  expect(stockPresets.filter(p=>p.settings.dryBristleVersion===3).map(p=>p.id)).toEqual(['dry-ink-bristle','dry-paint']);
 });
 it('round-trips each saved renderer without upgrading the drawing',()=>{
  for(const version of [1,2,3] as const){const settings={...stockPresets.find(p=>p.id==='dry-paint')!.settings,dryBristleVersion:version,dryMaterial:version===1?undefined:'paint' as const},p=newProject();
   const s:Stroke={...settings,...brushStrokeMetadata(settings),id:'saved-'+version,kind:'stroke',tool:'brush',points:[{x:10,y:20,p:.4,v:.65},{x:90,y:40,p:.9,v:.3}]};activeLayer(p).operations=[s];
   expect(activeLayer(validateProject(JSON.parse(JSON.stringify(p)))).operations[0]).toMatchObject({dryBristleVersion:version});
  }
 });
 it('upgrades stock presets for future strokes while retaining custom version two',()=>{
  const library=newBrushLibrary(),stock=library.presets.find(p=>p.id==='dry-paint')!;stock.defaults={...stock.defaults,dryBristleVersion:2};stock.settings={...stock.settings,dryBristleVersion:2,size:117,dryLoad:.61,color:'#832e17'};
  library.presets.push({...stock,id:'my-v2-dry',name:'My saved brush',custom:true});const restored=restoreBrushLibrary(JSON.parse(JSON.stringify(library)));
  expect(restored.presets.find(p=>p.id==='dry-paint')!.settings).toMatchObject({dryBristleVersion:3,size:117,dryLoad:.61,color:'#832e17'});
  expect(restored.presets.find(p=>p.id==='my-v2-dry')!.settings).toMatchObject({dryBristleVersion:2,size:117,dryLoad:.61,color:'#832e17'});
 });
 it('rejects unknown renderer versions rather than silently changing the appearance',()=>{
  const p=newProject(),settings=stockPresets.find(p=>p.id==='dry-ink-bristle')!.settings;activeLayer(p).operations=[{...settings,...brushStrokeMetadata(settings),dryBristleVersion:4,id:'unsupported',kind:'stroke',tool:'brush',points:[{x:1,y:1,p:1}]} as unknown as Stroke];expect(()=>validateProject(p)).toThrow('Invalid dry bristle renderer');
 });
});
