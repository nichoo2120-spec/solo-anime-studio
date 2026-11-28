import {expect,test} from '@playwright/test';

test('oil paint keeps a raised body without bristle detail and relights without changing coverage',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const {stockPresets}=await load('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await load('/src/core/paintTips.ts');
  const {drawStroke}=await load('/src/engine/renderer.ts');
  const {finalGeometry}=await load('/src/engine/geometryCache.ts');
  const settings=stockPresets.find((preset:any)=>preset.id==='oil-filbert').settings;
  const stroke={...brushStrokeMetadata(settings,true),id:'oil-relief',kind:'stroke',tool:'brush',
   size:100,opacity:1,response:1,pressure:true,pressureWidth:true,color:'#c87562',oilBristles:0,oilJitter:0,
   points:[{x:100,y:110,p:1},{x:280,y:110,p:1}]};
  function render(overrides:Record<string,unknown>,heightOnly=false){
   const canvas=Object.assign(document.createElement('canvas'),{width:380,height:220});
   const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
   const material={...stroke,...overrides};
   drawStroke(ctx,material,'final',finalGeometry(material),heightOnly);
   return ctx.getImageData(190,64,1,92).data;
  }
  const left=render({oilLight:-90}),right=render({oilLight:90}),legacy=render({impastoVersion:3,oilLight:-90});
  const heights=render({},true);
  let min=255,max=0,oldMin=255,oldMax=0,relit=0,coverage=0,heightMin=255,heightMax=0;
  for(let i=0;i<left.length;i+=4){
   coverage+=Number(left[i+3]!==right[i+3]||left[i+3]!==legacy[i+3]);
   if(left[i+3]!==255)continue;
   min=Math.min(min,left[i]);max=Math.max(max,left[i]);
   oldMin=Math.min(oldMin,legacy[i]);oldMax=Math.max(oldMax,legacy[i]);
   heightMin=Math.min(heightMin,heights[i]);heightMax=Math.max(heightMax,heights[i]);
   if(Math.abs(left[i]-right[i])>=12)relit++;
  }
  return {coverage,range:max-min,legacyRange:oldMax-oldMin,relit,heightRange:heightMax-heightMin};
 });
 expect(result.coverage).toBe(0);
 expect(result.legacyRange).toBe(0);
 expect(result.range).toBeGreaterThan(30);
 expect(result.relit).toBeGreaterThan(15);
 expect(result.heightRange).toBeGreaterThan(30);
});
