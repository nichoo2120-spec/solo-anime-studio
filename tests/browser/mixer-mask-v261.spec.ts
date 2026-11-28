import {expect,test} from '@playwright/test';

test('moving Mixer masks match the Paint nib at all three sizes',async({page})=>{
 test.setTimeout(240000);
 await page.goto('/');
 const rows=await page.evaluate(async()=>{
  const load=(path:string)=>import(path);
  const {stockPresets}=await load('/src/core/brushes.ts');
  const {brushStrokeMetadata}=await load('/src/core/paintTips.ts');
  const {drawStroke}=await load('/src/engine/renderer.ts');
  const {drawPigmentBrush}=await load('/src/engine/pigmentBrush.ts');
  const {finalGeometry}=await load('/src/engine/geometryCache.ts');
  const {MixerPreview}=await load('/src/engine/mixerPreview.ts');
  const width=950,height=740;
  const make=()=>Object.assign(document.createElement('canvas'),{width,height});
  const source=make();
  const rows=[];
  for(const preset of stockPresets.filter((p:{category:string})=>p.category!=='Eraser')){
   for(const size of [150,300,500]){
    const common={...preset.settings,id:'first-five',kind:'stroke',tool:'brush',color:'#ffffff',size,pressure:true};
    const blend={...common,...brushStrokeMetadata({...common,bbEnabled:true},true)};
    const reference={...common,...brushStrokeMetadata({...common,bbEnabled:false},true)};
    const preview=new MixerPreview(source),paint=make().getContext('2d')!;
    let minimum=1;
    const points=[];
    for(let i=0;i<5;i++){
     const spacing=size*Math.max(.025,common.tipSpacing??.08);
     points.push({x:320+i*spacing,y:350+i*2,p:.30+i*.035});
     preview.paint({...blend,points},source);
     const stroke={...reference,points};
     paint.clearRect(0,0,width,height);
     if(stroke.brushTip==='color-blender')drawPigmentBrush(paint,stroke,finalGeometry(stroke));
     else drawStroke(paint,stroke);
     const a=paint.getImageData(0,0,width,height).data;
     const b=preview.mask.getContext('2d').getImageData(0,0,width,height).data;
     let intersect=0,union=0;
     for(let j=3;j<a.length;j+=4){
      if(a[j]||b[j])union++;
      if(a[j]&&b[j])intersect++;
     }
     minimum=Math.min(minimum,union?intersect/union:1);
    }
    rows.push({preset:preset.id,size,minimum});
   }
  }
  return rows;
 });
 console.log('MIXER_MASK_ROWS '+JSON.stringify(rows));
 for(const row of rows)expect.soft(row.minimum,row.preset+' at '+row.size).toBeGreaterThanOrEqual(.99);
});
