import {harness} from './hlib.mjs';
const h=await harness('exp/mine.html',+process.argv[2]);
const r=await h.pg.evaluate(async()=>{
 const {stockPresets}=await import('/src/core/brushes.ts'),{brushStrokeMetadata,watercolorSeedFor}=await import('/src/core/paintTips.ts'),{compositePaintStroke,strokeRasterBounds}=await import('/src/engine/paintCompositing.ts');
 const W=900,H=300,mk=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='#d62828';x.fillRect(0,0,430,H);x.fillStyle='#1d4ed8';x.fillRect(430,0,470,H);x.clearRect(0,250,W,50);return c;};
 const res=[];
 for(const id of ['smudge-bristle','blender-soft','wet-mix'])for(const size of [30,70,130])for(const opacity of [1,.63]){
  const pr=stockPresets.find(p=>p.id===id),b={...pr.settings,size,opacity};const sid='lf-'+id+size+opacity;
  const pts=[];for(let i=0;i<=90;i++){pts.push({x:150+i*7,y:150+40*Math.sin(i/90*Math.PI*2),p:.3+.7*Math.sin(i/90*Math.PI),v:.65});}
  const st=n=>({id:sid,kind:'stroke',tool:'brush',points:pts.slice(0,n),size,opacity,color:'#22c55e',pressure:true,response:1,...brushStrokeMetadata(b),captureZoom:1,stabilization:0,smoothness:0,pressureWidth:true,pressureOpacity:false,taperStart:0,taperEnd:0,brushKind:b.brushKind,velocityTaper:false,colorSeed:watercolorSeedFor(sid)});
  const mask=document.createElement('canvas');mask.width=W;mask.height=H;
  const base=mk(),live=mk(),lc=live.getContext('2d',{willReadFrequently:true});
  for(let n=1;n<=pts.length;n++){const s=st(n);lc.clearRect(0,0,W,H);lc.drawImage(base,0,0);compositePaintStroke(lc,mask,s,0,0,strokeRasterBounds(s,W,H),base);}
  const fin=()=>{const c=mk(),x=c.getContext('2d',{willReadFrequently:true});const s=st(pts.length);compositePaintStroke(x,mask,s,0,0,undefined,undefined);return x.getImageData(0,0,W,H).data;};
  const f1=fin(),f2=fin(),L=lc.getImageData(0,0,W,H).data,b0=base.getContext('2d').getImageData(0,0,W,H).data;
  let mx=0,diff=0,det=0,changed=0;for(let i=0;i<L.length;i++){const d=Math.abs(L[i]-f1[i]);if(d>mx)mx=d;if(d)diff++;if(f1[i]!==f2[i])det++;if(f1[i]!==b0[i])changed++;}
  // transparent area: alpha changes inside y>=250?
  let alphaGain=0;for(let y=250;y<300;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4+3;if(f1[i]>0)alphaGain++;}
  res.push({id,size,opacity,maxdiff:mx,diffpx:diff,nondet:det,changed,alphaGain});}
 return res;});
console.table(r);await h.b.close();
