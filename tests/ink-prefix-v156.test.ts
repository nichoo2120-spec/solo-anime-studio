import {afterEach,describe,expect,it,vi} from 'vitest';
import {InkDisplay} from '../src/engine/InkDisplay';
import {newProject,newLayer,type Stroke} from '../src/core/model';
import type {LayerRenderer} from '../src/engine/renderer';
afterEach(()=>vi.unstubAllGlobals());
describe('first ink stroke above an already rendered paint layer',()=>{
 const setup=()=>{
  vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>({drawImage:vi.fn()})})});
  const project=newProject('paint then ink',800,600),layer=newLayer('Paint');layer.operations=[{id:'paint-a',kind:'stroke'},{id:'paint-b',kind:'stroke'}]as Stroke[];
  const getDisplay=vi.fn((_layer:{operations:typeof layer.operations})=>({width:800,height:600})),renderer={getDisplay,displayRevision:0}as unknown as LayerRenderer;
  const prefix=(new InkDisplay() as unknown as {prefix:(l:typeof layer,p:typeof project,end:number,r:LayerRenderer)=>HTMLCanvasElement});return{project,layer,renderer,getDisplay,prefix};
 };
 it('preserves the complete operation identity so the native raster cache is reused',()=>{
  const {project,layer,renderer,getDisplay,prefix}=setup();prefix.prefix(layer,project,2,renderer);expect(getDisplay.mock.calls[0][0].operations).toBe(layer.operations);
  prefix.prefix(layer,project,2,renderer);expect(getDisplay).toHaveBeenCalledTimes(1);
 });
 it('uses an isolated prefix for a partial layer and invalidates after a renderer revision',()=>{
  const {project,layer,renderer,getDisplay,prefix}=setup();prefix.prefix(layer,project,1,renderer);expect(getDisplay.mock.calls[0][0].operations).toEqual(layer.operations.slice(0,1));
  expect(getDisplay.mock.calls[0][0].operations).not.toBe(layer.operations);(renderer as {displayRevision:number}).displayRevision=1;prefix.prefix(layer,project,1,renderer);expect(getDisplay).toHaveBeenCalledTimes(2);
 });
});
