import {describe,it,expect} from 'vitest';
import {createFreehandVector,flowVectorOutline,flowPressureWidth,vectorSvg} from '../src/engine/vector';
import {newProject,validateProject} from '../src/core/model';
import type {Point} from '../src/core/model';
const make=(points:Point[])=>({...createFreehandVector('test',points,8,'#273039',true,1),profileVersion:2 as const,minWidthPercent:34,maxWidthPercent:100,taperStart:.05,taperEnd:.08});
const stable=(points:{x:number;y:number}[])=>points.map(pt=>({...pt,p:.38}));
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
describe('FlowCurve solid vector ink renderer v0.5.104',()=>{
 it('preserves endpoints and creates visible short strokes at very light pen pressure',()=>{
  const p=[{x:4,y:8,p:.001},{x:50,y:8,p:.001}];const line=make(p),outline=flowVectorOutline(line);
  expect(line.nodes[0].x).toBe(4);expect(line.nodes.at(-1)?.x).toBe(50);
  expect(outline.length).toBeGreaterThan(12);
  expect(flowPressureWidth(line,.001)).toBeGreaterThan(.34);
 });
 it('joins closed circles continuously without tapering to zero at the seam',()=>{
  const points=stable(Array.from({length:240},(_,i)=>({x:90+65*Math.cos(i*2*Math.PI/239),y:90+65*Math.sin(i*2*Math.PI/239)})));
  const outline=flowVectorOutline(make(points));
  expect(outline.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);
  expect(outline.length).toBeGreaterThan(40);
  const start=outline[0],end=outline.at(-1)!;
  expect(distance(start,end)).toBeGreaterThan(3); // width across joined sides, not pinched to a dot
 });
 it('keeps existing v1 vector ink unchanged and saves new v2 to SVG/project',()=>{
  const points=stable([{x:3,y:9},{x:20,y:65},{x:50,y:14}]);const next=make(points);
  const old={...next,profileVersion:1 as const};
  expect(vectorSvg(next,640,480)).toContain('fill="#273039"');
  expect(vectorSvg(old,640,480)).toContain('fill="#273039"');
  const project=newProject();project.layers[0].kind='vector';project.layers[0].operations=[next,old];
  expect(()=>validateProject(project)).not.toThrow();
  expect(flowPressureWidth({...next,pressure:false},.001)).toBe(1);
 });
});
