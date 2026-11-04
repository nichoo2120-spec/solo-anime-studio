import {createServer} from '../node_modules/vite/dist/node/index.js';import {chromium} from '../node_modules/playwright/index.mjs';import fs from 'node:fs';
const out='test-output/v153/exercises';fs.mkdirSync(out,{recursive:true});
const server=await createServer({root:process.cwd(),server:{host:'127.0.0.1',port:5534,strictPort:true}});await server.listen();const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5534');await page.exposeFunction('saveDry153',r=>fs.writeFileSync(out+'/'+r.name,Buffer.from(r.png.split(',')[1],'base64')));
 const rows=await page.evaluate(async()=>{
  const {fixtureStroke}=await import('/tests/dry-blend-fixtures.ts'),{LayerRenderer}=await import('/src/engine/renderer.ts'),{newProject,newLayer}=await import('/src/core/model.ts');const rows=[];
  const save=async(name,operations,width=1250,height=500)=>{const p=newProject(name,width,height),layer={...newLayer('Paint'),id:'paint',operations};p.layers=[layer];p.activeLayerId=layer.id;const r=new LayerRenderer(),c=r.get(layer,p);await window.saveDry153({name:name+'.png',png:c.toDataURL()});rows.push({name,file:name+'.png',width,height,operations});r.clear();};
  for(const preset of ['dry-ink-bristle','dry-paint']){
   for(const size of [38,70,130])for(const pressure of ['light','heavy','bell'])for(const speed of ['slow','fast']){
    const s=fixtureStroke(preset,'sine',speed,pressure,size).stroke;s.id='exercise-'+preset+'-'+size+'-'+pressure+'-'+speed;s.points=s.points.map(p=>({...p,y:p.y+100}));await save(s.id,[s]);
   }
   for(const shape of ['circle','hook','zigzag','maximum','vertical']){
    const size=shape==='maximum'?600:130,s=fixtureStroke(preset,'sine','fast','bell',size).stroke;s.id=preset+'-'+shape;
    if(shape==='circle')s.points=Array.from({length:161},(_,i)=>{const a=i/160*Math.PI*2;return{x:460+150*Math.cos(a),y:240+120*Math.sin(a),p:.2+.8*Math.sin(i/160*Math.PI)**2,v:.32};});
    if(shape==='hook')s.points=Array.from({length:151},(_,i)=>{const t=i/150;return{x:150+600*t,y:200+(t>.7?90*Math.sin((t-.7)/.3*Math.PI):0),p:t>.7?1-(t-.7)/.3*.8:1,v:.32};});
    if(shape==='vertical')s.points=Array.from({length:151},(_,i)=>({x:400,y:100+i*4,p:1,v:.65}));
    if(shape==='zigzag')s.points=fixtureStroke(preset,'zigzag','fast','bell',130).stroke.points.map(p=>({...p,y:p.y+100}));
    if(shape==='maximum')s.points=s.points.map(p=>({...p,x:300+(p.x-100)*1.5,y:500+(p.y-130)*2}));
    await save(s.id,[s],shape==='maximum'?1800:1250,shape==='maximum'?1000:shape==='vertical'?900:500);
   }
   const passes=Array.from({length:9},(_,i)=>{const s=fixtureStroke(preset,'straight','slow','none',130).stroke;return{...s,id:'filled-'+preset+'-'+i,color:'#284e79',opacity:.7,flow:.75,points:s.points.map(p=>({...p,y:110+i*27}))};});await save(preset+'-filled-overlaps',passes);
   for(const [index,opacity,flow]of [[0,.25,.3],[1,.6,.65],[2,1,1]]){const s=fixtureStroke(preset,'sine','slow','bell',130).stroke;s.id=preset+'-opacity-flow-'+index;s.color=index===0?'#ce8748':'#541e36';s.opacity=opacity;s.flow=flow;s.points=s.points.map(p=>({...p,y:p.y+100}));await save(s.id,[s]);}
  }return rows;
 });fs.writeFileSync(out+'/manifest.json',JSON.stringify(rows,null,2));console.log(rows.length+' actual rendered pressure, speed, circles, hooks, maximum-size, overlap and colour/flow cases.');
}finally{await browser.close();await server.close();}
