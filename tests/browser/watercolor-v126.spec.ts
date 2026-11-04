import {test,expect} from '@playwright/test';

test('watercolor pigment joins cache edges, arbitrary redraw crops and negative world positions without repeating',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {erodeWatercolorGrain}=await import('/src/engine/watercolorGrain.ts');
  const render=(x:number,y:number,w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);erodeWatercolorGrain(ctx,1,x,y,w,h);return ctx.getImageData(0,0,w,h).data;};
  const w=1152,h=1152,a=render(-137,-151,w,h),repeat:Record<string,number>={};let edge=0,ordinary=0,ne=0,no=0;
  for(const shift of [128,256,512])for(const axis of ['x','y']){let same=0,n=0;for(let y=0;y<h-shift;y+=2)for(let x=0;x<w-shift;x+=2){same+=Number(a[(y*w+x)*4+3]===a[((y+(axis==='y'?shift:0))*w+x+(axis==='x'?shift:0))*4+3]);n++;}repeat[axis+shift]=same/n;}
  for(let y=1;y<h;y++)for(let x=1;x<w;x++){const alpha=a[(y*w+x)*4+3];for(const [boundary,delta] of [[(x-137)%128===0,4],[(y-151)%128===0,w*4]] as const){const diff=Math.abs(alpha-a[(y*w+x)*4+3-delta]);if(boundary){edge+=diff;ne++;}else{ordinary+=diff;no++;}}}
  let cropDifference=0;
  for(const [x,y,cw,ch] of [[-7,43,333,197],[437,113,300,160],[-129,-145,280,260]]){const b=render(x,y,cw,ch);for(let yy=0;yy<ch;yy++)for(let xx=0;xx<cw;xx++)cropDifference=Math.max(cropDifference,Math.abs(b[(yy*cw+xx)*4+3]-a[((yy+y+151)*w+xx+x+137)*4+3]));}
  // Force cache eviction, then reconstruct the same document region.
  render(4096,4096,2304,2048);const again=render(-137,-151,257,219);let evictionDifference=0;
  for(let y=0;y<219;y++)for(let x=0;x<257;x++)evictionDifference=Math.max(evictionDifference,Math.abs(again[(y*257+x)*4+3]-a[(y*w+x)*4+3]));
  return {repeat,edge:edge/ne,ordinary:ordinary/no,cropDifference,evictionDifference};
 });
 console.log('WATERCOLOR_CONTINUITY',JSON.stringify(result));
 expect(result.cropDifference).toBe(0);expect(result.evictionDifference).toBe(0);
 expect(result.edge).toBeLessThan(result.ordinary*1.2);
 for(const same of Object.values(result.repeat))expect(same).toBeLessThan(.08);
});

test('old and new watercolor strokes stay identical between incremental preview and saved replay',async({page})=>{
 test.setTimeout(180000);await page.goto('/');
 const rows=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts'),{brushStrokeMetadata}=await import('/src/core/paintTips.ts'),{drawModernStroke}=await import('/src/engine/brushRaster.ts'),{LiveStrokeRaster}=await import('/src/engine/liveRaster.ts'),{strokeGeometry}=await import('/src/engine/strokeGeometry.ts');
  const settings=stockPresets.find(p=>p.id==='watercolor')!.settings,rows=[];
  for(const version of [1,2])for(const size of [1,12,150])for(const pressure of [false,true]){
   const s:any={...settings,...brushStrokeMetadata(settings),paintTipVersion:version,...(version===1?{brushTip:'wash',watercolorVersion:undefined}:{}),id:'watercolor-'+version+'-'+size+'-'+pressure,kind:'stroke',tool:'brush',size,pressure,flow:.14,opacity:.37,taperStart:.08,taperEnd:.12,points:[]};
   const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=1100;a.height=b.height=700;
   const ac=a.getContext('2d')!,bc=b.getContext('2d')!,live=new LiveStrokeRaster();let max=0;
   for(let i=0;i<=600;i++){s.points.push({x:100+900*i/600,y:350+240*Math.sin(i/600*Math.PI*7.3),p:.1+.9*Math.sin(i/600*Math.PI)**2});if(i%25)continue;const g=strokeGeometry(s,'live');live.paint(ac,s,g);if(i%150===0){bc.clearRect(0,0,1100,700);drawModernStroke(bc,s,'live',g);const x=ac.getImageData(0,0,1100,700).data,y=bc.getImageData(0,0,1100,700).data;for(let j=0;j<x.length;j++)max=Math.max(max,Math.abs(x[j]-y[j]));}}
   const g=strokeGeometry(s);live.paint(ac,s,g);bc.clearRect(0,0,1100,700);drawModernStroke(bc,JSON.parse(JSON.stringify(s)),'final',g);const x=ac.getImageData(0,0,1100,700).data,y=bc.getImageData(0,0,1100,700).data;for(let j=0;j<x.length;j++)max=Math.max(max,Math.abs(x[j]-y[j]));
   rows.push({version,size,pressure,max});live.reset();
  }return rows;
 });
 console.log('WATERCOLOR_PREVIEW_REPLAY',JSON.stringify(rows));for(const row of rows)expect(row.max,JSON.stringify(row)).toBe(0);
});

test('watercolor flow and overlapping passes build gradually, pressure and opacity still work',async({page})=>{
 await page.goto('/');const r=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts'),{brushStrokeMetadata}=await import('/src/core/paintTips.ts'),{drawModernStroke}=await import('/src/engine/brushRaster.ts');const settings=stockPresets.find(p=>p.id==='watercolor')!.settings;
  const render=(flow:number,opacity:number,pressure:number|false=false,passes=1)=>{const c=document.createElement('canvas'),out=document.createElement('canvas');c.width=out.width=700;c.height=out.height=220;const ctx=c.getContext('2d')!,oc=out.getContext('2d')!;
   const s:any={...settings,...brushStrokeMetadata(settings),id:'dynamics',kind:'stroke',tool:'brush',size:150,smoothness:0,stabilization:0,flow,pressure:pressure!==false,pressureWidth:false,pressureOpacity:false,pressureFlow:true,points:[{x:70,y:110,p:pressure||1},{x:630,y:110,p:pressure||1}]};
   drawModernStroke(ctx,s);oc.globalAlpha=opacity;for(let i=0;i<passes;i++)oc.drawImage(c,0,0);const data=oc.getImageData(0,0,700,220).data;let mass=0,max=0;for(let i=3;i<data.length;i+=4){mass+=data[i];max=Math.max(max,data[i]);}return {mass,max};};
  return {one:render(.08,1),two:render(.08,1,false,2),four:render(.08,1,false,4),high:render(.6,1),zero:render(0,1),invisible:render(.6,0),opacity:render(.6,.2),light:render(.14,1,.15),heavy:render(.14,1,1)};
 });
 console.log('WATERCOLOR_DYNAMICS',JSON.stringify(r));expect(r.two.mass).toBeGreaterThan(r.one.mass*1.3);expect(r.four.mass).toBeGreaterThan(r.two.mass*1.2);expect(r.high.mass).toBeGreaterThan(r.one.mass*1.5);expect(r.zero.mass).toBe(0);expect(r.invisible.mass).toBe(0);expect(r.opacity.max).toBeLessThanOrEqual(51);expect(r.light.mass).toBeLessThan(r.heavy.mass*.5);
});

test('watercolor does not use repeating Canvas patterns in either saved-stroke path',async({page})=>{
 await page.goto('/');const r=await page.evaluate(async()=>{
  const {stockPresets}=await import('/src/core/brushes.ts'),{brushStrokeMetadata}=await import('/src/core/paintTips.ts'),{drawModernStroke}=await import('/src/engine/brushRaster.ts');const settings=stockPresets.find(p=>p.id==='watercolor')!.settings,proto=CanvasRenderingContext2D.prototype,pattern=proto.createPattern;let patterns=0;
  proto.createPattern=function(...args){patterns++;return pattern.apply(this,args);};
  try{for(const version of [1,2]){const c=document.createElement('canvas');c.width=1200;c.height=900;const s:any={...settings,...brushStrokeMetadata(settings),paintTipVersion:version,...(version===1?{brushTip:'wash',watercolorVersion:undefined}:{}),id:'no-tiled-wash',kind:'stroke',tool:'brush',size:150,pressure:false,points:[{x:50,y:450,p:1},{x:1150,y:450,p:1}]};drawModernStroke(c.getContext('2d')!,s);}}finally{proto.createPattern=pattern;}return patterns;
 });expect(r).toBe(0);
});
