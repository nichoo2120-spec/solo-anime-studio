// v0.5.241 in the real app: Tip shape, Dual brush, My brushes (create, rename,
// duplicate, delete), real strokes, persistence after reload, screenshots.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createServer} from 'vite';import {chromium} from '@playwright/test';
const port=5843,server=await createServer({logLevel:'error',cacheDir:'/tmp/solo-shape-v241-ui-vite',server:{host:'127.0.0.1',port,strictPort:true}});let browser,failed=false;
try{await server.listen();browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(process.platform==='win32'?undefined:'/usr/bin/google-chrome'),args:['--disable-gpu','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(`http://127.0.0.1:${port}`);await page.getByLabel('Drawing canvas',{exact:true}).waitFor();await page.waitForTimeout(800);
 await page.getByLabel('Brush category',{exact:true}).selectOption('Paint');await page.getByLabel('Brush family',{exact:true}).selectOption('all').catch(()=>{});await page.getByLabel('Brush preset',{exact:true}).selectOption('paint');
 const drawing=page.getByLabel('Drawing canvas',{exact:true}),box=await drawing.boundingBox();
 const pixels=()=>drawing.evaluate(c=>{const t=document.createElement('canvas');t.width=c.width;t.height=c.height;const x=t.getContext('2d');x.drawImage(c,0,0);return Array.from(x.getImageData(0,0,c.width,c.height).data);});
 const changed=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++;return n;};
 const drag=async(x0,y0,x1,y1)=>{await page.mouse.move(box.x+x0,box.y+y0);await page.mouse.down();await page.mouse.move(box.x+x1,box.y+y1,{steps:40});await page.mouse.up();await page.waitForTimeout(900);};
 const exact=async(name,value)=>{const f=page.getByLabel(name+' exact value',{exact:true});await f.fill(String(value));await f.press('Enter');};
 await page.getByRole('button',{name:'Brush Settings',exact:true}).click();const nav=name=>page.getByRole('navigation',{name:'Brush settings sections'}).getByRole('button',{name,exact:true}).click();
 const panel=page.getByRole('region',{name:'Brush Settings'});
 // Tip shape
 await nav('Tip shape');await panel.getByLabel('Custom tip shape',{exact:true}).check();await exact('Tip roundness (shape)',25);await exact('Tip angle (shape)',45);await exact('Scale X',200);await panel.getByLabel('Angle follows stroke direction',{exact:true}).check();
 const preview=await panel.getByLabel('Live tip preview',{exact:true}).evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>10)n++;return n;});
 fs.mkdirSync('validation/brush-shape-v241',{recursive:true});await page.screenshot({path:'validation/brush-shape-v241/tip-shape-panel.png'});
 const cx=box.width/2,cy=box.height/2;let before=await pixels();await drag(cx-300,cy-120,cx+300,cy-60);let after=await pixels();const shapeChanged=changed(before,after);
 // Dual brush + save as a new brush
 await nav('Dual brush');await panel.getByLabel('Use dual brush',{exact:true}).check();await panel.getByLabel('Second brush',{exact:true}).selectOption('dry');await panel.getByLabel('Dual brush mode',{exact:true}).selectOption('subtract');await exact('Scatter',80);
 await page.screenshot({path:'validation/brush-shape-v241/dual-brush-panel.png'});
 before=await pixels();await drag(cx-300,cy,cx+300,cy+40);after=await pixels();const dualChanged=changed(before,after);
 await panel.getByLabel('New merged brush name',{exact:true}).fill('Rough flat');await panel.getByRole('button',{name:'Save as new brush',exact:true}).click();await page.waitForTimeout(200);
 // My brushes
 await nav('My brushes');const list=panel.getByRole('list',{name:'Custom brushes'});
 assert.equal(await list.getByRole('button',{name:'★ Rough flat',exact:true}).count(),1,'merged brush saved');
 await panel.getByLabel('Custom brush name',{exact:true}).fill('Plain round');await panel.getByRole('button',{name:'New from scratch',exact:true}).click();await page.waitForTimeout(150);
 await panel.getByRole('button',{name:'Rename Plain round',exact:true}).click();await panel.getByLabel('Rename Plain round',{exact:true}).fill('Round 2');await panel.getByRole('button',{name:'Save',exact:true}).click();
 await panel.getByRole('button',{name:'Duplicate Round 2',exact:true}).click();await page.waitForTimeout(150);
 assert.equal(await list.getByRole('button',{name:'★ Round 2 copy',exact:true}).count(),1,'duplicate');
 await panel.getByRole('button',{name:'Delete Round 2 copy',exact:true}).click();await panel.getByRole('button',{name:'Delete Round 2 copy',exact:true}).click();await page.waitForTimeout(150);
 assert.equal(await list.getByRole('button',{name:'★ Round 2 copy',exact:true}).count(),0,'deleted');
 await page.screenshot({path:'validation/brush-shape-v241/my-brushes-panel.png'});
 const names=await list.getByRole('button').allTextContents();
 // Stock brushes have no rename/delete
 assert.equal(await panel.getByRole('button',{name:/^(Rename|Delete) Simple Paint Brush$/}).count(),0);
 await panel.getByRole('button',{name:'Done',exact:true}).click().catch(()=>page.keyboard.press('Escape'));
 // Custom brushes appear in the picker
 const options=await page.getByLabel('Brush preset',{exact:true}).locator('option').allTextContents();
 await page.waitForTimeout(400);await page.reload();await page.getByLabel('Drawing canvas',{exact:true}).waitFor();await page.waitForTimeout(800);
 const after2=await page.getByLabel('Brush preset',{exact:true}).locator('option').allTextContents();
 const result={preview,shapeChanged,dualChanged,names,options:options.filter(o=>/Rough|Round 2/.test(o)),afterReload:after2.filter(o=>/Rough|Round 2/.test(o)),errors};console.log(JSON.stringify(result));
 assert(preview>200,'tip preview drawn');assert(shapeChanged>500,'shaped stroke drew');assert(dualChanged>300,'dual stroke drew');
 assert.equal(result.afterReload.length,2,'custom brushes persist after reload');assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS brush-shape-v241-ui');
}catch(e){failed=true;console.error(e);}finally{await browser?.close();await server.close();}
process.exitCode=failed?1:0;
