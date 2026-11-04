// Frozen expected bytes were captured from the independently extracted v146/v147
// renderers. This check runs from the delivered project without sibling sources.
import {createServer} from '../node_modules/vite/dist/node/index.js';
import {chromium} from '../node_modules/playwright/index.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/dry-v148-compatibility-goldens.json','utf8'));
const server=await createServer({root:process.cwd(),server:{host:'127.0.0.1',port:5516,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5516');
 const result=await page.evaluate(async f=>{
  const {drawStroke}=await import('/src/engine/renderer.ts'),{compositePaintStroke}=await import('/src/engine/paintCompositing.ts');
  const make=()=>{const c=document.createElement('canvas');c.width=f.width;c.height=f.height;return c;},sha=async c=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',c.getContext('2d').getImageData(0,0,f.width,f.height).data))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const oldV146=[],savedV147=[];
  for(const row of f.oldV146){const c=make();drawStroke(c.getContext('2d'),row.stroke);const rawActual=await sha(c),out=make(),cx=out.getContext('2d');cx.fillStyle=row.paper;cx.fillRect(0,0,f.width,f.height);if(row.base){cx.fillStyle='#e02a32';cx.fillRect(0,0,f.width/2,f.height);cx.fillStyle='#2859d7';cx.fillRect(f.width/2,0,f.width/2,f.height);}compositePaintStroke(cx,c,row.stroke);const actual=await sha(out);oldV146.push({preset:row.preset,shape:row.shape,size:row.size,rawActual,expected:row.expected,actual,exact:rawActual===row.rawExpected&&actual===row.expected});}
  for(const row of f.savedV147){const c=make();drawStroke(c.getContext('2d'),row.stroke);const actual=await sha(c);savedV147.push({preset:row.preset,size:row.size,shape:row.shape,expected:row.expected,actual,exact:actual===row.expected});}
  return{oldV146,savedV147};
 },fixture);
 fs.writeFileSync('validation/v148-frozen-goldens.json',JSON.stringify(result,null,2));assert.equal(result.oldV146.length,520);assert(result.oldV146.every(r=>r.exact));assert.equal(result.savedV147.length,12);assert(result.savedV147.every(r=>r.exact));console.log('Frozen compatibility: 520/520 old-brush and 12/12 saved v147 strokes PASS.');
}finally{await browser.close();await server.close();}
