import {describe,it,expect} from 'vitest';
import {newProject,appendOperation,validateProject,uid,editLayer,newLayer} from '../src/core/model';
import {DocumentStore} from '../src/core/history';
import {addDrawingFrame,duplicateDrawingFrame,deleteDrawingFrame,frameList,selectDrawingFrame} from '../src/animation/timeline';
const sample=()=>({id:uid(),kind:'stroke' as const,tool:'brush' as const,points:[{x:1,y:2,p:.5}],size:3,opacity:1,color:'#000000',pressure:false,response:1});
describe('Phase 2 drawing-frame timeline',()=>{
 it('keeps each drawing frame separate and saves it',()=>{
  const store=new DocumentStore(newProject());const id=store.getSnapshot().activeLayerId;
  store.commit(appendOperation(store.getSnapshot(),sample()));
  store.commit(addDrawingFrame(store.getSnapshot()),'New frame');
  expect(store.getSnapshot().layers.find(l=>l.id===id)!.operations).toHaveLength(0);
  store.commit(appendOperation(store.getSnapshot(),sample()));
  const first=frameList(store.getSnapshot())[0];
  store.selectFrame(selectDrawingFrame(store.getSnapshot(),first.id));
  expect(store.getSnapshot().layers.find(l=>l.id===id)!.operations).toHaveLength(1);
  expect(()=>validateProject(JSON.parse(JSON.stringify(store.getSnapshot())))).not.toThrow();
 });
 it('duplicates independently; deletion is undoable',()=>{
  const store=new DocumentStore(newProject());store.commit(appendOperation(store.getSnapshot(),sample()));
  store.commit(duplicateDrawingFrame(store.getSnapshot()),'Duplicate');
  const frames=frameList(store.getSnapshot());expect(frames).toHaveLength(2);
  store.commit(appendOperation(store.getSnapshot(),sample()));
  store.selectFrame(selectDrawingFrame(store.getSnapshot(),frames[0].id));
  expect(store.getSnapshot().layers.find(l=>l.id===store.getSnapshot().activeLayerId)!.operations).toHaveLength(1);
  store.commit(deleteDrawingFrame(store.getSnapshot()),'Delete');expect(frameList(store.getSnapshot())).toHaveLength(1);
  store.undo();expect(frameList(store.getSnapshot())).toHaveLength(2);
 });
 it('handles layer creation and edits without corrupting other frames',()=>{
  const store=new DocumentStore(newProject());store.commit(addDrawingFrame(store.getSnapshot()));
  const layer=newLayer('Test');store.commit({...store.getSnapshot(),layers:[layer,...store.getSnapshot().layers]});
  store.commit(editLayer(store.getSnapshot(),layer.id,{locked:true}));
  expect(()=>validateProject(JSON.parse(JSON.stringify(store.getSnapshot())))).not.toThrow();
 });
 it('opens legacy projects without creating a timeline prematurely',()=>{
  const legacy=newProject();expect(legacy.animation).toBeUndefined();expect(frameList(legacy)).toHaveLength(1);
  expect(validateProject(JSON.parse(JSON.stringify(legacy)))).toBeTruthy();
 });
});
