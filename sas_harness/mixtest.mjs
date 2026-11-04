import {chromium} from '/workspace/sas_work/node_modules/playwright-core/index.mjs';import fs from 'fs';
const sel=(pg,l,v)=>pg.getByLabel(l,{exact:true}).selectOption(v);
async function field(pg,n,v){const i=pg.getByLabel(n+' exact value',{exact:true});await i.fill(String(v));await i.press('Enter');}
const BR=(process.argv[2]||'dry-ink-bristle').split(',');const AM=[0,25,50,75,100];
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-gpu']});
const res={};
async function color(pg,hex){await pg.getByRole('button',{name:/^color$/i}).first().click().catch(e=>console.log('tab',e.message.slice(0,60)));const i=pg.getByLabel('Hex color',{exact:true});await i.fill(hex);await i.press('Enter');await i.blur();await pg.getByRole('button',{name:/^inspector$/i}).first().click().catch(e=>console.log('tab2',e.message.slice(0,60)));}
async function pick(pg,id){await pg.keyboard.press('b');await sel(pg,'Brush category','Paint');try{await sel(pg,'Brush family','all')}catch{};await sel(pg,'Brush preset',id);}
async function line(pg,x0,y0,x1,y1,n=40){await pg.mouse.move(x0,y0);await pg.mouse.down();for(let i=1;i<=n;i++){await pg.mouse.move(x0+(x1-x0)*i/n,y0+(y1-y0)*i/n);}await pg.mouse.up();await pg.waitForTimeout(250);}
for(const id of BR){
 const ctx=await b.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});const pg=await ctx.newPage();
 await pg.goto('http://127.0.0.1:6161/');await pg.waitForTimeout(2500);
 const c={x:296,y:232,width:640,height:354};
 // stripes with solid paint
 await pick(pg,'color-solid');await field(pg,'Size',60);await field(pg,'Opacity',100);
 const cols=['#e63946','#ffd60a','#1d4ed8','#2a9d8f','#111111'];const X0=c.x+c.width*0.30,X1=c.x+c.width*0.80;
 for(let k=0;k<cols.length;k++){await color(pg,cols[k]);await pick(pg,'color-solid');const x=X0+(X1-X0)*(k+.5)/cols.length;for(const dx of [-14,0,14])await line(pg,x+dx,c.y+c.height*0.08,x+dx,c.y+c.height*0.92,20);}
 await pg.screenshot({path:`img/dbg_stripes_${id}.png`});await pick(pg,id);await color(pg,'#f4f1ea');await field(pg,'Size',45);
 await pg.waitForTimeout(500);await pg.screenshot({path:`img/dbg_panel_${id}.png`});const info={};const mc=pg.getByLabel('Mix canvas colors',{exact:true});info.hasMixCheckbox=await mc.count()>0;
 for(let a=0;a<AM.length;a++){
  if(info.hasMixCheckbox){if(!await mc.isChecked())await mc.check();await field(pg,'Color mixing',AM[a]);}
  const y=c.y+c.height*(0.14+0.18*a);await line(pg,c.x+c.width*0.22,y,c.x+c.width*0.88,y,50);
 }
 await pg.mouse.move(5,5);await pg.waitForTimeout(800);
 await pg.screenshot({path:`img/mix_${id}.png`,clip:{x:c.x,y:c.y,width:c.width,height:c.height}});
 res[id]=info;console.log(id,JSON.stringify(info));await ctx.close();
}
fs.writeFileSync('mix_info.json',JSON.stringify(res,null,1));await b.close();
