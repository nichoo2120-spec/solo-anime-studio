import {describe,it,expect} from 'vitest';
import {appendOperation,newProject,validateProject,type Stroke} from '../src/core/model';
import {enableIndependentLayers,addDrawingFrame,frameList,selectDrawingFrame,isLayerHeld,insertLayerKey,layerKeyEnd,setLayerHoldEnd,syncActiveFrame,deleteDrawingFrame} from '../src/animation/timeline';
const op=(id:string):Stroke=>({kind:'stroke',id,tool:'brush',points:[{x:2,y:3,p:1}],size:3,opacity:1,color:'#112233',pressure:false,response:1});
function scene(){
 let p=enableIndependentLayers(newProject('Layered animation'));
 const [hair,body]=p.layers.map(l=>l.id);
 p={...p,activeLayerId:body};p=syncActiveFrame(appendOperation(p,op('body0')));
 p={...p,activeLayerId:hair};p=syncActiveFrame(appendOperation(p,op('hair0')));
 const ids=[frameList(p)[0].id];
 for(let i=1;i<4;i++){
  p=addDrawingFrame(p);ids.push(p.animation!.activeFrameId);
  p=syncActiveFrame(appendOperation(p,op('hair'+i)));
 }
 return {p,hair,body,ids};
}
describe('Phase 2 Tool 6 independent animation layers',()=>{
 it('holds body while hair keys animate, with no copies of operation arrays',()=>{
  const {p,body,hair}=scene();const frames=frameList(p);
  expect(frames.map(f=>f.drawings[hair].at(-1)?.id)).toEqual(['hair0','hair1','hair2','hair3']);
  expect(frames.every(f=>f.drawings[body]===frames[0].drawings[body])).toBe(true);
  expect(frames.slice(1).every(f=>isLayerHeld(p,body,f.id))).toBe(true);
  expect(validateProject(p)).toBe(p);
 });
 it('editing held key updates all exposed positions, not their artwork history',()=>{
  let {p,body,ids}=scene();p=selectDrawingFrame(p,ids[3]);p={...p,activeLayerId:body};
  p=syncActiveFrame(appendOperation(p,op('body-edited')));
  expect(frameList(p).every(f=>f.drawings[body].at(-1)?.id==='body-edited')).toBe(true);
  expect(validateProject(p)).toBe(p);
 });
 it('allows independent key creation from hold and restoring original keys after shortening',()=>{
  let {p,body,hair,ids}=scene();p=insertLayerKey(p,body,ids[2],true);
  expect(isLayerHeld(p,body,ids[2])).toBe(false);
  expect(frameList(p)[2].drawings[body]).not.toBe(frameList(p)[1].drawings[body]);
  const prior=frameList(p).map(f=>f.drawings[hair]);
  p=setLayerHoldEnd(p,hair,ids[0],3);
  expect(layerKeyEnd(p,hair,0)).toBe(3);
  expect(frameList(p)[3].drawings[hair]).toBe(prior[0]);
  p=setLayerHoldEnd(p,hair,ids[0],0);
  expect(frameList(p).map(f=>f.drawings[hair])).toEqual(prior);
  expect(Object.keys(p.animation!.layerHolds![hair].stash)).toHaveLength(0);
  expect(validateProject(p)).toBe(p);
 });
 it('survives JSON backup and deletion of an anchored key',()=>{
  let {p,body}=scene();
  const loaded=validateProject(JSON.parse(JSON.stringify(p)));
  expect(isLayerHeld(loaded,body,frameList(loaded)[1].id)).toBe(true);
  p=selectDrawingFrame(loaded,frameList(loaded)[0].id);
  p=deleteDrawingFrame(p);
  expect(isLayerHeld(p,body,frameList(p)[0].id)).toBe(false);
  expect(frameList(p)[0].drawings[body][0].id).toBe('body0');
  expect(validateProject(p)).toBe(p);
 });
});
