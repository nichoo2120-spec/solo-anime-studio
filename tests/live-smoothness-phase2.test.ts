import {describe,it,expect} from 'vitest';
import {liveSmoothCapturedPath} from '../src/engine/strokeProcessing';
import {strokeGeometry} from '../src/engine/strokeGeometry';
import {newProject,appendOperation,validateProject,type Stroke} from '../src/core/model';
const points=Array.from({length:80},(_,i)=>({x:i*2.5,y:50+Math.sin(i*.31)*3+Math.sin(i*1.4)*1.4,p:.3+i/200}));
const stroke=(overrides:Partial<Stroke>={})=>({kind:'stroke',id:'test',tool:'brush',color:'#273039',size:6,opacity:1,pressure:true,response:1,stabilization:0,smoothness:65,engineVersion:6,points,...overrides} as Stroke);
describe('Phase 2 raster drawing smoothness without regression',()=>{
 it('does not touch zero-smoothing geometry, pressure or raw sample storage',()=>{
  const previous=stroke({smoothness:0});const newer=stroke({smoothness:0,liveRefinementVersion:1});
  expect(strokeGeometry(newer,'live')).toEqual(strokeGeometry(previous,'live'));
  expect(newer.points).toEqual(points);
 });
 it('smoothness visibly adjusts live curve geometry without adding input delay',()=>{
  const old=strokeGeometry(stroke(),'live'),newer=strokeGeometry(stroke({liveRefinementVersion:1}),'live');
  expect(newer.points).toHaveLength(old.points.length);
  expect(newer.points.at(-1)).toEqual(old.points.at(-1));
  expect(newer.points[0]).toEqual(old.points[0]);
  expect(newer.points.slice(1,-1).some((p,i)=>p.x!==old.points[i+1].x||p.y!==old.points[i+1].y)).toBe(true);
  expect(newer.points.every((p,i)=>p.p===points[i].p)).toBe(true);
 });
 it('local filter keeps corners and endpoints, with stable old prefix when extended',()=>{
  const corners=new Set([15,40]);const a=liveSmoothCapturedPath(points.slice(0,60),100,corners),b=liveSmoothCapturedPath(points,100,corners);
  expect(a[0]).toEqual(points[0]);expect(a[15]).toEqual(points[15]);expect(a[40]).toEqual(points[40]);
  expect(a.slice(0,58)).toEqual(b.slice(0,58));
 });
 it('preserves legacy saved strokes and validates new documents',()=>{
  expect(strokeGeometry(stroke(),'final')).toEqual(strokeGeometry(stroke({liveRefinementVersion:undefined}),'final'));
  expect(()=>validateProject(appendOperation(newProject(),stroke({liveRefinementVersion:1})))).not.toThrow();
 });
});
