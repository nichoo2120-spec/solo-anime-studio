import {describe,expect,it} from 'vitest';
import {newProject,appendOperation,uid,validateProject} from '../src/core/model';
import {DocumentStore} from '../src/core/history';
import {addDrawingFrame,frameList,frameHold,holdFromDrag,MAX_FRAME_HOLD,setDrawingFrameHoldById,totalExposureFrames,currentFrameIndex,selectDrawingFrame} from '../src/animation/timeline';
const stroke=()=>({id:uid(),kind:'stroke' as const,tool:'brush' as const,points:[{x:3,y:4,p:.65}],size:4,opacity:1,color:'#222222',pressure:false,response:1});

describe('Phase 2 exposure grip + shortcut patch',()=>{
 it('converts pointer motion to whole exposure ticks, clamping 1–24',()=>{
  expect(holdFromDrag(2,4)).toBe(2);
  expect(holdFromDrag(2,6)).toBe(3);
  expect(holdFromDrag(2,19)).toBe(4);
  expect(holdFromDrag(2,-11)).toBe(1);
  expect(holdFromDrag(3,1000)).toBe(MAX_FRAME_HOLD);
  expect(holdFromDrag(3,NaN)).toBe(3);
  expect(holdFromDrag(3,Infinity)).toBe(3);
 });
 it('handles untouched legacy project when dragging the first cel',()=>{
  const project=newProject(),id=frameList(project)[0].id;
  const next=setDrawingFrameHoldById(project,id,5);
  expect(frameHold(frameList(next)[0])).toBe(5);
  expect(totalExposureFrames(next)).toBe(5);
  expect(()=>validateProject(JSON.parse(JSON.stringify(next)))).not.toThrow();
 });
 it('resizes another cel without switching selection or duplicating artwork',()=>{
  const store=new DocumentStore(newProject());
  store.commit(appendOperation(store.getSnapshot(),stroke()));
  store.commit(addDrawingFrame(store.getSnapshot()));
  const before=store.getSnapshot(),first=frameList(before)[0],second=frameList(before)[1];
  const active=before.animation!.activeFrameId;
  const original=first.drawings[before.activeLayerId];
  store.commit(setDrawingFrameHoldById(before,first.id,8),'Resize frame exposure');
  const after=store.getSnapshot();
  expect(frameList(after).map(frameHold)).toEqual([8,1]);
  expect(after.animation!.activeFrameId).toBe(active);
  expect(currentFrameIndex(after)).toBe(1);
  expect(frameList(after)[0].drawings[after.activeLayerId]).toBe(original);
  expect(frameList(after)[1].id).toBe(second.id);
  expect(totalExposureFrames(after)).toBe(9);
  store.undo();expect(frameList(store.getSnapshot()).map(frameHold)).toEqual([1,1]);
  store.redo();expect(frameList(store.getSnapshot()).map(frameHold)).toEqual([8,1]);
 });
 it('can shrink hold to 1 and ignores invalid/nonexistent values',()=>{
  const project=setDrawingFrameHoldById(newProject(),'legacy-first-frame',12);
  const id=frameList(project)[0].id;
  const result=setDrawingFrameHoldById(project,id,1);
  expect(frameList(result)[0].hold).toBeUndefined();
  expect(frameHold(frameList(result)[0])).toBe(1);
  for(const hold of [-1,0,25,1.5,NaN,Infinity])expect(setDrawingFrameHoldById(result,id,hold)).toBe(result);
  expect(setDrawingFrameHoldById(result,'unknown',2)).toBe(result);
 });
});
