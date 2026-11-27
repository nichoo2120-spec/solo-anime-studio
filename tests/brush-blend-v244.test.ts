import {describe,it,expect,vi} from 'vitest';
import {newBrushLibrary,restoreBrushLibrary,stockPresets,updatePreset,activePreset} from '../src/core/brushes';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {brushBlendSettingsFor,blendPressureFactor,blendStrengthPresets,blendPresets,blendDefaultsFor,defaultBlendModeFor,blendStyleFor} from '../src/core/brushBlend';
import {newProject,activeLayer,validateProject,type Point,type Stroke} from '../src/core/model';
import {applyBrushBlendLive,renderBrushBlend,resetBrushBlend} from '../src/engine/brushBlend';
import {BrushBlendGestureV2} from '../src/engine/brushBlendStyles';

function surface(width:number,height:number){
 const data=new Uint8ClampedArray(width*height*4),canvas={width,height} as {width:number;height:number;getContext?:()=>unknown};
 const ctx={canvas,
  getImageData(x:number,y:number,w:number,h:number){const out=new Uint8ClampedArray(w*h*4);for(let j=0;j<h;j++)out.set(data.subarray(((y+j)*width+x)*4,((y+j)*width+x+w)*4),j*w*4);return {data:out,width:w,height:h};},
  putImageData(img:{data:Uint8ClampedArray;width:number;height:number},x:number,y:number){for(let j=0;j<img.height;j++)data.set(img.data.subarray(j*img.width*4,(j+1)*img.width*4),((y+j)*width+x)*4);},
  createImageData(w:number,h:number){return {data:new Uint8ClampedArray(w*h*4),width:w,height:h};},
 };
 canvas.getContext=()=>ctx;return {ctx:ctx as unknown as CanvasRenderingContext2D,canvas:canvas as unknown as HTMLCanvasElement,data};
}
const W=260,H=128;
const points:Point[]=Array.from({length:72},(_,i)=>{const t=i/71;return {x:24+t*212,y:64+24*Math.sin(t*Math.PI*2),p:.4+.6*Math.sin(t*Math.PI)};});
function scene(){const c=surface(W,H);for(let y=22;y<106;y++)for(let x=0;x<W;x++)c.data.set(x<W/2?[228,42,53,255]:[34,76,220,255],(y*W+x)*4);return c;}
function mask(){const c=surface(W,H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){for(const p of points)if(Math.hypot(x-p.x,y-p.y)<19){c.data[(y*W+x)*4+3]=255;break;}}return c;}
const hash=(d:Uint8ClampedArray)=>{let h=2166136261;for(let i=0;i<d.length;i++){h^=d[i];h=Math.imul(h,16777619);}return h>>>0;};
function stroke(id='soft-paint',settings:Record<string,unknown>={},version:1|2|3|4|5|6=3):Stroke{
 const preset=stockPresets.find(p=>p.id===id)!;const controls={...preset.settings,bbEnabled:true,...(version<6?{bbPressure:true}:{}),...settings},metadata={...brushStrokeMetadata(controls),...brushBlendSettingsFor(controls,6)} as Record<string,unknown>;
 delete metadata.bbBlur;
 metadata.brushBlendVersion=version;
 if(version<6)for(const key of ['bbStrength','bbMinPressure','bbPressureCurve','bbRenderStyle'])delete metadata[key];
 if(version<3){for(const key of ['bbMode','bbColorCarry','bbSoftness','bbTextureKeep','bbSmoothing','bbEdgeDarkness'])delete metadata[key];if(version===1)delete metadata.bbStyle;metadata.brushBlendVersion=version;}
 const {bbEnabled:_enabled,...base}=controls;
 return {...base,...metadata,id:`blend-${version}-${id}`,kind:'stroke',tool:'brush',color:'#00ff00',size:38,opacity:1,pressure:true,response:1,stabilization:Math.max(preset.settings.stabilization??0,Number(controls.bbSmoothing??0)),points} as Stroke;
}
function stampMask(){const c=surface(W,H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){let hit=false;for(const p of points)if(Math.hypot(x-p.x,y-p.y)<19){hit=true;break;}if(hit&&((x*17+y*31)%13)>4)c.data[(y*W+x)*4+3]=255;}return c;}
function render(s:Stroke,m=mask()){const c=scene();renderBrushBlend(c.ctx,m.canvas,s);return c.data;}
function edgeRoughness(data:Uint8ClampedArray){let sum=0,n=0;for(const y of [50,64,76])for(let x=28;x<W-2;x++){if(x>W/2-14&&x<W/2+14)continue;const a=(y*W+x)*4,b=a+4,c=a+8;for(let ch=0;ch<3;ch++){sum+=Math.abs(data[b+ch]*2-data[a+ch]-data[c+ch]);n++;}}return sum/n;}

describe('Blend settings v0.5.244',()=>{
 it('chooses a useful starting mode while keeping the family style separate',()=>{
  expect(defaultBlendModeFor({brushKind:'watercolor-new',brushTip:'water-wet'})).toBe('wet');
  expect(defaultBlendModeFor({brushKind:'dry-bristle'})).toBe('dry');
  expect(defaultBlendModeFor({brushKind:'g-pen'})).toBe('smudge');
  expect(defaultBlendModeFor({brushKind:'coloring-air'})).toBe('soft');
  const wet=stroke('water-wet',{bbMode:'dry'});expect(wet.bbStyle).toBe(blendStyleFor({brushKind:'watercolor-new',brushTip:'water-wet'}));expect(wet.bbMode).toBe('dry');
 });
 it('all four modes produce different blend dynamics',()=>{
  const hashes=['soft','wet','smudge','dry'].map(bbMode=>hash(render(stroke('soft-paint',{bbMode,bbAmount:.9,bbPickup:.78,bbWetness:.8,bbStretch:.8,bbColorCarry:.62,bbSoftness:.58}))));
  expect(new Set(hashes).size).toBe(4);
 });
 it('every new Blend control changes the resulting pixels',()=>{
  const base={bbMode:'soft',bbAmount:.9,bbPickup:.72,bbWetness:.65,bbMix:.45,bbFlow:.82,bbStretch:.72,bbColorCarry:.5,bbSoftness:.45,bbTextureKeep:0,bbSmoothing:0,bbEdgeDarkness:0};
  const ref=hash(render(stroke('soft-paint',base)));
  for(const [key,value] of Object.entries({bbAmount:.35,bbPickup:.12,bbWetness:.12,bbStretch:.12,bbColorCarry:1,bbSoftness:1,bbTextureKeep:1,bbSmoothing:1,bbEdgeDarkness:1,bbMode:'wet'})){
   expect(hash(render(stroke('soft-paint',{...base,[key]:value}))),key).not.toBe(ref);
  }
 });
 it('offers the four requested presets and resets to family defaults',()=>{
  expect(blendPresets.map(p=>p.name)).toEqual(['Soft blend','Wet blend','Dry blend','Smudge blend']);
  expect(blendPresets.map(p=>p.values.bbMode)).toEqual(['soft','wet','dry','smudge']);
 });
 it('gives each brush family its own v3 blend character',()=>{
  const ids=['color-air','water-smooth','dry-paint','paint','hb','g-pen','color-texture','marker'];
  const outputs=ids.map(id=>render(stroke(id,{bbMode:'smudge',bbAmount:1,bbPickup:.8,bbWetness:.8,bbMix:.55,bbFlow:.9,bbStretch:.75,bbColorCarry:.7,bbSoftness:.45,bbTextureKeep:.9})));
  expect(new Set(outputs.map(hash)).size).toBe(ids.length);
  expect(edgeRoughness(outputs[0])).toBeLessThan(edgeRoughness(outputs[2])*.5);
  expect(blendDefaultsFor(stockPresets.find(p=>p.id==='water-smooth')!.settings,6).bbEdgeDarkness).toBe(0);
  expect(stroke('water-smooth').bbEdgeDarkness).toBe(0);
  expect(stroke('water-edge').bbEdgeDarkness).toBe(1);
 });
 it('ink pulls stay crisp on the stamp edge without black or white halos',()=>{
  const m=stampMask(),out=render(stroke('g-pen',{bbMode:'smudge',bbAmount:1,bbPickup:.9,bbMix:.35,bbStretch:.6,bbColorCarry:.8}),m),before=scene().data;
  let inkPixels=0;for(let i=0;i<out.length;i+=4){if(m.data[i+3]===0)expect(Array.from(out.subarray(i,i+4))).toEqual(Array.from(before.subarray(i,i+4)));else if(out[i]!==before[i]||out[i+1]!==before[i+1]||out[i+2]!==before[i+2]){expect(Math.min(out[i],out[i+1],out[i+2])).toBeGreaterThan(20);inkPixels++;}}
  expect(inkPixels).toBeGreaterThan(100);
 });
 it('uses the real brush stamp as the blend mask, preserving its gaps',()=>{
  const m=stampMask(),s=stroke('paint',{bbMode:'smudge',bbAmount:1,bbPickup:1,bbMix:0,bbStretch:1,bbTextureKeep:1}),out=render(s,m),before=scene().data;
  let changed=0;for(let i=0;i<out.length;i+=4){if(m.data[i+3]===0)expect(Array.from(out.subarray(i,i+4))).toEqual(Array.from(before.subarray(i,i+4)));else if(out[i]!==before[i]||out[i+1]!==before[i+1]||out[i+2]!==before[i+2])changed++;}
  expect(changed).toBeGreaterThan(100);
 });
 it('oil pulls colour in the stroke direction instead of applying a blur',()=>{
  const base=stroke('paint',{bbMode:'smudge',bbAmount:1,bbPickup:.9,bbMix:.35,bbStretch:1,bbColorCarry:.9,bbSoftness:.6});
  const forward=render(base),reverse=render({...base,points:[...base.points].reverse()});
  expect(hash(forward)).not.toBe(hash(reverse));
 });
 it('stores settings per brush and restores them from the saved brush library',()=>{
  let lib=newBrushLibrary();lib={...lib,brushId:'paint'};const p=activePreset(lib);
  lib=updatePreset(lib,'paint',{...p.settings,bbEnabled:true,bbMode:'wet',bbColorCarry:.91,bbSoftness:.23,bbTextureKeep:.82,bbSmoothing:.55,bbEdgeDarkness:.4,bbStretch:.76});
  const saved=restoreBrushLibrary(JSON.parse(JSON.stringify(lib)));
  expect(activePreset(saved).settings).toMatchObject({bbEnabled:true,bbMode:'wet',bbColorCarry:.91,bbSoftness:.23,bbTextureKeep:.82,bbSmoothing:.55,bbEdgeDarkness:.4,bbStretch:.76});
  expect(saved.presets.find(x=>x.id==='hb')!.settings.bbMode).toBeUndefined();
 });
 it('accepts v3 strokes while keeping legacy v1 and v2 golden pixels fixed',()=>{
  const v1=render(stroke('soft-paint',{bbAmount:.83,bbPickup:.62,bbWetness:.34,bbMix:.57,bbFlow:.61,bbStretch:.49},1));
  const v2=render(stroke('water-wet',{bbAmount:.9,bbPickup:.5,bbWetness:.7,bbMix:.6,bbFlow:.7,bbStretch:.52},2));
  expect([hash(v1),hash(v2)]).toEqual([3938442574,273843913]);
  const p=newProject();activeLayer(p).operations=[stroke('water-wet',{bbMode:'wet'})];expect(()=>validateProject(JSON.parse(JSON.stringify(p)))).not.toThrow();
 });
});

describe('Blend stroke v4',()=>{
 it('validates, keeps historical v3 pixels, and leaves Silk Blend on its own engine',()=>{
  const legacyTexture={'water-wet':.48,'dry-paint':.8,hb:.62,paint:.42,marker:.08,'g-pen':.08,'soft-paint':.08,'color-texture':.62};
  const legacyIds=['water-wet','g-pen','soft-paint','dry-paint','hb','paint','marker','color-texture'] as const;
  const old=legacyIds.map(id=>stroke(id,{bbTextureKeep:legacyTexture[id],...(id==='hb'?{bbColorCarry:.78}:{})},3));
  expect(old.map(s=>hash(render(s)))).toEqual([2524874400,688513792,1353112674,4108793486,451321915,643636958,4217570115,377647135]);
  const p=newProject(),s=stroke('water-wet',{},4);
  activeLayer(p).operations=[...old,s];
  expect(()=>validateProject(JSON.parse(JSON.stringify(p)))).not.toThrow();
  const silk=stockPresets.find(p=>p.id==='silk-blend')!.settings;
  expect(brushStrokeMetadata({...silk,bbEnabled:true})).toEqual(brushStrokeMetadata(silk));
 });
 it('keeps non-air materials sharp even with Soft selected',()=>{
  const options={bbWetness:1,bbSoftness:1,bbMix:.2,bbFlow:1};
  const m=mask(),kernel=vi.spyOn(BrushBlendGestureV2.prototype as unknown as {build:()=>void},'build');
  try{
   for(const bbMode of ['soft','wet','smudge','dry']){
    for(const id of ['color-air','soft-paint','water-smooth','dry-paint','paint','hb','g-pen','marker','color-texture']){
     const s={...stroke(id,{...options,bbMode},4),points:[{x:120.5,y:64.5,p:1}],pressure:false};
     kernel.mockClear();render(s,m);
     expect(kernel.mock.calls.length,id+' '+bbMode).toBe(id==='color-air'||id==='soft-paint'?1:0);
    }
   }
  }finally{kernel.mockRestore();}
  expect(blendStyleFor({brushKind:'coloring-soft',tsEnabled:true})).toBe('texture');
  expect(blendStyleFor({brushKind:'coloring-air',dbEnabled:true,dbTip:'chalk'})).toBe('texture');
  expect(blendStyleFor({brushKind:'ink-pen'})).toBe('ink');
  for(const brushKind of ['crayon','charcoal'])expect(blendStyleFor({brushKind})).toBe('pencil');
 });
 it('uses wetness and paper grain to spread watercolor while reserving the tide line for Watercolor Edge',()=>{
  const full=surface(W,H);for(let i=3;i<full.data.length;i+=4)full.data[i]=255;
  const base={...stroke('water-wet',{bbWetness:1,bbMix:0,bbFlow:1,bbAmount:1},4),points:[{x:80,y:64,p:1},{x:170,y:64,p:1}],pressure:false};
  const pigment=()=>{const c=surface(W,H);
   for(let y=25;y<103;y++)for(let x=25;x<110;x++)c.data.set([220,65,98,255],(y*W+x)*4);
   return c;
  };
  const draw=(s:Stroke)=>{const c=pigment();renderBrushBlend(c.ctx,full.canvas,s);return c.data;};
  const wet=draw(base),dry=draw({...base,bbWetness:0}),fine=draw({...base,bbTextureKeep:0}),edge=draw({...base,bbEdgeDarkness:1});
  const spread=(pixels:Uint8ClampedArray)=>{let total=0;for(let y=25;y<103;y++)for(let x=110;x<W;x++)total+=pixels[(y*W+x)*4+3];return total;};
  expect(spread(wet)).toBeGreaterThan(spread(dry));
  const protectedEdge=draw({...base,bbEdgeDarkness:1,bbProtectAlpha:true}),original=pigment().data;
  expect(protectedEdge.every((v,i)=>i%4!==3||v===original[i])).toBe(true);
  expect(hash(wet)).not.toBe(hash(fine));
  expect(hash(wet)).not.toBe(hash(edge));
  for(let i=0;i<wet.length;i+=4)if(wet[i+3]>0)expect(wet[i]).toBe(220);
  expect(stroke('water-wet',{},4).bbEdgeDarkness).toBe(0);
  expect(stroke('water-edge',{},4).bbEdgeDarkness).toBe(1);
 });
 it('keeps ink and marker alpha and color bounds across transparent texels',()=>{
  const m=stampMask();
  for(const id of ['g-pen','marker']){
   const c=scene();
   for(let y=22;y<106;y++)for(let x=0;x<W;x++)if((x+y)%7===0)c.data[(y*W+x)*4+3]=80;
   const before=c.data.slice();
   renderBrushBlend(c.ctx,m.canvas,stroke(id,{bbMode:'wet',bbWetness:1,bbSoftness:1,bbMix:.1,bbEdgeDarkness:1},4));
   expect(hash(c.data)).not.toBe(hash(before));
   for(let i=0;i<c.data.length;i+=4){
    if(c.data[i+3]!==before[i+3])throw Error(id+' changed coverage');
    if(!m.data[i+3]&&c.data.subarray(i,i+4).some((v,k)=>v!==before[i+k]))throw Error(id+' filled a gap');
    if(c.data[i+3]&&(c.data[i]<34||c.data[i]>228||c.data[i+1]<42||c.data[i+1]>76||c.data[i+2]<53||c.data[i+2]>220))throw Error(id+' created a halo');
   }
  }
 });
 it('makes dry brush and chalk break up the pull without filling mask gaps',()=>{
  const m=stampMask(),before=scene().data;
  const s=stroke('dry',{bbAmount:1,bbFlow:1,bbMix:.1,bbStretch:1,bbTextureKeep:1},4);
  const dry=render(s,m),smooth=render({...s,bbTextureKeep:0},m);
  let broken=0,changed=0;
  for(let i=0;i<dry.length;i+=4){
   const moved=dry[i]!==before[i]||dry[i+1]!==before[i+1]||dry[i+2]!==before[i+2]||dry[i+3]!==before[i+3];
   if(!m.data[i+3]&&moved)throw Error('Filled a dry brush gap');
   if(moved)changed++;
   else if(smooth[i]!==before[i]||smooth[i+1]!==before[i+1]||smooth[i+2]!==before[i+2])broken++;
  }
  expect(changed).toBeGreaterThan(100);
  expect(broken).toBeGreaterThan(100);
 });
 it('keeps graphite pulls short and oil pulls directional',()=>{
  const before=scene().data,m=mask(),s={...stroke('hb',{bbMode:'smudge',bbPickup:.7,bbColorCarry:.9,bbMix:.1,bbStretch:1},4),points:[{x:62,y:64,p:1},{x:224,y:64,p:1}]};
  const oil={...stroke('paint',{bbMode:'smudge',bbPickup:.7,bbColorCarry:.9,bbMix:.1,bbStretch:1},4),points:s.points};
  const pen=render(s,m),paint=render(oil,m),back=render({...oil,points:[...oil.points].reverse()},m);
  const delta=(data:Uint8ClampedArray,left:number)=>{let n=0;for(let y=40;y<89;y++)for(let x=left;x<221;x++){const i=(y*W+x)*4;n+=Math.abs(data[i]-before[i]);}return n;};
  expect(delta(pen,139)).toBeGreaterThan(0);
  expect(delta(pen,157)).toBeLessThan(delta(paint,157)*.6);
  expect(delta(paint,157)).toBeGreaterThan(delta(back,157));
 });
 it('reaches the stretched stamp footprint while leaving its gaps and matching final replay',()=>{
  const s={...stroke('soft-paint',{tsEnabled:true,tsScaleX:3,tsAngle:90,dbEnabled:true,dbTip:'chalk',dbMode:'subtract',dbScatter:1,bbFlow:1,bbMix:.05,bbStretch:1},4),
   points:[{x:40,y:64,p:.45},{x:220,y:64,p:.75}]};
  expect(s).toMatchObject({stampVersion:1,bbStyle:'texture',dbTip:'chalk',dbScatter:1});
  const m=surface(W,H);
  for(let y=22;y<106;y++)for(let x=20;x<240;x++)if((x+y)%7<4)m.data[(y*W+x)*4+3]=120+(y%5)*25;
  const base=scene(),expected=render(s,m),worker=scene();
  try{
   applyBrushBlendLive(worker.ctx,m.canvas,s,base.canvas,false,s.points.slice(0,1));
   applyBrushBlendLive(worker.ctx,m.canvas,s,base.canvas,true,s.points);
  }finally{resetBrushBlend();}
  expect(worker.data).toEqual(expected);
  let outer=0;
  for(let i=0;i<expected.length;i+=4){
   if(!m.data[i+3]&&expected.subarray(i,i+4).some((v,k)=>v!==base.data[i+k]))throw Error('Filled a custom stamp gap');
   if(Math.abs(Math.floor(i/4/W)-64)>27&&expected[i]!==base.data[i])outer++;
  }
  expect(outer).toBeGreaterThan(100);
 });
});


describe('Watercolor Blend v5',()=>{
 it('versions newly created Blend strokes and keeps saved v4 pixels identical',()=>{
  const ids=['water-smooth','water-wet','water-rough','water-flat','water-edge'];
  const metadata=ids.map(id=>brushStrokeMetadata({...stockPresets.find(p=>p.id===id)!.settings,bbEnabled:true}));
  expect(metadata.map(s=>s.brushBlendVersion)).toEqual([7,7,7,7,7]);
  expect(ids.map(id=>hash(render(stroke(id,{},4))))).toEqual([2316611864,1919703141,3050506906,3210628171,2682126738]);
  const shaped=stockPresets.find(p=>p.id==='water-flat')!.settings;
  expect(brushStrokeMetadata({...shaped,bbEnabled:true,tsEnabled:true}).brushBlendVersion).toBe(7);
  const p=newProject();
  activeLayer(p).operations=ids.slice(0,4).map(id=>stroke(id,{},5));
  expect(()=>validateProject(JSON.parse(JSON.stringify(p)))).not.toThrow();
  activeLayer(p).operations=[stroke('soft-paint',{},5)];
  expect(()=>validateProject(JSON.parse(JSON.stringify(p)))).toThrow();
 });
 it('gives rough a broken deposit and flat a firm edge under the same settings',()=>{
  const m=surface(W,H);for(let i=3;i<m.data.length;i+=4)m.data[i]=255;
  const options={bbAmount:1,bbFlow:1,bbMix:.25,bbStretch:1,bbSoftness:.55,bbWetness:.5};
  const path=[{x:75,y:64,p:1},{x:207,y:64,p:1}];
  const draw=(id:string)=>render({...stroke(id,options,5),id:'water-feel',pressure:false,points:path},m);
  const before=scene().data;
  const [smooth,rough,flat]=['water-smooth','water-rough','water-flat'].map(draw);
  const change=(pixels:Uint8ClampedArray,x:number,y:number)=>Math.abs(pixels[(y*W+x)*4]-before[(y*W+x)*4]);
  const band=(pixels:Uint8ClampedArray,y:number)=>{
   let sum=0;for(let x=135;x<157;x++)sum+=change(pixels,x,y);return sum;
  };
  expect(band(smooth,64)).toBeGreaterThan(0);
  expect(band(flat,80)/band(flat,64)).toBeGreaterThan(band(smooth,80)/band(smooth,64)+.12);
  let gaps=0,painted=0;
  for(let y=55;y<74;y++)for(let x=135;x<157;x++){
   if(change(rough,x,y)<2&&change(smooth,x,y)>12)gaps++;
   if(change(rough,x,y)>12)painted++;
  }
  expect(gaps).toBeGreaterThan(10);
  expect(painted).toBeGreaterThan(10);
 });
});

describe('Version 6 Blend strength and pressure',()=>{
 const testMask=mask();
 const sample=(id:string,pressure:number,settings:Partial<Stroke>={})=>{
  const s=stroke(id,{},6);
  return {...s,pressureWidth:false,points:points.map(p=>({...p,p:pressure})),...settings};
 };
 const before=scene().data;
 const delta=(s:Stroke)=>render(s,testMask).reduce((sum,v,i)=>sum+Math.abs(v-before[i]),0);
 it.each(['water-smooth','water-wet','water-flat','water-rough','dry-paint','paint','hb','g-pen','marker','color-air','soft-paint','color-texture'])(
  'keeps %s active at light pressure with its original footprint',
  id=>{
   const full=sample(id,1),fullDelta=delta(full);
   expect(fullDelta).toBeGreaterThan(100);
   for(const p of [.1,.5,1]){
    expect(delta(sample(id,p))).toBe(fullDelta);
    expect(delta(sample(id,p,{bbPressure:true}))).toBeGreaterThanOrEqual(fullDelta*.7);
   }
  }
 );
 it('tracks the configured Paint opacity within 10% at each pressure',()=>{
  for(const id of ['water-smooth','water-wet','water-flat','water-rough']){
   const opacity=stockPresets.find(p=>p.id===id)!.settings.opacity;
   for(const p of [.1,.5,1]){
    const full=delta(sample(id,p));
    const relative=delta(sample(id,p,{opacity}))/full;
    expect(Math.abs(relative-opacity),`${id}, pressure ${p}`).toBeLessThanOrEqual(.1*opacity);
   }
  }
 });
 it('changes rendered output for strength, pressure curves, floor and style',()=>{
  const watercolor=sample('water-flat',.1);
  const normal=delta(watercolor);
  expect(delta({...watercolor,bbStrength:0})).toBe(0);
  expect(delta({...watercolor,bbStrength:.5})).toBeLessThan(normal);
  expect(delta({...watercolor,bbStrength:2})).toBeGreaterThan(normal);
  const pressure={...watercolor,bbPressure:true};
  expect(delta(pressure)).toBeLessThan(normal);
  expect(delta({...pressure,bbMinPressure:0})).toBeLessThan(delta(pressure));
  expect(delta({...pressure,bbPressureCurve:'soft'})).toBeGreaterThan(delta(pressure));
  expect(delta({...pressure,bbPressureCurve:'firm'})).toBeLessThan(delta(pressure));
  const styles=['auto','blur','wet','smudge','dry'] as const;
  const textured=sample('color-texture',.1);
  expect(new Set(styles.map(bbRenderStyle=>hash(render({...textured,bbRenderStyle},testMask)))).size).toBe(styles.length);
 });
 it('applies the minimum pressure floor on every curve',()=>{
  for(const curve of ['soft','linear','firm'] as const){
   const factors=[.1,.5,1].map(p=>blendPressureFactor(p,.7,curve));
   expect(factors[0]).toBeGreaterThanOrEqual(.7);
   expect(factors[1]).toBeGreaterThan(factors[0]);
   expect(factors[2]).toBe(1);
  }
 });
 it('saves settings per brush and validates the new fields only on v6',()=>{
  const lib=newBrushLibrary(),water=lib.presets.find(p=>p.id==='water-flat')!;
  const settings={bbStrength:1.75,bbPressure:true,bbMinPressure:.85,bbPressureCurve:'firm',bbRenderStyle:'dry'} as const;
  const saved=restoreBrushLibrary(JSON.parse(JSON.stringify(updatePreset(lib,water.id,{...water.settings,...settings}))));
  expect(saved.presets.find(p=>p.id===water.id)!.settings).toMatchObject(settings);
  expect(saved.presets.find(p=>p.id==='hb')!.settings.bbStrength).toBeUndefined();
  expect(blendStrengthPresets).toEqual([{name:'Light blend',strength:.5},{name:'Normal blend',strength:1},{name:'Strong blend',strength:1.6}]);
  const p=newProject(),s=sample('water-flat',.1,settings);
  activeLayer(p).operations=[s];
  expect(()=>validateProject(JSON.parse(JSON.stringify(p)))).not.toThrow();
  for(const invalid of [{bbStrength:2.01},{bbMinPressure:-.01},{bbPressureCurve:'paint'},{bbRenderStyle:'toString'},{brushBlendVersion:5}]){
   activeLayer(p).operations=[{...s,...invalid} as Stroke];
   expect(()=>validateProject(JSON.parse(JSON.stringify(p)))).toThrow();
  }
 });
});
