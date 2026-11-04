import {describe,it,expect} from 'vitest';
import {stockPresets,newBrushLibrary,restoreBrushLibrary} from '../src/core/brushes';
import {brushStrokeMetadata,watercolorSeedFor} from '../src/core/paintTips';
import {activeLayer,newProject,validateProject,type Stroke} from '../src/core/model';
import {paintSamples} from '../src/engine/paintPass';
import {strokeGeometry} from '../src/engine/strokeGeometry';
import {depositionField,type Deposit} from '../src/engine/watercolorTransport';
import {watercolorAppearance,watercolorGranulation} from '../src/engine/watercolorAppearance';
const water=stockPresets.filter(p=>p.family==='watercolor');
const stroke=(id='new'):Stroke=>({...water[0].settings,...brushStrokeMetadata(water[0].settings),id,kind:'stroke',tool:'brush',size:90,pressure:false,watercolorSeed:watercolorSeedFor(id),points:[{x:90,y:100,p:1,v:.65},{x:690,y:100,p:1,v:.65}]});
const deposit=(s:Stroke,x=350,y=110)=>depositionField(s,paintSamples(strokeGeometry(s),.18)).sample(x,y,{radius:0,density:0,water:0,grain:0,dx:0,dy:0,edge:0});
describe('reference watercolor appearance compatibility',()=>{
 it('opts new watercolor strokes in and leaves stored drawings unversioned',()=>{
  const s=stroke(),project=newProject();activeLayer(project).operations=[s];
  expect(validateProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
  const old={...s,watercolorAppearanceVersion:undefined};activeLayer(project).operations=[old];
  expect(validateProject(JSON.parse(JSON.stringify(project))).layers.flatMap(l=>l.operations).find(o=>o.kind==='stroke')).not.toHaveProperty('watercolorAppearanceVersion');
  expect(water.every(p=>brushStrokeMetadata(p.settings).watercolorAppearanceVersion===1)).toBe(true);
  expect(stockPresets.filter(p=>p.family!=='watercolor').every(p=>brushStrokeMetadata(p.settings).watercolorAppearanceVersion===undefined)).toBe(true);
  for(const patch of [{watercolorAppearanceVersion:2},{watercolorEngine:undefined}]){activeLayer(project).operations=[{...s,...patch} as Stroke];expect(()=>validateProject(project)).toThrow();}
 });
 it('upgrades restored stock preferences for future marks without resetting artist controls',()=>{
  const old=newBrushLibrary(),p=old.presets.find(p=>p.id==='water-smooth')!;delete p.settings.watercolorAppearanceVersion;p.settings.size=137;p.settings.flow=.31;
  expect(restoreBrushLibrary(old).presets.find(candidate=>candidate.id===p.id)!.settings).toMatchObject({watercolorAppearanceVersion:1,size:137,flow:.31});
 });
 it('carries pigment coordinates with the stroke, separately from document paper',()=>{
  const s=stroke(),a=deposit(s),translated={...s,points:s.points.map(p=>({...p,x:p.x+37,y:p.y+29}))},b=deposit(translated,387,139);
  expect(a.along).toBe(b.along);expect(a.across).toBe(b.across);
  const material=watercolorAppearance(s),output=()=>({pigment:0,grain:0,edge:0,pool:0});
  expect(material(a,output())).toEqual(watercolorAppearance(translated)(b,output()));
  expect(material(a,output())).toEqual(watercolorAppearance(JSON.parse(JSON.stringify(s)))(a,output()));
  const patterns=Array.from({length:5},(_,i)=>{const next=stroke('seed-'+i),sample=watercolorAppearance(next);return Array.from({length:30},(_,j)=>sample({...a,along:20+j*9},output()).pigment);});
  expect(new Set(patterns.map(p=>JSON.stringify(p))).size).toBe(5);
  const fine=watercolorGranulation(s),moved=watercolorGranulation(translated);expect(fine(350,110)).toBe(moved(387,139));expect(fine(350,110)).toBe(watercolorGranulation(JSON.parse(JSON.stringify(s)))(350,110));expect(fine(350,110)).not.toBe(watercolorGranulation(stroke('another-grain'))(350,110));
 });
 it('retains pressure and speed deposition controls with bounded materials for every style',()=>{
  for(const preset of water){const base={...stroke(),...preset.settings,pressure:true};
   const sample=(p:number,v:number)=>deposit({...base,points:base.points.map(q=>({...q,p,v}))});
   expect(sample(1,.65).radius).toBeGreaterThan(sample(.15,.65).radius);
   expect(sample(1,.65).density).toBeGreaterThan(sample(.15,.65).density);
   // The persisted v channel is inverse speed: a larger value means slower motion.
   expect(sample(1,.95).density).toBeGreaterThan(sample(1,.2).density);
   const appearance=watercolorAppearance(base);for(let a=0;a<600;a+=7){const d:Deposit={...sample(1,.65),along:a,across:Math.sin(a)*40},m=appearance(d,{pigment:0,grain:0,edge:0,pool:0});expect(Object.values(m).every(Number.isFinite)).toBe(true);expect(m.pigment).toBeGreaterThan(0);expect(m.grain).toBeGreaterThanOrEqual(0);expect(m.grain).toBeLessThanOrEqual(1);}
  }
 });
 it('mixes pigment continuously across opposite travel directions and cropped buffers',()=>{
  for(const preset of water){const s:Stroke={...stroke(),...preset.settings,size:120,pressure:false,points:[{x:80,y:90,p:1,v:.65},{x:650,y:90,p:1,v:.65},{x:650,y:112,p:1,v:.65},{x:80,y:112,p:1,v:.65}]};
  const samples=paintSamples(strokeGeometry(s),.18),full=depositionField(s,samples),crop=depositionField(s,samples);full.prepare(0,0,800,220);crop.prepare(220,60,200,90);
  const empty=():Deposit=>({radius:0,density:0,water:0,grain:0,dx:0,dy:0,edge:0});let previous:number|undefined;const values=[];
  for(let y=65;y<145;y++){const a=full.sample(300,y,empty()),b=crop.sample(300,y,empty());expect(a.paintPigment).toBeDefined();expect(a.paintPigment).toBe(b.paintPigment);expect(Object.values(a).every(Number.isFinite)).toBe(true);if(previous!==undefined)expect(Math.abs(a.paintPigment!-previous)).toBeLessThan(.12);previous=a.paintPigment;values.push(previous);}
  expect(Math.max(...values as number[])-Math.min(...values as number[])).toBeGreaterThan(.01);
  }
 });
});
