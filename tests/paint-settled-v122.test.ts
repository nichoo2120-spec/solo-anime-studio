import {describe,it,expect} from 'vitest';
import {strokeGeometry} from '../src/engine/strokeGeometry';
import {activeLayer,newProject,validateProject,type Stroke} from '../src/core/model';

describe('settled paint geometry',()=>{
 const stroke:Stroke={id:'paint',kind:'stroke',tool:'brush',engineVersion:10,paintNibVersion:1,brushKind:'paint',liveRefinementVersion:3,captureZoom:.64,size:150,opacity:.9,color:'#30343a',pressure:true,response:1,stabilization:.25,smoothness:25,points:Array.from({length:200},(_,i)=>({x:100+i*3,y:250+100*Math.sin(i/199*Math.PI*8),p:.2+.8*Math.sin(i/199*Math.PI)**2}))};
 it('keeps settled paint fixed on release while the endpoint reaches the pen',()=>{
  const live=strokeGeometry(stroke,'live'),final=strokeGeometry(stroke,'final');
  expect(final.points.slice(0,-3)).toEqual(live.points.slice(0,-3));expect(final.cubics.slice(0,-4)).toEqual(live.cubics.slice(0,-4));expect(final.points.at(-1)).toEqual(stroke.points.at(-1));
  const saved=JSON.parse(JSON.stringify(stroke));expect(strokeGeometry(saved)).toEqual(final);
 });
 it('does not alter the previous live refinement renderer',()=>{
  const old={...stroke,liveRefinementVersion:2 as const};expect(strokeGeometry(old,'live')).toEqual(strokeGeometry(stroke,'live'));expect(strokeGeometry(old,'final').points.slice(5,-5)).not.toEqual(strokeGeometry(stroke,'final').points.slice(5,-5));
 });
 it('validates the stored renderer version and rejects future unknown versions',()=>{
  const p=newProject();activeLayer(p).operations=[stroke];expect(validateProject(JSON.parse(JSON.stringify(p))).layers).toEqual(p.layers);
  const bad=JSON.parse(JSON.stringify(p));(activeLayer(bad).operations[0] as any).liveRefinementVersion=4;expect(()=>validateProject(bad)).toThrow('Unsupported live stroke refinement');
 });
});
