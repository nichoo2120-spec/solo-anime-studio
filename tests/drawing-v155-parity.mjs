import {createServer} from 'vite';import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:5552,strictPort:true}});await server.listen();const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try{
 const rows=[];
 for(const dpr of [1,2]){
  const page=await browser.newPage({viewport:{width:1200,height:850},deviceScaleFactor:dpr});await page.goto('http://127.0.0.1:5552/tests/drawing-v155.html');await page.waitForFunction(()=>window.DRAWING_TEST);
  const cases=[['hb',45,{}],['technical',45,{}],['g-pen',60,{blends:true}],['dry-ink-bristle',90,{}],['dry-paint',70,{blends:true}],['color-solid',70,{}],['smudge-bristle',30,{blends:true}],['blender-soft',30,{}],['wet-mix',60,{}],['eraser-hard',65,{}],['eraser-soft',65,{blends:true}],['color-solid',35,{edge:true}],['g-pen',50,{zoom:2}],['g-pen',5,{zoom:8,panX:-780,panY:-800,x0:110,y0:120,length:70,amplitude:10}],['dry-ink-bristle',60,{rotation:.18,edge:true}],['color-solid',40,{mirror:true,axis:'vertical'}],['color-solid',40,{mirror:true,axis:'horizontal'}],['color-solid',45,{bottom:true}],['hb',35,{resize:[820,580]}]];
  for(const [index,[preset,size,options]]of cases.entries()){
   const row=await page.evaluate(async({preset,size,options,id})=>{const h=window.DRAWING_TEST;await h.scene(id,options);h.brush(preset,size);await h.ready();return h.draw(id,48,options);},{preset,size,options,id:'display-parity-'+index});
   const {png,...result}=row;const item={dpr,preset,size,options,...result};rows.push(item);fs.writeFileSync('validation/v155-display-parity.json',JSON.stringify(rows,null,2));
   const max=Math.max(...row.diffs.map(r=>r.max)),changed=Math.max(...row.diffs.map(r=>r.changed));console.log(JSON.stringify({dpr,preset,max,changed,maxBytes:row.maxBytes}));
   if(max>1||row.diffs.some(r=>r.changed/r.pixels>.001)){fs.writeFileSync(`validation/v155-parity-failure-${preset}-${dpr}.png`,Buffer.from(png.split(',')[1],'base64'));assert.fail('Display differs from synchronous full redraw: '+JSON.stringify(item));}
   assert(row.operations>=282,'test did not capture a drawing stroke');assert(row.maxBytes<=64*1024*1024,'display cache exceeded 64MiB');
  }await page.close();
 }
 console.log(rows.length+' live display cases vs forced full redraw PASS.');
}finally{await browser.close();await server.close();}
