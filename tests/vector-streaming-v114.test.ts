import {describe,it,expect} from 'vitest';
import {StreamingVectorInk} from '../src/engine/StreamingVectorInk';
import {newProject,newLayer,validateProject} from '../src/core/model';
import {transformVector,vectorSvg,vectorCubics} from '../src/engine/vector';
import {flattenCubic} from '../src/engine/strokeGeometry';

const points=Array.from({length:2001},(_,i)=>({x:20+i*1.5,y:210+80*Math.sin(i/35)+.5*Math.sin(i*.7),p:.2+.7*Math.sin(i*.02)**2}));
const style={id:'stream',width:12,opacity:.7,color:'#223344',pressure:true,smoothness:65,stabilization:12,minWidthPercent:35,maxWidthPercent:100,taperStart:0,taperEnd:0};
const saved=(line:ReturnType<StreamingVectorInk['snapshot']>)=>{const p=newProject('Streaming',4096,700),layer=newLayer('Ink','vector');layer.operations=[line];return {...p,layers:[layer],activeLayerId:layer.id};};

describe('v0.5.114 settled streaming vector ink',()=>{
 it('keeps settled geometry and local pressure profiles unchanged as the stroke grows',()=>{
  const ink=new StreamingVectorInk(style);ink.update(points.slice(0,401));const first=ink.snapshot(),settled=first.nodes.filter(n=>n.x<400);
  ink.update(points.slice(0,801));const second=ink.snapshot();expect(second.nodes.filter(n=>n.x<400)).toEqual(settled);
  expect(second.inkSections!.slice(0,first.inkSections!.length-1)).toEqual(first.inkSections!.slice(0,-1));
 });
 it('bounds fitting work independently of total gesture length',()=>{
  const ink=new StreamingVectorInk(style);
  for(let i=80;i<=points.length;i+=80){ink.update(points.slice(0,i));ink.snapshot();}
  ink.update(points);const line=ink.snapshot();expect(ink.work.maxFitSamples).toBeLessThan(65);expect(line.inkSections!.length).toBeGreaterThan(60);
  expect(line.nodes[0]).toMatchObject(points[0]);expect(line.nodes.at(-1)).toMatchObject(points.at(-1)!);
 });
 it('is independent of input batching and preview/snapshot cadence',()=>{
  const whole=new StreamingVectorInk(style);whole.update(points);
  const batched=new StreamingVectorInk(style);for(let i=1;i<points.length;i+=17){batched.update(points.slice(0,i));batched.snapshot();}batched.update(points);
  expect(batched.snapshot()).toEqual(whole.snapshot());
 });
 it('joins ordinary curve sections with matching tangent directions',()=>{
  const ink=new StreamingVectorInk(style);ink.update(points.slice(0,501));const line=ink.snapshot();
  for(const section of line.inkSections!.slice(0,-1)){const n=line.nodes[section.end],ax=n.x-n.in.x,ay=n.y-n.in.y,bx=n.out.x-n.x,by=n.out.y-n.y,den=Math.hypot(ax,ay)*Math.hypot(bx,by);if(den>1e-8)expect((ax*bx+ay*by)/den).toBeGreaterThan(.9999);}
 });
 it('keeps a streamed circle round and lands on the actual release point',()=>{
  const circle=Array.from({length:241},(_,i)=>({x:250+100*Math.cos(i/240*Math.PI*2),y:200+100*Math.sin(i/240*Math.PI*2),p:.6})),ink=new StreamingVectorInk(style);ink.update(circle);const line=ink.snapshot(),sampled=vectorCubics(line).flatMap(c=>flattenCubic(c,.1));
  expect(Math.max(...sampled.map(p=>Math.abs(Math.hypot(p.x-250,p.y-200)-100)))).toBeLessThan(2);
  expect(line.nodes.at(-1)).toMatchObject(circle.at(-1)!);
 });
 it('validates save/reopen, remains editable after transforms, and exports cubic contours',()=>{
  const ink=new StreamingVectorInk(style);ink.update(points.slice(0,501));const line=ink.snapshot();
  expect(validateProject(JSON.parse(JSON.stringify(saved(line)))).layers[0].operations[0]).toMatchObject({kind:'vector',profileVersion:6});
  const transformed=transformVector(line,[-1,0,0,1,1700,0]);expect(transformed.inkSections).toEqual(line.inkSections);expect(vectorSvg(transformed,1800,700)).toContain('fill="#223344"');expect(vectorSvg(transformed,1800,700)).not.toMatch(/NaN|Infinity/);
 });
 it('rejects malformed section ranges and pressure profiles in saved artwork',()=>{
  const ink=new StreamingVectorInk(style);ink.update(points.slice(0,200));const line=ink.snapshot();
  for(const bad of [{...line,inkSections:[]},{...line,inkSections:[{end:0,widthProfile:[{t:0,p:.5},{t:1,p:.5}]}]},{...line,inkSections:line.inkSections!.map((s,i)=>i? s:{...s,widthProfile:[{t:.2,p:.5},{t:1,p:.5}]})}])expect(()=>validateProject(saved(bad))).toThrow('Invalid streaming vector sections.');
 });
 it('keeps a pressure-sensitive tap as one valid editable mark',()=>{
  const ink=new StreamingVectorInk(style);ink.update([{x:100,y:100,p:.3}]);const line=ink.snapshot();expect(line.nodes).toHaveLength(2);expect(line.inkSections).toHaveLength(1);expect(()=>validateProject(saved(line))).not.toThrow();
 });
 it('does not grow the fit window when the pen stays at one location and changes pressure',()=>{
  const ink=new StreamingVectorInk(style);ink.update(Array.from({length:12000},(_,i)=>({x:100,y:100,p:.2+.6*Math.sin(i/25)**2})));ink.snapshot();expect(ink.work.maxFitSamples).toBe(1);
 });
});
