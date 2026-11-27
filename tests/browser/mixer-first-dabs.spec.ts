import {expect,test} from '@playwright/test';

test('moving mixer prefixes use the full Paint mask and match independent replay',async({page})=>{
 test.setTimeout(240000);
 await page.goto('/');
 const rows=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const {drawStroke}=await load('/src/engine/renderer.ts');
  const {renderBrushBlend}=await load('/src/engine/brushBlend.ts');
  const {stockPresets}=await load('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await load('/src/core/paintTips.ts');
  const {LiveBlendWorker}=await load('/src/engine/LiveBlendWorker.ts');
  const surface=()=>Object.assign(document.createElement('canvas'),{width:560,height:400}).getContext('2d',{willReadFrequently:true})!;
  const base=surface(),paint=surface(),mask=surface(),expected=surface();
  base.fillStyle='#00bb22';base.fillRect(0,0,270,400);base.fillStyle='#cc1122';base.fillRect(270,0,290,400);
  let resolve:()=>void=()=>{};const worker=new LiveBlendWorker(()=>resolve());
  const rows=[];
  try{
   for(const preset of stockPresets.filter((p:any)=>p.category!=='Eraser')){
    for(const size of preset.id==='water-smooth'?[150,300,500]:[150]){
     const settings={...preset.settings,size};
     const common={...settings,id:'prefix',tool:'brush',kind:'stroke',opacity:1,size,pressure:true,response:1,color:'#9944ff'};
     const blend={...common,...brushStrokeMetadata({...settings,bbEnabled:true},true)};
     const normal={...common,...brushStrokeMetadata({...settings,bbEnabled:false},true)};
     for(const count of [3,5,10]){
      const points=Array.from({length:count},(_,i)=>({x:249+i*12,y:200,p:.3,v:.75}));
      const s={...blend,points};
      for(const c of [mask,paint,expected])c.clearRect(0,0,560,400);
      drawStroke(mask,s);drawStroke(paint,{...normal,points});
      expected.drawImage(base.canvas,0,0);renderBrushBlend(expected,mask.canvas,s);
      const ready=new Promise<void>(r=>{resolve=r;});
      const preview=worker.preview(s,base.canvas,count);
      if(!preview)throw Error('worker unavailable');
      await ready;
      const a=mask.getImageData(0,0,560,400).data,b=paint.getImageData(0,0,560,400).data;
      const live=preview.getContext('2d').getImageData(0,0,560,400).data,final=expected.getImageData(0,0,560,400).data;
      let union=0,intersection=0,max=0,carried=0;
      for(let i=0;i<a.length;i+=4){
       if(a[i+3]||b[i+3])union++;if(a[i+3]&&b[i+3])intersection++;
       for(let k=0;k<4;k++)max=Math.max(max,Math.abs(final[i+k]-live[i+k]));
       if((i/4)%560>=270&&live[i+1]>22)carried++;
      }
      rows.push({id:preset.id,size,count,iou:union?intersection/union:1,max,carried});
     }
     worker.cancel();
    }
   }
  }finally{worker.dispose();}
  return rows;
 });
 for(const r of rows){
  expect.soft(r.max,JSON.stringify(r)).toBeLessThanOrEqual(1);
  if(r.count===5)expect.soft(r.iou,JSON.stringify(r)).toBeGreaterThanOrEqual(.9);
  if(r.id==='water-smooth')expect.soft(r.carried,JSON.stringify(r)).toBeGreaterThan(0);
 }
});
