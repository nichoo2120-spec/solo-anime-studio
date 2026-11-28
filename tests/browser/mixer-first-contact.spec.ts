import {expect,test} from '@playwright/test';

for(const size of [150,300,500]){
 test('Mixer presents and commits the same moving pixels at '+size+' px',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async size=>{
   const load=(path:string)=>import(path);
   const {LiveBlendWorker}=await load('/src/engine/LiveBlendWorker.ts');
   const {drawStroke}=await load('/src/engine/renderer.ts');
   const {renderBrushBlend}=await load('/src/engine/brushBlend.ts');
   const {brushStrokeMetadata}=await load('/src/core/paintTips.ts');
   const {stockPresets}=await load('/src/core/brushes.ts');
   const make=()=>Object.assign(document.createElement('canvas'),{width:420,height:240});
   const base=make(),ctx=base.getContext('2d')!;
   ctx.fillStyle='lime';ctx.fillRect(0,0,200,240);
   ctx.fillStyle='red';ctx.fillRect(200,0,220,240);
   const settings={...stockPresets.find((p:{id:string})=>p.id==='brush-pen').settings,
    bbEnabled:true,bbPressureWet:true,bbPressureMix:true,bbPaintLoad:0};
   const stroke={...settings,...brushStrokeMetadata(settings,true),id:'moving-prefix',size,
    kind:'stroke',tool:'brush',color:'#123456',opacity:1,pressure:true,response:1,
    points:[] as {x:number;y:number;p:number}[]};
   const worker=new LiveBlendWorker(()=>{}),read=(c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(0,0,420,240).data;
   const green:number[]=[];
   let maximumError=0,live:HTMLCanvasElement;
   try{
    for(let n=1;n<=10;n++){
     await new Promise(requestAnimationFrame);
     stroke.points.push({x:184+n*8,y:120,p:.3});
     live=worker.preview(stroke,base,n);
     const pixels=read(live),mask=make(),expected=make(),dst=expected.getContext('2d')!;
     drawStroke(mask.getContext('2d')!,stroke);
     dst.drawImage(base,0,0);renderBrushBlend(dst,mask,stroke);
     const final=read(expected);
     for(let i=0;i<final.length;i++)maximumError=Math.max(maximumError,Math.abs(final[i]-pixels[i]));
     if([3,5,10].includes(n))green.push(pixels[4*(420*120+202)+1]);
    }
    const committed=await worker.finish(stroke).done;
    return {green,maximumError,reused:committed===live!};
   }finally{worker.dispose();}
  },size);
  expect(result.green).toHaveLength(3);
  expect(Math.min(...result.green)).toBeGreaterThan(8);
  expect(result.maximumError).toBeLessThanOrEqual(1);
  expect(result.reused).toBe(true);
 });
}
