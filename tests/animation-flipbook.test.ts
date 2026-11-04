import {describe,it,expect} from 'vitest';
import {newProject,appendOperation,uid,validateProject} from '../src/core/model';
import {addDrawingFrame,selectDrawingFrame,frameList,currentFrameIndex,syncActiveFrame} from '../src/animation/timeline';
import {flipCandidate,flipVisibleLayers} from '../src/animation/flipbook';

const stroke=()=>({id:uid(),kind:'stroke' as const,tool:'brush' as const,
 points:[{x:30,y:25,p:1}],size:5,opacity:1,color:'#000000',pressure:false,response:1});

describe('Phase 2 Tool 3: non-destructive flipbook',()=>{
 it('previews previous/next without selecting or editing another frame',()=>{
  let p=appendOperation(newProject(),stroke());
  p=addDrawingFrame(p);p=syncActiveFrame(appendOperation(p,stroke()));
  const current=p,active=p.animation!.activeFrameId;
  const previous=flipCandidate(p,-1),next=flipCandidate(p,1);
  expect(previous?.drawings[p.activeLayerId]).toHaveLength(1);
  expect(next).toBeNull();
  const preview=flipVisibleLayers(p,previous!);
  expect(preview.animation).toBeUndefined();
  expect(preview.layers.find(l=>l.id===p.activeLayerId)!.operations).toBe(previous!.drawings[p.activeLayerId]);
  expect(p).toBe(current);
  expect(p.animation!.activeFrameId).toBe(active);
  expect(()=>validateProject(JSON.parse(JSON.stringify(p)))).not.toThrow();
 });
 it('switches candidate direction on middle frame and respects boundaries',()=>{
  let p=newProject();p=addDrawingFrame(p);p=addDrawingFrame(p);
  const frames=frameList(p);
  p=selectDrawingFrame(p,frames[1].id);
  expect(currentFrameIndex(p)).toBe(1);
  expect(flipCandidate(p,-1)).toBe(frameList(p)[0]);
  expect(flipCandidate(p,1)).toBe(frameList(p)[2]);
  p=selectDrawingFrame(p,frames[0].id);
  expect(flipCandidate(p,-1)).toBeNull();
 });
 it('includes all visible artwork but excludes hidden and reference layers',()=>{
  let p=newProject();const frame=frameList(p)[0];
  p={...p,layers:[...p.layers.map(l=>({...l,visible:false})),{...p.layers[0],id:'reference-only',visible:true,reference:true}]};
  expect(flipVisibleLayers(p,frame).layers).toHaveLength(0);
 });
});
