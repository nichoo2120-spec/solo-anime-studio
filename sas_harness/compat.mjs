import {harness} from './hlib.mjs';import fs from 'fs';import crypto from 'crypto';
const tag=process.argv[2],port=+process.argv[3];
const h=await harness(process.env.PAGE||'exp/h.html',port);
const ids=(await h.pg.evaluate(()=>window.H.presets())).map(p=>p.id).filter(i=>!/^dry-(ink-bristle|paint)$/.test(i));
const sha=u=>crypto.createHash('sha256').update(u).digest('hex').slice(0,16);
const Y=180;const line=(x0,x1,y=Y)=>({kind:'line',x0,y0:y,x1,y1:y});
const paths={slow_line:{path:line(100,580),speed:.25},fast_line:{path:line(100,580),speed:3},sine:{path:{kind:'sine',x0:100,y0:Y,x1:700,y1:Y,amp:45},speed:.5},bell:{path:line(100,580),speed:.4,pressure:'bell'}};
const base=[];for(let y=30;y<=270;y+=12){base.push({preset:'color-solid',ov:{size:40,color:'#d62828',opacity:1,colorNib:'round'},color:'#d62828',path:{kind:'line',x0:40,y0:y,x1:450,y1:y},speed:2});base.push({preset:'color-solid',ov:{size:40,color:'#1d4ed8',opacity:1,colorNib:'round'},color:'#1d4ed8',path:{kind:'line',x0:450,y0:y,x1:860,y1:y},speed:2});}
const out={};let n=0;
for(const id of ids)for(const [pn,p] of Object.entries(paths))for(const [paper,color,sz] of [['#ffffff','#000000',null],['#d9c7a1','#1d4ed8',70],['#ffffff','#22c55e',130],['#ffffff','#000000',38]]){
 for(const withBase of [false,true]){ if(withBase&&pn!=='slow_line')continue;
 const r=await h.render({W:900,H:360,paper,base:withBase?base:undefined,ops:[{preset:id,ov:{...(sz?{size:sz}:{}),color},color,id:'c_'+id+'_'+pn,...p}]});
 out[`${id}/${pn}/${paper}/${color}/${sz}/${withBase?'base':'empty'}`]={layer:sha(r.layer),white:sha(r.white)};n++;}
}
fs.writeFileSync(`data/compat_${tag}.json`,JSON.stringify(out));console.log(tag,n,'renders',ids.length,'presets',h.errs);await h.b.close();
