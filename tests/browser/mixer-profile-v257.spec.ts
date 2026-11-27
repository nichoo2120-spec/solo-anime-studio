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
   const proto=CanvasRenderingContext2D.prototype,originals=new Map<string,Function>();
   let io=0,blit=0;
   for(const method of ['getImageData','putImageData','drawImage'] as const){
    const original=proto[method];originals.set(method,original);
    Object.defineProperty(proto,method,{configurable:true,writable:true,value:function(this:CanvasRenderingContext2D,...args:unknown[]){
     const start=performance.now();try{return Reflect.apply(original,this,args);}
     finally{if(method==='drawImage')blit+=performance.now()-start;else io+=performance.now()-start;}
    }});
   }
   try{
   for(const size of [50,130,300,500]){
    const brush={...settings,bbEnabled:true},s={...brush,...brushStrokeMetadata(brush,true),id:'profile',kind:'stroke',tool:'brush',size,opacity:.44,color:'#845297',pressure:false,points:[{x:790,y:510,p:.6},{x:1120,y:560,p:.7}]};
    const path=blendPath(s);let distance=0;
    for(let i=1;i<path.length;i++)distance+=Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y);
    const spacing=Math.max(.5,size*Math.max(.025,Math.min(s.brushBlendVersion===9?.15:.12,s.tipSpacing??.08)));
    const n=Math.ceil(distance/spacing)+1,times=[];
    for(let i=0;i<4;i++){
     out.fillStyle='#741bb8';out.fillRect(0,0,960,1080);out.fillStyle='#fff';out.fillRect(960,0,960,1080);mask.clearRect(0,0,1920,1080);
     io=0;blit=0;const start=performance.now();if(!s.silkBlendVersion)drawStroke(mask,s);
     const mid=performance.now();io=0;blit=0;if(s.silkBlendVersion)renderSilkStroke(out,s);else renderBrushBlend(out,mask.canvas,s);
     const end=performance.now();if(i)times.push({paint:mid-start,mix:end-mid,frame:end-start,readWrite:io,canvasBlits:blit,mixOther:Math.max(0,end-mid-io-blit)});
    }
    const time=times.sort((a,b)=>a.frame-b.frame)[1];rows.push({id,size,...time,perDab:s.silkBlendVersion?null:time.frame/n,version:s.brushBlendVersion??'Silk'});
   }
   }finally{for(const [key,fn] of originals)Object.defineProperty(proto,key,{configurable:true,writable:true,value:fn});}
   return rows;
  },id);
  for(const row of results){console.log('MIXER_PROFILE '+JSON.stringify(row));expect(row.frame).toBeGreaterThanOrEqual(0);}
 }
});

test('Wet zero matches Paint at 44% and 100% on the current layer',async({page})=>{
 await page.goto('/');
 const cases=await page.evaluate(async()=>{
  const load=(p:string)=>import(p);
  const {stockPresets}=await load('/src/core/brushes.ts'),{drawStroke}=await load('/src/engine/renderer.ts');
  const {compositePaintStroke}=await load('/src/engine/paintCompositing.ts');
  const {brushStrokeMetadata}=await load('/src/core/paintTips.ts');
  const make=()=>Object.assign(document.createElement('canvas'),{width:420,height:290}).getContext('2d',{willReadFrequently:true})!;
  const a=make(),b=make(),mask=make(),rows=[];
  for(const id of ['water-smooth','water-rough','water-wet','water-edge','water-gradient','water-flat','flat','brush-pen','color-texture'])
   for(const opacity of [.44,1]){
    for(const [enabled,ctx] of [[false,a],[true,b]] as const){
     const p=stockPresets.find((p:any)=>p.id===id),settings={...p.settings,bbEnabled:enabled,bbWetness:0};
     const s={...settings,...brushStrokeMetadata(settings,true),points:[{x:125,y:141,p:.5},{x:294,y:131,p:.65}],
      size:130,opacity,color:'#af5386',tool:'brush',kind:'stroke',id:'wet-zero'};
     mask.clearRect(0,0,420,290);ctx.fillStyle='#eee';ctx.fillRect(0,0,420,290);
     drawStroke(mask,s);compositePaintStroke(ctx,mask.canvas,s);
    }
    const first=a.getImageData(0,0,420,290).data,second=b.getImageData(0,0,420,290).data;
    rows.push({id,opacity,difference:first.reduce((n,v,i)=>n+Number(v!==second[i]),0)});
   }
  return rows;
 });
 for(const row of cases)expect.soft(row.difference,row.id+' '+row.opacity).toBe(0);
});
