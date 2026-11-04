import {describe,it,expect} from 'vitest';
import {strokeGeometry} from '../src/engine/strokeGeometry';
import type {Point,Stroke} from '../src/core/model';
import {strokeSnapshot,finalGeometry} from '../src/engine/geometryCache';
import {diagnosticTrace,replayTrace} from '../src/engine/diagnosticReplay';
import {noisyContours} from './fixtures/drawingSequences';
const revision=5;
export const thinZ:Point[]=[{x:0,y:0,p:1},{x:100,y:0,p:1},{x:99,y:2,p:1},{x:199,y:2,p:1}];
export const tinyHair:Point[]=[{x:100,y:100,p:1},{x:110,y:98,p:1},{x:120,y:97,p:1},{x:130,y:98,p:1},{x:140,y:100,p:1}];
const make=(points:Point[],level:number):Stroke=>({id:'c4',kind:'stroke',tool:'brush',engineVersion:revision,points,size:4,opacity:1,color:'#000000',response:1,pressure:false,stabilization:1,smoothness:level});
describe('structural sparse input',()=>{
 it('protects the short middle arm of an unequal four-point Z at every level',()=>{for(const level of [0,25,50,75,100])expect(strokeGeometry(make(thinZ,level)).points).toEqual(thinZ);});
 it('does not flatten a three-pixel high five-point hair arc at maximum stabilization',()=>{for(const level of [0,25,50,75,100]){const g=strokeGeometry(make(tinyHair,level));expect(Math.min(...g.points.map(p=>p.y))).toBeLessThan(98);expect(g.points[0]).toEqual(tinyHair[0]);expect(g.points.at(-1)).toEqual(tinyHair.at(-1));}});
 it('preserves zigzag vertices at all smoothness and stabilization levels',()=>{const points=[{x:0,y:0,p:1},{x:10,y:10,p:1},{x:20,y:0,p:1},{x:30,y:10,p:1},{x:40,y:0,p:1}];for(const level of [0,25,50,75,100])for(const stabilization of [0,.25,.5,.75,1])expect(strokeGeometry({...make(points,level),stabilization}).points).toEqual(points);});
 it('preserves dense endpoints, pressure and deterministic saved-revision geometry',()=>{for(const {points} of Object.values(noisyContours))for(const level of [0,25,50,75,100])for(const stabilization of [0,.25,.5,.75,1])for(const engineVersion of [4,5] as const){const s={...make(points,level),stabilization,engineVersion},g=strokeGeometry(s);expect(g).toEqual(strokeGeometry({...s}));expect(g.points[0]).toEqual(points[0]);expect(g.points.at(-1)).toEqual(points.at(-1));expect(g.points.map(p=>p.p)).toEqual(points.map(p=>p.p));expect(g.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);}});
 it('finalizes an independent immutable source and caches only finalized geometry',()=>{const input=make(structuredClone(thinZ),100),snapshot=strokeSnapshot(input),expected=finalGeometry(snapshot);input.points[1].x=1000;expect(snapshot.points[1].x).toBe(100);expect(Object.isFrozen(snapshot.points)).toBe(true);expect(finalGeometry(snapshot)).toBe(expected);expect(()=>{snapshot.points[0].x=30;}).toThrow();});
 it('validates diagnostic input and executes the real algorithm repeatedly without changing source',async()=>{const source=structuredClone(tinyHair),record={tool:'brush',settings:make(source,100),source,notes:[]};const before=JSON.stringify(record),result=await replayTrace(record,100);expect(result.completed).toBe(100);expect(result.identical).toBe(true);expect(JSON.stringify(record)).toBe(before);for(const patch of [{source:[{x:NaN,y:0,p:1}]},{truncated:true},{settings:{...record.settings,engineVersion:99}}])expect(()=>diagnosticTrace({...record,...patch})).toThrow();});
});
