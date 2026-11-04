import {watercolorPresets as stockPresets} from './fixtures/watercolor-presets';
import {describe,it,expect} from 'vitest';
import {} from '../src/core/brushes';
import {brushStrokeMetadata,watercolorSeedFor} from '../src/core/paintTips';
import {newProject,activeLayer,validateProject,type Stroke} from '../src/core/model';
import {paintSamples} from '../src/engine/paintPass';
import {strokeGeometry} from '../src/engine/strokeGeometry';
import {strokePigment,pigmentBehavior,watercolorVelocity,movementLoad} from '../src/engine/watercolorPigment';
const water=stockPresets.filter(p=>p.settings.brushKind==='watercolor');
function stroke(i=1):Stroke {const settings=water[1].settings;return {...settings,...brushStrokeMetadata(settings),id:'water-'+i,watercolorSeed:watercolorSeedFor('water-'+i),kind:'stroke',tool:'brush',size:100,pressure:false,points:[{x:100,y:100,p:.5,v:.65},{x:600,y:100,p:.5,v:.65}]};}
const sample=(s:Stroke,x=300,y=110)=>strokePigment(s,paintSamples(strokeGeometry(s),.18)).sample(x,y,{density:0,edge:0,dx:0,dy:0,settle:0});
describe('stroke-generated pigment v131',()=>{
 it('routes fresh watercolor only to material 2, preserving old material 1',()=>{const p=newProject(),s=stroke();expect(s.watercolorMaterialVersion).toBe(2);for(const v of [undefined,1,2] as const){activeLayer(p).operations=[{...s,watercolorMaterialVersion:v,watercolorSeed:v?s.watercolorSeed:undefined}];expect(validateProject(p)).toBeTruthy();}activeLayer(p).operations=[{...s,watercolorMaterialVersion:3} as unknown as Stroke];expect(()=>validateProject(p)).toThrow();expect(brushStrokeMetadata({brushTip:'bristle'}).watercolorMaterialVersion).toBeUndefined();});
 it('replays exactly, follows stroke coordinates and varies with stored seeds',()=>{const s=stroke();expect(sample(s)).toEqual(sample(JSON.parse(JSON.stringify(s))));const values=Array.from({length:5},(_,i)=>sample(stroke(i)).density);expect(new Set(values).size).toBe(5);const shifted={...s,points:s.points.map(p=>({...p,x:p.x+25,y:p.y+40}))};expect(sample(shifted,325,150)).toEqual(sample(s));});
 it('responds to velocity without changing pressure or enabling width taper',()=>{const slow=stroke(),fast=stroke();slow.points=slow.points.map(p=>({...p,v:.95}));fast.points=fast.points.map(p=>({...p,v:.2}));expect(movementLoad(slow,slow.points[0])).toBeGreaterThan(movementLoad(fast,fast.points[0]));expect(slow.velocityTaper).toBeUndefined();expect(watercolorVelocity(10,40)).toBeGreaterThan(watercolorVelocity(10,2));expect(watercolorVelocity(10,0,.42)).toBe(.42);expect(sample(slow).settle).toBeGreaterThan(sample(fast).settle);});
 it('gives all eight profiles different wetness, granulation and directional load',()=>{const b=water.map(p=>pigmentBehavior(p.settings));expect(new Set(b.map(p=>JSON.stringify(p))).size).toBe(8);expect(b[6].dry).toBeGreaterThan(b[2].dry);expect(b[7].wet).toBeGreaterThan(b[0].wet);expect(b[4].granules).toBeLessThan(b[1].granules);});
 it('keeps spatial queries finite for dots, negative coordinates and turns',()=>{for(const p of water)for(const points of [[{x:-3,y:-7,p:.01}],[{x:1,y:1,p:.1},{x:10,y:40,p:1},{x:30,y:-20,p:.5}]]){const s={...stroke(),...p.settings,points};const field=strokePigment(s,paintSamples(strokeGeometry(s),.18));for(let x=-20;x<=40;x+=4){const v=field.sample(x,10,{density:0,edge:0,dx:0,dy:0,settle:0});expect(Object.values(v).every(Number.isFinite)).toBe(true);expect(v.density).toBeGreaterThanOrEqual(.02);expect(v.density).toBeLessThanOrEqual(1.24);}}});
});
