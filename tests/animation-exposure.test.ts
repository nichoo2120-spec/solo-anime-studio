import {describe,it,expect} from 'vitest';
import {newProject,appendOperation,validateProject,uid} from '../src/core/model';
import {DocumentStore} from '../src/core/history';
import {addDrawingFrame,duplicateDrawingFrame,selectDrawingFrame,frameList,setDrawingFrameHold,frameHold,totalExposureFrames,frameExposureStart,currentExposureRange} from '../src/animation/timeline';
const stroke=()=>({id:uid(),kind:'stroke' as const,tool:'brush' as const,points:[{x:2,y:3,p:.8}],size:4,opacity:1,color:'#123456',pressure:false,response:1});

describe('Phase 2 Tool 4: frame holds (exposure timing)',()=>{
 it('defaults old frame projects to a single exposure and remains backwards compatible',()=>{
  const project=newProject();expect(frameHold(frameList(project)[0])).toBe(1);
  expect(totalExposureFrames(project)).toBe(1);expect(currentExposureRange(project)).toEqual({start:1,end:1,hold:1});
  expect(validateProject(JSON.parse(JSON.stringify(project)))).toBeTruthy();
 });
 it('holds a cel without duplicating pixels, adjusts frame numbers, and saves/reopens',()=>{
  const store=new DocumentStore(newProject());store.commit(appendOperation(store.getSnapshot(),stroke()));
  const sourceOps=store.getSnapshot().layers.find(l=>l.id===store.getSnapshot().activeLayerId)!.operations;
  store.commit(setDrawingFrameHold(store.getSnapshot(),2),'Hold 2 frames');
  expect(currentExposureRange(store.getSnapshot())).toEqual({start:1,end:2,hold:2});
  expect(frameList(store.getSnapshot())[0].drawings[store.getSnapshot().activeLayerId]).toBe(sourceOps);
  store.commit(addDrawingFrame(store.getSnapshot()));store.commit(setDrawingFrameHold(store.getSnapshot(),3));
  expect(totalExposureFrames(store.getSnapshot())).toBe(5);expect(frameExposureStart(store.getSnapshot(),1)).toBe(3);
  expect(currentExposureRange(store.getSnapshot())).toEqual({start:3,end:5,hold:3});
  const saved=JSON.parse(JSON.stringify(store.getSnapshot()));expect(()=>validateProject(saved)).not.toThrow();
  expect(frameList(saved)[0].drawings[saved.activeLayerId]).toHaveLength(1);
  expect(frameList(saved)[1].drawings[saved.activeLayerId]).toHaveLength(0);
 });
 it('supports undo/redo and does not change drawings on metadata-only edits',()=>{
  const store=new DocumentStore(newProject());store.commit(appendOperation(store.getSnapshot(),stroke()));
  store.commit(setDrawingFrameHold(store.getSnapshot(),12),'Hold');
  expect(frameHold(frameList(store.getSnapshot())[0])).toBe(12);
  store.undo();expect(frameHold(frameList(store.getSnapshot())[0])).toBe(1);
  store.redo();expect(frameHold(frameList(store.getSnapshot())[0])).toBe(12);
  expect(store.getSnapshot().layers.find(l=>l.id===store.getSnapshot().activeLayerId)!.operations).toHaveLength(1);
 });
 it('duplicates exposure timing but does not couple future cel edits',()=>{
  const store=new DocumentStore(newProject());store.commit(appendOperation(store.getSnapshot(),stroke()));
  store.commit(setDrawingFrameHold(store.getSnapshot(),4));store.commit(duplicateDrawingFrame(store.getSnapshot()));
  expect(frameList(store.getSnapshot()).map(frameHold)).toEqual([4,4]);
  expect(totalExposureFrames(store.getSnapshot())).toBe(8);
  store.commit(appendOperation(store.getSnapshot(),stroke()));
  const original=frameList(store.getSnapshot())[0];
  store.selectFrame(selectDrawingFrame(store.getSnapshot(),original.id));
  expect(store.getSnapshot().layers.find(l=>l.id===store.getSnapshot().activeLayerId)!.operations).toHaveLength(1);
 });
 it('rejects invalid holds without changing document state',()=>{
  const project=newProject();for(const invalid of [0,25,2.5,NaN,Infinity])expect(setDrawingFrameHold(project,invalid)).toBe(project);
  const timed=setDrawingFrameHold(project,3);
  for(const invalid of [0,25,2.5,-1]){
   const wrong=structuredClone(timed) as any;wrong.animation.frames[0].hold=invalid;
   expect(()=>validateProject(wrong)).toThrow(/hold duration/);
  }
 });
});
