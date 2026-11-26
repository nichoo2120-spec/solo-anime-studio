import {expect,test} from '@playwright/test';

const baselineOnly = process.env.BLEND_BASELINE_ONLY === '1';

test('profiles each Blend family and style on a 1920 × 1080 canvas',async({page})=>{
 test.setTimeout(210_000);
 await page.goto('/');
 const rows=await page.evaluate(async({baselineOnly})=>{
  const load=(path:string)=>import(path);
  const {stockPresets}=await load('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await load('/src/core/paintTips.ts');
  const {drawStroke}=await load('/src/engine/renderer.ts');
  const {renderBrushBlend,applyBrushBlendLive,resetBrushBlend}=await load('/src/engine/brushBlend.ts');
  const {BrushBlendGestureV3}=await load('/src/engine/brushBlendStyles.ts');
  const {SilkGesture,renderSilkStroke,applySilkBlend,resetSilkBlend}=await load('/src/engine/silkBlend.ts');
  const width=1920,height=1080;
  const surface=()=>Object.assign(document.createElement('canvas'),{width,height}).getContext('2d',{willReadFrequently:true})!;
  const base=surface(),mask=surface(),out=surface(),before=surface(),after=surface(),historic=surface();
  const fill=base.createLinearGradient(370,260,1330,820);
  fill.addColorStop(0,'#b53858');fill.addColorStop(.55,'#e7af62');fill.addColorStop(1,'#4069bd');
  base.fillStyle=fill;base.fillRect(0,0,width,height);
  base.fillStyle='#365892';base.fillRect(735,445,420,250);
  base.clearRect(955,350,120,160);
  const fixture=[
   ['Soft paint','soft-paint','auto'],['Watercolor','water-flat','auto'],['Oil','flat','auto'],
   ['Airbrush','color-air','auto'],['Pencil','hb','auto'],['Ink','g-pen','auto'],
   ['Marker','marker','auto'],['Texture','color-texture','auto'],['Dry brush','dry','auto'],
   ['Soft blur','soft-paint','blur'],['Wet','soft-paint','wet'],['Smudge','soft-paint','smudge'],['Dry','soft-paint','dry'],
   ...['soft','wet','smudge','dry'].map(mode=>['Silk '+mode,'silk-blend','silk',mode]),
  ];
  const points=Array.from({length:33},(_,i)=>({x:572+i*23,y:525+Math.sin(i*.15)*30,p:.7+.25*i/32,v:.65}));
  const p95=(v:number[])=>v.sort((a,b)=>a-b)[Math.max(0,Math.ceil(v.length*.95)-1)]??0;
  let dabs:number[]|undefined;
  const wrap=(prototype:any)=>{
   const dab=prototype.dab;
   prototype.dab=function(...args:unknown[]){
    if(!dabs)return dab.apply(this,args);
    const t=performance.now();
    try{return dab.apply(this,args);}finally{dabs.push(performance.now()-t);}
   };
  };
  wrap(BrushBlendGestureV3.prototype);wrap(SilkGesture.prototype);
  const rows=[];
  const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  for(const size of [20,100,300,500])for(const [label,id,style,silkMode] of fixture){
   const settings={...stockPresets.find((p:{id:string})=>p.id===id).settings,bbEnabled:true,bbRenderStyle:style,silkMode,pressureWidth:false};
   const stroke={...settings,...brushStrokeMetadata(settings),id:'blend-profile-'+id,kind:'stroke',tool:'brush',size,points,pressure:false};
   const baseline={...stroke,blendRasterVersion:size>64?1:undefined};
   const candidate={...stroke,blendRasterVersion:size>64?2:undefined};
   mask.clearRect(0,0,width,height);
   const t=performance.now();
   if(style!=='silk')drawStroke(mask,baseline);
   const maskMs=performance.now()-t;
   const canonical=(canvas:CanvasRenderingContext2D,s:typeof stroke)=>{
    canvas.clearRect(0,0,width,height);canvas.drawImage(base.canvas,0,0);
    const t=performance.now();
    if(style==='silk')renderSilkStroke(canvas,s);
    else renderBrushBlend(canvas,mask.canvas,s);
    return performance.now()-t;
   };
   if(style!=='silk'&&!baselineOnly&&size===300)canonical(historic,{...stroke,brushBlendVersion:3,blendRasterVersion:undefined});
   const measure=(s:typeof baseline)=>{
    out.clearRect(0,0,width,height);out.drawImage(base.canvas,0,0);resetBrushBlend();resetSilkBlend();
    const samples:number[]=[];
    dabs=[];
    const draw=(n:number,final=false)=>{
     const section={...s,points:points.slice(0,n)};
     if(style==='silk')applySilkBlend(out,mask.canvas,section,0,0,undefined,base.canvas,final);
     else applyBrushBlendLive(out,mask.canvas,section,base.canvas,final,section.points);
    };
    for(let i=1;i<=points.length;i+=4){const t=performance.now();draw(i);samples.push(performance.now()-t);}
    const dabMs=dabs.reduce((sum,v)=>sum+v,0)/Math.max(1,dabs.length),peakDab=p95(dabs),dabCount=dabs.length;
    dabs=undefined;
    const t=performance.now();draw(points.length,true);
    return {dabMs,peakDab,dabCount,frame:p95(samples),penUp:performance.now()-t};
   };
   await frame();
   const prior=measure(baseline);
   const oldMs=canonical(before,baseline);
   let updated:ReturnType<typeof measure>|undefined,meanDelta:number|undefined,maxDelta:number|undefined,historicalDelta:number|undefined,canonicalMs:number|undefined;
   if(!baselineOnly){
    updated=measure(candidate);
    canonicalMs=canonical(after,candidate);
    const crop={x:320,y:230,w:1240,h:625};
    const a=before.getImageData(crop.x,crop.y,crop.w,crop.h).data,b=after.getImageData(crop.x,crop.y,crop.w,crop.h).data;
    const written=out.getImageData(crop.x,crop.y,crop.w,crop.h).data;
    let sum=0,max=0,mismatch=0,changed=0;
    const original=base.getImageData(crop.x,crop.y,crop.w,crop.h).data;
    for(let i=0;i<a.length;i+=4){
     const visible=a[i]!==original[i]||a[i+1]!==original[i+1]||a[i+2]!==original[i+2]||a[i+3]!==original[i+3]||
      b[i]!==original[i]||b[i+1]!==original[i+1]||b[i+2]!==original[i+2]||b[i+3]!==original[i+3];
     if(visible)changed+=4;
     for(let j=0;j<4;j++){const d=Math.abs(a[i+j]-b[i+j]);sum+=d;max=Math.max(max,d);mismatch+=Number(written[i+j]!==b[i+j]);}
    }
    meanDelta=sum/Math.max(1,changed);
    maxDelta=max;
    if(mismatch)throw Error(label+' '+size+' final worker/fallback parity differs by '+mismatch+' channels');
    if(style!=='silk'&&size===300){
     canonical(after,{...stroke,brushBlendVersion:3,blendRasterVersion:undefined});
     const h=historic.getImageData(crop.x,crop.y,crop.w,crop.h).data,hh=after.getImageData(crop.x,crop.y,crop.w,crop.h).data;
     historicalDelta=h.reduce((n,value,i)=>n+Number(value!==hh[i]),0);
    }
   }
   rows.push({label,size,maskMs,prior,oldMs,updated,canonicalMs,meanDelta,maxDelta,historicalDelta});
  }
  return rows;
 },{baselineOnly});
 for(const row of rows){
  console.log('BLEND_V254_PROFILE '+JSON.stringify(row));
  if(!baselineOnly){
   expect.soft(row.meanDelta,row.label+' '+row.size+' changed-pixel MAE').toBeLessThanOrEqual(2);
   if(row.historicalDelta!==undefined)expect.soft(row.historicalDelta,row.label+' historical v3 repeat').toBe(0);
  }
 }
});
