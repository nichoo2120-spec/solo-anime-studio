import {describe,it,expect} from 'vitest';
import {newProject,uid,type Stroke} from '../src/core/model';
import {DocumentStore} from '../src/core/history';
import {addDrawingFrame,selectDrawingFrame,frameList} from '../src/animation/timeline';
import {sanitizeOnionSettings,onionNeighbors,DEFAULT_ONION_SETTINGS} from '../src/animation/onionSkin';
function stroke():Stroke{return {id:uid(),kind:'stroke',tool:'brush',points:[{x:22,y:30,p:1}],size:3,color:'#202020',opacity:1,pressure:false,response:1};}
function threeFrames(){const store=new DocumentStore(newProject());const layer=store.getSnapshot().activeLayerId;
 store.commit({...store.getSnapshot(),layers:store.getSnapshot().layers.map(l=>l.id===layer?{...l,operations:[stroke()]}:l)});
 store.commit(addDrawingFrame(store.getSnapshot()));store.commit(addDrawingFrame(store.getSnapshot()));
 return store;
}
describe('Phase 2 / Tool 2 - neighboring drawing onion skin',()=>{
 it('uses adjacent frames, never the active frame, in the correct direction',()=>{
  const store=threeFrames(),frames=frameList(store.getSnapshot());
  const middle=selectDrawingFrame(store.getSnapshot(),frames[1].id);const neighbors=onionNeighbors(middle,DEFAULT_ONION_SETTINGS);
  expect(neighbors.map(n=>[n.kind,n.frame.id,n.index])).toEqual([['previous',frames[0].id,0],['next',frames[2].id,2]]);
  expect(neighbors[0].color).not.toBe(neighbors[1].color);
 });
 it('handles first and last frame without wrapping',()=>{
  const store=threeFrames(),frames=frameList(store.getSnapshot());
  expect(onionNeighbors(selectDrawingFrame(store.getSnapshot(),frames[0].id),DEFAULT_ONION_SETTINGS).map(n=>n.kind)).toEqual(['next']);
  expect(onionNeighbors(store.getSnapshot(),DEFAULT_ONION_SETTINGS).map(n=>n.kind)).toEqual(['previous']);
 });
 it('turning off or zeroing opacity removes ghosts without changing artwork',()=>{
  const store=threeFrames(),p=store.getSnapshot(),before=JSON.stringify(p);
  expect(onionNeighbors(p,{...DEFAULT_ONION_SETTINGS,enabled:false})).toHaveLength(0);
  expect(onionNeighbors(p,{...DEFAULT_ONION_SETTINGS,previousOpacity:0})).toHaveLength(0);
  expect(JSON.stringify(p)).toBe(before);
 });
 it('sanitizes persisted preferences and safely ignores invalid values',()=>{
  expect(sanitizeOnionSettings({enabled:false,previousOpacity:150,nextOpacity:-5,previous:'wrong'}))
   .toMatchObject({enabled:false,previous:true,previousOpacity:100,nextOpacity:0});
  expect(sanitizeOnionSettings(null)).toEqual(DEFAULT_ONION_SETTINGS);
 });
 it('refreshes neighbors after frame navigation; original frame operations remain separate',()=>{
  const store=threeFrames(),frames=frameList(store.getSnapshot());
  const middle=selectDrawingFrame(store.getSnapshot(),frames[1].id);
  expect(onionNeighbors(middle,DEFAULT_ONION_SETTINGS)[0].frame.drawings[middle.activeLayerId]).toHaveLength(1);
  expect(onionNeighbors(middle,DEFAULT_ONION_SETTINGS)[1].frame.drawings[middle.activeLayerId]).toHaveLength(0);
 });
});
