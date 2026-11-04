import {it,expect} from 'vitest';
import {DocumentStore} from '../src/core/history';
import {newProject,newLayer,activeLayer,validateProject} from '../src/core/model';
import {createVector} from '../src/engine/vector';
import {EditingController} from '../src/engine/EditingController';
import type {LayerRenderer} from '../src/engine/renderer';
it('cuts and pastes native vectors with fresh IDs and exact undo/redo',async()=>{const p=newProject(),l=newLayer('Vectors','vector'),v=createVector('original',{x:100,y:100,p:.2},{x:400,y:100,p:.8},true,5,'#123456',true);l.operations=[v];p.layers=[l,...p.layers];p.activeLayerId=l.id;const store=new DocumentStore(p),renderer={prepare:async()=>{}} as unknown as LayerRenderer;let selection:any[]=[];const c=new EditingController(store,()=>renderer,()=>selection,p=>{selection=p;},()=>{});c.selectAll();c.copy(true);const cut=store.getSnapshot();expect(activeLayer(cut).operations).toHaveLength(0);await c.paste();const pasted=store.getSnapshot(),copy=activeLayer(pasted).operations[0];expect(copy.id).not.toBe(v.id);expect(copy).toMatchObject({kind:'vector',nodes:v.nodes,pressure:true});validateProject(JSON.parse(JSON.stringify(pasted)));store.undo();expect(store.getSnapshot()).toBe(cut);store.redo();expect(store.getSnapshot()).toBe(pasted);});
