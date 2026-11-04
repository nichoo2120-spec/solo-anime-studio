import {chromium} from '/workspace/sas_work/node_modules/playwright-core/index.mjs';
import fs from 'fs';
export const OUT=process.env.OUT||process.cwd();
export async function harness(page='exp/h.html',port=5494){
 const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-gpu']});
 const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push('pageerror:'+e.message));pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await pg.goto(`http://127.0.0.1:${port}/${page}`);await pg.waitForFunction(()=>window.H,null,{timeout:60000});
 return {b,pg,errs,async render(opts){const r=await pg.evaluate(o=>window.H.render(o),opts);return r;}};
}
export function save(dataUrl,path){fs.writeFileSync(path,Buffer.from(dataUrl.split(',')[1],'base64'));}
