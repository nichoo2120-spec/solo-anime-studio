import {expect,test} from '@playwright/test';

test('new oil tips give light pen pressure more width and taper only a light release',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const {stockPresets}=await load('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await load('/src/core/paintTips.ts');
  const {stampPlan}=await load('/src/engine/stampBrush.ts');
  const {finalGeometry}=await load('/src/engine/geometryCache.ts');
  return stockPresets.filter((preset:any)=>preset.category==='Oil / Impasto').map(({settings}:any)=>{
   const make=(version:number,pressure:number,release=pressure)=>{
    const stroke={...brushStrokeMetadata(settings,true),impastoVersion:version,id:'oil-pressure',kind:'stroke',
     tool:'brush',size:50,opacity:1,response:1,pressure:true,pressureWidth:true,color:'#a25460',
     points:[{x:20,y:80,p:pressure},{x:100,y:80,p:pressure},{x:200,y:80,p:release}]};
    return stampPlan(stroke,finalGeometry(stroke)).dabs;
   };
   const light=[.2,.3,.4].map(p=>make(3,p)[0].rx);
   const release=make(3,1,.25);
   const firm=make(3,1);
   return {light,oldLight:make(2,.2)[0].rx,firm:firm.at(-1).rx,oldFirm:make(2,1).at(-1).rx,
    dryEnd:release.at(-1).pressure,lightEnd:release.at(-1).rx,oldEnd:make(2,1,.25).at(-1).rx};
  });
 });
 expect(result).toHaveLength(5);
 for(const preset of result){
  expect(preset.light[0]).toBeGreaterThan(preset.oldLight);
  expect(preset.light[1]).toBeGreaterThan(preset.light[0]);
  expect(preset.light[2]).toBeGreaterThan(preset.light[1]);
  expect(preset.firm).toBeCloseTo(preset.oldFirm);
  expect(preset.dryEnd).toBeLessThan(.25);
  expect(preset.lightEnd).toBeLessThan(preset.oldEnd);
 }
});
