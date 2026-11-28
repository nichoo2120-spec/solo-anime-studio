import {test,expect} from '@playwright/test';
test('GPU mixer matches CPU on every stock preset during drawing and falls back on context loss',async({page})=>{
 test.setTimeout(180000);
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const load=(p:string)=>import(p),{stockPresets}=await load('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await load('/src/core/paintTips.ts'),{MixerPreview}=await load('/src/engine/mixerPreview.ts');
  const {selectEngine}=await load('/src/engine/gpuMixer.ts');
  const dev=window as unknown as {soloBlendStatus:{active:string;detail:string};soloMixerLossTest:()=>WEBGL_lose_context|null};
  const blendStatus=()=>dev.soloBlendStatus;
  const make=()=>Object.assign(document.createElement('canvas'),{width:360,height:210});
  const base=make(),ctx=base.getContext('2d')!;
  for(let x=0;x<360;x+=4){ctx.fillStyle=x<170?(x%12?'#1cbd41':'#319843'):(x%12?'#eb393d':'#ac214d');ctx.fillRect(x,0,4,210);}
  const rgba=(c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;
  const difference=(a:HTMLCanvasElement,b:HTMLCanvasElement)=>{const x=rgba(a),y=rgba(b);let max=0,detail="";for(let i=0;i<x.length;i++)max=Math.max(max,Math.abs(x[i]-y[i]));return max;};
  const rows=[];let last:any,cpu:any,gpu:any,accelerated=0;
  for(const preset of stockPresets.filter((p:any)=>p.category!=='Eraser')){
   const settings={...preset.settings,bbEnabled:true};
   const s={...settings,...brushStrokeMetadata(settings,true),kind:'stroke',tool:'brush',id:'same-seed',size:150,color:'#3178ed',response:1,opacity:1,pressure:true,points:[] as {x:number;y:number;p:number}[]};
   cpu=new MixerPreview(base);gpu=new MixerPreview(base);
   let max=0,detail="";
   for(let i=0;i<6;i++){s.points.push({x:150+i*12,y:100+i*2,p:.3+i*.035});selectEngine('CPU');const a=cpu.paint(s,base);selectEngine('GPU');const b=gpu.paint(s,base);
    if(blendStatus().active==='GPU')accelerated++;else detail=blendStatus().detail;
    max=Math.max(max,difference(a,b));}
   rows.push({preset:preset.id,max,detail});last=s;
  }
  const extension=dev.soloMixerLossTest();extension?.loseContext();
  await new Promise(r=>setTimeout(r,80));
  last.points.push({x:246,y:106,p:.4});selectEngine('CPU');const a=cpu.paint(last,base);selectEngine('GPU');const b=gpu.paint(last,base);
  const recovered=difference(a,b),active=blendStatus().active;extension?.restoreContext();
  return {rows,accelerated,recovered,active,loss:!!extension};
 });
 console.log('MIXER_GPU_CHECK',JSON.stringify(result));
 expect(result.accelerated).toBeGreaterThan(0);
 for(const row of result.rows)expect.soft(row.max,row.preset).toBeLessThanOrEqual(2);
 expect(result.loss).toBe(true);expect(result.active).toBe('CPU');expect(result.recovered).toBeLessThanOrEqual(2);
});
