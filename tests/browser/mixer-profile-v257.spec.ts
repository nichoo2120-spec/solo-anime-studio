import {test,expect} from '@playwright/test';

test('profile two full brush raster stages at four sizes',async({page})=>{
 test.setTimeout(360000);
 await page.goto('/');
 const ids=await page.evaluate(async()=>{
  const p='/src/core/brushes.ts';return (await import(p)).stockPresets.filter((p:any)=>p.category!=='Eraser').map((p:any)=>p.id) as string[];
 });
 for(const id of ids){
  const results=await page.evaluate(async id=>{
   const load=(p:string)=>import(p);
   const {stockPresets}=await load('/src/core/brushes.ts'),{drawStroke}=await load('/src/engine/renderer.ts');
   const {renderBrushBlend,blendPath}=await load('/src/engine/brushBlend.ts'),{brushStrokeMetadata}=await load('/src/core/paintTips.ts');
   const {renderSilkStroke}=await load('/src/engine/silkBlend.ts');
   const settings=stockPresets.find((p:any)=>p.id===id).settings;
   const make=()=>Object.assign(document.createElement('canvas'),{width:1920,height:1080}).getContext('2d',{willReadFrequently:true})!;
   const mask=make(),out=make(),rows=[];
   for(const size of [50,130,300,500]){
    const brush={...settings,bbEnabled:true},s={...brush,...brushStrokeMetadata(brush,true),id:'profile',kind:'stroke',tool:'brush',size,opacity:.44,color:'#845297',pressure:false,points:[{x:790,y:510,p:.6},{x:1120,y:560,p:.7}]};
    const path=blendPath(s);let distance=0;
    for(let i=1;i<path.length;i++)distance+=Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y);
    const spacing=Math.max(.5,size*Math.max(.025,Math.min(s.brushBlendVersion===9?.15:.12,s.tipSpacing??.08)));
    const n=Math.ceil(distance/spacing)+1,times=[];
    for(let i=0;i<4;i++){
     out.fillStyle='#741bb8';out.fillRect(0,0,960,1080);out.fillStyle='#fff';out.fillRect(960,0,960,1080);mask.clearRect(0,0,1920,1080);
     const start=performance.now();if(!s.silkBlendVersion)drawStroke(mask,s);
     const mid=performance.now();if(s.silkBlendVersion)renderSilkStroke(out,s);else renderBrushBlend(out,mask.canvas,s);
     const end=performance.now();if(i)times.push({paint:mid-start,mix:end-mid,frame:end-start});
    }
    const time=times.sort((a,b)=>a.frame-b.frame)[1];rows.push({id,size,...time,perDab:s.silkBlendVersion?null:time.frame/n,version:s.brushBlendVersion??'Silk'});
   }
   return rows;
  },id);
  for(const row of results){console.log('MIXER_PROFILE '+JSON.stringify(row));expect(row.frame).toBeGreaterThanOrEqual(0);}
 }
});
