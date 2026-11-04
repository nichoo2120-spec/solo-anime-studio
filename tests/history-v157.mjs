// Functional history checks. This is not the unavailable sas_b15 performance harness.
import {createServer} from 'vite';import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:5571,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-gpu']});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5571/exp/h.html');await page.waitForFunction(()=>window.H);
 const report=await page.evaluate(async()=>{
  const {LayerRenderer}=await import('/src/engine/renderer.ts'),{newProject,newLayer}=await import('/src/core/model.ts'),{stockPresets}=await import('/src/core/brushes.ts'),{brushStrokeMetadata,watercolorSeedFor}=await import('/src/core/paintTips.ts');
  const hash=async c=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',c.getContext('2d').getImageData(0,0,c.width,c.height).data))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const make=(id,n,size)=>{const settings={...stockPresets.find(p=>p.id===id).settings,size},seed=watercolorSeedFor(id+'-'+n);return{...settings,...brushStrokeMetadata(settings),id:id+'-'+n,kind:'stroke',tool:id==='eraser-hard'?'eraser':'brush',color:n%2?'#25436c':'#c05f49',opacity:.73,pressure:true,response:1,stabilization:0,smoothness:18,captureZoom:1,colorSeed:seed,dryBristleSeed:seed,points:Array.from({length:35},(_,i)=>({x:120+i*45,y:330+(n%4)*70+95*Math.sin(i/34*Math.PI*2),p:.2+.8*Math.sin(i/34*Math.PI)**2,v:.65}))};};
  const cases=[];
  for(const id of ['dry-ink-bristle','dry-paint','hb','color-solid','smudge-bristle','color-blender','eraser-hard']){
   const p=newProject('large history',1920,1080),l={...newLayer('Paint'),id:'paint',operations:[]},r=new LayerRenderer();p.layers=[l];p.activeLayerId=l.id;const get=ops=>r.get({...l,operations:ops},p),base=make('color-solid',999,150),initial=[base];get(initial);const s=make(id,1,150),ops=[...initial,s],after=get(ops),afterHash=await hash(after),stats=r.cacheStats(),beforeHash=await hash(get(initial)),undoStats=r.cacheStats(),redoHash=await hash(get(ops)),redoStats=r.cacheStats();
   const cold=new LayerRenderer(),coldAfter=await hash(cold.get({...l,operations:ops},p)),coldBefore=await hash(cold.get({...l,operations:initial},p));cases.push({id,afterHash,coldAfter,beforeHash,coldBefore,redoHash,stats,undoStats,redoStats});r.clear();cold.clear();
  }
  const p=newProject('twenty history',1000,500),l={...newLayer('Paint'),id:'twenty',operations:[]},r=new LayerRenderer(),operations=[],hashes=[await hash(r.get(l,p))];p.layers=[l];
  for(let n=0;n<20;n++){const s=make(['color-solid','dry-ink-bristle','hb','dry-paint'][n%4],n,150);s.points=s.points.map(q=>({...q,x:q.x*.5,y:q.y*.5}));operations.push(s);hashes.push(await hash(r.get({...l,operations:[...operations]},p)));}
  const checks=[];for(let n=19;n>=0;n--)checks.push({direction:'undo',n,expected:hashes[n],actual:await hash(r.get({...l,operations:operations.slice(0,n)},p))});for(let n=1;n<=20;n++)checks.push({direction:'redo',n,expected:hashes[n],actual:await hash(r.get({...l,operations:operations.slice(0,n)},p))});
  const historyStats=r.cacheStats();r.clear();return{cases,checks,historyStats};
 });
 fs.writeFileSync('validation/v157-history.json',JSON.stringify(report,null,2));for(const c of report.cases){assert.equal(c.afterHash,c.coldAfter,c.id+' append');assert.equal(c.beforeHash,c.coldBefore,c.id+' undo');assert.equal(c.redoHash,c.afterHash,c.id+' redo');assert.equal(c.undoStats.undoHits,1,c.id+' undo did not blit');assert.equal(c.redoStats.redoHits,1,c.id+' redo did not blit');assert(c.redoStats.totalBytes<=c.redoStats.budget);}
 for(const c of report.checks)assert.equal(c.actual,c.expected,JSON.stringify(c));assert.equal(report.historyStats.undoHits,20);assert.equal(report.historyStats.redoHits,20);console.log('Seven large-stroke tiled undo/redo cases and 20 undos + 20 redos: exact canonical RGBA hashes PASS.');
}finally{await browser.close();await server.close();}
