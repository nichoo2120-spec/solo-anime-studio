// Browser regression: transformed strokes remain selectable after repeated edits,
// IndexedDB save/reopen does not rasterize sharp editable brush art.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';

const server=await createServer({server:{host:'127.0.0.1',port:5815,strictPort:true}});
let browser;
try{
 await server.listen();
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--disable-gpu']});
 const page=await browser.newPage({viewport:{width:1400,height:900},deviceScaleFactor:2});
 await page.goto('http://127.0.0.1:5815');
 const report=await page.evaluate(async()=>{
  const {newProject,validateProject}=await import('/src/core/model.ts');
  const {ProjectRepository}=await import('/src/core/persistence.ts');
  const {InkDisplay,displayCleanInk}=await import('/src/engine/InkDisplay.ts');
  const {LayerRenderer}=await import('/src/engine/renderer.ts');
  const {hitStroke,polyline,projectiveStroke,transformedStroke}=await import('/src/engine/strokeSelection.ts');
  const {homography,affineH}=await import('/src/engine/perspectiveWarp.ts');
  const base=newProject('Selection and reopen fidelity',300,170);
  const layer=base.layers.find(l=>l.id===base.activeLayerId);
  const stroke={kind:'stroke',id:'same-editable-ink',tool:'brush',brushKind:'technical',engineVersion:10,
   points:Array.from({length:55},(_,i)=>({x:35+i*3.6,y:68+Math.sin(i/54*Math.PI*2)*28,p:.5+i/54*.4})),
   size:5,opacity:1,color:'#243039',pressure:false,response:1,stabilization:0,smoothness:0};
  const h=homography([{x:10,y:10},{x:255,y:10},{x:255,y:145},{x:10,y:145}],
   [{x:16,y:5},{x:270,y:20},{x:233,y:158},{x:5,y:155}]);
  if(!h)throw Error('Fixture perspective is invalid');
  let current=projectiveStroke(stroke,h),repicks=0;
  // Alternate perspective, translation and scale edits. Each time simulate
  // deselection and repicking the SAME operation, not a new duplicate/image.
  for(let i=0;i<7;i++){
   const selectedLayer={...layer,operations:[current]};
   const points=polyline(current),at=points[Math.floor(points.length*.45)];
   if(hitStroke(selectedLayer,at,2)?.id!=='same-editable-ink')throw Error('Cannot reselect edited stroke on pass '+i);
   repicks++;
   current=i%2===0?transformedStroke(current,[1.01,0,0,1.01,2,-1]):
     projectiveStroke(current,affineH([1,0,0,1,-1.5,1.5]));
  }
  layer.operations=[current];
  const valid=validateProject(JSON.parse(JSON.stringify(base)));
  const database=new ProjectRepository('sas-reopen-reselect-v215');
  await database.save(valid,'manual');
  const reopened=(await database.get(base.id))?.project;
  if(!reopened)throw Error('IndexedDB reopen did not recover the project');
  const loaded=validateProject(reopened);
  const loadedLayer=loaded.layers.find(l=>l.id===loaded.activeLayerId);
  const loadedStroke=loadedLayer.operations.find(o=>o.id==='same-editable-ink');
  if(!loadedStroke||loadedStroke.kind!=='stroke')throw Error('Edited brush stroke became an unselectable image');
  const pts=polyline(loadedStroke),where=pts[Math.floor(pts.length*.45)];
  if(hitStroke(loadedLayer,where,2)?.id!==loadedStroke.id)throw Error('Cannot reselect stroke after reopening');
  const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const render=(layer,p)=>{
   const sharp=canvas(1200,680),ctx=sharp.getContext('2d');
   ctx.scale(4,4);
   const ink=new InkDisplay(),renderer=new LayerRenderer();
   const accepted=ink.paint(ctx,layer,p,undefined,undefined,renderer);
   if(!accepted)throw Error('Reopened transformed stroke bypassed high-DPI display');
   const native=renderer.get(layer,p),blown=canvas(1200,680),bc=blown.getContext('2d');
   bc.imageSmoothingEnabled=false;bc.drawImage(native,0,0,1200,680);
   const data=ctx.getImageData(0,0,1200,680).data,scaled=bc.getImageData(0,0,1200,680).data;
   let different=0;
   for(let i=3;i<data.length;i+=4)if(Math.abs(data[i]-scaled[i])>20)different++;
   const png=sharp.toDataURL();
   ink.clear();renderer.clear();return {accepted,different,png};
  };
  const first=render(layer,base),second=render(loadedLayer,loaded);
  if(!displayCleanInk(loadedStroke))throw Error('Projective ink is not eligible for sharp display');
  if(first.png!==second.png)throw Error('Reopen changed the rendered ink');
  if(second.different<100)throw Error('High-DPI display is just enlarging the page bitmap');
  return {repicks,editable:loadedStroke.kind,sharp:second.accepted,changedPixels:second.different,reopenExact:first.png===second.png};
 });
 assert.equal(report.repicks,7);
 assert.equal(report.editable,'stroke');
 assert(report.sharp&&report.reopenExact&&report.changedPixels>100);
 console.log('PASS RESELECT+REOPEN',report);
}finally{await browser?.close();await server.close();}
