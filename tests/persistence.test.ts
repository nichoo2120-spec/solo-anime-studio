import 'fake-indexeddb/auto';
import {describe,it,expect,vi} from 'vitest';
import {ProjectRepository} from '../src/core/persistence';
import {newProject,appendOperation,editLayer,activeLayer,type Stroke} from '../src/core/model';
const repo=()=>new ProjectRepository('test-'+crypto.randomUUID());
const drawing=():Stroke=>({id:crypto.randomUUID(),kind:'stroke',tool:'brush',points:[{x:20,y:40,p:.8}],size:5,opacity:.7,color:'#112233',pressure:true,response:1.3});
describe('transactional local storage',()=>{
 it('reopens complete editable artwork and layer properties through a new repository',async()=>{const database='test-'+crypto.randomUUID(),r=new ProjectRepository(database);let p=appendOperation(newProject('Test scene'),drawing());p=editLayer(p,p.layers[0].id,{visible:false,locked:true,opacity:.4});await r.save(p);const reopened=await new ProjectRepository(database).load(p.id);expect(reopened.project).toEqual(p);expect(activeLayer(reopened.project).operations[0]).toEqual(activeLayer(p).operations[0]);expect(reopened.kind).toBe('manual');});
 it('recovers the most recent successfully autosaved state',async()=>{const r=repo(),p=newProject();await r.save(p);const changed=appendOperation(p,drawing());await r.save(changed,'autosave');expect((await r.load(p.id)).project).toEqual(changed);expect((await r.load(p.id)).kind).toBe('autosave');expect((await r.snapshots(p.id)).some(s=>JSON.stringify(s.project)===JSON.stringify(p))).toBe(true);});
 it('rejects corrupt saves without replacing the last valid project',async()=>{const r=repo(),p=newProject();await r.save(p);await expect(r.save({...p,width:-1})).rejects.toThrow();expect((await r.load(p.id)).project).toEqual(p);expect(await r.snapshots(p.id)).toHaveLength(1);});
 it('aborts both project and recovery writes atomically on failure',async()=>{const r=repo(),p=newProject();await r.save(p);const original=IDBObjectStore.prototype.put;const mock=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,...args:Parameters<IDBObjectStore['put']>){const result=original.apply(this,args);if(this.name==='snapshots')this.transaction.abort();return result;});await expect(r.save(appendOperation(p,drawing()))).rejects.toThrow();mock.mockRestore();expect((await r.load(p.id)).project).toEqual(p);expect(await r.snapshots(p.id)).toHaveLength(1);});
 it('retains ten recovery points while keeping independent project identities',async()=>{const r=repo(),p=newProject();for(let i=0;i<13;i++)await r.save({...p,name:'Revision '+i});expect(await r.snapshots(p.id)).toHaveLength(10);const q=newProject('Other');await r.save(q);expect(await r.list()).toHaveLength(2);expect((await r.load(p.id)).project.name).toBe('Revision 12');});
 it('reports missing projects without fabricating saved state',async()=>{await expect(repo().load('missing')).rejects.toThrow('not found');});
});

describe('local project cleanup',()=>{
 it('deletes only the selected saved projects and their recovery snapshots',async()=>{
  const r=repo(),a=newProject('Test A'),b=newProject('Test B'),keep=newProject('Keep this one');
  await r.save(a,'autosave');await r.save(appendOperation(a,drawing()),'autosave');
  await r.save(b,'autosave');await r.save(keep,'manual');
  expect(await r.deleteProjects([a.id,b.id,a.id])).toBe(2);
  expect((await r.list()).map(item=>item.id)).toEqual([keep.id]);
  expect(await r.snapshots(a.id)).toHaveLength(0);expect(await r.snapshots(b.id)).toHaveLength(0);
  expect(await r.snapshots(keep.id)).toHaveLength(1);
  expect((await r.load(keep.id)).project).toEqual(keep);
 });
 it('does not remove unrelated data for missing or empty selections',async()=>{
  const r=repo(),keep=newProject('My main project');await r.save(keep);
  expect(await r.deleteProjects(['missing'])).toBe(0);
  expect(await r.deleteProjects([])).toBe(0);
  expect((await r.load(keep.id)).project).toEqual(keep);
 });
});
