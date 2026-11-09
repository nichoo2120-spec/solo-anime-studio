import {test,expect} from '@playwright/test';

/** Repro: small editable pen stroke is pulled by a Distort corner. Preview,
 * committed painting and repeat-selection must agree without a dark wedge.
 * Other artwork and tool modes must remain untouched. */
test('distort brush preview equals committed ink and stays reselectable',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const m=await import('/src/core/model.ts'),{DocumentStore}=await import('/src/core/history.ts'),
   {StudioEngine}=await import('/src/engine/StudioEngine.ts'),{TransformTool}=await import('/src/tools/transform/TransformTool.ts'),
   {hitStroke,polyline}=await import('/src/engine/strokeSelection.ts');
  const doc=m.newProject('Distort fidelity',640,360),layer=m.activeLayer(doc);
  const points=Array.from({length:45},(_,i)=>({x:80+i*6,y:145+Math.sin(i/44*Math.PI)*32,p:.4+i/44*.4}));
  layer.operations=[{id:'ink',kind:'stroke',tool:'brush',brushKind:'technical',engineVersion:6,points,size:5,color:'#17212c',opacity:1,pressure:true,response:1,smoothness:0,stabilization:0}];
  const store=new DocumentStore(doc),canvases=Array.from({length:3},()=>{
   const c=document.createElement('canvas');c.width=640;c.height=360;c.style.cssText='position:fixed;left:0;top:0;width:640px;height:360px';document.body.append(c);
   c.setPointerCapture=()=>{};c.hasPointerCapture=()=>true;return c;
  });
  const e=new StudioEngine(canvases[0],store,()=>{});e.setView({x:0,y:0,zoom:1,rotation:0});
  e.selectAllStrokes();
  const t=new TransformTool(e,canvases[1],canvases[2],e.view,{frameIds:[],layerIds:[]});
  t.setMode('distort');
  const q=t.session.quad[1],rect=canvases[1].getBoundingClientRect();
  const event=(type:string,x:number,y:number)=>new PointerEvent(type,{pointerId:1,isPrimary:true,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:rect.left+x,clientY:rect.top+y});
  t.down(event('pointerdown',q.x,q.y));t.move(event('pointermove',q.x+120,q.y+80));t.up(event('pointerup',q.x+120,q.y+80));
  const preview=document.createElement('canvas');preview.width=640;preview.height=360;
  t.paintArtwork(preview.getContext('2d')!,t.source,t.box);
  const before=preview.getContext('2d')!.getImageData(0,0,640,360).data;
  const commit=await t.commit();
  const saved=store.getSnapshot(),after=e.renderer.get(m.activeLayer(saved),saved).getContext('2d')!.getImageData(0,0,640,360).data;
  let diff=0,alphaMax=0;
  for(let i=0;i<before.length;i++)if(before[i]!==after[i]){diff++;if(i%4===3)alphaMax=Math.max(alphaMax,Math.abs(before[i]-after[i]));}
  const op=m.activeLayer(saved).operations.find((o:any)=>o.id==='ink');
  const pt=op?polyline(op)[Math.floor(polyline(op).length/2)]:null;
  const repick=pt&&hitStroke(m.activeLayer(saved),pt,1)?.id;
  const kind=op?.kind;
  store.undo();const undo=store.getSnapshot()===doc;
  t.destroy();e.dispose();canvases.forEach(c=>c.remove());
  return {commit,diff,alphaMax,kind,repick,undo};
 });
 expect(result.commit.error).toBeUndefined();
 expect(result.kind).toBe('stroke');
 expect(result.repick).toBe('ink');
 expect(result.alphaMax).toBeLessThanOrEqual(2);
 expect(result.diff).toBeLessThan(100);
 expect(result.undo).toBe(true);
});
