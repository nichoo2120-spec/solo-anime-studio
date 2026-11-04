import {describe,it,expect,vi,afterEach} from 'vitest';
import {DrawingFrameCache} from '../src/engine/DrawingFrameCache';
import {newProject,newLayer,type Stroke} from '../src/core/model';
import type {LayerRenderer} from '../src/engine/renderer';

const canvasMock=()=>{vi.stubGlobal('document',{createElement:()=>{const c:any={width:0,height:0};const ctx:any={canvas:c,save:vi.fn(),restore:vi.fn(),resetTransform:vi.fn(),drawImage:vi.fn(),clearRect:vi.fn(),setTransform:vi.fn()};c.getContext=()=>ctx;return c;}});};
afterEach(()=>vi.unstubAllGlobals());

describe('v161: warm snapshot safety after restoring canonical raster compositing',()=>{
 it('keeps the unchanged warm prefix when a new gesture starts and caches subsequent frames',()=>{
  canvasMock();const p=newProject(),upper=newLayer('Upper'),target=newLayer('Paint');p.layers=[upper,target];p.activeLayerId=target.id;
  const key={project:p,renderer:{} as LayerRenderer,revision:0,target:target.id,width:128,height:96,dpr:1,view:{x:0,y:0,zoom:1,rotation:0}};
  const cache=new DrawingFrameCache(),source=document.createElement('canvas');source.width=128;source.height=96;
  cache.warm(key);cache.capture(source.getContext('2d')!);cache.rememberInk(upper.id,source);
  const ctx=source.getContext('2d')!;
  expect(cache.status().ready).toBe(true);expect(cache.paintInk(ctx,upper)).toBe(true);
  const stroke={id:'new-gesture',size:8,engineVersion:10} as Stroke,geometry:any={cubics:[],points:[{x:30,y:30,p:1}]};
  expect(cache.begin(key,stroke,geometry)).toBeUndefined();
  expect(cache.status().ready).toBe(true);expect(cache.restore(ctx)).toBeDefined();expect(cache.paintInk(ctx,upper)).toBe(true);
  cache.capture(ctx);cache.rememberInk(upper.id,source);cache.finish(stroke,geometry);
  expect(cache.status().ready).toBe(true);expect(cache.paintInk(ctx,upper)).toBe(true);
  const region=cache.begin(key,stroke,{...geometry,points:[{x:30,y:30,p:1},{x:35,y:35,p:1}]},{x:30,y:30,width:5,height:5});
  expect(region).toEqual({x:27,y:27,width:11,height:11});
  expect(cache.restore(ctx,region)).toBeDefined();cache.clear();
 });
 it.each([1,2])('invalidates the idle snapshot for DPR %i after a project change',dpr=>{
  canvasMock();const p=newProject(),key={project:p,renderer:{} as LayerRenderer,revision:0,target:p.activeLayerId,width:128*dpr,height:96*dpr,dpr,view:{x:0,y:0,zoom:1,rotation:0}};
  const cache=new DrawingFrameCache(),source=document.createElement('canvas');source.width=key.width;source.height=key.height;cache.warm(key);cache.capture(source.getContext('2d')!);
  expect(cache.status().ready).toBe(true);
  const replacement={...p,layers:p.layers.map(l=>({...l}))};cache.warm({...key,project:replacement});
  expect(cache.status().ready).toBe(false);
  expect(cache.begin({...key,project:replacement},{id:'fresh',size:8} as Stroke,{cubics:[],points:[]} as any)).toBeUndefined();
  cache.clear();
 });
});
