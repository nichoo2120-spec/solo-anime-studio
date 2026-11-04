import {describe,it,expect} from 'vitest';
import {DocumentStore} from '../src/core/history';
import {newProject,validateProject} from '../src/core/model';
import {VectorController,smoothFreehandSamples} from '../src/engine/VectorController';
import {stabilizeCapturedPath} from '../src/engine/strokeProcessing';

const pts=Array.from({length:200},(_,i)=>({x:i*2,y:Math.sin(i*.1)*15+(i%2?1.8:-1.8),p:.35+.3*i/200}));

describe('Patch 5.1 vector smoothness, stabilization and frame-rate fitting',()=>{
 it('keeps endpoints, preserves pressure and reduces noisy jitter at higher smoothness',()=>{
  const filtered=smoothFreehandSamples(pts,80);
  expect(filtered).toHaveLength(pts.length);
  expect(filtered[0]).toEqual(pts[0]);expect(filtered.at(-1)).toEqual(pts.at(-1));
  expect(filtered.every((p,i)=>p.p===pts[i].p)).toBe(true);
  const rough=pts.slice(1,-1).reduce((sum,p,i)=>sum+Math.abs(p.y-(pts[i].y+pts[i+2].y)/2),0);
  const clean=filtered.slice(1,-1).reduce((sum,p,i)=>sum+Math.abs(p.y-(filtered[i].y+filtered[i+2].y)/2),0);
  expect(clean).toBeLessThan(rough);
  expect(smoothFreehandSamples(pts,0)).toBe(pts);
 });
 it('preserves the final pen endpoint when stabilization is enabled',()=>{
  const samples=stabilizeCapturedPath(pts,.4,true);
  expect(samples.at(-1)).toEqual(pts.at(-1));
 });
 it('collects coalesced samples without refitting Bezier nodes until render, then saves editable vectors',()=>{
  const store=new DocumentStore(newProject('Vector 5.1')),brush=()=>({size:4,opacity:1,color:'#334455',pressure:true,stabilization:0,response:1,tolerance:24}),c=new VectorController(store,brush,()=>{},()=>{});
  c.mode='freehand';c.smoothness=65;c.stabilization=27;c.pressure=true;c.down(pts[0],1,true);
  const startingNodes=c.draft!.nodes.length;
  c.moveSamples(pts.slice(1,-1));
  expect(c.draft!.nodes).toHaveLength(startingNodes); // no per-pointer expensive fitting
  c.prepareRender(true);expect(c.draft!.nodes.length).toBeGreaterThan(startingNodes);
  c.up(pts.at(-1)!);
  const p=store.getSnapshot();expect(()=>validateProject(p)).not.toThrow();
  const layer=p.layers.find(l=>l.kind==='vector')!;
  expect(layer.operations.length).toBe(1);
  const op=layer.operations[0];expect(op.kind).toBe('vector');if(op.kind==='vector')expect(op.nodes.at(-1)!.x).toBe(pts.at(-1)!.x);
  store.undo();expect(store.getSnapshot().layers.some(l=>l.kind==='vector')).toBe(false);
  store.redo();expect(store.getSnapshot().layers.some(l=>l.kind==='vector')).toBe(true);
 });
});
