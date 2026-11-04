import {describe,it,expect} from 'vitest';
import {strokeGeometry} from '../src/engine/strokeGeometry';
import {appendOperation,newProject,validateProject,type Point,type Stroke} from '../src/core/model';

const p=(x:number,y:number,pressure=.5):Point=>({x,y,p:pressure});
const stroke=(points:Point[],revision:1|2,stabilization=0,smoothness=0):Stroke=>({
 id:'test-low-lag',kind:'stroke',tool:'brush',engineVersion:6,
 liveRefinementVersion:revision,points,size:7,opacity:1,color:'#111111',
 pressure:true,response:1,stabilization,smoothness,
});
const deviation=(points:Point[],expected:number)=>points.slice(1,-1)
 .reduce((sum,p)=>sum+Math.abs(p.y-expected),0)/(points.length-2);

describe('Phase 2 drawing feel: fast clean zero and bounded stabilizer',()=>{
 it('reduces high-frequency subpixel jitter at 0% without lag or changing pressure',()=>{
  const samples=Array.from({length:101},(_,i)=>p(i*2,20+(i%2?.7:-.7),.2+i*.007));
  const original=strokeGeometry(stroke(samples,1),'live');
  const repaired=strokeGeometry(stroke(samples,2),'live');
  expect(deviation(repaired.points,20)).toBeLessThan(deviation(original.points,20)*.6);
  expect(repaired.points[0]).toEqual(samples[0]);
  expect(repaired.points.at(-1)).toEqual(samples.at(-1));
  expect(repaired.points).toHaveLength(samples.length);
  expect(repaired.points.every((pt,i)=>pt.p===samples[i].p)).toBe(true);
 });
 it('retains expressive corners and short strokes',()=>{
  const v=[p(0,0),p(12,0),p(24,0),p(24,12),p(24,24)];
  expect(strokeGeometry(stroke(v,2),'live').points[2]).toEqual(v[2]);
  const tiny=[p(0,0),p(.1,.15)];
  expect(strokeGeometry(stroke(tiny,2),'live').points).toEqual(tiny);
 });
 it('stabilization stays within its spatial cap and catches up at release',()=>{
  const samples=Array.from({length:101},(_,i)=>p(i*2,20));
  const oldTip=strokeGeometry(stroke(samples,1,1),'live').points.at(-1)!;
  const newTip=strokeGeometry(stroke(samples,2,1),'live').points.at(-1)!;
  expect(samples.at(-1)!.x-newTip.x).toBeGreaterThan(0);expect(samples.at(-1)!.x-oldTip.x).toBeGreaterThan(0);
  expect(Math.hypot(samples.at(-1)!.x-newTip.x,samples.at(-1)!.y-newTip.y)).toBeLessThanOrEqual(7.51);
  expect(strokeGeometry(stroke(samples,2,1),'final').points.at(-1)).toEqual(samples.at(-1));
 });
 it('does not rewrite saved revision 1 strokes, and saves revision 2',()=>{
  const samples=[p(0,0),p(10,2),p(20,0)];
  const previous=stroke(samples,1,.7,32),repaired=stroke(samples,2,.7,32);
  expect(strokeGeometry(previous,'final')).toEqual(strokeGeometry({...previous},'final'));
  expect(()=>validateProject(appendOperation(newProject(),repaired))).not.toThrow();
  expect(previous.liveRefinementVersion).toBe(1);
 });
 it('does not cause old already-drawn parts to fluctuate as new samples arrive',()=>{
  const samples=Array.from({length:101},(_,i)=>p(i*2,20+(i%2?.7:-.7)));
  const partial=strokeGeometry(stroke(samples.slice(0,55),2),'live');
  const full=strokeGeometry(stroke(samples,2),'live');
  expect(partial.points.slice(0,53)).toEqual(full.points.slice(0,53));
 });
});
