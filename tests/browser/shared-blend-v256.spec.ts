import {expect,test} from '@playwright/test';

test('Paint and Blend share coverage and grain on a uniform contrasting pickup',async({page})=>{
 test.setTimeout(240000);
 await page.goto('/');
 const rows=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const {stockPresets}=await load('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await load('/src/core/paintTips.ts');
  const {drawStroke}=await load('/src/engine/renderer.ts');
  const {drawPigmentBrush}=await load('/src/engine/pigmentBrush.ts');
  const {finalGeometry}=await load('/src/engine/geometryCache.ts');
  const {renderBrushBlend,setLiveBlendSample,sampleFromCanvas}=await load('/src/engine/brushBlend.ts');
  const width=750,height=590;
  const canvas=()=>Object.assign(document.createElement('canvas'),{width,height}).getContext('2d',{willReadFrequently:true})!;
  const paint=canvas(),mask=canvas(),dest=canvas(),source=canvas();
  source.fillStyle='white';source.fillRect(0,0,width,height);
  setLiveBlendSample(sampleFromCanvas(source.canvas,{x:0,y:0,width,height}));
  const rows=[];
  try{
   for(const preset of stockPresets.filter((p:any)=>p.category!=='Eraser')){
    for(const size of [132,400]){
     const common={...preset.settings,id:'fixed-seed',color:'#ffffff',opacity:1,size,
      kind:'stroke',tool:'brush',points:[{x:215,y:255,p:.55},{x:525,y:335,p:.9}]};
     const reference={...common,...brushStrokeMetadata({...common,bbEnabled:false},true)};
     paint.clearRect(0,0,width,height);
     // Native blenders transport existing pigment and have no standalone Paint alpha.
     // Render their authored Paint nib on transparent paper for this reference.
     if(reference.brushTip==='color-blender')drawPigmentBrush(paint,reference,finalGeometry(reference));
     else drawStroke(paint,reference);
     const alpha=paint.getImageData(0,0,width,height).data;
     for(const style of ['smudge','blur','auto']){
      const settings={...common,bbEnabled:true,bbRenderStyle:style,bbSample:'all',bbFlow:1,bbAmount:1,bbStrength:1,bbPaintLoad:0};
      const stroke={...settings,...brushStrokeMetadata(settings,true)};
      if(stroke.silkBlendVersion)continue;
      mask.clearRect(0,0,width,height);drawStroke(mask,stroke);
      dest.fillStyle='black';dest.fillRect(0,0,width,height);
      renderBrushBlend(dest,mask.canvas,stroke);
      const out=dest.getImageData(0,0,width,height).data;
      let intersection=0,union=0,grainPaint=0,grainBlend=0;
      for(let i=4;i<alpha.length;i+=4){
       const a=alpha[i+3]>8,b=out[i]>8;
       if(a&&b)intersection++;
       if(a||b)union++;
       if(a&&alpha[i-1]>8){grainPaint+=Math.abs(alpha[i+3]-alpha[i-1]);grainBlend+=Math.abs(out[i]-out[i-4]);}
      }
      // Sparse events leave a long span. Check each interior cross-section
      // Paint actually touches, preserving intentional holes in a textured nib.
      let gaps=0;
      for(let x=230;x<510;x++){
       let hasPaint=false,hasBlend=false;
       for(let y=0;y<height;y++){const k=(y*width+x)*4;hasPaint ||= alpha[k+3]>8;hasBlend ||= out[k]>8;}
       if(hasPaint&&!hasBlend)gaps++;
      }
      rows.push({id:preset.id,size,style,gaps,iou:intersection/Math.max(1,union),grainError:Math.abs(grainPaint-grainBlend)/Math.max(1,union)});
     }
    }
   }
  }finally{setLiveBlendSample(undefined);}
  return rows;
 });
 for(const row of rows){
  const label=row.id+' '+row.style+' '+row.size;
  expect.soft(row.gaps,label+' sparse input gaps').toBe(0);
  expect.soft(row.iou,label+' coverage').toBeGreaterThanOrEqual(.85);
  expect.soft(row.grainError,label+' mean high-frequency error').toBeLessThan(3);
 }
});
