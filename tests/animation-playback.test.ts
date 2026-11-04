import {describe,it,expect} from 'vitest';
import {newProject,appendOperation,validateProject,uid} from '../src/core/model';
import {DocumentStore} from '../src/core/history';
import {addDrawingFrame,setDrawingFrameHold,frameList} from '../src/animation/timeline';
import {exposurePlan,positionAtExposure,positionAtElapsed,playbackFps} from '../src/animation/playback';

const line=()=>({id:uid(),kind:'stroke' as const,tool:'brush' as const,points:[{x:4,y:5,p:.7}],size:5,opacity:1,color:'#122233',pressure:false,response:1});
function scene(){
 const store=new DocumentStore(newProject());
 store.commit(appendOperation(store.getSnapshot(),line()));
 store.commit(setDrawingFrameHold(store.getSnapshot(),2));
 store.commit(addDrawingFrame(store.getSnapshot()));
 store.commit(appendOperation(store.getSnapshot(),line()));
 store.commit(setDrawingFrameHold(store.getSnapshot(),3));
 store.commit(addDrawingFrame(store.getSnapshot()));
 store.commit(setDrawingFrameHold(store.getSnapshot(),1));
 return store;
}
describe('Phase 2 / Tool 5: read-only playback timing',()=>{
 it('honors exposures without duplicating cels',()=>{
  const store=scene(),doc=store.getSnapshot(),plan=exposurePlan(doc);
  expect(plan).toEqual({ends:[2,5,6],total:6});
  expect(Array.from({length:6},(_,i)=>positionAtExposure(plan,i+1).celIndex)).toEqual([0,0,1,1,1,2]);
  expect(frameList(doc)).toHaveLength(3);
  expect(validateProject(structuredClone(doc))).toBeTruthy();
 });
 it('uses real elapsed time for 24fps; catches up without altered drawing data',()=>{
  const store=scene(),doc=store.getSnapshot(),before=JSON.stringify(doc),plan=exposurePlan(doc);
  expect(positionAtElapsed(plan,1,0,24,false).celIndex).toBe(0);
  expect(positionAtElapsed(plan,1,85,24,false).celIndex).toBe(1); // exposure 3
  expect(positionAtElapsed(plan,1,210,24,false).celIndex).toBe(2); // exposure 6
  expect(positionAtElapsed(plan,1,1000,24,false)).toEqual({exposure:6,celIndex:2,ended:true});
  expect(JSON.stringify(store.getSnapshot())).toBe(before);
 });
 it('loops at exact exposure boundary and starts from selected cel',()=>{
  const plan=exposurePlan(scene().getSnapshot());
  expect(positionAtElapsed(plan,1,250,24,true).exposure).toBe(1);
  expect(positionAtElapsed(plan,3,0,24,true).celIndex).toBe(1);
  expect(positionAtElapsed(plan,3,125,24,true).celIndex).toBe(2);
  expect(positionAtElapsed(plan,6,1000/24,24,true).exposure).toBe(1);
 });
 it('clamps playback FPS and never creates a zero-length or invalid frame',()=>{
  expect(playbackFps(0)).toBe(1);expect(playbackFps(72)).toBe(60);
  expect(playbackFps(Number.NaN)).toBe(24);
  const plan=exposurePlan(newProject());
  expect(positionAtElapsed(plan,1,9999999,60,true)).toEqual({exposure:1,celIndex:0,ended:false});
 });
});
