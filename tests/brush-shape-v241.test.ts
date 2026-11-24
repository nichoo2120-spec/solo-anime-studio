import {describe,it,expect} from 'vitest';
import {stockPresets,newBrushLibrary,restoreBrushLibrary,updatePreset,activePreset,createCustomBrush,renameCustomBrush,duplicateCustomBrush,deleteCustomBrush,mergeCustomBrushes,customBrushes,scratchBrushSettings,CUSTOM_NAME_MAX} from '../src/core/brushes';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {newProject,activeLayer,validateProject,appendOperation,type Stroke,type Point} from '../src/core/model';
import {DocumentStore} from '../src/core/history';
import {brushShapeMetadata,brushStampTip,dualModes,canShapeBrush} from '../src/core/brushShape';
import {stampDabs,dualDabs,stampExtent} from '../src/engine/stampBrush';
import {paintSamples} from '../src/engine/paintPass';
import {finalGeometry} from '../src/engine/geometryCache';

const paint=stockPresets.find(p=>p.id==='paint')!;
const line=(n=40):Point[]=>Array.from({length:n},(_,i)=>{const t=i/(n-1);return {x:20+t*300,y:100+30*Math.sin(t*Math.PI),p:.4+.6*Math.sin(t*Math.PI)};});
function stroke(patch:Record<string,unknown>,extra:Partial<Stroke>={}):Stroke{
 const settings={...paint.settings,...patch} as typeof paint.settings;const {tsEnabled:_a,dbEnabled:_b,dbBrushId:_c,dbBrushName:_d,...plain}=settings as Record<string,unknown>;
 return {...plain,...brushStrokeMetadata(settings),id:'shape',kind:'stroke',tool:'brush',color:'#c0392b',size:30,opacity:1,pressure:true,response:1,points:line(),...extra} as Stroke;
}
describe('Tip shape + Dual Brush v0.5.241',()=>{
 it('only strokes with Tip shape or Dual brush on get stamp fields (old and normal strokes stay byte-identical)',()=>{
  for(const p of stockPresets){const m=brushStrokeMetadata(p.settings) as Record<string,unknown>;expect(Object.keys(m).filter(k=>k==='stampVersion'||/^(stamp|ts|db)[A-Z]/.test(k)),p.id).toEqual([]);
   const off=brushStrokeMetadata({...p.settings,tsEnabled:false,tsRoundness:.2,dbEnabled:false,dbTip:'chalk'});expect(JSON.stringify(off),p.id).toBe(JSON.stringify(m));}
  const m=brushStrokeMetadata({...paint.settings,tsEnabled:true,tsRoundness:.3}) as Record<string,unknown>;
  expect(m).toMatchObject({stampVersion:1,stampTip:'bristle',tsRoundness:.3,tsAngle:0,tsScaleX:1,tsScaleY:1,tsFlipX:false,tsFlipY:false,tsFollow:false,tsTilt:false});
  for(const k of ['paintTipVersion','engineVersion','coloringEngine','watercolorEngine','dryBristleVersion','brushTip'])expect(m[k],k).toBeUndefined();
 });
 it('blenders keep their own engine; every other brush maps to a stamp tip',()=>{
  expect(canShapeBrush(stockPresets.find(p=>p.id==='silk-blend')!.settings)).toBe(false);expect(canShapeBrush(stockPresets.find(p=>p.id==='color-blender')!.settings)).toBe(false);
  expect(brushShapeMetadata({...stockPresets.find(p=>p.id==='silk-blend')!.settings,tsEnabled:true})).toEqual({});
  expect(brushStampTip({brushKind:'graphite-hb'}).tip).toBe('chalk');expect(brushStampTip({brushKind:'g-pen'})).toMatchObject({tip:'soft-round',hardness:1});expect(brushStampTip({brushKind:'marker',brushTip:'felt'}).tip).toBe('felt');
 });
 it('roundness, scale, angle, flip, follow and tilt shape the dabs',()=>{
  const dab=(patch:Record<string,unknown>,extra:Partial<Stroke>={})=>{const s=stroke({tsEnabled:true,...patch},extra);return stampDabs(s,paintSamples(finalGeometry(s),.25));};
  const base=dab({})[0];
  expect(Math.abs(dab({tsRoundness:.25})[0].ry)).toBeCloseTo(Math.abs(base.ry)*.25,5);
  expect(Math.abs(dab({tsScaleX:2})[0].rx)).toBeCloseTo(Math.abs(base.rx)*2,5);
  expect(dab({tsAngle:90})[10].angle).toBeCloseTo(Math.PI/2,5);
  expect(dab({tsFlipX:true})[10].rx).toBeLessThan(0);expect(dab({tsFlipY:true})[10].ry).toBeLessThan(0);
  const f=dab({tsFollow:true});expect(f[2].angle).not.toBeCloseTo(f[f.length-3].angle,2);
  const tilted=line().map(p=>({...p,az:45,alt:30}));const t=dab({tsTilt:true},{points:tilted})[0];expect(t.angle).toBeCloseTo(Math.PI/4,4);expect(Math.abs(t.rx)).toBeGreaterThan(Math.abs(base.rx)*1.5);
  expect(stampExtent(stroke({tsEnabled:true,tsScaleX:3}))).toBeGreaterThan(2);
 });
 it('dual brush: own size, spacing, scatter and count; deterministic',()=>{
  const s=stroke({dbEnabled:true,dbTip:'chalk',dbScale:.5,dbSpacing:.25,dbScatter:.5,dbCount:3}),g=paintSamples(finalGeometry(s),.25);
  const a=dualDabs(s,g),b=dualDabs(s,g);expect(a).toEqual(b);expect(a.length%3).toBe(0);expect(a[0].rx).toBeCloseTo(30*.5*.5,5);
  const wide=dualDabs({...s,dbSpacing:1},g);expect(wide.length).toBeLessThan(a.length/3);
  expect(dualModes.map(m=>m.id)).toEqual(['multiply','darken','overlay','subtract','lighten','screen','height']);
 });
 it('saves Tip shape and Dual settings with the brush and cleans bad values',()=>{
  let lib=newBrushLibrary();lib={...lib,brushId:'paint'};
  lib=updatePreset(lib,'paint',{...activePreset(lib).settings,tsEnabled:true,tsRoundness:.3,tsAngle:40,tsScaleX:2,tsScaleY:.5,tsFlipX:true,tsFollow:true,tsTilt:true,dbEnabled:true,dbBrushId:'dry',dbBrushName:'Dry',dbTip:'chalk',dbHardness:.8,dbTexture:.5,dbMode:'overlay',dbScale:.7,dbSpacing:.4,dbScatter:1.2,dbCount:3,dbAmount:.6});
  const back=activePreset(restoreBrushLibrary(JSON.parse(JSON.stringify(lib)))).settings;
  expect(back).toMatchObject({tsEnabled:true,tsRoundness:.3,tsAngle:40,tsScaleX:2,tsScaleY:.5,tsFlipX:true,tsFollow:true,tsTilt:true,dbEnabled:true,dbTip:'chalk',dbMode:'overlay',dbScale:.7,dbSpacing:.4,dbScatter:1.2,dbCount:3,dbAmount:.6});
  const bad=JSON.parse(JSON.stringify(lib)),bp=bad.presets.find((p:{id:string})=>p.id==='paint');bp.settings={...bp.settings,tsRoundness:9,tsScaleX:-1,dbMode:'lava',dbTip:'banana'};
  const cleaned=activePreset(restoreBrushLibrary(bad)).settings;expect(cleaned.tsRoundness).toBe(1);expect(cleaned.tsScaleX).toBe(.1);expect(cleaned.dbMode).not.toBe('lava');expect(cleaned.dbTip).not.toBe('banana');
 });
 it('saves shaped strokes in projects, rejects broken data, one undo step',()=>{
  const p=newProject(),s=stroke({tsEnabled:true,tsRoundness:.4,tsTilt:true,dbEnabled:true,dbTip:'chalk'},{points:line().map(q=>({...q,az:10,alt:50}))});activeLayer(p).operations=[s];
  expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  for(const patch of [{tsRoundness:2},{stampVersion:2},{stampTip:'lava'},{dbMode:'x'},{tool:'eraser'},{dbCount:1.5},{tsWhatever:1},{points:[{x:1,y:1,p:1,az:999}]}] as unknown as Partial<Stroke>[]){activeLayer(p).operations=[{...s,...patch} as Stroke];expect(()=>validateProject(JSON.parse(JSON.stringify(p))),JSON.stringify(patch)).toThrow();}
  const store=new DocumentStore(newProject()),q=store.getSnapshot();store.commit(appendOperation(q,s));store.undo();expect(store.getSnapshot()).toBe(q);
 });
});
describe('Create Your Own Brush v0.5.241',()=>{
 it('creates from current or scratch with a short name, selected and listed',()=>{
  let lib=newBrushLibrary();const src=activePreset(lib);
  lib=createCustomBrush(lib,'  My   soft hair brush that is far too long  ',src,{...src.settings,size:42});
  const mine=customBrushes(lib);expect(mine).toHaveLength(1);expect(mine[0].name.length).toBeLessThanOrEqual(CUSTOM_NAME_MAX);expect(mine[0].name.startsWith('My soft hair')).toBe(true);
  expect(lib.brushId).toBe(mine[0].id);expect(mine[0].settings.size).toBe(42);expect(mine[0].category).toBe(src.category);
  lib=createCustomBrush(lib,'Plain',stockPresets.find(p=>p.id==='paint')!,scratchBrushSettings());expect(customBrushes(lib)).toHaveLength(2);
  expect(createCustomBrush(lib,'   ',src,src.settings)).toBe(lib);
 });
 it('rename, duplicate and delete work on custom brushes only, never stock',()=>{
  let lib=newBrushLibrary();lib=createCustomBrush(lib,'Mine',activePreset(lib),activePreset(lib).settings);const id=customBrushes(lib)[0].id;
  lib=renameCustomBrush(lib,id,'Renamed');expect(lib.presets.find(p=>p.id===id)!.name).toBe('Renamed');
  expect(renameCustomBrush(lib,'paint','Hacked').presets.find(p=>p.id==='paint')!.name).toBe(paint.name);
  lib=duplicateCustomBrush(lib,id);expect(customBrushes(lib)).toHaveLength(2);expect(customBrushes(lib)[1].name).toBe('Renamed copy');
  const before=lib.presets.length;expect(deleteCustomBrush(lib,'paint').presets.length).toBe(before);
  lib=deleteCustomBrush(lib,customBrushes(lib)[1].id);expect(customBrushes(lib)).toHaveLength(1);expect(lib.presets.some(p=>p.id===lib.brushId)).toBe(true);
  for(const s of stockPresets)expect(lib.presets.some(p=>p.id===s.id),s.id).toBe(true);
 });
 it('custom brushes are saved with the app (library round trip)',()=>{
  let lib=newBrushLibrary();lib=createCustomBrush(lib,'Keep me',activePreset(lib),{...activePreset(lib).settings,tsEnabled:true,tsRoundness:.3,bbEnabled:true});
  const back=restoreBrushLibrary(JSON.parse(JSON.stringify(lib)));const c=customBrushes(back);expect(c).toHaveLength(1);expect(c[0]).toMatchObject({name:'Keep me',custom:true});expect(c[0].settings).toMatchObject({tsEnabled:true,tsRoundness:.3,bbEnabled:true});
  expect(back.brushId).toBe(c[0].id);
 });
 it('custom brushes travel with projects and backups, and are merged on import',()=>{
  let lib=newBrushLibrary();lib=createCustomBrush(lib,'Travel',activePreset(lib),activePreset(lib).settings);
  const p={...newProject(),customBrushes:customBrushes(lib)};const json=JSON.parse(JSON.stringify(p));expect(validateProject(json).customBrushes).toHaveLength(1);
  const other=newBrushLibrary(),merged=mergeCustomBrushes(other,json.customBrushes);expect(merged.added).toBe(1);expect(customBrushes(merged.library)[0].name).toBe('Travel');
  expect(mergeCustomBrushes(merged.library,json.customBrushes).added).toBe(0);
  for(const bad of [{},[{id:'x'}],[{...json.customBrushes[0],custom:false}],[{...json.customBrushes[0],name:'x'.repeat(61)}]]){expect(()=>validateProject({...json,customBrushes:bad})).toThrow();}
  const plain=newProject();expect(JSON.stringify(validateProject(JSON.parse(JSON.stringify(plain))))).toBe(JSON.stringify(plain));
 });
});
