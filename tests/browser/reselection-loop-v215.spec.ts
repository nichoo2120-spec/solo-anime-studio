import {test,expect} from '@playwright/test';

test('Stroke Select can pick the same edited ink over and over, including after reload',async({page})=>{
 await page.goto('/');
 await page.evaluate(async()=>{
  const {newProject}=await import('/src/core/model.ts');
  const {DocumentStore}=await import('/src/core/history.ts');
  const {StudioEngine}=await import('/src/engine/StudioEngine.ts');
  const p=newProject('Re-pick after repeated edits',640,360),layer=p.layers.find(l=>l.id===p.activeLayerId)!;
  layer.operations=[{kind:'stroke',tool:'brush',id:'reselected-stroke',brushKind:'technical',engineVersion:10,size:8,opacity:1,color:'#112233',pressure:false,response:1,stabilization:0,smoothness:0,
   points:Array.from({length:30},(_,i)=>({x:110+i*8,y:150+Math.sin(i/29*Math.PI)*18,p:1}))}];
  const c=document.createElement('canvas');c.style.cssText='position:fixed;left:0;top:0;width:640px;height:360px;z-index:10000000;pointer-events:auto;';
  document.body.append(c);
  const store=new DocumentStore(p),e=new StudioEngine(c,store,()=>{});
  e.setView({x:0,y:0,zoom:1,rotation:0});e.setTool('stroke-select');e.setStrokeMode('select');
  (window as any).__repeatSelection={e,store,canvas:c};
 });
 const select=async()=>{
  const target=await page.evaluate(async()=>{
   const {polyline}=await import('/src/engine/strokeSelection.ts');
   const {e,store}=(window as any).__repeatSelection;
   const doc=store.getSnapshot(),op=doc.layers.find((l:any)=>l.id===doc.activeLayerId).operations[0];
   const pts=polyline(op),p=pts[Math.floor(pts.length*.5)];
   const r=(window as any).__repeatSelection.canvas.getBoundingClientRect();
   return {x:r.left+p.x,y:r.top+p.y};
  });
  await page.mouse.click(target.x,target.y);
  const ids=await page.evaluate(()=>(window as any).__repeatSelection.e.strokeIds);
  expect(ids).toEqual(['reselected-stroke']);
 };
 for(let iteration=0;iteration<6;iteration++){
  await select();
  // Clicking an already selected edited line must not silently deselect it.
  if(iteration===2)await select();
  await page.evaluate((i)=>{
   const {e}=(window as any).__repeatSelection;
   if(i%2===0)e.setTransform({dx:7,dy:2});
   else {
    e.warpQuad=e.selection.map((p:any,j:number)=>({...p,x:p.x+(j===1?10:0),y:p.y+(j===2?4:0)}));
   }
   e.applySelection();
   e.clearSelection();
   e.setTool('brush');e.setTool('stroke-select');e.setStrokeMode('select');
  },iteration);
 }
 await page.evaluate(async()=>{
  const {e,store}=(window as any).__repeatSelection;
  const {ProjectRepository}=await import('/src/core/persistence.ts');
  const repo=new ProjectRepository('sas-physical-selection-v215');
  await repo.save(store.getSnapshot(),'manual');
  const record=await repo.get(store.getSnapshot().id);
  if(!record)throw Error('Project could not be reopened');
  await e.load(record.project);
  e.setView({x:0,y:0,zoom:1,rotation:0});
  e.setTool('brush');e.setTool('stroke-select');e.setStrokeMode('select');
  e.clearSelection();
 });
 await select();
 const state=await page.evaluate(()=>{
  const {e,store,canvas}=(window as any).__repeatSelection;
  const layer=store.getSnapshot().layers.find((l:any)=>l.id===store.getSnapshot().activeLayerId);
  const ids=[...e.strokeIds],types=layer.operations.map((o:any)=>o.kind);
  e.dispose();canvas.remove();return {ids,types};
 });
 expect(state.ids).toEqual(['reselected-stroke']);
 expect(state.types).toEqual(['stroke']);
});
