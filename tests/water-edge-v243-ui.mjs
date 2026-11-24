// v0.5.243 real app (owner pt88u): watercolor painting (Wet Mix / smooth),
// Blend mode watercolor, Silk Wet — no dark wet border on new strokes; only the
// stock "Watercolor Edge" brush keeps it (Edge darkness slider in Brush Settings).
// OUT=before|after picks the screenshot name; run on the old tree for "before".
import fs from 'node:fs';import {createServer} from 'vite';import {chromium} from '@playwright/test';
const port=+(process.env.PORT??5845),tag=process.env.OUT??'after',out=process.env.OUTDIR??'validation/water-edge-v243';
const server=await createServer({logLevel:'error',cacheDir:'/tmp/solo-edge-v243-ui-vite-'+port,server:{host:'127.0.0.1',port,strictPort:true}});let browser,failed=false;
try{await server.listen();browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/google-chrome',args:['--disable-gpu','--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1700,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(`http://127.0.0.1:${port}`);await page.getByLabel('Drawing canvas',{exact:true}).waitFor();await page.waitForTimeout(800);
 const drawing=page.getByLabel('Drawing canvas',{exact:true}),box=await drawing.boundingBox();
 const sel=async(n,v)=>{await page.getByLabel(n,{exact:true}).selectOption(v);};
 const tab=async n=>{const b=page.getByRole('button',{name:n,exact:true}).first();if(await b.count())await b.click();else await page.getByLabel(n,{exact:true}).first().click();await page.waitForTimeout(150);};
 const color=async hex=>{await tab('COLOR');const f=page.getByLabel('Hex color',{exact:true}).first();await f.fill(hex);await f.press('Enter');await tab('INSPECTOR');};
 const size=async v=>{const f=page.getByLabel('Size exact value',{exact:true}).first();await f.fill(String(v));await f.press('Enter');};
 const choose=async id=>{await page.getByLabel('Brush (B)',{exact:true}).first().click().catch(()=>{});await sel('Brush category','Paint');await sel('Brush family','all').catch(()=>{});await sel('Brush preset',id);};
 const blendGroup=()=>page.getByRole('group',{name:'Paint or Blend'}).first();
 const setBlend=async on=>{const b=blendGroup().getByRole('button',{name:on?'Blend':'Paint',exact:true});if(await b.count()&&await b.getAttribute('aria-pressed')!=='true'){await b.click();await page.waitForTimeout(150);}};
 const drag=async(pts)=>{await page.mouse.move(box.x+pts[0][0],box.y+pts[0][1]);await page.mouse.down();for(const [x,y] of pts.slice(1))await page.mouse.move(box.x+x,box.y+y,{steps:3});await page.mouse.up();await page.waitForTimeout(800);};
 const line=(x0,y0,x1,y1,n=30)=>Array.from({length:n+1},(_,i)=>[x0+(x1-x0)*i/n,y0+(y1-y0)*i/n]);
 const wave=(x0,x1,y,amp,n=50)=>Array.from({length:n+1},(_,i)=>{const t=i/n;return [x0+(x1-x0)*t,y+amp*Math.sin(t*Math.PI*3)];});
 const W=box.width,top=box.height*.12,L=W*.05,R=W*.95,mid=(L+R)/2;
 // colour bands on the left half (for Blend / Silk), white paper on the right half
 await choose('color-solid');await size(70);
 await color('#d8283c');for(let k=0;k<4;k++)await drag(line(L,top+30+k*20,mid,top+30+k*20));
 await color('#1f5bd8');for(let k=0;k<4;k++)await drag(line(L,top+110+k*20,mid,top+110+k*20));
 await color('#f2c230');for(let k=0;k<4;k++)await drag(line(L,top+190+k*20,mid,top+190+k*20));
 const has=[];
 // Blend mode watercolor (J) and Silk Wet over the bands
 await choose('water-wet');await size(40);await setBlend(true);await drag(wave(L+20,mid-20,top+70,35));
 await choose('water-rough');await size(40);await setBlend(true);await drag(wave(L+20,mid-20,top+150,35));
 if(await page.getByLabel('Silk Blend (B B)',{exact:true}).count()){await page.getByLabel('Silk Blend (B B)',{exact:true}).first().click();await sel('Silk Blend mode','wet');await size(40);await drag(wave(L+20,mid-20,top+225,22));}
 // watercolor painting on white paper (blue), overlapping strokes
 for(const [k,id] of ['water-wet','water-smooth','water-rough','water-flat'].entries()){await choose(id);await setBlend(false);await size(46);await color('#2a62c9');await drag(wave(mid+30,R-30,top+40+k*62,22));}
 await choose('water-wet');await setBlend(false);await size(46);await color('#c93a6a');await drag(line(mid+60,top+10,mid+160,top+260,40));
 // straight test strokes on white for the rim measurement (rows at top+360 / top+410)
 for(const [k,id] of ['water-wet','water-smooth'].entries()){await choose(id);await setBlend(false);await size(46);await color('#2a62c9');await drag(line(mid+30,top+360+k*50,R-30,top+360+k*50,40));}
 // the one brush that keeps the edge
 const edgeBrush=await page.getByLabel('Brush preset',{exact:true}).locator('option[value="water-edge"]').count();
 if(edgeBrush){await choose('water-edge');await setBlend(false);await size(46);await color('#2a62c9');await drag(wave(mid+30,R-30,top+300,18));has.push('water-edge');}
 await page.mouse.move(box.x+2,box.y+2);await page.waitForTimeout(1500);
 fs.mkdirSync(out,{recursive:true});
 const clip={x:box.x+L-6,y:box.y+top-10,width:R-L+12,height:450};
 await page.screenshot({path:`${out}/app-${tag}.png`,clip});
 // Edge darkness slider (Brush Settings) on the Watercolor Edge brush
 let slider=null;if(edgeBrush){const bs=page.getByRole('button',{name:'Brush Settings',exact:true}).first();if(await bs.count()){await bs.click();await page.waitForTimeout(300);
  const f=page.getByLabel('Edge darkness exact value',{exact:true}).first();if(await f.count())slider=await f.inputValue();
  await page.screenshot({path:`${out}/edge-slider-${tag}.png`});}}
 const res={tag,has,slider,errors};fs.writeFileSync(`${out}/app-${tag}.json`,JSON.stringify(res,null,1));console.log(JSON.stringify(res));
 if(errors.length)failed=true;
 if(process.env.ASSERT&&(!edgeBrush||slider!=='100'))failed=true;
}catch(e){failed=true;console.error(e);}finally{await browser?.close();await server.close();}
process.exit(failed?1:0);
