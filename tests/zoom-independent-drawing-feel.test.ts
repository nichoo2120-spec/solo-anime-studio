import {describe,it,expect} from 'vitest';
import {strokeGeometry,STROKE_FEEL_REFERENCE_ZOOM} from '../src/engine/strokeGeometry';
import {appendOperation,newProject,validateProject,type Point,type Stroke} from '../src/core/model';

const gesture=Array.from({length:160},(_,i)=>({x:100+i*1.8,y:110+Math.sin(i*.1)*20+(i%2?.65:-.65),p:.15+i/200}));
const atZoom=(zoom:number,pressure=true,stabilization=.35,smoothness=38):Stroke=>({
 id:'zoom-stroke',kind:'stroke',tool:'brush',engineVersion:6,liveRefinementVersion:2,
 captureZoom:zoom,points:gesture.map(p=>({...p,x:p.x/zoom,y:p.y/zoom})),
 color:'#223344',size:6,opacity:1,pressure,response:1,stabilization,smoothness,
});
const toScreen=(points:Point[],zoom:number)=>points.map(p=>({...p,x:p.x*zoom,y:p.y*zoom}));
const maxDifference=(a:Point[],b:Point[])=>Math.max(...a.map((p,i)=>Math.hypot(p.x-b[i].x,p.y-b[i].y)));

describe('Zoom-invariant hand-drawn stroke feel (reference: 121%)',()=>{
 it('matches 121% curve cleanup at smaller/normal/larger zoom, live and final',()=>{
  expect(STROKE_FEEL_REFERENCE_ZOOM).toBe(1.21);
  for(const phase of ['live','final'] as const){
   const expected=toScreen(strokeGeometry(atZoom(1.21),phase).points,1.21);
   for(const zoom of [.5,.8,1,1.21,2,4]){
    const actual=strokeGeometry(atZoom(zoom),phase);
    expect(maxDifference(toScreen(actual.points,zoom),expected)).toBeLessThan(1e-8);
    expect(actual.points.every((p,i)=>p.p===atZoom(zoom).points[i].p)).toBe(true);
   }
  }
 });
 it('preserves physical pen endpoints at zero stabilization and on pen-up',()=>{
  for(const zoom of [.5,1,1.21,2]){
   const raw=atZoom(zoom,true,0,0);
   expect(strokeGeometry(raw,'live').points.at(-1)).toEqual(raw.points.at(-1));
   const steady=atZoom(zoom,true,.75,60);
   expect(strokeGeometry(steady,'final').points.at(-1)).toEqual(steady.points.at(-1));
   expect(strokeGeometry(steady,'final').points[0]).toEqual(steady.points[0]);
  }
 });
 it('keeps the early live prefix stable as more samples arrive',()=>{
  const s=atZoom(1),prefix=strokeGeometry({...s,points:s.points.slice(0,80)},'live');
  const complete=strokeGeometry(s,'live');
  expect(maxDifference(prefix.points.slice(0,78),complete.points.slice(0,78))).toBeLessThan(1e-8);
 });
 it('never rewrites the feel of older saved strokes without captureZoom',()=>{
  const previous=atZoom(1);delete previous.captureZoom;
  expect(strokeGeometry(previous,'final')).toEqual(strokeGeometry({...previous},'final'));
 });
 it('saves new zoom-aware strokes and rejects invalid captured zoom',()=>{
  expect(()=>validateProject(appendOperation(newProject(),atZoom(1)))).not.toThrow();
  expect(()=>validateProject(appendOperation(newProject(),atZoom(0)))).toThrow();
  expect(()=>validateProject(appendOperation(newProject(),atZoom(Infinity)))).toThrow();
 });
});
