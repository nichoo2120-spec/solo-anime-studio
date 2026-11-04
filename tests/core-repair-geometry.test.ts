import {describe,it,expect} from 'vitest';
import {strokeGeometry,cubicAt} from '../src/engine/strokeGeometry';
import {validateProject,newProject,appendOperation,type Stroke,type Point} from '../src/core/model';
import {PointerPath} from '../src/engine/inputPath';
const stroke=(points:Point[],smoothness=0)=>({id:'repair',kind:'stroke',tool:'brush',engineVersion:3,size:4,opacity:1,color:'#000000',pressure:false,response:1,stabilization:0,smoothness,points} as unknown as Stroke);
describe('sparse fast-curve geometry',()=>{
 it('interpolates a four-quadrant circle without inventing corners',()=>{const p=Array.from({length:5},(_,i)=>({x:200+100*Math.cos(i*Math.PI/2),y:200+100*Math.sin(i*Math.PI/2),p:1})),g=strokeGeometry(stroke(p));for(const c of g.cubics){const mid=cubicAt(c,.5);expect(Math.hypot(mid.x-200,mid.y-200)).toBeGreaterThan(96);expect(Math.hypot(mid.x-200,mid.y-200)).toBeLessThan(104);}});
 it('keeps sparse S-curve turning samples at maximum smoothness',()=>{const points=[{x:0,y:0,p:1},{x:25,y:1.5,p:1},{x:50,y:0,p:1},{x:75,y:-1.5,p:1},{x:100,y:0,p:1}],g=strokeGeometry(stroke(points,100));expect(g.points.length).toBeGreaterThanOrEqual(5);expect(Math.max(...g.points.map(p=>p.y))).toBeGreaterThan(.5);expect(Math.min(...g.points.map(p=>p.y))).toBeLessThan(-.5);});
 it('has nonzero smooth tangents at sparse S-curve peaks',()=>{const g=strokeGeometry(stroke([{x:0,y:0,p:1},{x:50,y:100,p:1},{x:100,y:0,p:1},{x:150,y:-100,p:1},{x:200,y:0,p:1}]));expect(g.cubics[0].b.x-g.cubics[0].c2.x).toBeGreaterThan(5);expect(g.cubics[1].c1.x-g.cubics[1].a.x).toBeGreaterThan(5);});
});

describe('capture and repaired geometry regressions',()=>{
 it('keeps 100 sparse circles and 100 shallow S-curves at maximum filtering',()=>{
  for(let run=0;run<100;run++){
   const count=4+run%9,radius=20+run,angle=run*.1,points=Array.from({length:count+1},(_,i)=>({x:200+radius*Math.cos(angle+i/count*Math.PI*2),y:200+radius*Math.sin(angle+i/count*Math.PI*2),p:1}));
   const g=strokeGeometry(stroke(points,100));expect(g.points).toHaveLength(points.length);
   for(const c of g.cubics){const q=cubicAt(c,.5);expect(Math.hypot(q.x-200,q.y-200)/radius).toBeGreaterThan(.94);expect(Math.hypot(q.x-200,q.y-200)/radius).toBeLessThan(1.05);}
   const s=Array.from({length:5},(_,i)=>({x:i*25,y:Math.sin(i*Math.PI/2)*(1+run/100),p:1})),curve=strokeGeometry(stroke(s,100));expect(curve.points).toEqual(s);expect(curve.cubics).toHaveLength(4);
  }
 });
 it('preserves supported corners, hairpin flicks, short strokes and exact endpoints',()=>{
  for(const points of [[{x:0,y:0,p:1},{x:10,y:0,p:1},{x:20,y:0,p:1},{x:20,y:10,p:1},{x:20,y:20,p:1}],[{x:0,y:0,p:.1},{x:50,y:5,p:1},{x:1,y:1,p:.1}],[{x:0,y:0,p:1},{x:.01,y:.02,p:1}]]){
   const g=strokeGeometry(stroke(points,100));expect(g.points).toEqual(points);expect(g.cubics[0].a).toEqual(points[0]);expect(g.cubics.at(-1)!.b).toEqual(points.at(-1));if(points.length>2)expect(g.cubics[points.length===5?1:0].c2).toEqual(points[points.length===5?2:1]);
  }
 });
 it('keeps dense slow-curve filtering bounded without removing samples',()=>{const points=Array.from({length:301},(_,i)=>({x:i,y:30*Math.sin(i/300*Math.PI*2),p:1})),s=stroke(points,100);s.stabilization=1;const g=strokeGeometry(s);expect(g.points).toHaveLength(points.length);g.points.forEach((p,i)=>expect(Math.hypot(p.x-points[i].x,p.y-points[i].y)).toBeLessThanOrEqual(2.5));expect(g.points[0]).toEqual(points[0]);expect(g.points.at(-1)).toEqual(points.at(-1));});
 it('deduplicates overlapping batches and rejects another pointer and stale events',()=>{
  const event=(t:number,x:number,id=7)=>({timeStamp:t,clientX:x,clientY:10,pressure:1,pointerId:id} as PointerEvent),first=event(10,0),path=new PointerPath(7,10,first),a=event(11,1),b=event(12,2),end=event(13,3);
  const batch={...end,getCoalescedEvents:()=>[a,b,event(12,99,8)]} as PointerEvent;expect(path.batch(batch)).toEqual([a,b,batch]);expect(path.batch(batch)).toEqual([]);expect(path.batch(event(9,80))).toEqual([]);expect(path.batch(event(14,4))).toHaveLength(1);
  const late=event(13.5,3.5);expect(path.batch(late).map(p=>p.clientX)).toEqual([1,2,3,3.5,4]);expect(path.replaying).toBe(true);
 });
 it('accepts the new renderer revision and retains legacy geometry unchanged',()=>{const p=[{x:0,y:0,p:1},{x:20,y:30,p:1},{x:40,y:0,p:1}],modern=stroke(p);expect(()=>validateProject(appendOperation(newProject(),modern))).not.toThrow();const old={...modern,engineVersion:2 as const};expect(strokeGeometry(old).cubics[0].c2).toEqual(p[1]);expect(strokeGeometry(modern).cubics[0].c2.x).toBeLessThan(p[1].x);});
});
