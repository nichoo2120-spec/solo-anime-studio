// v0.5.243 (owner pt88u): no dark wet edge (tide line / pool bank) on new
// strokes of watercolor brushes, Silk Wet and Blend mode; the effect stays only
// on the stock "Watercolor Edge" brush (Edge darkness slider). Old strokes
// (no edgeDarkness field) render exactly as before.
// Measures a rim score per brush on a straight stroke: positive = darker band
// at the edge than in the middle. Writes old-vs-new sheets.
import {createServer} from 'vite';import {chromium} from '@playwright/test';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve('.'),out=path.join(root,'validation','water-edge-v243');fs.mkdirSync(out,{recursive:true});
const port=5848,server=await createServer({root,logLevel:'error',cacheDir:'/tmp/solo-edge-v243-vite',server:{host:'127.0.0.1',port,strictPort:true}});
server.middlewares.use('/__edgeqa',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Edge QA</title>');});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(process.platform==='win32'?undefined:'/usr/bin/google-chrome'),headless:true,args:['--no-sandbox','--disable-gpu']});
let failed=false;
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}/__edgeqa`);if(process.env.PR)await page.evaluate(v=>{globalThis.__PR=v;},process.env.PR);
 const result=await page.evaluate(async(tag)=>{
  const {stockPresets}=await import('/src/core/brushes.ts');const {brushStrokeMetadata}=await import('/src/core/paintTips.ts');
  const {compositePaintStroke}=await import('/src/engine/paintCompositing.ts');const {drawStroke}=await import('/src/engine/renderer.ts');
  const W=560,H=200,make=(w=W,h=H)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const bg=kind=>{const c=make(),x=c.getContext('2d');if(kind==='white'){x.fillStyle='#ffffff';x.fillRect(0,0,W,H);}else if(kind==='red'){x.fillStyle='#d8283c';x.fillRect(0,0,W,H);}else{x.fillStyle='#d8283c';x.fillRect(0,0,W/2,H);x.fillStyle='#1f5bd8';x.fillRect(W/2,0,W/2,H);}return c;};
  const PR=+(globalThis.__PR??.85);const line=(n=120)=>Array.from({length:n},(_,i)=>({x:40+i*(W-80)/(n-1),y:H/2,p:PR}));
  const wave=(n=150)=>Array.from({length:n},(_,i)=>{const t=i/(n-1);return {x:40+t*(W-80),y:H/2+50*Math.sin(t*Math.PI*3),p:.45+.5*Math.sin(Math.min(1,t*1.1)*Math.PI*.5+.4)};});
  const strokeFor=(id,mode,legacy,extra={})=>{const preset=stockPresets.find(p=>p.id===id);if(!preset)return null;const settings={...preset.settings,...(mode==='blend'?{bbEnabled:true}:{}),...(id==='silk-blend'?{silkMode:'wet',silkWetness:.7}:{})};const {bbEnabled:_e,...plain}=settings;const meta=brushStrokeMetadata(settings);
   const s={...plain,...meta,id:'edge-'+id+'-'+mode,kind:'stroke',tool:'brush',color:mode==='paint'?'#2a62c9':'#00ff00',size:mode==='paint'?70:56,opacity:plain.opacity??1,pressure:true,response:1,points:line(),...extra};
   if(legacy){delete s.edgeDarkness;}return s;};
  // paint on a transparent layer over white paper (as in the app); Blend/Silk need the colours in the layer
  const render=(s,b)=>{const res=make();const ctx=res.getContext('2d');if(b!=='white')ctx.drawImage(bg(b),0,0);const mask=make();drawStroke(mask.getContext('2d'),s);compositePaintStroke(ctx,mask,s);if(b!=='white')return res;const flat=bg('white');flat.getContext('2d').drawImage(res,0,0);return flat;};
  const lumA=c=>{const d=c.getContext('2d').getImageData(0,0,W,H).data,L=new Float32Array(W*H);for(let i=0;i<W*H;i++)L[i]=.3*d[i*4]+.59*d[i*4+1]+.11*d[i*4+2];return L;};
  // rim: per column, darkening vs background; interior = mean over the middle
  // third of the painted band, edge = max over the outer thirds.
  // rim: average darkening-vs-background profile across the stroke (columns in
  // the middle half). Interior = mean over the middle 40% of the painted band;
  // edge = max of the profile in the outer bands. halo = brighter-than-background
  // pixels just outside the stroke.
  const rim=(c,b)=>{const L=lumA(c),B=lumA(bg(b)),P=new Float32Array(H);let n=0,halo=0;
   for(let x=Math.round(W*.25);x<W*.75;x++){n++;for(let y=0;y<H;y++)P[y]+=B[y*W+x]-L[y*W+x];}
   for(let y=0;y<H;y++)P[y]/=n;const peak=Math.max(...P);if(peak<3)return {rim:null,halo:0,peak:+peak.toFixed(1)};
   let top=-1,bot=-1;for(let y=0;y<H;y++)if(P[y]>peak*.1){if(top<0)top=y;bot=y;}
   const h=bot-top,c0=top+h*.3,c1=bot-h*.3;let mid=0,mn=0,edge=-1e9;
   for(let y=top;y<=bot;y++){if(y>=c0&&y<=c1){mid+=P[y];mn++;}else edge=Math.max(edge,P[y]);}
   mid/=Math.max(1,mn);
   for(let x=Math.round(W*.25);x<W*.75;x++)for(const y of [top-3,top-2,top-1,bot+1,bot+2,bot+3])if(y>=0&&y<H&&B[y*W+x]-L[y*W+x]<-4)halo++;
   const prof=[];for(let y=top;y<=bot;y+=Math.max(1,Math.round(h/16)))prof.push(Math.round(P[y]));
   return {rim:+((edge-mid)/Math.max(4,mid)).toFixed(3),halo,peak:+peak.toFixed(1),prof:prof.join(' ')};};
  const cases=[['water-wet','paint','white'],['water-smooth','paint','white'],['water-rough','paint','white'],['water-flat','paint','white'],['water-gradient','paint','white'],['water-edge','paint','white'],
   ['water-wet','blend','red'],['water-rough','blend','red'],['water-edge','blend','red'],['silk-blend','silk','red'],
   ['soft-paint','paint','white'],['marker','paint','white'],['paint','paint','white'],['flat','paint','white'],['color-soft','paint','white'],['color-solid','paint','white'],['color-air','paint','white'],['color-texture','paint','white'],['brush-pen','paint','white'],['dry-paint','paint','white'],['dry-paint','blend','red'],['soft-paint','blend','red'],['marker','blend','red']];
  const rows=[];
  for(const [id,mode,b] of cases){const s=strokeFor(id,mode,false);if(!s){rows.push({id,mode,missing:true});continue;}const l=strokeFor(id,mode,true);
   const t0=performance.now();const cn=render(s,b);const ms=performance.now()-t0;const t1=performance.now();const co=render(l,b);const msOld=performance.now()-t1;
   rows.push({id,mode,bg:b,edgeDarkness:s.edgeDarkness,new:rim(cn,b),old:rim(co,b),ms:+ms.toFixed(1),msOld:+msOld.toFixed(1)});}
  // Sheets: "his screenshot" style — wavy blend strokes over red|blue and watercolor strokes on white, old vs new.
  const sheetCases=[['water-wet','paint','white'],['water-smooth','paint','white'],['water-rough','paint','white'],['water-flat','paint','white'],['water-gradient','paint','white'],['water-wet','blend','split'],['water-rough','blend','split'],['silk-blend','silk','split'],['soft-paint','blend','split']];
  const label=(id,mode)=>(stockPresets.find(p=>p.id===id)?.name??id)+(mode==='blend'?' — Blend (J)':mode==='silk'?' — Silk Wet':'');
  const mkSheet=(list,title,colA,colB,pick)=>{const sh=make(30+W*2+20,70+list.length*(H+34)),c=sh.getContext('2d');c.fillStyle='#1b252b';c.fillRect(0,0,sh.width,sh.height);c.fillStyle='#e6eef2';c.font='bold 19px sans-serif';c.fillText(title,16,32);c.font='15px sans-serif';c.fillText(colA,30,58);c.fillText(colB,30+W+10,58);
   list.forEach(([id,mode,b],i)=>{const y=70+i*(H+34);c.fillStyle='#cfd8dc';c.font='14px sans-serif';c.fillText(label(id,mode),30,y+16);const [A,B]=pick(id,mode,b);c.drawImage(A,30,y+22);c.drawImage(B,30+W+10,y+22);});return sh;};
  const shot=(s,b)=>s?render(s,b):make();
  const ext=(id,mode)=>({points:wave(),id:'sheet-'+id+'-'+mode});
  const s1=mkSheet(sheetCases,'v0.5.242 (left, dark wet edge) vs v0.5.243 (right, no dark edge)','v0.5.242','v0.5.243',(id,mode,b)=>[shot(strokeFor(id,mode,true,ext(id,mode)),b),shot(strokeFor(id,mode,false,ext(id,mode)),b)]);
  const edgeCases=[['water-edge','paint','white'],['water-edge','blend','split']];
  const s2=make(30+W*3+40,70+edgeCases.length*(H+34)),c2=s2.getContext('2d');c2.fillStyle='#1b252b';c2.fillRect(0,0,s2.width,s2.height);c2.fillStyle='#e6eef2';c2.font='bold 19px sans-serif';c2.fillText('Watercolor Edge brush — Edge darkness 0% / 50% / 100%',16,32);
  edgeCases.forEach(([id,mode,b],i)=>{const y=70+i*(H+34);c2.font='14px sans-serif';c2.fillStyle='#cfd8dc';c2.fillText(label(id,mode),30,y+16);[0,.5,1].forEach((e,k)=>{const s=strokeFor(id,mode,false,{...ext(id,mode),edgeDarkness:e});if(s)c2.drawImage(render(s,b),30+k*(W+10),y+22);});});
  return {rows,sheet:s1.toDataURL('image/png'),edge:s2.toDataURL('image/png')};
 });
 const tag=process.env.TAG??'guard';
 fs.writeFileSync(path.join(out,`before-after-${tag}.png`),Buffer.from(result.sheet.split(',')[1],'base64'));
 fs.writeFileSync(path.join(out,`watercolor-edge-brush-${tag}.png`),Buffer.from(result.edge.split(',')[1],'base64'));
 fs.writeFileSync(path.join(out,`results-${tag}.json`),JSON.stringify(result.rows,null,1));
 for(const r of result.rows)console.log((r.id+' '+r.mode).padEnd(22),r.missing?'missing':`edge=${r.edgeDarkness} new ${JSON.stringify(r.new)} old ${JSON.stringify(r.old)} ${r.ms}ms/${r.msOld}ms`);
 if(process.env.ASSERT){
  const by=(id,mode)=>result.rows.find(r=>r.id===id&&r.mode===mode);
  for(const r of result.rows){if(r.missing)throw Error('missing '+r.id);
   if(r.id==='water-edge'){assert(r.edgeDarkness>0,'Watercolor Edge keeps an edge');continue;}
   const wet=r.mode!=='paint'||r.id.startsWith('water-');
   if(r.mode==='paint'&&!r.id.startsWith('water-')){assert.deepEqual(r.new,r.old,r.id+' (not a wet brush) is untouched');continue;}
   if(r.mode==='paint')assert(r.new.rim===null||r.new.rim<.2&&r.new.rim<=(r.old.rim??0)+.005,`${r.id} ${r.mode}: no dark rim (${r.new.rim})`);
   else assert(r.new.rim===null||r.new.rim<.1,`${r.id} ${r.mode}: no dark rim (${r.new.rim})`);
   if(wet&&r.mode!=='paint'&&r.old.rim!==null&&r.id!=='dry-paint'&&r.id!=='soft-paint'&&r.id!=='marker')assert(r.old.rim>.5,`${r.id} ${r.mode}: old strokes keep their edge (${r.old.rim})`);
   assert(r.new.halo<=Math.max(2,r.old.halo),`${r.id} ${r.mode}: no lighter rim (${r.new.halo})`);}
  assert(by('water-edge','paint').new.rim>by('water-wet','paint').new.rim+.08,'Watercolor Edge paints a darker wet edge');assert(by('water-edge','blend').new.rim>.5,'Watercolor Edge keeps its edge in Blend mode');
  assert(errors.length===0,errors.join('\n'));
 }
 console.log('PASS water-edge-v243-browser',tag);
}catch(e){failed=true;console.error(e);}finally{await browser.close();await server.close();}
process.exit(failed?1:0);
