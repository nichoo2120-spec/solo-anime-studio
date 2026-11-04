import {describe,it,expect} from 'vitest';
import {createFreehandVector,solidInkOutline,solidInkVariable,vectorCubics,vectorSvg} from '../src/engine/vector';
import {flattenCubic} from '../src/engine/strokeGeometry';
import type {Point} from '../src/core/model';
const circle:Point[]=Array.from({length:241},(_,i)=>({x:420+180*Math.cos(i*Math.PI/120),y:220+180*Math.sin(i*Math.PI/120),p:.5}));
const v3=(points:Point[],pressure=false)=>({...createFreehandVector('new',points,5,'#30343a',pressure,1.4),profileVersion:3 as const,pressure,minWidthPercent:70,maxWidthPercent:100,taperStart:0,taperEnd:0});

describe('v0.5.109 new default Solid Ink vector stroke',()=>{
 it('draws a true centerline vector stroke with no automatic tapers',()=>{
  const line=v3([{x:10,y:10,p:.4},{x:120,y:40,p:.4}]);
  expect(solidInkVariable(line)).toBe(false);
  const svg=vectorSvg(line,640,480);
  expect(svg).toContain('stroke-width="5"');
  expect(svg).toContain('stroke-linecap="round"');
  expect(svg).not.toContain('fill-opacity');
 });
 it('fits a circle with curved handles, rather than a polygon',()=>{
  const line=v3(circle),curveSamples=vectorCubics(line).flatMap(c=>flattenCubic(c,.25));
  const maxError=Math.max(...curveSamples.map(p=>Math.abs(Math.hypot(p.x-420,p.y-220)-180)));
  expect(line.nodes.length).toBeLessThan(30);
  expect(maxError).toBeLessThan(4);
  expect(line.nodes[0].x).toBeCloseTo(circle[0].x,4);
  expect(line.nodes.at(-1)!.y).toBeCloseTo(circle.at(-1)!.y,4);
 });
 it('keeps a variable-pressure outline if the artist opts into it',()=>{
  const line=v3(circle,true),poly=solidInkOutline(line);
  expect(solidInkVariable(line)).toBe(true);
  expect(poly.length).toBeGreaterThan(30);
  expect(poly.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);
  expect(vectorSvg(line,640,480)).toContain('fill="#30343a"');
 });
 it('does not change v2 saved stroke profiles',()=>{
  const old={...v3(circle,true),profileVersion:2 as const};
  expect(vectorSvg(old,640,480)).toContain('fill="#30343a"');
 });
});
