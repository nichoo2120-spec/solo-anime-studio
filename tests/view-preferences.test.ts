import {afterEach,describe,it,expect,vi} from 'vitest';
import {ViewPreferences,documentDirty} from '../src/core/viewPreferences';
import {newProject,editLayer} from '../src/core/model';
afterEach(()=>vi.unstubAllGlobals());
describe('document content and project view preferences',()=>{
 it('restores pending/flushed project-specific views without touching documents',()=>{const map=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>map.set(k,v)});const p=newProject(),q=newProject(),views=new ViewPreferences(),view={x:-300,y:40,zoom:4,rotation:Math.PI/6};views.remember(p,view);expect(views.read(p)).toEqual(view);expect(views.read(q)).toBeNull();views.flush();expect(new ViewPreferences().read(p)).toEqual(view);expect(views.read({...p,width:640})).toBeNull();expect(documentDirty(p,p)).toBe(false);});
 it('does not dirty layer focus, but detects artwork/settings and Save As',()=>{const p=newProject();expect(documentDirty({...p,activeLayerId:p.layers[0].id},p)).toBe(false);expect(documentDirty(editLayer(p,p.activeLayerId,{opacity:.5}),p)).toBe(true);expect(documentDirty({...p,name:'Renamed'},p)).toBe(true);expect(documentDirty({...p,id:'copy'},p)).toBe(true);expect(documentDirty({...p,settings:{guides:false}},p)).toBe(true);});
 it('rejects invalid stored view numbers and safely tolerates blocked preferences',()=>{vi.stubGlobal('localStorage',{getItem:()=>'{bad',setItem:()=>{throw Error('blocked');}});const p=newProject(),views=new ViewPreferences();expect(views.read(p)).toBeNull();expect(()=>{views.remember(p,{x:0,y:0,zoom:1,rotation:0});views.flush();}).not.toThrow();});
});
