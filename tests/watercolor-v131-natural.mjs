import {createServer} from '../node_modules/vite/dist/node/index.js';
import {chromium} from '../node_modules/playwright/index.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
const root=process.cwd(),server=await createServer({root,server:{host:'127.0.0.1',port:5415,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5415');
const result=await page.evaluate(async()=>{
 const {stockPresets}=await import('/src/core/brushes.ts'),{brushStrokeMetadata,watercolorSeedFor}=await import('/src/core/paintTips.ts'),{drawModernStroke}=await import('/src/engine/brushRaster.ts'),{strokeGeometry}=await import('/src/engine/strokeGeometry.ts'),{LiveStrokeRaster}=await import('/src/engine/liveRaster.ts');
 const water=stockPresets.filter(p=>p.settings.brushKind==='watercolor'),make=(w=640,h=260)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
 const difference=(a,b)=>{a=pixels(a);b=pixels(b);let max=0,changed=0,alpha=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);max=Math.max(max,d);if(d)changed++;if(i%4===3)alpha=Math.max(alpha,d);}return {max,changed,alpha};};
 const render=(s)=>{const c=make();drawModernStroke(c.getContext('2d'),s);return c;};
 const base=(p,id,patch={})=>({...p.settings,...brushStrokeMetadata(p.settings),kind:'stroke',tool:'brush',id,watercolorSeed:watercolorSeedFor(id),color:'#165c86',pressure:false,size:p.id==='watercolor-liner'?12:90,flow:.32,opacity:.76,taperStart:0,taperEnd:0,smoothness:0,stabilization:0,points:Array.from({length:91},(_,i)=>({x:65+i*5.5,y:130+28*Math.sin(i/90*Math.PI*2),p:.8,v:.65})),...patch});
 const sheet=(w,h,title,subtitle)=>{const c=make(w,h),x=c.getContext('2d');x.fillStyle='#fbfaf6';x.fillRect(0,0,w,h);x.fillStyle='#203c4a';x.font='bold 25px sans-serif';x.fillText(title,24,35);x.font='16px sans-serif';x.fillText(subtitle,24,64);return {c,x};};
 const variation=sheet(1440,2780,'Five new strokes · v0.5.130 left / v0.5.131 right','Each mark rendered at the SAME canvas coordinates, then arranged here. Only the saved stroke seed changes.');
 const dynamics=sheet(1440,2780,'Pressure and movement response · all eight watercolor presets','Columns: light pressure · heavy pressure · slow travel · fast travel. Identical curve geometry; stored input channels vary.');
 const areas=sheet(1440,2270,'Broad filled areas · v0.5.130 left / v0.5.131 right','Three separately seeded overlapping passes. No texture rotation, arbitrary color noise or whole-stroke blur.');
 const rows=[];
 for(const [j,p] of water.entries()){
  const top=105+j*330,vt=variation.x,dt=dynamics.x;for(const x of [vt,dt]){x.fillStyle='#203c4a';x.font='bold 20px sans-serif';x.fillText(p.name,24,top);}
  const old=[],now=[];
  for(let i=0;i<5;i++)for(const version of [1,2]){
   const s=base(p,'variation-'+i,{watercolorMaterialVersion:version,size:p.id==='watercolor-liner'?8:48,points:[{x:60,y:130,p:.8,v:.65},{x:580,y:130,p:.8,v:.65}]}),c=render(s);(version===1?old:now).push(c);
   vt.save();vt.globalAlpha=s.opacity;vt.drawImage(c,20+(version-1)*710,top+8+i*52-80,690,260);vt.restore();
  }
  const repeat=render(base(p,'variation-0',{size:p.id==='watercolor-liner'?8:48,points:[{x:60,y:130,p:.8,v:.65},{x:580,y:130,p:.8,v:.65}]}));
  const seedDifferences=now.slice(1).map(c=>difference(now[0],c)),oldSeedDifferences=old.slice(1).map(c=>difference(old[0],c));
  const s=base(p,'replay-'+p.id),canonical=render(s),reloaded=render(JSON.parse(JSON.stringify(s))),again=render(s);
  const live=make(),raster=new LiveStrokeRaster(),growing={...s,points:[]};for(let n=0;n<s.points.length;n++){growing.points.push(s.points[n]);if(n%15===0)raster.paint(live.getContext('2d'),growing,strokeGeometry(growing,'live'));}raster.paint(live.getContext('2d'),growing,strokeGeometry(growing));
  const pressure=[],speed=[];
  for(const [k,patch] of [{pressure:true,points:s.points.map(q=>({...q,p:.18,v:.65}))},{pressure:true,points:s.points.map(q=>({...q,p:.95,v:.65}))},{points:s.points.map(q=>({...q,v:.95}))},{points:s.points.map(q=>({...q,v:.2}))}].entries()){
   const c=render({...s,...patch}),d=pixels(c);let totalAlpha=0;for(let n=3;n<d.length;n+=4)totalAlpha+=d[n];(k<2?pressure:speed).push(totalAlpha);
   dt.save();dt.globalAlpha=s.opacity;dt.drawImage(c,18+k*355,top+25,340,240);dt.restore();
  }
  const rect=[];for(let y=65;y<=195;y+=12){const reverse=(y-65)/12%2;rect.push({x:reverse?550:80,y,p:.85,v:.65},{x:reverse?80:550,y,p:.85,v:.65});}
  const ay=105+j*265,at=areas.x;at.fillStyle='#203c4a';at.font='bold 20px sans-serif';at.fillText(p.name,24,ay);
  for(const version of [1,2]){const out=make(),oc=out.getContext('2d');for(let pass=0;pass<3;pass++){const q=base(p,'area-'+pass,{watercolorMaterialVersion:version,points:rect.map(q=>({...q,y:q.y+pass*5})),size:p.id==='watercolor-liner'?18:90,flow:.18,opacity:.32}),c=render(q);oc.globalAlpha=q.opacity;oc.drawImage(c,0,0);}at.drawImage(out,25+(version-1)*710,ay+12,680,230);}
  rows.push({id:p.id,seedDifferences,oldSeedDifferences,replay:difference(canonical,reloaded),repeat:difference(canonical,again),live:difference(canonical,live),pressureAlpha:pressure,speedAlpha:speed});
 }
 // Four zoom presentations use the same project-resolution layer, like the app.
 const zoom=[];for(const p of water){const s=base(p,'zoom-'+p.id),a=render(s);for(const scale of [.5,1,1.57,3]){const c=make(Math.ceil(640*scale),Math.ceil(260*scale));c.getContext('2d').drawImage(a,0,0,c.width,c.height);zoom.push({id:p.id,scale,nonempty:pixels(c).some((v,i)=>i%4===3&&v>0)});}}
 return {rows,zoom,variation:variation.c.toDataURL(),dynamics:dynamics.c.toDataURL(),areas:areas.c.toDataURL()};
});
for(const key of ['variation','dynamics','areas']){fs.writeFileSync('WATERCOLOR_'+key.toUpperCase()+'_v0_5_131.png',Buffer.from(result[key].split(',')[1],'base64'));delete result[key];}
fs.writeFileSync('validation/natural131.json',JSON.stringify(result,null,2));
for(const r of result.rows){assert(r.seedDifferences.every(d=>d.alpha>3&&d.changed>100),r.id+' seeds');assert.equal(r.replay.max,0,r.id+' reload');assert.equal(r.repeat.max,0,r.id+' repeat');assert.equal(r.live.max,0,r.id+' live replay');assert(r.pressureAlpha[1]>r.pressureAlpha[0],r.id+' pressure');assert(r.speedAlpha[0]>r.speedAlpha[1],r.id+' speed');}assert(result.zoom.every(r=>r.nonempty));console.log('A–F: eight presets, five seeds each, pressure/speed, live/JSON replay exact; broad areas and 32 zoom views rendered');
}finally{await browser.close();await server.close();}
