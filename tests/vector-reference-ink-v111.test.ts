import {describe,it,expect} from 'vitest';
import {createFreehandVector,buildInkPressureProfile,referenceInkOutline,vectorSvg} from '../src/engine/vector';
import {validateProject,newLayer,newProject} from '../src/core/model';

const referenceWave=Array.from({length:240},(_,i)=>{
 const t=i/239;return {x:30+700*t,y:190+75*Math.sin(t*Math.PI*4)+.9*Math.sin(t*80),p:.1+.88*Math.sin(t*Math.PI)**2};
});
const makeInk=(points=referenceWave,pressure=true)=>({...createFreehandVector('test',points,7,'#bd2839',pressure),profileVersion:4 as const,minWidthPercent:22,maxWidthPercent:100,taperStart:0,taperEnd:0});

describe('v0.5.111 shared FlowCurve ink',()=>{
 it('produces continuous, finite Bezier outlines and pressure-aware strokes',()=>{
  const ink=makeInk(),outline=referenceInkOutline(ink);
  expect(ink.nodes.length).toBeGreaterThan(2);
  expect(ink.nodes.length).toBeLessThan(60);
  expect(outline.length).toBeGreaterThan(30);
  expect(outline.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);
  expect(vectorSvg(ink,800,600)).toContain('fill="#bd2839"');
 });
 it('preserves a pressure bulge midway through a straight 2-node Bezier',()=>{
  const samples=Array.from({length:121},(_,i)=>({x:20+i*4,y:120,p:.1+.9*Math.sin(i/120*Math.PI)}));
  const line={...makeInk(samples),widthProfile:buildInkPressureProfile(samples)};
  const outline=referenceInkOutline(line);
  const range=(x:number)=>{const ys=outline.filter(p=>Math.abs(p.x-x)<1.1).map(p=>p.y);return Math.max(...ys)-Math.min(...ys);};
  expect(line.nodes.length).toBeLessThanOrEqual(4);
  expect(range(260)).toBeGreaterThan(range(40)*1.5);
 });
 it('preserves a precise rounded line when pressure is disabled',()=>{
  const line=makeInk(referenceWave,false),svg=vectorSvg(line,800,600);
  expect(svg).toContain('stroke-linecap="round"');
  expect(svg).toContain('fill="none"');
 });
 it('supports save/reopen validation for new v4 vector strokes',()=>{
  const doc=newProject('Ink',800,600),layer=newLayer('Ink','vector');
  layer.operations=[makeInk()];
  const stored={...doc,layers:[layer],activeLayerId:layer.id};
  expect(validateProject(JSON.parse(JSON.stringify(stored))).layers[0].operations[0]).toMatchObject({profileVersion:4,kind:'vector'});
 });
 it('keeps actual sharp corners instead of replacing them with loops',()=>{
  const stroke=Array.from({length:101},(_,i)=>({x:20+i*4,y:i<=50?20+i*3:170-(i-50)*3,p:.7}));
  const line=makeInk(stroke);expect(line.nodes.some(n=>Math.hypot(n.x-220,n.y-170)<8)).toBe(true);
 });
});
