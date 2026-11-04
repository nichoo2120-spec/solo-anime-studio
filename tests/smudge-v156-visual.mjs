// Frozen v155 output, deterministic replay and incremental rollback comparisons.
import {createServer} from 'vite';import {chromium} from '@playwright/test';
import fs from 'node:fs';import assert from 'node:assert/strict';
const root=process.env.COMPARE_ROOT??process.cwd(),tag=process.env.COMPARE_TAG??'after';
const server=await createServer({root,server:{host:'127.0.0.1',port:5556,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-gpu']});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5556/exp/h.html');await page.waitForFunction(()=>window.H);
 const result=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts'),{brushStrokeMetadata,watercolorSeedFor}=await import('/src/core/paintTips.ts'),{compositePaintStroke,strokeRasterBounds}=await import('/src/engine/paintCompositing.ts'),{resetWetSmudgeCaches}=await import('/src/engine/wetSmudge.ts');
  const W=960,H=340,make=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;},hash=async c=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',c.getContext('2d').getImageData(0,0,W,H).data))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const sheet=document.createElement('canvas');sheet.width=1040;sheet.height=4*260+60;const sc=sheet.getContext('2d');sc.fillStyle='#fff';sc.fillRect(0,0,sheet.width,sheet.height);sc.fillStyle='#142b40';sc.font='bold 23px sans-serif';sc.fillText('Actual smudge output · same pigment and pressure',24,35);
  const rows=[];
  for(const [index,preset]of ['smudge-bristle','blender-soft','wet-mix','color-blender'].entries())for(const size of [12,30,130,500])for(const mode of ['opaque','transparent'])for(const shape of ['straight','curve']){
   const settings={...stockPresets.find(p=>p.id===preset).settings,size},id=`v156-${preset}-${size}-${mode}-${shape}`,s={...settings,...brushStrokeMetadata(settings),id,kind:'stroke',tool:'brush',color:'#278f69',opacity:mode==='transparent'?.61:1,pressure:true,response:1,captureZoom:1,stabilization:.08,smoothness:18,taperStart:0,taperEnd:size===500?.15:0,colorSeed:watercolorSeedFor(id),points:Array.from({length:121},(_,i)=>{const t=i/120;return{x:100+730*t,y:170+(shape==='curve'?65*Math.sin(t*Math.PI*3):0),p:.18+.8*Math.sin(t*Math.PI)**2,v:.65-.25*Math.sin(t*Math.PI*2)};})};
   const source=make(),bc=source.getContext('2d');bc.fillStyle=mode==='opaque'?'#e30c23':'rgba(227,12,35,.43)';bc.fillRect(0,0,430,H);bc.fillStyle=mode==='opaque'?'#043cb1':'rgba(4,60,177,.68)';bc.fillRect(430,0,W-430,H);
   const target=make(),mask=make(),tc=target.getContext('2d'),render=(stroke,base)=>{tc.clearRect(0,0,W,H);tc.drawImage(source,0,0);compositePaintStroke(tc,mask,stroke,0,0,strokeRasterBounds(stroke,W,H),base);};
   resetWetSmudgeCaches();render(s);const canonical=await hash(target),expected=tc.getImageData(0,0,W,H).data;render(JSON.parse(JSON.stringify(s)));const repeat=await hash(target);resetWetSmudgeCaches();
   // Include backward edits and large changes, rather than only monotonic input.
   for(const n of [1,5,12,24,44,65,50,74,100,121])render({...s,points:s.points.slice(0,n)},source);
   render(s,source);const live=tc.getImageData(0,0,W,H).data;let max=0,changed=0;for(let i=0;i<live.length;i+=4){let d=false;for(let k=0;k<4;k++){const q=Math.abs(live[i+k]-expected[i+k]);max=Math.max(max,q);d||=q>0;}if(d)changed++;}
   rows.push({preset,size,mode,shape,canonical,repeat,liveMax:max,liveChanged:changed});
   if(size===130&&mode==='opaque'&&shape==='curve'){sc.fillStyle='#142b40';sc.font='bold 20px sans-serif';sc.fillText(stockPresets.find(p=>p.id===preset).name,24,82+index*260);sc.drawImage(target,40,95+index*260,960,200);}
  }
  resetWetSmudgeCaches();return{rows,png:sheet.toDataURL()};
 });
 const file=`validation/v156-${tag}-smudge-visual.json`;fs.writeFileSync(file,JSON.stringify(result.rows,null,2));fs.writeFileSync(`validation/v156-${tag}-smudge-output.png`,Buffer.from(result.png.split(',')[1],'base64'));
 for(const r of result.rows){assert.equal(r.canonical,r.repeat,JSON.stringify(r));assert(r.liveMax<=1&&r.liveChanged/(960*340)<=.001,JSON.stringify(r));}
 if(tag==='after'){const before=JSON.parse(fs.readFileSync('tests/fixtures/smudge-v156-goldens.json')).rows;assert.equal(before.length,result.rows.length);for(let i=0;i<before.length;i++)assert.equal(result.rows[i].canonical,before[i].canonical,JSON.stringify(result.rows[i]));}
 console.log(`${result.rows.length} actual rendered cases: replay, backward tail edits, 12–500px, opacity/pressure, canonical v155 equivalence PASS.`);
}finally{await browser.close();await server.close();}
