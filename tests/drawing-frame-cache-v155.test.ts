import {describe,it,expect} from 'vitest';
import {DrawingFrameCache,drawingScreenRegion,type DrawingFrameKey} from '../src/engine/DrawingFrameCache';
import {newProject,type Stroke} from '../src/core/model';
import type {LayerRenderer} from '../src/engine/renderer';
import type {strokeGeometry} from '../src/engine/strokeGeometry';
const geometry=(x=40)=>({points:[{x:20,y:30,p:1},{x,y:50,p:1}],cubics:[]})as unknown as ReturnType<typeof strokeGeometry>;
const stroke={id:'gesture',size:10,kind:'stroke',tool:'brush'}as Stroke;
const key=():DrawingFrameKey=>({project:newProject(),renderer:{}as LayerRenderer,revision:0,target:'line',width:1000,height:800,dpr:1,view:{x:0,y:0,zoom:1,rotation:0}});
describe('P1 bounded drawing display cache',()=>{
 it('maps a changed document box to integer device pixels with filtering margin',()=>{
  expect(drawingScreenRegion({x:5,y:8,width:4,height:6},{x:10,y:20,zoom:2,rotation:0},2,300,300)).toEqual({x:37,y:69,width:22,height:30});
 });
 it('includes all transformed corners at rotated views',()=>{
  const r=drawingScreenRegion({x:0,y:0,width:20,height:10},{x:100,y:100,zoom:1,rotation:Math.PI/2},2,500,500);expect(r).toEqual({x:177,y:197,width:26,height:46});
 });
 it('clips entirely off-screen changes without negative extents',()=>{
  expect(drawingScreenRegion({x:-100,y:-100,width:10,height:10},{x:0,y:0,zoom:1,rotation:0},2,200,200)).toEqual({x:0,y:0,width:0,height:0});
 });
 it('starts with a full frame and then uses the supplied dirty raster footprint',()=>{
  const c=new DrawingFrameCache(),k=key(),g=geometry();expect(c.begin(k,stroke,g)).toBeUndefined();c.finish(stroke,g);
  expect(c.begin(k,stroke,geometry(60),{x:25,y:20,width:10,height:12})).toEqual({x:22,y:17,width:16,height:18});
 });
 it('keeps both the old and new native-ink extent when the path shrinks',()=>{
  const c=new DrawingFrameCache(),k=key();c.begin(k,stroke,geometry(600));c.finish(stroke,geometry(600));const r=c.begin(k,stroke,geometry(50))!;expect(r.x+r.width).toBeGreaterThan(600);expect(r.y).toBeLessThan(30);
 });
 it('invalidates for edits, history, camera, renderer, resolution and layer changes',()=>{
  const k=key();for(const patch of [{project:{...k.project}},{renderer:{}as LayerRenderer},{revision:1},{target:'other'},{width:1001},{height:801},{dpr:2},{view:{...k.view,x:1}},{view:{...k.view,y:1}},{view:{...k.view,zoom:2}},{view:{...k.view,rotation:.2}}]){
   const c=new DrawingFrameCache();c.begin(k,stroke,geometry());c.finish(stroke,geometry());expect(c.begin({...k,...patch},stroke,geometry())).toBeUndefined();
  }
 });
 it('does not carry a dirty rectangle across gestures or explicit invalidation',()=>{
  const c=new DrawingFrameCache(),k=key();c.begin(k,stroke,geometry());c.finish(stroke,geometry());expect(c.begin(k,{...stroke,id:'next'},geometry())).toBeUndefined();c.finish(stroke,geometry());c.invalidate();expect(c.begin(k,stroke,geometry())).toBeUndefined();
 });
 it('declines a giant prefix allocation but retains correct full redraw fallback',()=>{
  const c=new DrawingFrameCache(),k={...key(),width:8192,height:8192};c.begin(k,stroke,geometry());c.capture({}as CanvasRenderingContext2D);expect(c.status().bytes).toBe(0);expect(c.status().ready).toBe(false);c.clear();expect(c.status().bytes).toBe(0);
 });
 it('prepares idle metadata without allocating pixels or carrying an old gesture',()=>{
  const c=new DrawingFrameCache(),k=key();c.begin(k,stroke,geometry());c.finish(stroke,geometry());c.warm(k);expect(c.status().bytes).toBe(0);expect(c.begin(k,stroke,geometry())).toBeUndefined();
 });
});
