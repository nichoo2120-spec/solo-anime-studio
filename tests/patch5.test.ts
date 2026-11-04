import {describe,it,expect} from 'vitest';
import {createFreehandVector,vectorCubics,vectorDistance,adjustVectorSmoothness,vectorSvg} from '../src/engine/vector';
import {dryMediaCoverage,isDryMediaV9} from '../src/engine/dryMediaV9';
import {newBrushLibrary,restoreBrushLibrary,stockPresets} from '../src/core/brushes';
import {newProject,appendOperation,validateProject,type Stroke} from '../src/core/model';

describe('Patch 5 graphite and circular dry brush',()=>{
 it('uses dedicated revision 9 without overwriting older brush renderer versions',()=>{
  expect(isDryMediaV9('dry-round')).toBe(true);
  expect(isDryMediaV9('graphite-hb')).toBe(true);
  expect(isDryMediaV9('watercolor')).toBe(false);
  expect(stockPresets.find(p=>p.id==='dry')!.settings.brushKind).toBe('dry-round');
  expect(stockPresets.find(p=>p.id==='hb')!.settings.brushKind).toBe('graphite-hb');
  const older=restoreBrushLibrary({brushId:'hb',eraserId:'eraser-hard',presets:[{id:'hb',settings:{...stockPresets[0].settings,brushKind:'hb',size:19}}]});
  expect(older.presets.find(p=>p.id==='hb')!.settings).toMatchObject({size:19,brushKind:'graphite-hb'});
 });
 it('produces irregular dry-grain deposits not regularly repeating dabs',()=>{
  const samples=Array.from({length:80},(_,i)=>dryMediaCoverage('dry-round',120+i*.7,76+i*.5,8,.95));
  expect(Math.max(...samples)-Math.min(...samples)).toBeGreaterThan(.25);
  expect(dryMediaCoverage('graphite-hb',130,70,5,.7)).not.toBe(dryMediaCoverage('graphite-hb',131,70,5,.7));
 });
 it('opens new revision 9 strokes and unchanged revision 8 strokes',()=>{
  const base={id:'p5',kind:'stroke',tool:'brush',points:[{x:20,y:20,p:.3},{x:160,y:160,p:.8}],size:28,opacity:1,color:'#112233',pressure:true,response:1,brushKind:'dry-round',engineVersion:9} as Stroke;
  expect(()=>validateProject(appendOperation(newProject(),base))).not.toThrow();
  expect(()=>validateProject(appendOperation(newProject(),{...base,brushKind:'dry-grain',engineVersion:8}))).not.toThrow();
 });
});
describe('Patch 5 freehand vector line art',()=>{
 it('fits smooth editable Bezier segments from real drawing samples',()=>{
  const input=Array.from({length:90},(_,i)=>({x:20+i*2,y:70+Math.sin(i*.08)*30,p:.2+.7*i/90}));
  const line=createFreehandVector('draw',input,6,'#123456',true,1.4);
  expect(line.nodes.length).toBeGreaterThanOrEqual(3);
  expect(line.nodes.length).toBeLessThan(input.length+1);
  expect(line.nodes[0].x).toBe(input[0].x);
  expect(line.nodes.at(-1)!.x).toBe(input.at(-1)!.x);
  expect(line.nodes.at(-1)!.p).toBeCloseTo(input.at(-1)!.p);
  expect(vectorCubics(line)).toHaveLength(line.nodes.length-1);
  expect(vectorDistance(line,{x:input[40].x,y:input[40].y})).toBeLessThan(5);
  expect(vectorSvg(line,200,200)).toContain('<path');
  expect(adjustVectorSmoothness(line,10).nodes).toHaveLength(line.nodes.length);
 });
 it('keeps sensible geometry for a very short stroke',()=>{
  const line=createFreehandVector('short',[{x:3,y:5,p:.5}],2,'#222222',false);
  expect(line.nodes.length).toBe(2);
  expect(line.nodes[1].x-line.nodes[0].x).toBeCloseTo(.01);
 });
});
