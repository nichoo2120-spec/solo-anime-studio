import {describe,it,expect} from 'vitest';
import {DocumentStore} from '../src/core/history';
import {newProject,editLayer} from '../src/core/model';
import {documentDirty} from '../src/core/viewPreferences';

describe('project tab histories',()=>{
 it('retains independent undo and redo branches through the shared store',()=>{
  const a=newProject('A'),b=newProject('B'),store=new DocumentStore(a);
  store.commit({...a,name:'A first'});store.commit({...store.getSnapshot(),name:'A second'});store.undo();
  const tabA=store.captureHistory();
  store.replace(b);store.commit({...b,name:'B first'});const tabB=store.captureHistory();
  store.restoreHistory(tabA);expect(store.getSnapshot().name).toBe('A first');expect(store.canRedo).toBe(true);
  store.redo();expect(store.getSnapshot().name).toBe('A second');
  store.restoreHistory(tabB);expect(store.getSnapshot().name).toBe('B first');expect(store.canRedo).toBe(false);
  store.undo();expect(store.getSnapshot()).toBe(b);store.commit({...b,name:'B different'});
  store.restoreHistory(tabA);store.redo();expect(store.getSnapshot().name).toBe('A second');
 });
 it('retains active layer and immutable layer snapshots without cloning artwork',()=>{
  const a=newProject('A'),store=new DocumentStore(a),layer=a.layers[0];
  store.commit(editLayer(a,layer.id,{name:'A layer'}));store.select(layer.id);
  const tab=store.captureHistory(),project=store.getSnapshot();
  store.replace(newProject('B'));store.restoreHistory(tab);
  expect(store.getSnapshot()).toBe(project);expect(store.getSnapshot().activeLayerId).toBe(layer.id);
  expect(store.getSnapshot().layers).toBe(project.layers);
  store.undo();expect(store.getSnapshot().layers[0].name).toBe(layer.name);
 });
 it('rejects invalid history before replacing the active document',()=>{
  const a=newProject('A'),store=new DocumentStore(a),state=store.captureHistory();
  expect(()=>store.restoreHistory({...state,index:12})).toThrow();expect(store.getSnapshot()).toBe(a);
 });
 it('treats a never-saved document as dirty',()=>{
  const p=newProject('A');expect(documentDirty(p,undefined)).toBe(true);expect(documentDirty(p,p)).toBe(false);
 });
});

