import {describe,it,expect} from 'vitest';
import {paintTipCoverage} from '../src/engine/texturedPaintTip';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {newBrushLibrary,restoreBrushLibrary} from '../src/core/brushes';
import {newProject,activeLayer,validateProject,type Stroke} from '../src/core/model';
describe('textured painting tips',()=>{
 it('uses distinct, noncircular footprints and real internal texture',()=>{
  const flat=paintTipCoverage('flat-bristle',.7,0,.8),off=paintTipCoverage('flat-bristle',0,.7,.8);expect(flat).toBeGreaterThan(.03);expect(off).toBe(0);
  expect(paintTipCoverage('chalk',.65,.65,.9)).toBeGreaterThan(0);expect(paintTipCoverage('felt',0,.7,.8)).toBe(0);
  const values=Array.from({length:100},(_,i)=>paintTipCoverage('chalk',(i%10-5)/15,(Math.floor(i/10)-5)/15,.9));expect(Math.max(...values)-Math.min(...values)).toBeGreaterThan(.4);
 });
 it('upgrades stock paint settings while keeping older custom tips and chosen round tips',()=>{
  const fresh=newBrushLibrary();for(const p of fresh.presets.filter(p=>p.category==='Paint'&&p.id!=='airbrush'))expect(p.settings.brushTip).toBeTruthy();
  const old={...fresh,presets:[...fresh.presets.map(p=>({...p,settings:{...p.settings,brushTip:undefined}})),{...fresh.presets[10],id:'old-custom',custom:true,name:'Original custom',settings:{...fresh.presets[10].settings,brushTip:undefined}}]};
  const restored=restoreBrushLibrary(old);expect(restored.presets.find(p=>p.id==='paint')!.settings.brushTip).toBe('bristle');expect(restored.presets.find(p=>p.id==='old-custom')!.settings.brushTip).toBe('round');
  const invalid=JSON.parse(JSON.stringify(old));invalid.presets.at(-1).settings.brushTip='unrecognized-tip';expect(restoreBrushLibrary(invalid).presets.find(p=>p.id==='old-custom')!.settings.brushTip).toBe('round');
  const chosen=newBrushLibrary();chosen.presets.find(p=>p.id==='paint')!.settings.brushTip='round';expect(restoreBrushLibrary(chosen).presets.find(p=>p.id==='paint')!.settings.brushTip).toBe('round');
 });
 it('versions only the new paint tip and validates saved brush controls',()=>{
  const p=newProject(),s:Stroke={id:'new',kind:'stroke',tool:'brush',size:40,opacity:1,color:'#123456',pressure:true,response:1,points:[{x:30,y:50,p:.5}],brushKind:'flat',...brushStrokeMetadata({brushKind:'flat',brushTip:'flat-bristle',tipAngle:-30,tipSpacing:.08})};activeLayer(p).operations=[s];expect(validateProject(JSON.parse(JSON.stringify(p)))).toBeTruthy();expect(s.flatNibVersion).toBeUndefined();expect(s.paintTipVersion).toBe(2);
  expect(()=>validateProject({...p,layers:p.layers.map(l=>({...l,operations:l.id===p.activeLayerId?[{...s,tipSpacing:0}]:l.operations}))})).toThrow();expect(brushStrokeMetadata({brushKind:'g-pen'}).paintTipVersion).toBeUndefined();
 });
});
