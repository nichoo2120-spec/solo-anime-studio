import {describe,it,expect} from 'vitest';
import {stockPresets,newBrushLibrary,restoreBrushLibrary,sanitizeBrush} from '../src/core/brushes';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {newProject,activeLayer,validateProject,type Stroke} from '../src/core/model';
import old from './fixtures/stock-v153.json';
const presets=stockPresets.filter(p=>p.settings.smudgeVersion===2);
function stroke(id='smudge-bristle'):Stroke{const b=stockPresets.find(p=>p.id===id)!.settings;return{...b,...brushStrokeMetadata(b),kind:'stroke',tool:'brush',id:'saved-smudge',points:[{x:100,y:150,p:.8,v:.65},{x:600,y:150,p:.9,v:.3}]};}
describe('Phase 3 wet-smudge metadata and saved compatibility',()=>{
 it('preserves every v153 stock preset exactly',()=>{for(const p of old)if(p.id!=='color-blender')expect(stockPresets.find(q=>q.id===p.id)).toEqual(p);// v0.5.166 changed only the default Blender
});
 it('adds exactly three versioned Blender presets next to classic Blender',()=>{expect(presets.map(p=>p.name)).toEqual(['Smudge Bristle','Blender Soft','Wet Mix']);expect(stockPresets.find(p=>p.id==='color-blender')!.settings.smudgeVersion).toBe(3);expect(presets[1].settings.colorNib).toBe('round');expect(presets[2].settings.useSelectedColour).toBe(.25);});
 it('only captures wet-smudge fields for explicitly versioned Blender settings',()=>{for(const p of old)expect(brushStrokeMetadata(p.settings as any)).not.toHaveProperty('smudgeVersion');for(const p of presets)expect(brushStrokeMetadata(p.settings)).toMatchObject({smudgeVersion:2,mixAmount:p.settings.mixAmount,holdLen:p.settings.holdLen});});
 it('round-trips all new controls through a saved project',()=>{for(const p of presets){const project=newProject();activeLayer(project).operations=[stroke(p.id)];expect(validateProject(JSON.parse(JSON.stringify(project)))).toEqual(project);}});
 it('rejects invalid versions, wrong tools and invalid reservoir controls',()=>{const p=newProject(),s=stroke();for(const patch of [{smudgeVersion:1},{smudgeVersion:4},{brushTip:'color-solid'},{coloringEngine:undefined},{pickupLen:0},{holdLen:99},{mixAmount:2},{smearStreak:NaN},{useSelectedColour:-1}]){activeLayer(p).operations=[{...s,...patch}as Stroke];expect(()=>validateProject(p)).toThrow();}});
 it('retains customized controls and custom wet presets through restore',()=>{const l=newBrushLibrary(),p=l.presets.find(p=>p.id==='smudge-bristle')!;p.settings={...p.settings,mixAmount:.21,pickupLen:1.7,holdLen:7.2,smearStreak:.36,useSelectedColour:.12};l.presets.push({...p,id:'custom-wet',name:'My wet brush',custom:true});const restored=restoreBrushLibrary(JSON.parse(JSON.stringify(l)));for(const id of ['smudge-bristle','custom-wet'])expect(restored.presets.find(p=>p.id===id)!.settings).toMatchObject({smudgeVersion:2,mixAmount:.21,pickupLen:1.7,holdLen:7.2,smearStreak:.36,useSelectedColour:.12});});
 it('clamps controls and cannot enable wet behavior on a classic preset',()=>{const p=presets[0].settings;expect(sanitizeBrush({...p,holdLen:100,pickupLen:-1,smearStreak:3,useSelectedColour:-1},p)).toMatchObject({smudgeVersion:2,holdLen:12,pickupLen:.2,smearStreak:1,useSelectedColour:0});const classic=stockPresets.find(p=>p.id==='color-blender')!.settings;expect(sanitizeBrush({...classic,smudgeVersion:2,holdLen:8},classic).smudgeVersion).toBe(3);/* v0.5.166: default Blender stays on v3 */});
});
