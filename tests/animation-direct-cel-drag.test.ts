import {describe,expect,it} from 'vitest';
import {newProject} from '../src/core/model';
import {DocumentStore} from '../src/core/history';
import {addDrawingFrame,frameList,frameHold,holdFromDrag,currentFrameIndex,setDrawingFrameHoldById,totalExposureFrames} from '../src/animation/timeline';

describe('Phase 2 direct cel drag keeps exposure edits non-destructive',()=>{
 it('snaps mouse/pen movement into hold lengths without extra artwork',()=>{
  expect(holdFromDrag(1,45)).toBe(6);
  expect(holdFromDrag(6,-50)).toBe(1);
  expect(holdFromDrag(6,900)).toBe(24);
 });
 it('changes another cel duration without selecting or copying it, with one Undo entry',()=>{
  const store=new DocumentStore(addDrawingFrame(newProject()));
  const before=store.getSnapshot(),a=frameList(before)[0],b=frameList(before)[1];
  const beforeDrawings=a.drawings,active=before.animation!.activeFrameId;
  store.commit(setDrawingFrameHoldById(before,a.id,8),'Resize frame exposure');
  const after=store.getSnapshot();
  expect(frameList(after).map(frameHold)).toEqual([8,1]);
  expect(totalExposureFrames(after)).toBe(9);
  expect(frameList(after)[0].drawings).toBe(beforeDrawings);
  expect(after.animation!.activeFrameId).toBe(active);
  expect(currentFrameIndex(after)).toBe(1);
  expect(frameList(after)[1].id).toBe(b.id);
  store.undo();expect(frameList(store.getSnapshot()).map(frameHold)).toEqual([1,1]);
  store.redo();expect(frameList(store.getSnapshot()).map(frameHold)).toEqual([8,1]);
 });
});
