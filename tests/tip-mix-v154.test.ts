import {describe,it,expect} from 'vitest';
import {brushStrokeMetadata,type PaintTip} from '../src/core/paintTips';
import {stockPresets,newBrushLibrary,restoreBrushLibrary,sanitizeBrush} from '../src/core/brushes';
import {newProject,activeLayer,validateProject,type Stroke} from '../src/core/model';
import {mixedCoverage,paintingCoverage} from '../src/engine/paintingTips';
const original=stockPresets.find(p=>p.id==='paint')!.settings;
const settings={...original,mixTipA:'soft-round' as PaintTip,mixTipB:'flat-bristle' as PaintTip,mixBlend:.5};
const captured=(b=settings):Stroke=>({...original,...brushStrokeMetadata(b),id:'mixed-nib',kind:'stroke',tool:'brush',points:[{x:80,y:100,p:1},{x:550,y:100,p:1}]});
describe('Phase 3C physical paint-tip mixing',()=>{
 it('captures a mixed nib and routes it into the painting renderer',()=>{
  expect(brushStrokeMetadata(settings)).toMatchObject({brushTip:'soft-round',paintTipVersion:2,mixTipA:'soft-round',mixTipB:'flat-bristle',mixBlend:.5});
  expect(brushStrokeMetadata({...settings,brushTip:'round'})).toMatchObject({brushTip:'soft-round',paintTipVersion:2});
 });
 it('uses a single tip at endpoints and when both tips are identical',()=>{
  for(const t of [0,.01,.99,1]){const m=brushStrokeMetadata({...settings,mixBlend:t});expect(m.brushTip).toBe(t>=.99?'flat-bristle':'soft-round');expect(m.mixTipA).toBeUndefined();expect(m.mixTipB).toBeUndefined();expect(m.mixBlend).toBeUndefined();}
  expect(brushStrokeMetadata({...settings,mixTipB:'soft-round'}).mixBlend).toBeUndefined();
 });
 it('renders different nib coverage at 50% and 0% using the real coverage functions',()=>{
  const zero=brushStrokeMetadata({...settings,mixBlend:0}),half=brushStrokeMetadata(settings);
  const raster=(mixed:boolean)=>Uint8Array.from({length:64*64},(_,i)=>{const x=(i%64+.5)/32-1,y=(Math.floor(i/64)+.5)/32-1;return Math.round(255*(mixed?mixedCoverage(half.mixTipA!,half.mixTipB!,half.mixBlend!,x,y,.7,.18):paintingCoverage(zero.brushTip!,x,y,.7,.18)));});
  expect(raster(true)).not.toEqual(raster(false));
 });
 it('saves and reloads stock and custom preset mixes without dropping settings',()=>{
  const library=newBrushLibrary(),p=library.presets.find(p=>p.id==='paint')!;p.settings={...settings};library.presets.push({...p,id:'custom-nib',name:'My mixed nib',custom:true});
  const restored=restoreBrushLibrary(JSON.parse(JSON.stringify(library)));
  for(const id of ['paint','custom-nib'])expect(restored.presets.find(p=>p.id===id)!.settings).toMatchObject({mixTipA:'soft-round',mixTipB:'flat-bristle',mixBlend:.5});
 });
 it('validates mixed-tip saved strokes and rejects malformed values',()=>{
  const project=newProject(),s=captured();activeLayer(project).operations=[s];expect(validateProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
  for(const patch of [{mixTipA:'water-smooth'},{mixTipB:3},{mixBlend:-.1},{mixBlend:1.1},{mixBlend:NaN}]){activeLayer(project).operations=[{...s,...patch}as Stroke];expect(()=>validateProject(project)).toThrow();}
 });
 it('clamps restored blend while leaving other brush families untouched',()=>{
  expect(sanitizeBrush({...settings,mixBlend:8},original).mixBlend).toBe(1);
  for(const p of stockPresets.filter(p=>p.settings.coloringEngine||p.settings.watercolorAppearanceVersion||p.settings.dryBristleVersion)){
   expect(brushStrokeMetadata({...p.settings,mixTipA:'soft-round',mixTipB:'chalk',mixBlend:.5})).not.toHaveProperty('mixTipA');
   expect(sanitizeBrush({...p.settings,mixTipA:'soft-round',mixTipB:'chalk',mixBlend:.5},p.settings).mixTipA).toBeUndefined();
  }
  expect(brushStrokeMetadata(original)).not.toHaveProperty('mixBlend');
 });
});
