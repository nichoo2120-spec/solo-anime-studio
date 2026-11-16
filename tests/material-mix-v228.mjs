import fs from 'node:fs';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';

const server=await createServer({server:{host:'127.0.0.1',port:5828,strictPort:true}});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5828');
 const result=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await import('/src/core/paintTips.ts');
  const {drawStroke}=await import('/src/engine/renderer.ts');
  const {applyPigmentMix}=await import('/src/engine/pigmentMix.ts');
  const {mixMaterial}=await import('/src/engine/materialMix.ts');
  const {LiveBlendWorker}=await import('/src/engine/LiveBlendWorker.ts');
  const {newProject,validateProject}=await import('/src/core/model.ts');
  const W=800,H=400,make=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;};
  const paint=(source,s,mask)=>{const out=make();out.getContext('2d',{willReadFrequently:true}).drawImage(source,0,0);applyPigmentMix(out.getContext('2d'),mask,s,0,0);return out;};
  const pixels=c=>c.getContext('2d').getImageData(0,0,W,H).data;
  const difference=(a,b)=>{const x=pixels(a),y=pixels(b);let max=0,count=0;for(let i=0;i<x.length;i++){const d=Math.abs(x[i]-y[i]);max=Math.max(max,d);if(d>3)count++;}return{max,count};};
  const stripeCanvas=make(),sc=stripeCanvas.getContext('2d');
  for(let x=0;x<W;x+=32){sc.fillStyle='#bf4055';sc.fillRect(x,0,16,H);sc.fillStyle='#486fca';sc.fillRect(x+16,0,16,H);}
  const stripeMask=make(),sm=stripeMask.getContext('2d');sm.fillStyle='white';sm.fillRect(70,145,660,110);
  const contrast=c=>{let total=0,n=0;for(let x=320;x<640;x+=32){total+=Math.abs(c.getContext('2d').getImageData(x+4,200,1,1).data[0]-c.getContext('2d').getImageData(x+20,200,1,1).data[0]);n++;}return total/n;};
  const items=[['water-wet','watercolor'],['color-air','airbrush'],['dry-ink-bristle','dry'],['color-solid','solid'],['soft-paint','soft']],rendered=[];
  for(const [id,expected] of items){
   const preset=stockPresets.find(p=>p.id===id);if(!preset)throw Error('Missing brush '+id);
   const stroke={...preset.settings,...brushStrokeMetadata(preset.settings),id:'material-v228-'+id,kind:'stroke',tool:'brush',size:110,opacity:1,pressure:false,response:1,color:'#00ff00',nativeMixVersion:3,nativeMixPickupVersion:3,nativeMixAmount:1,nativeMixPaintLoad:0,nativeMixRadius:.5,points:Array.from({length:94},(_,i)=>({x:80+i*6.8,y:200+Math.sin(i*.08)*7,p:.8,v:.65}))};
   if(mixMaterial(stroke)!==expected)throw Error('Wrong Mix material for '+id+': '+mixMaterial(stroke));
   const output=paint(stripeCanvas,stroke,stripeMask);
   const otherPalette=paint(stripeCanvas,{...stroke,color:'#ff00ff'},stripeMask);
   if(difference(output,otherPalette).max!==0)throw Error('Selected colour leaked into existing-paint pickup: '+id);
   const blank=paint(make(),stroke,stripeMask);if(pixels(blank).some(v=>v))throw Error('Mix painted a blank canvas without paint load: '+id);
   const nativeMask=make();drawStroke(nativeMask.getContext('2d'),stroke);
   const expectedFinal=paint(stripeCanvas,stroke,nativeMask),worker=new LiveBlendWorker(()=>{});
   worker.preview({...stroke,points:stroke.points.slice(0,28)},stripeCanvas,1,true);await new Promise(r=>setTimeout(r,60));
   worker.preview({...stroke,points:stroke.points.slice(0,61)},stripeCanvas,2,true);await new Promise(r=>setTimeout(r,60));
   worker.preview(stroke,stripeCanvas,3,true);const actual=await worker.finish(stroke).done;
   if(!actual)throw Error('Mix worker failed for '+id);
   const workerDifference=difference(expectedFinal,actual);worker.dispose();
   if(workerDifference.max>4)throw Error('Worker and saved-stroke replay differ for '+id+': '+JSON.stringify(workerDifference));
   const untouched=difference(stripeCanvas,output);if(untouched.count===0)throw Error('Mix had no effect for '+id);
   const project=newProject('Material mix validation',W,H);project.layers[0].operations=[stroke];validateProject(JSON.parse(JSON.stringify(project)));
   rendered.push({id,material:expected,contrast:contrast(output),workerDifference});
  }
  const before=contrast(stripeCanvas),water=rendered.find(x=>x.material==='watercolor'),dry=rendered.find(x=>x.material==='dry'),air=rendered.find(x=>x.material==='airbrush');
  if(!water||!dry||!air)throw Error('A material profile was not rendered');
  if(!(water.contrast<before*.96))throw Error('Watercolour did not soften pigment boundaries: '+JSON.stringify({before,water:water.contrast}));
  if(!(dry.contrast>water.contrast))throw Error('Dry bristles lost more pigment separation than watercolour: '+JSON.stringify(rendered));
  if(!(air.contrast<dry.contrast))throw Error('Airbrush did not feather more than dry bristles: '+JSON.stringify(rendered));
  return{before,rendered};
 });
 fs.mkdirSync('validation/mix-v228',{recursive:true});
 console.log(JSON.stringify(result));
}finally{await browser.close();await server.close();}

