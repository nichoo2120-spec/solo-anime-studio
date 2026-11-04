import {describe,it,expect} from 'vitest';
import {deposition} from '../src/engine/painting';
import {paintingCoverage} from '../src/engine/paintingTips';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {newBrushLibrary,restoreBrushLibrary,sanitizeBrush} from '../src/core/brushes';
import {newProject,activeLayer,validateProject,type Stroke} from '../src/core/model';
describe('painting dynamics',()=>{
 it('separates the deposition rate from opacity and normalizes spacing',()=>{expect(deposition(0,5,100)).toBe(0);expect(deposition(1,5,100)).toBe(1);const a=deposition(.2,5,100),b=deposition(.2,10,100);expect(1-(1-a)**2).toBeCloseTo(b,12);expect(a).toBeLessThan(deposition(.7,5,100));});
 it('changes the soft envelope without converting a flat brush to a round tip',()=>{expect(paintingCoverage('soft-round',.7,0,0,0)).toBeLessThan(paintingCoverage('soft-round',.7,0,1,0));expect(paintingCoverage('flat-bristle',.65,0,.8,0)).toBeGreaterThan(.5);expect(paintingCoverage('flat-bristle',0,.65,.8,0)).toBe(0);});
 it('retains painting dynamics in stock/custom presets and safely validates them',()=>{const lib=newBrushLibrary(),soft=lib.presets.find(p=>p.id==='soft-paint')!;expect(soft.settings.flow).toBe(.18);const restored=restoreBrushLibrary({...lib,presets:lib.presets.map(p=>p.id==='flat'?{...p,settings:{...p.settings,flow:.23,hardness:.41,pressureFlow:false}}:p)});expect(restored.presets.find(p=>p.id==='flat')!.settings).toMatchObject({flow:.23,hardness:.41,pressureFlow:false});expect(sanitizeBrush({flow:2,hardness:-1},soft.settings)).toMatchObject({flow:1,hardness:0});
 const p=newProject(),s:Stroke={...soft.settings,...brushStrokeMetadata(soft.settings),id:'paint',kind:'stroke',tool:'brush',points:[{x:20,y:30,p:.5}]};activeLayer(p).operations=[s];expect(s.paintTipVersion).toBe(2);expect(validateProject(p)).toBeTruthy();for(const patch of [{flow:NaN},{hardness:2},{pressureFlow:'yes'}])expect(()=>validateProject({...p,layers:p.layers.map(l=>l.id===p.activeLayerId?{...l,operations:[{...s,...patch}]}:l)})).toThrow();});
});
