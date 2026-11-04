// Same deterministic ten identities before/after; all numeric analysis stays in metrics.py.
import {createServer} from '../node_modules/vite/dist/node/index.js';
import {chromium} from '../node_modules/playwright/index.mjs';
import fs from 'node:fs';import path from 'node:path';
const before=process.argv.includes('--baseline'),root=before?path.resolve(process.env.DRY_BASELINE_ROOT??'../baseline152/Solo_Anime_Studio_v0_5_152'):process.cwd(),out=path.resolve('test-output/v153/'+(process.env.DRY_AUDIT_TAG??(before?'before':'after')));
fs.mkdirSync(out,{recursive:true});const ids=Number(process.env.DRY_AUDIT_IDS??10),sizes=(process.env.DRY_AUDIT_SIZES??'130,70,38').split(',').map(Number);
const server=await createServer({root,server:{host:'127.0.0.1',port:5510,strictPort:true}});await server.listen();const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5510');await page.exposeFunction('saveAudit148',({name,png})=>fs.writeFileSync(path.join(out,name),Buffer.from(png.split(',')[1],'base64')));const result=await page.evaluate(async({ids,sizes})=>{
 const {LayerRenderer}=await import('/src/engine/renderer.ts'),{newProject,newLayer}=await import('/src/core/model.ts'),{fixtureStroke}=await import('/tests/dry-blend-fixtures.ts');const cases=[];
 for(const preset of ['dry-ink-bristle','dry-paint'])for(const size of sizes)for(let i=0;i<ids;i++)for(const [shape,speed]of [['straight','slow'],['straight','fast'],['sine','slow'],['sine','fast']]){
  const id='phase21-'+String(i).padStart(2,'0'),f=fixtureStroke(preset,shape,speed,'none',size,{id,dryBristleSeed:undefined}),name=[preset,i,size,shape,speed].join('_'),p=newProject('Phase 2.1 audit',1250,500),layer={...newLayer('Paint'),id:'paint',operations:[f.stroke]};p.layers=[layer];p.activeLayerId=layer.id;const r=new LayerRenderer(),start=performance.now(),c=r.get(layer,p),renderMs=performance.now()-start;
  await window.saveAudit148({name:name+'.png',png:c.toDataURL()});cases.push({name,family:'dry',preset,size,strokeId:id,index:i,shape,speed,pressure:'none',raw:name+'.png',renderMs,renderer:f.stroke.dryBristleVersion});r.clear();
 }return {width:1250,height:500,ids,sizes,cases};
 },{ids,sizes});fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(result,null,2));console.log((before?'Before':'After')+': '+result.cases.length+' real LayerRenderer cases.');}finally{await browser.close();await server.close();}
