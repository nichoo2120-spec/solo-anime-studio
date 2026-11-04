import {describe,it,expect} from 'vitest';
import {processedGeometry,TrailingBrush,stabilizeCapturedPath} from '../src/engine/strokeProcessing';
import {strokeGeometry,flattenCubic} from '../src/engine/strokeGeometry';
import {appendOperation,newProject,validateProject,type Point,type Stroke} from '../src/core/model';
import {sequences,levels,noisyLine,noisyContours} from './fixtures/drawingSequences';
const stroke=(points:Point[],smoothness=0,stabilization=0):Stroke=>({id:'fixed-recording',kind:'stroke',tool:'brush',points,size:4,color:'#18212a',opacity:1,pressure:false,response:1,engineVersion:4,smoothness,stabilization});
const rms=(points:Point[],reference:Point[])=>Math.sqrt(points.reduce((sum,p,i)=>sum+(p.x-reference[i].x)**2+(p.y-reference[i].y)**2,0)/points.length);

describe('deterministic captured geometry',()=>{
 for(const name of ['circle13','circle30','fastS','hair5','v3','z4'] as const)it(`replays ${name} 100 times with exact samples/endpoints and saved geometry`,()=>{
  const source=structuredClone(sequences[name]),s=stroke(source,50,.25),expected=JSON.stringify(strokeGeometry(s)),original=JSON.stringify(source);
  for(let run=0;run<100;run++){const input=structuredClone(s),result=strokeGeometry(input);expect(JSON.stringify(result)).toBe(expected);expect(input.points).toHaveLength(source.length);expect(result.points[0]).toEqual(source[0]);expect(result.points.at(-1)).toEqual(source.at(-1));const doc=validateProject(JSON.parse(JSON.stringify(appendOperation(newProject(),input))));const saved=doc.layers.find(l=>l.id===doc.activeLayerId)!.operations[0] as Stroke;expect(JSON.stringify(strokeGeometry(saved))).toBe(expected);}
  expect(JSON.stringify(source)).toBe(original);
 });
 it.each(levels)('keeps V/Z vertices and straight arms at smoothness %s and maximum stabilization',level=>{for(const points of [sequences.v3,sequences.z4]){const g=strokeGeometry(stroke(points,level,1));expect(g.points).toEqual(points);const flat=g.cubics.flatMap(c=>flattenCubic(c));expect(flat.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);for(let i=1;i<points.length-1;i++)expect(g.cubics[i-1].c2).toEqual(points[i]);}});
 it('keeps controlled circle radii and continuous closed tangents',()=>{for(const points of [sequences.circle13,sequences.circle30]){const g=strokeGeometry(stroke(points,50,0)),flat=g.cubics.flatMap(c=>flattenCubic(c));for(const p of flat)expect(Math.hypot(p.x-300,p.y-260)).toBeGreaterThan(93);for(const p of flat)expect(Math.hypot(p.x-300,p.y-260)).toBeLessThan(107);const a=g.cubics[0],b=g.cubics.at(-1)!,u={x:a.c1.x-a.a.x,y:a.c1.y-a.a.y},v={x:b.b.x-b.c2.x,y:b.b.y-b.c2.y};expect((u.x*v.x+u.y*v.y)/(Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y))).toBeGreaterThan(.999);}});
 it('handles one point, duplicates, two-point flicks and zero distance explicitly',()=>{for(const points of [[{x:0,y:0,p:1}],[{x:0,y:0,p:1},{x:0,y:0,p:1}],[{x:0,y:0,p:1},{x:.01,y:.02,p:1}]])for(const level of levels){const g=strokeGeometry(stroke(points,level,level/100));expect(g.points[0]).toEqual(points[0]);expect(g.points.at(-1)).toEqual(points.at(-1));expect(g.cubics.length).toBe(points.at(-1)!.x?1:0);}});
 it('retains sparse arcs and bounds local handles without backwards folds',()=>{for(const source of [sequences.fastS,sequences.hair5,[{x:100,y:200,p:1},{x:150,y:180,p:1},{x:200,y:200,p:1}]]){const g=strokeGeometry(stroke(source));expect(g.points).toEqual(source);const flat=g.cubics.flatMap(c=>flattenCubic(c)),length=flat.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-flat[i].x,p.y-flat[i].y),0);expect(length).toBeGreaterThan(Math.hypot(source.at(-1)!.x-source[0].x,source.at(-1)!.y-source[0].y)*1.01);for(const c of g.cubics){const dx=c.b.x-c.a.x,dy=c.b.y-c.a.y,d=dx*dx+dy*dy;const a=((c.c1.x-c.a.x)*dx+(c.c1.y-c.a.y)*dy)/d,b=((c.c2.x-c.a.x)*dx+(c.c2.y-c.a.y)*dy)/d;expect(a).toBeGreaterThanOrEqual(-1e-8);expect(a).toBeLessThanOrEqual(b+1e-8);expect(b).toBeLessThanOrEqual(1.00000001);}}});
 it('does not introduce backwards-x loops into controlled monotone contours at any level',()=>{for(const {points} of Object.values(noisyContours))for(const level of levels)for(const strength of [0,.5,1]){const flat=strokeGeometry(stroke(points,level,strength)).cubics.flatMap(c=>flattenCubic(c));for(let i=1;i<flat.length;i++)expect(flat[i].x).toBeGreaterThanOrEqual(flat[i-1].x-.00001);}});
});

describe('observable, separate smoothness and stabilization',()=>{
 for(const [name,fixture] of Object.entries(noisyContours))it(`smooths recorded shaky ${name} progressively at all five levels`,()=>{
  const result=levels.map(level=>strokeGeometry(stroke(fixture.points,level,0))),errors=result.map(g=>rms(g.points,fixture.reference));
  for(let i=1;i<errors.length;i++)expect(errors[i]).toBeLessThan(errors[i-1]-.15);
  expect(errors.at(-1)!).toBeLessThan(errors[0]*.4);expect(new Set(result.map(g=>JSON.stringify(g))).size).toBe(5);
  result.forEach(g=>{expect(g.points).toHaveLength(fixture.points.length);expect(g.points[0]).toEqual(fixture.points[0]);expect(g.points.at(-1)).toEqual(fixture.points.at(-1));});
 });
 it('reduces live shake progressively, exposes controlled lag and catches up on release',()=>{
  const jitter:number[]=[],lags:number[]=[];
  for(const level of levels){const follower=new TrailingBrush(level/100),positions=noisyLine.map(p=>follower.push(p)),middle=positions.slice(30,-1),mean=middle.reduce((sum,p)=>sum+p.y,0)/middle.length;jitter.push(Math.sqrt(middle.reduce((sum,p)=>sum+(p.y-mean)**2,0)/middle.length));lags.push(noisyLine[70].x-positions[70].x);expect(follower.finish(noisyLine.at(-1)!)).toEqual(noisyLine.at(-1));for(let i=0;i<positions.length;i++)expect(Math.hypot(positions[i].x-noisyLine[i].x,positions[i].y-noisyLine[i].y)).toBeLessThanOrEqual(24.00001);}
  for(let i=1;i<levels.length;i++){expect(jitter[i]).toBeLessThanOrEqual(jitter[i-1]*1.01);expect(lags[i]).toBeGreaterThan(lags[i-1]);}expect(jitter.at(-1)!).toBeLessThan(jitter[0]*.21);expect(lags.at(-1)!).toBeGreaterThan(lags[0]+1);
 });
 it('smoothing does not move the live follower; stabilization is not overridden by smoothness',()=>{
  const input=noisyContours.s.points;expect(processedGeometry(input,.5,0,'live')).toEqual(processedGeometry(input,.5,100,'live'));
  for(const strength of [0,.25,.5,.75,1])expect(new Set(levels.map(level=>JSON.stringify(processedGeometry(input,strength,level)))).size).toBe(5);
  expect(stabilizeCapturedPath(input,0,false)).toEqual(input);expect(stabilizeCapturedPath(input,1,false).at(-1)).not.toEqual(input.at(-1));expect(stabilizeCapturedPath(input,1,true).at(-1)).toEqual(input.at(-1));
 });
});
