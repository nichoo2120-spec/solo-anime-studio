// v0.5.242 Blend v2: every stock brush family blends in its own style.
// Real browser: v1 (v0.5.240/241 recipe, left) vs v2 (right) sheet for every
// family, character metrics per family, settings, no halos / no added colour,
// and real LiveBlendWorker live == final parity for every family.
import {createServer} from 'vite';import {chromium} from '@playwright/test';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve('.'),out=path.join(root,'validation','brush-blend-v242');fs.mkdirSync(out,{recursive:true});
const port=5846,server=await createServer({root,logLevel:'error',cacheDir:'/tmp/solo-blend-v242-vite',server:{host:'127.0.0.1',port,strictPort:true}});
server.middlewares.use('/__blendqa',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Blend QA</title>');});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(process.platform==='win32'?undefined:'/usr/bin/google-chrome'),headless:true,args:['--no-sandbox','--disable-gpu']});
let failed=false;
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}/__blendqa`);
 const result=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts');const {brushStrokeMetadata}=await import('/src/core/paintTips.ts');
  const {compositePaintStroke}=await import('/src/engine/paintCompositing.ts');const {drawStroke}=await import('/src/engine/renderer.ts');
  const {LiveBlendWorker}=await import('/src/engine/LiveBlendWorker.ts');const {blendStyleNames}=await import('/src/core/brushBlend.ts');
  const W=620,H=230,make=(w=W,h=H)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const scene=()=>{const c=make(),x=c.getContext('2d');x.fillStyle='#d8283c';x.fillRect(20,25,W-40,62);x.fillStyle='#1f5bd8';x.fillRect(20,87,W-40,62);x.fillStyle='#f2c230';x.fillRect(20,149,W-40,56);return c;};
  const pts=(L=170)=>Array.from({length:L},(_,i)=>{const t=i/(L-1);return {x:50+t*(W-100),y:115+92*Math.sin(t*Math.PI*5),p:.35+.65*Math.sin(Math.min(1,t*1.15)*Math.PI*.5+.4)};});
  const strokeFor=(id,version,blend={},extra={})=>{const preset=stockPresets.find(p=>p.id===id);const settings={...preset.settings,bbEnabled:true,...blend};const {bbEnabled:_e,...plain}=settings;let meta=brushStrokeMetadata(settings);
   if(version===1){const {bbStyle:_s,...m}=meta;meta={...m,brushBlendVersion:1};}
   else{for(const key of ['bbMode','bbColorCarry','bbSoftness','bbTextureKeep','bbSmoothing','bbEdgeDarkness'])delete meta[key];meta.brushBlendVersion=2;}
   return {...plain,...meta,id:'qa-'+id,kind:'stroke',tool:'brush',color:'#00ff00',size:34,opacity:1,pressure:true,response:1,points:pts(),...extra};};
  const reload=(s,base)=>{const res=make();const ctx=res.getContext('2d');ctx.drawImage(base,0,0);const mask=make();drawStroke(mask.getContext('2d'),s);compositePaintStroke(ctx,mask,s);return res;};
  const data=c=>c.getContext('2d').getImageData(0,0,W,H).data;
  const families=[['water-wet','Soft Wet Watercolor'],['water-rough','Rough Watercolor'],['water-flat','Flat Watercolor'],['dry-paint','Dry Paint Brush'],['dry-ink-bristle','Dry Ink Brush'],['dry','Dry Brush (old)'],['hb','HB Pencil'],['2b','2B Pencil'],['g-pen','G-Pen'],['brush-pen','Brush Pen'],['technical','Technical Pen'],['color-air','Airbrush'],['paint','Simple Paint Brush (oil)'],['flat','Flat Brush'],['color-solid','Solid Paint'],['marker','Soft Marker'],['color-texture','Textured Paint'],['color-soft','Soft Paint'],['soft-paint','Soft Paint Brush']];
  const sheet=make(40+W*2+20,70+families.length*(H+34)),sc=sheet.getContext('2d');sc.fillStyle='#1b252b';sc.fillRect(0,0,sheet.width,sheet.height);sc.fillStyle='#e6eef2';sc.font='bold 21px sans-serif';
  sc.fillText('Blend mode (J) — v0.5.241 (left)  vs  v0.5.242 family styles (right). Brush colour is pure green and must never appear.',20,36);
  const rows=[];let row=0;
  // character metrics inside the stroke (where v2 changed the pixels)
  const metrics=(before,after)=>{let changed=0,alphaDrop=0,green=0,lumSum=0,n=0,gapCore=0,core=0,hf=0,hfn=0;
   const lum=(d,i)=>.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];
   for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=(y*W+x)*4;const ch=Math.abs(after[i]-before[i])+Math.abs(after[i+1]-before[i+1])+Math.abs(after[i+2]-before[i+2]);
    if(after[i+3]+1<before[i+3])alphaDrop++;if(after[i+3]>20&&after[i+1]>Math.max(after[i],after[i+2])+90&&before[i+3]<5)green++;
    if(ch>6){changed++;lumSum+=lum(after,i);n++;const r=(x2,y2)=>lum(after,(y2*W+x2)*4);hf+=Math.abs(4*r(x,y)-r(x-1,y)-r(x+1,y)-r(x,y-1)-r(x,y+1));hfn++;}}
   return {changed,alphaDrop,green,meanLum:n?+(lumSum/n).toFixed(1):0,hf:hfn?+(hf/hfn).toFixed(2):0};};
  // gaps: along the stroke path, fraction of near-centre pixels left untouched
  const gaps=(before,after,s)=>{let core=0,gap=0;for(const p of s.points)for(let k=0;k<12;k++){const a=k/12*Math.PI*2,rr=s.size*.25,x=Math.round(p.x+Math.cos(a)*rr),y=Math.round(p.y+Math.sin(a)*rr);if(x<0||y<0||x>=W||y>=H)continue;const i=(y*W+x)*4;if(before[i+3]<250)continue;core++;const ch=Math.abs(after[i]-before[i])+Math.abs(after[i+1]-before[i+1])+Math.abs(after[i+2]-before[i+2]);if(ch<=6)gap++;}return core?+(gap/core).toFixed(3):0;};
  const hashOf=d=>{let h=2166136261;for(let i=0;i<d.length;i++){h^=d[i];h=Math.imul(h,16777619);}return h>>>0;};
  for(const [id,label] of families){
   const base=scene(),before=data(base),s1=strokeFor(id,1),s2=strokeFor(id,2);
   const r1=reload(s1,base);const t=performance.now();const r2=reload(s2,base);const ms=performance.now()-t;const a2=data(r2),a1=data(r1);
   const y=60+row*(H+34);sc.fillStyle='#e6eef2';sc.font='16px sans-serif';sc.fillText(label+'  →  '+blendStyleNames[s2.bbStyle]+' blend',20,y+14);sc.fillStyle='#fff';sc.fillRect(20,y+22,W,H);sc.drawImage(r1,20,y+22);sc.fillRect(40+W,y+22,W,H);sc.drawImage(r2,40+W,y+22);row++;
   rows.push({id,style:s2.bbStyle,version:s2.brushBlendVersion,ms:+ms.toFixed(1),v1:{...metrics(before,a1),gaps:gaps(before,a1,s1)},v2:{...metrics(before,a2),gaps:gaps(before,a2,s2)},hash:hashOf(a2)});
  }
  // settings take effect (v2, watercolor and dry)
  const settingRows=[];for(const id of ['water-wet','dry-paint','paint']){const base=scene(),ref=data(reload(strokeFor(id,2),base));
   for(const [k,v] of [['bbAmount',.3],['bbPickup',1],['bbWetness',1],['bbMix',0],['bbFlow',.2],['bbStretch',0],['bbPaintLoad',.5],['bbPressure',false],['bbProtectAlpha',true]]){const r=data(reload(strokeFor(id,2,{[k]:v}),base));let diff=0;for(let i=0;i<r.length;i++)if(r[i]!==ref[i])diff++;settingRows.push({id,k,v,diff});}}
  // protect transparency (v2): no fully transparent pixel gains alpha
  let protectedGain=0;{const base=scene(),b=data(base),a=data(reload(strokeFor('water-wet',2,{bbProtectAlpha:true}),base));for(let i=3;i<a.length;i+=4)if(b[i]===0&&a[i]!==0)protectedGain++;}
  // real worker parity for every family
  const workerRows=[];let waiting;const worker=new LiveBlendWorker(()=>{waiting?.();waiting=undefined;});
  for(const [id] of families){const s=strokeFor(id,2,{},{id:'w-'+id}),base=scene();
   try{for(const n of [1,12,45,46,100,170,170])await Promise.race([new Promise(r=>{waiting=r;worker.preview({...s,points:s.points.slice(0,n)},base,{n});}),new Promise((_,rej)=>setTimeout(()=>rej(Error('no preview')),8000))]);
    const pending=worker.finish(s);if(!pending)throw Error('worker unavailable');const live=await pending.done;
    const a=data(reload(s,base)),b=live.getContext('2d').getImageData(0,0,W,H).data;let diff=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])diff++;workerRows.push({id,diff});
   }catch(e){workerRows.push({id,error:String(e)});}finally{worker.cancel();}}
  worker.dispose();
  return {rows,settingRows,protectedGain,workerRows,sheet:sheet.toDataURL()};
 });
 fs.writeFileSync(path.join(out,'families-sheet.png'),Buffer.from(result.sheet.split(',')[1],'base64'));delete result.sheet;
 result.errors=errors;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,1));
 for(const r of result.rows)console.log(r.id.padEnd(16),r.style.padEnd(8),'v1',JSON.stringify(r.v1),'\n'.padEnd(27),'v2',JSON.stringify(r.v2),r.ms+'ms');
 console.log(JSON.stringify({settings:result.settingRows.filter(r=>r.diff<=500),protectedGain:result.protectedGain,worker:result.workerRows.filter(r=>r.diff||r.error),errors}));
 const by=id=>result.rows.find(r=>r.id===id);
 for(const r of result.rows){assert.equal(r.version,2,r.id);assert(r.v2.changed>2500,r.id+' blends');assert.equal(r.v2.green,0,r.id+' adds no colour');assert.equal(r.v2.alphaDrop,0,r.id+' no halos (alpha never drops)');}
 assert.equal(new Set(result.rows.filter(r=>!['water-flat','color-soft','technical','color-solid','dry'].includes(r.id)).map(r=>r.style)).size,9,'nine family styles');
 assert.equal(new Set(result.rows.map(r=>r.hash)).size,result.rows.length,'every brush blends differently');
 // family character
 for(const id of ['water-wet','water-rough','water-flat'])assert.equal(by(id).style,'water',id);
 for(const id of ['dry-paint','dry-ink-bristle','dry'])assert.equal(by(id).style,'dry',id);
 for(const id of ['dry-paint','dry-ink-bristle'])assert(by(id).v2.gaps>.12&&by(id).v2.gaps>by('paint').v2.gaps+.08,id+' dry blend is broken / scratchy');
 assert(by('dry-paint').v2.hf>by('paint').v2.hf*1.5&&by('dry-paint').v2.hf>by('color-air').v2.hf,'dry is rougher than oil and airbrush');
 assert(by('hb').v2.hf>by('color-soft').v2.hf,'pencil has grain');
 for(const id of ['water-wet','water-rough'])assert(by(id).v2.changed>by('color-soft').v2.changed*1.4&&by(id).v2.gaps<.06,id+' watercolor bleeds wide as one continuous wet wash');
 assert(by('color-air').v2.hf<by('dry-paint').v2.hf&&by('color-air').v2.changed>12000,'airbrush blends wide and smooth');
 for(const r of result.settingRows)assert(r.diff>500,r.id+' '+r.k+' changes the blend');
 assert.equal(result.protectedGain,0,'protect transparency');
 for(const r of result.workerRows){assert(!r.error,r.id+': '+r.error);assert.equal(r.diff,0,r.id+' worker live == final');}
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS brush-blend-v242-browser');
}catch(e){failed=true;console.error(e);}finally{await browser.close();await server.close();}
process.exitCode=failed?1:0;
