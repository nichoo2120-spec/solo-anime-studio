import {expect,it} from 'vitest';
import {applyAutosaveDelta,autosaveDelta} from '../src/core/autosaveDelta';
import {activeLayer,appendOperation,newProject,type Stroke} from '../src/core/model';
import {duplicateDrawingFrame,syncActiveFrame} from '../src/animation/timeline';

it('ships appended operations without cloning the unchanged drawing history',()=>{
 const stroke=(i:number):Stroke=>({id:String(i),kind:'stroke',tool:'brush',size:2,opacity:1,color:'#123456',pressure:false,response:1,points:[{x:i,y:i,p:1}]});
 let project=duplicateDrawingFrame(newProject());
 for(let i=0;i<500;i++)project=syncActiveFrame(appendOperation(project,stroke(i)));
 const next=syncActiveFrame(appendOperation(project,stroke(500)));
 const delta=autosaveDelta(project,next);
 expect(JSON.stringify(delta).length).toBeLessThan(2500);
 const base=structuredClone(project);
 const reconstructed=applyAutosaveDelta(base,structuredClone(delta)) as typeof project;
 expect(reconstructed).toEqual(next);
 expect(activeLayer(reconstructed).operations[499]).toBe(activeLayer(base).operations[499]);
 expect(autosaveDelta(next,next)).toBeUndefined();
});

it('reconstructs undo, replaced items, and removed fields without mutating its base',()=>{
 const previous={layers:[{operations:[{id:'a'},{id:'b'}]},{operations:[{id:'c'}]}],optional:'guide'};
 const next={layers:[{operations:[{id:'changed'}]}],newOption:true};
 expect(applyAutosaveDelta(previous,autosaveDelta(previous,next))).toEqual(next);
 expect(previous).toEqual({layers:[{operations:[{id:'a'},{id:'b'}]},{operations:[{id:'c'}]}],optional:'guide'});
});
