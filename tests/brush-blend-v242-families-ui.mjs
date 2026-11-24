// v0.5.242 real app: every stock brush family in Blend mode (J) blending across
// two painted colours. Writes a labelled screenshot of the whole canvas plus
// per-brush crops (OUT env var picks the file name: before / after).
import fs from 'node:fs';import {createServer} from 'vite';import {chromium} from '@playwright/test';
const port=+(process.env.PORT??5844),tag=process.env.OUT??'after',out='validation/brush-blend-v242';
const server=await createServer({logLevel:'error',cacheDir:'/tmp/solo-blend-v242-ui-vite',server:{host:'127.0.0.1',port,strictPort:true}});let browser,failed=false;
export const FAMILIES=[['water-wet','Soft Wet Watercolor'],['water-rough','Rough Watercolor'],['dry-paint','Dry Paint Brush'],['dry-ink-bristle','Dry Ink Brush'],['hb','HB Pencil'],['2b','2B Pencil'],['g-pen','G-Pen'],['brush-pen','Brush Pen'],['color-air','Airbrush'],['paint','Simple Paint (oil)'],['flat','Flat Brush'],['marker','Soft Marker'],['color-texture','Textured Paint'],['color-soft','Soft Paint']];
try{await server.listen();browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/google-chrome',args:['--disable-gpu','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1700,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(`http://127.0.0.1:${port}`);await page.getByLabel('Drawing canvas',{exact:true}).waitFor();await page.waitForTimeout(800);
 const drawing=page.getByLabel('Drawing canvas',{exact:true}),box=await drawing.boundingBox();
 const sel=async(n,v)=>{await page.getByLabel(n,{exact:true}).selectOption(v);};
 const tab=async n=>{const b=page.getByRole('button',{name:n,exact:true}).first();if(await b.count())await b.click();else await page.getByLabel(n,{exact:true}).first().click();await page.waitForTimeout(150);};
 const color=async hex=>{await tab('COLOR');const f=page.getByLabel('Hex color',{exact:true}).first();await f.fill(hex);await f.press('Enter');await tab('INSPECTOR');};
 const size=async v=>{const f=page.getByLabel('Size exact value',{exact:true}).first();await f.fill(String(v));await f.press('Enter');};
 const choose=async id=>{await page.getByLabel('Brush (B)',{exact:true}).first().click().catch(()=>{});await sel('Brush category',id==='hb'||id==='2b'?'Pencil':id==='g-pen'||id==='brush-pen'?'Ink':'Paint');await sel('Brush family','all').catch(()=>{});await sel('Brush preset',id);};
 const drag=async(pts)=>{await page.mouse.move(box.x+pts[0][0],box.y+pts[0][1]);await page.mouse.down();for(const [x,y] of pts.slice(1))await page.mouse.move(box.x+x,box.y+y,{steps:3});await page.mouse.up();await page.waitForTimeout(700);};
 const line=(x0,y0,x1,y1,n=40)=>Array.from({length:n+1},(_,i)=>[x0+(x1-x0)*i/n,y0+(y1-y0)*i/n]);
 // two colour bands
 await choose('color-solid');await size(70);await color('#d8283c');
 const top=box.height*.18,colW=box.width*.9/FAMILIES.length,left=box.width*.05;
 for(let k=0;k<3;k++)await drag(line(left,top+40+k*18,left+box.width*.9,top+40+k*18,30));
 await color('#1f5bd8');for(let k=0;k<3;k++)await drag(line(left,top+100+k*18,left+box.width*.9,top+100+k*18,30));
 await color('#f2c230');for(let k=0;k<2;k++)await drag(line(left,top+160+k*18,left+box.width*.9,top+160+k*18,30));
 // each brush blends with a zig-zag down across the bands
 const states=[],only=process.env.ONLY?.split(',');
 for(const [i,[id]] of FAMILIES.entries()){if(only&&!only.includes(id))continue;
  await choose(id);await size(24);
  const blend=page.getByRole('group',{name:'Paint or Blend'}).first().getByRole('button',{name:'Blend',exact:true});
  if(await blend.getAttribute('aria-pressed')!=='true'){await page.mouse.move(box.x+5,box.y+5);await page.keyboard.press('j');await page.waitForTimeout(150);}
  if(await blend.getAttribute('aria-pressed')!=='true'){await blend.click();await page.waitForTimeout(150);}
  states.push([id,await blend.getAttribute('aria-pressed')]);
  const x=left+colW*(i+.5),pts=[];for(let s=0;s<=60;s++){const t=s/60;pts.push([x+Math.sin(t*Math.PI*6)*colW*.28,top+10+t*200]);}
  await drag(pts);
 }
 await page.mouse.move(box.x+2,box.y+2);await page.waitForTimeout(1500);
 fs.mkdirSync(out,{recursive:true});
 const clip={x:box.x+left-4,y:box.y+top-10,width:box.width*.9+8,height:240};
 await page.screenshot({path:`${out}/families-${tag}.png`,clip});
 fs.writeFileSync(`${out}/families-${tag}.json`,JSON.stringify({families:FAMILIES,colW,clip,states,errors},null,1));
 console.log(JSON.stringify({tag,states,errors}));if(errors.length)failed=true;
}catch(e){failed=true;console.error(e);}finally{await browser?.close();await server.close();}
process.exit(failed?1:0);
