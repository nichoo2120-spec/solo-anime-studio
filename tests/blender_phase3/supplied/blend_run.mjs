// Usage: node blend_run.mjs TAG PORT   -> data/TAG/*.png + data/TAG/perf.json
import {harness,save,OUT} from './hlib.mjs';import fs from 'fs';
const tag=process.argv[2]||'v153',port=+(process.argv[3]||5502);
const h=await harness('exp/h.html',port);const dir=`${OUT}/data/${tag}`;fs.mkdirSync(dir,{recursive:true});
const W=900,H=300,R='#d62828',B='#1d4ed8';
const fill=(c,x0,x1)=>{const a=[];for(let y=30;y<=270;y+=12)a.push({preset:'color-solid',ov:{size:40,color:c,opacity:1,colorNib:'round'},color:c,path:{kind:'line',x0,y0:y,x1,y1:y},speed:2});return a;};
const rb=[...fill(R,40,450),...fill(B,450,860)];
const dot=[];for(let y=110;y<=190;y+=10)dot.push({preset:'color-solid',ov:{size:30,color:R,opacity:1,colorNib:'round'},color:R,path:{kind:'line',x0:120,y0:y,x1:200,y1:y},speed:2});
const line=(x0,x1,y=150)=>({kind:'line',x0,y0:y,x1,y1:y});
const bl=(ov,extra)=>({preset:'color-blender',ov,path:line(180,720),speed:.4,...extra});
const cases={
 rb_slow:[rb,bl({size:70},{speed:.25})], rb_mid:[rb,bl({size:70})], rb_fast:[rb,bl({size:70},{speed:3})],
 rb_light:[rb,bl({size:70},{pressure:.25})], rb_heavy:[rb,bl({size:70},{pressure:.95})],
 rb_s30:[rb,bl({size:30})], rb_s130:[rb,bl({size:130})],
 rb_rtl:[rb,bl({size:70},{path:line(720,180)})], rb_curve:[rb,bl({size:70},{path:{kind:'sine',x0:180,y0:150,x1:720,y1:150,amp:50}})],
 w_patch:[dot,bl({size:70},{path:line(140,800)})], w_empty:[[],bl({size:70})],
};
for(const [n,[base,op]] of Object.entries(cases)){const r=await h.render({W,H,paper:'#ffffff',base,ops:[{...op,id:'bl_'+n}]});save(r.white,`${dir}/${n}__out.png`);save(r.base,`${dir}/${n}__base.png`);}
// live per-event cost: grow the stroke one event at a time against a red/blue base, size 70 and 130
const perf=await h.pg.evaluate(async()=>{
 const {stockPresets}=await import('/src/core/brushes.ts'),{brushStrokeMetadata,watercolorSeedFor}=await import('/src/core/paintTips.ts'),{compositePaintStroke,strokeRasterBounds}=await import('/src/engine/paintCompositing.ts');
 const out={};
 for(const size of [70,130]){for(const rep of [0,1,2]){
  const W=1400,H=500,base=document.createElement('canvas');base.width=W;base.height=H;const bc=base.getContext('2d');bc.fillStyle='#d62828';bc.fillRect(0,0,700,H);bc.fillStyle='#1d4ed8';bc.fillRect(700,0,700,H);
  const pr=stockPresets.find(p=>p.id==='color-blender'),b={...pr.settings,size};const id='perf-bl-'+size+'-'+rep;
  const s={id,kind:'stroke',tool:'brush',points:[],size,opacity:b.opacity,color:'#000000',pressure:false,response:b.response??1,...brushStrokeMetadata(b),captureZoom:1,stabilization:0,smoothness:0,pressureWidth:true,pressureOpacity:false,taperStart:0,taperEnd:0,brushKind:b.brushKind,velocityTaper:false,colorSeed:watercolorSeedFor(id)};
  const tgt=document.createElement('canvas');tgt.width=W;tgt.height=H;const tc=tgt.getContext('2d',{willReadFrequently:true});const mask=document.createElement('canvas');mask.width=W;mask.height=H;
  const t=[];for(let x=200;x<=1200;x+=8){s.points=[...s.points,{x,y:250,p:1,v:.65}];const st={...s};const t0=performance.now();tc.clearRect(0,0,W,H);tc.drawImage(base,0,0);compositePaintStroke(tc,mask,st,0,0,strokeRasterBounds(st,W,H),base);tc.getImageData(x,250,1,1);t.push(performance.now()-t0);}
  const n=[...t].sort((a,b)=>a-b);(out['s'+size]??=[]).push({n:t.length,mean:+(t.reduce((a,v)=>a+v,0)/t.length).toFixed(2),p50:+n[n.length>>1].toFixed(2),p95:+n[Math.floor(n.length*.95)].toFixed(2),max:+n.at(-1).toFixed(2)});
 }}
 return out;});
fs.writeFileSync(`${dir}/perf.json`,JSON.stringify(perf,null,1));console.log(JSON.stringify(perf),h.errs);await h.b.close();
