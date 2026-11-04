import {describe,it,expect,vi,afterEach} from 'vitest';
import {RasterSceneDisplay} from '../src/engine/RasterSceneDisplay';
import {newProject,newLayer} from '../src/core/model';
import type {LayerRenderer} from '../src/engine/renderer';

afterEach(()=>vi.restoreAllMocks());

describe('v161: editing canvas must never switch to a non-parity worker raster bitmap',()=>{
 it.each([1,2])('uses the canonical layer-by-layer compositor at DPR %i even when an old worker bitmap may arrive',dpr=>{
  const request=vi.fn(),scene=new RasterSceneDisplay(request);
  const p=newProject(),bottom=newLayer('Background'),middle=newLayer('Paint under'),top=newLayer('Ink');
  p.layers=[top,middle,bottom];
  const renderer={displayRevision:1} as LayerRenderer;
  // The group is deliberately poisoned: a worker bitmap must never be selected,
  // even if it is ready and has matching identity at pen-down or mid-stroke.
  const group=vi.spyOn(scene as any,'group').mockImplementation(()=>{throw new Error('group must not be used for editing');});
  const ctx={getTransform:()=>({a:dpr,b:0})} as CanvasRenderingContext2D;
  for(let i=0;i<10;i++){
   expect(scene.paint(ctx,p,renderer,top.id)).toBeUndefined();
   expect(scene.paint(ctx,p,renderer)).toBeUndefined();
  }
  expect(group).not.toHaveBeenCalled();
  expect(scene.status()).toMatchObject({ready:0,pending:false,failed:false});
  expect(request).not.toHaveBeenCalled();
  scene.dispose();
 });
 it('keeps the independent navigation/thumbnail compositor available',()=>{
  const scene=new RasterSceneDisplay(()=>{},true);
  const group=vi.spyOn(scene as any,'group').mockReturnValue(undefined);
  expect(scene.paint({} as CanvasRenderingContext2D,newProject(),{} as LayerRenderer)).toBeUndefined();
  expect(group).toHaveBeenCalledOnce();scene.dispose();
 });
});
