import {test,expect} from '@playwright/test';

test('raw, coalesced, delayed and release-only pen samples preserve one ordered vector stroke',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const enginePath='/src/engine/StudioEngine.ts',modelPath='/src/core/model.ts',historyPath='/src/core/history.ts',vectorPath='/src/engine/vector.ts';
  const {StudioEngine}=await import(enginePath),m=await import(modelPath),{DocumentStore}=await import(historyPath),{drawVector}=await import(vectorPath);
  const points=Array.from({length:121},(_,i)=>{const t=i/120;return {x:250+95*Math.sin(t*Math.PI*4),y:40+t*500,p:.08+.88*Math.sin(t*Math.PI)**2};});
  const run=async(mode:string)=>{
   const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:0;top:0;width:600px;height:600px';document.body.append(canvas);canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
   const store=new DocumentStore(m.newProject('Vector event regression',600,600)),engine=new StudioEngine(canvas,store,()=>{});await new Promise(requestAnimationFrame);engine.setView({x:0,y:0,zoom:1,rotation:0});engine.setTool('vector');Object.assign(engine.vectors,{width:10,pressure:true,smoothness:65,stabilization:12});
   const event=(type:string,index:number,pressure?:number)=>{const p=points[index],e=new PointerEvent(type,{pointerId:9,isPrimary:true,pointerType:'pen',button:0,buttons:type==='pointerup'||mode==='raw-zero-buttons'?0:1,pressure:pressure??(type==='pointerup'?0:p.p),clientX:p.x,clientY:p.y});Object.defineProperty(e,'timeStamp',{value:1000+index*8});return e;};
   const send=(type:string,ids:number[])=>{const e=event(type,ids.at(-1)!);Object.defineProperty(e,'getCoalescedEvents',{value:()=>ids.map(i=>event(type==='pointerup'?'pointermove':type,i))});canvas.dispatchEvent(e);};
   canvas.dispatchEvent(event('pointerdown',0,mode.startsWith('unknown')?0:undefined));
   if(mode==='overlap')for(let i=1;i<points.length;i+=4){const end=Math.min(points.length-1,i+3);send('pointerrawupdate',Array.from({length:end-i+1},(_,j)=>i+j));const start=Math.max(1,i-3);send('pointermove',Array.from({length:end-start+1},(_,j)=>start+j));}
   else if(mode==='late'||mode==='unknown-late')for(let i=1;i<points.length;i+=2){const end=Math.min(points.length-1,i+1);send('pointerrawupdate',[end]);if(end!==i)send('pointermove',[i,end]);}
   else for(let i=1;i<points.length-(mode==='release-tail'?4:0);i++){
    canvas.dispatchEvent(event(mode==='raw-zero-buttons'?'pointerrawupdate':'pointermove',i));
    if(mode==='pressure-gaps')canvas.dispatchEvent(event('pointermove',i,0));
   }
   const accepted=(engine.vectors as any).drag.samples.length;
   const live=document.createElement('canvas');live.width=600;live.height=600;engine.vectors.renderNewLayer(live.getContext('2d'));
   if(mode==='release-tail')send('pointerup',[117,118,119,120]);else canvas.dispatchEvent(event('pointerup',120));
   const line=m.activeLayer(store.getSnapshot()).operations.at(-1),saved=document.createElement('canvas');saved.width=600;saved.height=600;drawVector(saved.getContext('2d'),line);
   const a=live.getContext('2d')!.getImageData(0,0,600,600).data,b=saved.getContext('2d')!.getImageData(0,0,600,600).data;let alphaDifference=0;for(let i=3;i<a.length;i+=4)if(a[i]!==b[i])alphaDifference++;
   const valid=m.validateProject(JSON.parse(JSON.stringify(store.getSnapshot()))).layers.some((l:any)=>l.operations.some((o:any)=>o.id===line.id));
   store.undo();const undoEmpty=m.activeLayer(store.getSnapshot()).operations.length===0;store.redo();const redoRestored=m.activeLayer(store.getSnapshot()).operations.some((o:any)=>o.id===line.id);
   engine.dispose();canvas.remove();return {mode,accepted,nodes:line.nodes,widthProfile:line.widthProfile,alphaDifference,valid,undoEmpty,redoRestored};
  };
  const rows=[];for(const mode of ['normal','overlap','late','release-tail','raw-zero-buttons','pressure-gaps','unknown-contact','unknown-late'])rows.push(await run(mode));return rows;
 });
 const base=result[0];
 for(const row of result){
  expect(row.nodes.map(({p,...n}:any)=>n),row.mode+' geometry').toEqual(base.nodes.map(({p,...n}:any)=>n));
  if(!row.mode.startsWith('unknown'))expect(row.widthProfile,row.mode+' widths').toEqual(base.widthProfile);
  if(row.mode!=='release-tail')expect(row.alphaDifference,row.mode+' preview/commit').toBe(0);
  expect(row.valid,row.mode+' save').toBe(true);expect(row.undoEmpty,row.mode+' undo').toBe(true);expect(row.redoRestored,row.mode+' redo').toBe(true);
 }
 expect(result[1].accepted).toBe(base.accepted);
 expect(base.widthProfile.at(-1)!.p).toBeCloseTo(.08,6);
 expect(result.at(-1)!.widthProfile[0].p).toBeCloseTo(.08+.88*Math.sin(Math.PI/120)**2,6);
});
