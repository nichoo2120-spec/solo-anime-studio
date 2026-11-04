import {describe,it,expect} from 'vitest';
import {newProject,validateProject,type Stroke} from '../src/core/model';
import {stockPresets,newBrushLibrary,activeInputPreset,isRetiredBlendPresetId} from '../src/core/brushes';
import {workerBlendEligible} from '../src/engine/LiveBlendWorker';
import {displayCleanInk} from '../src/engine/InkDisplay';

describe('native pigment Mix compatibility',()=>{
 for(const version of [1,2,3] as const)it(`round-trips saved Mix version ${version}`,()=>{
  const p=newProject();p.layers[0].operations.push({kind:'stroke',tool:'brush',id:'mix',points:[{x:20,y:20,p:.4},{x:90,y:40,p:.9}],size:40,opacity:.6,color:'#00ff00',response:1,pressure:true,nativeMixVersion:version,nativeMixAmount:.58,nativeMixRadius:.5});
  const parsed=JSON.parse(JSON.stringify(p));expect(validateProject(parsed)).toEqual(p);
 });
 it('persists the explicit native paint load and rejects invalid loads',()=>{
  const p=newProject();const stroke={kind:'stroke',tool:'brush',id:'loaded',points:[{x:20,y:30,p:.5}],size:40,opacity:1,color:'#aacc33',response:1,pressure:true,nativeMixVersion:3,nativeMixAmount:.8,nativeMixPaintLoad:.75} as Stroke;
  p.layers[0].operations.push(stroke);expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  for(const load of [-.1,1.1,NaN]){const copy=structuredClone(p);(copy.layers[0].operations[0] as Stroke).nativeMixPaintLoad=load;expect(()=>validateProject(copy)).toThrow();}
 });
 it('rejects unsupported saved Mix versions',()=>{
  const p=newProject();p.layers[0].operations.push({kind:'stroke',tool:'brush',id:'mix',points:[{x:20,y:20,p:.5}],size:40,opacity:1,color:'#000000',response:1,pressure:false,nativeMixVersion:4,nativeMixAmount:.5} as unknown as Stroke);
  expect(()=>validateProject(p)).toThrow();
 });
 it('every active brush retains native settings and sends Mix to the worker',()=>{
  for(const preset of stockPresets.filter(p=>p.category!=='Eraser'&&!isRetiredBlendPresetId(p.id))){
   const library=newBrushLibrary();library.brushId=preset.id;
   expect(activeInputPreset(library).settings).toEqual(preset.settings);
   library.mode='mix';const settings=activeInputPreset(library).settings;
   for(const key of ['brushKind','brushTip','size','opacity','flow','colorNib','dryMaterial','pressureCurve','smoothness','stabilization'] as const)expect(settings[key]).toEqual(preset.settings[key]);
   expect(settings.nativeMixEnabled).toBe(true);expect(workerBlendEligible({tool:'brush',nativeMixVersion:3})).toBe(true);
  }
 });
 it('normal clean Ink remains unchanged while Mix bypasses the clean Ink shortcut',()=>{
  const base={kind:'stroke',tool:'brush',brushKind:'technical',engineVersion:10,points:[],size:5,opacity:1,color:'#000000',pressure:false,response:1,id:'ink'} as Stroke;
  expect(displayCleanInk(base)).toBe(true);expect(displayCleanInk({...base,nativeMixVersion:3})).toBe(false);
 });
});
