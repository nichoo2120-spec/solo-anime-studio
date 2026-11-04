import {describe,it,expect} from 'vitest';
import {createFreehandVector,flashVectorOutline,vectorSvg,vectorDistance} from '../src/engine/vector';
import {newProject,validateProject} from '../src/core/model';

const points=Array.from({length:1600},(_,i)=>({x:30+i*.5,y:80+45*Math.sin(i*.01)+12*Math.sin(i*.027),p:.12+.75*Math.abs(Math.sin(i*.02))}));
const base=createFreehandVector('freehand-flash',points,12,'#242424',true,1.5);
const flash={...base,profileVersion:1 as const,minWidthPercent:18,maxWidthPercent:150,taperStart:.12,taperEnd:.24};

describe('Patch 6 – Flash vector editing and width profile',()=>{
 it('keeps all input endpoints and reduces editable anchor count',()=>{
  expect(base.nodes.length).toBeLessThan(220);
  expect(base.nodes[0].x).toBe(points[0].x);
  expect(base.nodes.at(-1)?.x).toBe(points.at(-1)?.x);
  expect(vectorDistance(base,{x:points[600].x,y:points[600].y})).toBeLessThan(8);
 });
 it('pressure switch OFF yields the same vector width at every reported pressure',()=>{
  const off={...flash,pressure:false};
  expect(flashVectorOutline(off)).toEqual(flashVectorOutline({...off,nodes:off.nodes.map(n=>({...n,p:.01}))}));
 });
 it('responds to width levels and taper as editable outlines',()=>{
  expect(flashVectorOutline(flash)).not.toEqual(flashVectorOutline({...flash,minWidthPercent:80,maxWidthPercent:100}));
  expect(flashVectorOutline(flash)).not.toEqual(flashVectorOutline({...flash,taperStart:0,taperEnd:0}));
 });
 it('round-trips saved project data and exports SVG filled shapes',()=>{
  const p=newProject();p.layers[0].kind='vector';p.layers[0].operations=[flash];
  expect(()=>validateProject(JSON.parse(JSON.stringify(p)))).not.toThrow();
  expect(vectorSvg(flash,1920,1080)).toContain('fill="#242424"');
 });
 it('keeps legacy vector strokes on original rendering format',()=>{
  expect(base.profileVersion).toBeUndefined();
  expect(vectorSvg({...base,pressure:false},1920,1080)).toContain('stroke-width="12"');
 });
});
