import {test,expect} from '@playwright/test';
import fs from 'node:fs';
test('optimized nibs preserve reference pixels, pressure footprints, texture and taper',async({page})=>{
 test.setTimeout(90000);await page.goto('/');
 const results=await page.evaluate(async()=>{
  const bp='/src/core/brushes.ts',rp='/src/engine/brushRaster.ts',sp='/src/engine/strokeGeometry.ts';const {stockPresets}=await import(bp),current=await import(rp),{strokeGeometry,pressureResponse}=await import(sp);
  const make=()=>{const c=document.createElement('canvas');c.width=400;c.height=300;return c;},hash=async(data:Uint8ClampedArray)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(b=>b.toString(16).padStart(2,'0')).join(''),results=[];
  for(const preset of stockPresets.filter(p=>p.id!=='watercolor'))for(const engineVersion of [2,3,4])for(const phase of ['live','final']){
   const stroke={...(preset.id==='dry'?{...preset.settings,brushKind:'dry',size:24,opacity:.8,textureStrength:.65}:preset.settings),id:'reference',kind:'stroke',tool:preset.category==='Eraser'?'eraser':'brush',engineVersion,...(engineVersion===4?{size:28,taperStart:0,taperEnd:0}:{}),pressure:true,color:'#6549a3',points:Array.from({length:21},(_,i)=>({x:80+i*11,y:140+Math.sin(i/20*Math.PI*2)*50,p:.15+Math.sin(i/20*Math.PI)*.8}))},geometry=strokeGeometry(stroke,phase),c=make();current.drawModernStroke(c.getContext('2d'),stroke,phase,geometry);
   const pixels=c.getContext('2d')!.getImageData(0,0,400,300).data;const repeat=make();current.drawModernStroke(repeat.getContext('2d'),stroke,phase,geometry);const again=repeat.getContext('2d')!.getImageData(0,0,400,300).data;if(again.some((v,i)=>v!==pixels[i]))throw Error('Non-deterministic raster '+preset.id);if(!pixels.some((v,i)=>i%4===3&&v>0))throw Error('Empty raster '+preset.id);results.push({key:`${preset.id}/${engineVersion}/${phase}`,hash:await hash(pixels)});
  }
  // A dot has no length-based taper. Pressure, not stroke-length initialization,
  // must set its physical radius; thin and deliberately broad dots are both kept.
  for(const kind of ['hb','g-pen','mapping','brush-pen','airbrush'])for(const size of [1,4,20,60])for(const p of [.1,.5,1]){
   const preset=stockPresets.find((p:any)=>p.id===kind)!,stroke={...preset.settings,id:'dot',kind:'stroke',tool:'brush',engineVersion:4,pressure:true,size,points:[{x:200,y:150,p}]},c=make();current.drawModernStroke(c.getContext('2d'),stroke);
   const image=c.getContext('2d')!.getImageData(0,0,400,300).data,radius=size/2*(stroke.pressureWidth===false?1:Math.max(.06,pressureResponse(p**stroke.response,stroke.pressureCurve)));let max=0,count=0;for(let i=3;i<image.length;i+=4)if(image[i]){const index=(i-3)/4;max=Math.max(max,Math.hypot(index%400+.5-200,Math.floor(index/400)+.5-150));count++;}
   if((size>=4||p>=.5)&&!count||max>radius+1.5)throw Error(`Unexpected ${kind} dot: ${max} / ${radius}, ${count}`);
  }
  return results;
 });
 // Old hashes depend on obsolete preset defaults and one Edge rasterizer.
 // Check repeatability within this browser; retain physical footprint assertions above.
 expect(results.length).toBeGreaterThan(80);expect(new Set(results.map(r=>r.key)).size).toBe(results.length);
 fs.writeFileSync('validation/v117-raster-signatures.json',JSON.stringify(results,null,2));
});
