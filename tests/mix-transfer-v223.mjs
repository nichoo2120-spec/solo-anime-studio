import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
const server=await createServer({server:{host:'127.0.0.1',port:5823,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5823');
 const rows=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts'),{brushStrokeMetadata}=await import('/src/core/paintTips.ts');const rows=[];
  for(const id of ['dry-ink-bristle','technical','water-wet','color-soft'])for(const size of [30,150]){
   const width=700,height=440,base=document.createElement('canvas');base.width=width;base.height=height;const bc=base.getContext('2d',{willReadFrequently:true});bc.fillStyle='#a53676';bc.fillRect(120,120,230,170);bc.fillStyle='#3576c2';bc.fillRect(350,120,230,170);bc.strokeStyle='#161e2a';bc.lineWidth=13;bc.beginPath();bc.moveTo(100,220);bc.lineTo(600,220);bc.stroke();
   const workers=[new Worker('/src/engine/liveBlend.worker.ts?worker_file&type=module',{type:'module'}),new Worker('/src/engine/liveBlend.worker.ts?worker_file&type=module',{type:'module'})],surfaces=workers.map(()=>{const c=document.createElement('canvas');c.width=width;c.height=height;c.getContext('2d',{willReadFrequently:true}).drawImage(base,0,0);return c;});
   for(let i=0;i<2;i++){const bitmap=await createImageBitmap(base),pixels=bc.getImageData(0,0,width,height).data;workers[i].postMessage({kind:'begin',token:1,width,height,base:bitmap,nativeDelta:true,basePixels:pixels,compactReplies:i===1},[bitmap,pixels.buffer]);}
   const settings=stockPresets.find(p=>p.id===id).settings,s={...settings,...brushStrokeMetadata(settings),id:'generated-transfer',kind:'stroke',tool:'brush',color:'#243142',opacity:1,size,nativeMixVersion:3,nativeMixAmount:.8,pressure:true,response:1,watercolorSeed:12,dryBristleSeed:12,colorSeed:12,points:[]};let max=0,referencePixels=0,transferredPixels=0;
   for(let n=0;n<18;n++){
    for(let j=0;j<5;j++){const k=n*5+j;s.points.push({x:140+k*4.4,y:220+Math.sin(k*.1)*35,p:.4+.5*Math.sin(k/90*Math.PI),v:.65});}
    const replies=await Promise.all(workers.map(worker=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Mix reply timed out')),15000);worker.onmessage=e=>{clearTimeout(timer);e.data.error?reject(Error(e.data.error)):resolve(e.data);};worker.onerror=e=>reject(Error(e.message));worker.postMessage({kind:'update',token:1,serial:n,stroke:s,final:n===17});})));
    for(let i=0;i<2;i++){const reply=replies[i],r=reply.region,ctx=surfaces[i].getContext('2d');if(i===0){referencePixels+=r.width*r.height;ctx.clearRect(r.x,r.y,r.width,r.height);ctx.drawImage(reply.bitmap,r.x,r.y);reply.bitmap.close();reply.deltaMask.close();reply.deltaPaint.close();}else{transferredPixels+=r.width*r.height;if(!reply.bitmap||!reply.maskData||!reply.paintData)throw Error('Missing compact reply');ctx.clearRect(r.x,r.y,r.width,r.height);ctx.drawImage(reply.bitmap,r.x,r.y);reply.bitmap.close();}}
    const a=surfaces[0].getContext('2d').getImageData(0,0,width,height).data,b=surfaces[1].getContext('2d').getImageData(0,0,width,height).data;for(let k=0;k<a.length;k+=4){max=Math.max(max,Math.abs(a[k+3]-b[k+3]));for(let ch=0;ch<3;ch++)max=Math.max(max,Math.abs(Math.round(a[k+ch]*a[k+3]/255)-Math.round(b[k+ch]*b[k+3]/255)));}if(max>2)throw Error(id+' size '+size+' update '+n+' changed pixels: '+max);
   }
   workers.forEach(w=>w.terminate());rows.push({id,size,max,referencePixels,transferredPixels});
  }
  function assertPixels(data,length){if(!data||data.length!==length)throw Error('Invalid pixel reply');}
  return rows;
 });
 assert(rows.every(r=>r.max<=2));assert(rows.reduce((n,r)=>n+r.transferredPixels,0)<rows.reduce((n,r)=>n+r.referencePixels,0)/2);console.log('Mix transfer pixel parity and area reduction passed.',JSON.stringify(rows));
}finally{await browser.close();await server.close();}
