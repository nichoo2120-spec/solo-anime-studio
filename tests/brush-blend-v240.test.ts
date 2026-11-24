import {describe,it,expect} from 'vitest';
import {stockPresets,newBrushLibrary,restoreBrushLibrary,updatePreset,activePreset} from '../src/core/brushes';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {newProject,activeLayer,validateProject,appendOperation,type Stroke,type Point} from '../src/core/model';
import {DocumentStore} from '../src/core/history';
import {blendDefaults,blendPresets,brushBlendMetadata,canBrushBlend} from '../src/core/brushBlend';
import {renderBrushBlend,applyBrushBlendLive,resetBrushBlend,decodeCarry} from '../src/engine/brushBlend';
import {initialShortcuts,normalizeShortcuts,commandLabels} from '../src/core/shortcuts';

function surface(width:number,height:number){
 const data=new Uint8ClampedArray(width*height*4);
 const canvas={width,height} as {width:number;height:number;getContext?:()=>unknown};
 const ctx={canvas,
  getImageData(x:number,y:number,w:number,h:number){const out=new Uint8ClampedArray(w*h*4);for(let j=0;j<h;j++)out.set(data.subarray(((y+j)*width+x)*4,((y+j)*width+x+w)*4),j*w*4);return {data:out,width:w,height:h};},
  putImageData(img:{data:Uint8ClampedArray;width:number;height:number},x:number,y:number){for(let j=0;j<img.height;j++)data.set(img.data.subarray(j*img.width*4,(j+1)*img.width*4),((y+j)*width+x)*4);},
  createImageData(w:number,h:number){return {data:new Uint8ClampedArray(w*h*4),width:w,height:h};},
 };
 canvas.getContext=()=>ctx;
 return {ctx:ctx as unknown as CanvasRenderingContext2D,canvas:canvas as unknown as HTMLCanvasElement,data};
}
const W=420,H=200;
function scene(){const s=surface(W,H);for(let y=30;y<170;y++)for(let x=0;x<W;x++)s.data.set(x<W/2?[230,30,40,255]:[20,70,220,255],(y*W+x)*4);return s;}
/** A brush mask standing in for the brush's own raster: grainy (every 3rd column weaker). */
function mask(points:Point[],r=26,grain=false){const m=surface(W,H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){let a=0;for(const p of points){const d=Math.hypot(x-p.x,y-p.y);if(d<r){a=255;break;}}if(a&&grain&&x%3===0)a=90;if(a)m.data[(y*W+x)*4+3]=a;}return m;}
const paint=stockPresets.find(p=>p.id==='soft-paint')!;
function stroke(points:Point[],blend:Record<string,unknown>={},patch:Partial<Stroke>={}):Stroke{
 const settings={...paint.settings,bbEnabled:true,...blend};
 const {bbEnabled:_e,...plain}=settings;
 // v0.5.240 strokes (brushBlendVersion 1): the frozen v1 recipe is tested here; v2 lives in brush-blend-v242.test.ts.
 const {bbStyle:_st,...meta}=brushStrokeMetadata(settings) as Record<string,unknown>;
 return {...plain,...meta,brushBlendVersion:1,id:'bb',kind:'stroke',tool:'brush',color:'#00ff00',size:40,opacity:1,pressure:true,response:1,points,...patch} as Stroke;
}
const line=(x0:number,x1:number,y:number,n=60)=>Array.from({length:n},(_,i)=>{const t=i/(n-1);return {x:x0+(x1-x0)*t,y,p:.4+.6*Math.sin(t*Math.PI)};});
const hash=(d:Uint8ClampedArray)=>{let h=2166136261;for(let i=0;i<d.length;i++){h^=d[i];h=Math.imul(h,16777619);}return h>>>0;};
const run=(s:Stroke,grain=false)=>{const c=scene(),m=mask(s.points,26,grain);renderBrushBlend(c.ctx,m.canvas,s);return c;};

describe('Paint / Blend switch v0.5.240',()=>{
 it('every paint brush can blend; blenders and erasers do not get the switch',()=>{
  const can=stockPresets.filter(p=>p.category!=='Eraser'&&canBrushBlend(p.settings)).map(p=>p.id);
  expect(can).toContain('hb');expect(can).toContain('g-pen');expect(can).toContain('paint');expect(can).toContain('water-wet');expect(can).toContain('color-air');
  expect(can).not.toContain('silk-blend');expect(can).not.toContain('color-blender');expect(can).not.toContain('wet-mix');
 });
 it('Paint mode strokes carry no new fields, so old and Paint drawings stay byte-identical',()=>{
  for(const p of stockPresets){const m=brushStrokeMetadata(p.settings) as Record<string,unknown>;expect(Object.keys(m).filter(k=>k.startsWith('bb')||k==='brushBlendVersion'),p.id).toEqual([]);
   const off=brushStrokeMetadata({...p.settings,bbEnabled:false,bbAmount:.2,bbSample:'all'});expect(JSON.stringify(off),p.id).toBe(JSON.stringify(m));}
  expect(brushBlendMetadata({brushKind:'paint'})).toEqual({});
  expect(brushStrokeMetadata({...paint.settings,bbEnabled:true})).toMatchObject({brushBlendVersion:2,bbStyle:'soft',...blendDefaults});
 });
 it('Blend mode adds no brush colour and blends the colours already there',()=>{
  const s=stroke(line(120,320,100)),c=run(s),before=scene().data;let changed=0,green=0;
  for(let i=0;i<c.data.length;i+=4){if(c.data[i]!==before[i]||c.data[i+2]!==before[i+2])changed++;if(c.data[i+3]>20&&c.data[i+1]>Math.max(c.data[i],c.data[i+2])+15)green++;}
  expect(changed).toBeGreaterThan(2000);expect(green).toBe(0);
  const at=(x:number,y:number)=>Array.from(c.data.subarray((y*W+x)*4,(y*W+x)*4+4));expect(at(225,100)[0],'red carried into blue').toBeGreaterThan(30);
 });
 it('follows the brush\'s own mask: a grainy tip blends grainy, nothing outside the mask changes',()=>{
  const s=stroke(line(120,320,100)),smooth=run(s),grainy=run(s,true),m=mask(s.points,26),before=scene().data;
  expect(hash(smooth.data)).not.toBe(hash(grainy.data));
  for(let i=0;i<before.length;i+=4)if(!m.data[i+3])expect(smooth.data[i]===before[i]&&smooth.data[i+3]===before[i+3]).toBe(true);
 });
 it('every setting changes the result, and presets set documented values',()=>{
  const pts=line(120,320,100),ref=hash(run(stroke(pts)).data);
  for(const [k,v] of [['bbAmount',.3],['bbPickup',1],['bbWetness',1],['bbMix',0],['bbFlow',.2],['bbStretch',0],['bbPaintLoad',.5],['bbPressure',false]] as const)expect(hash(run(stroke(pts,{[k]:v})).data),k).not.toBe(ref);
  expect(blendPresets.map(p=>p.name)).toEqual(['Soft blend','Smudge','Wet mix']);
  expect(hash(run(stroke(pts,{bbAmount:0})).data)).toBe(hash(scene().data));
 });
 it('Protect transparency never adds alpha to empty pixels',()=>{
  const s=stroke([{x:200,y:20,p:1},{x:200,y:190,p:1}],{bbProtectAlpha:true,bbPaintLoad:.5}),c=run(s),b=scene().data;
  for(let i=3;i<b.length;i+=4)if(b[i]===0)expect(c.data[i]).toBe(0);
 });
 it('Clean brush off: a carried colour changes how the stroke starts',()=>{
  const carry=btoa(String.fromCharCode(...Array.from({length:64},()=>[250,220,20,255]).flat()));
  expect(decodeCarry(carry)).toBeDefined();expect(decodeCarry('bad!')).toBeUndefined();
  const pts=line(60,200,100);expect(hash(run(stroke(pts,{},{bbCarry:carry})).data)).not.toBe(hash(run(stroke(pts)).data));
 });
 it('live incremental pieces end in exactly the reload pixels',()=>{
  const full=stroke(line(60,360,100,140)),one=run(full),base=scene(),live=scene(),m=mask(full.points,26);resetBrushBlend();
  for(const n of [1,2,7,20,21,55,90,139,140])applyBrushBlendLive(live.ctx,m.canvas,{...full,points:full.points.slice(0,n)},base.canvas,false,full.points.slice(0,n));
  expect(hash(live.data)).not.toBe(hash(scene().data));
  applyBrushBlendLive(live.ctx,m.canvas,full,base.canvas,true,full.points);
  expect(hash(live.data)).toBe(hash(one.data));expect(Array.from(base.data)).toEqual(Array.from(scene().data));
 });
 it('saves and reloads Blend settings with each brush, and cleans bad values',()=>{
  let lib=newBrushLibrary();lib={...lib,brushId:'paint'};
  lib=updatePreset(lib,'paint',{...activePreset(lib).settings,bbEnabled:true,bbAmount:.31,bbPickup:.12,bbWetness:.9,bbMix:.2,bbFlow:.4,bbStretch:.8,bbSample:'all',bbClean:false,bbPaintLoad:.1,bbPressure:false,bbProtectAlpha:true});
  const back=restoreBrushLibrary(JSON.parse(JSON.stringify(lib)));
  expect(activePreset(back).settings).toMatchObject({bbEnabled:true,bbAmount:.31,bbPickup:.12,bbWetness:.9,bbMix:.2,bbFlow:.4,bbStretch:.8,bbSample:'all',bbClean:false,bbPaintLoad:.1,bbPressure:false,bbProtectAlpha:true});
  expect(back.presets.find(p=>p.id==='hb')!.settings.bbEnabled,'saved per brush').toBeUndefined();
  const bad=JSON.parse(JSON.stringify(lib)),bp=bad.presets.find((p:{id:string})=>p.id==='paint');bp.settings={...bp.settings,bbAmount:7,bbPickup:-2,bbSample:'moon',bbClean:'x'};
  expect(activePreset(restoreBrushLibrary(bad)).settings).toMatchObject({bbAmount:1,bbPickup:0});
  expect(activePreset(restoreBrushLibrary(bad)).settings.bbSample).not.toBe('moon');
  const silk=restoreBrushLibrary(JSON.parse(JSON.stringify({...lib,presets:lib.presets.map(p=>p.id==='silk-blend'?{...p,settings:{...p.settings,bbEnabled:true}}:p)})));
  expect(silk.presets.find(p=>p.id==='silk-blend')!.settings.bbEnabled).toBeUndefined();
 });
 it('saves Blend strokes in projects and rejects broken Blend data',()=>{
  const p=newProject(),s=stroke(line(10,90,40,10),{bbSample:'all'},{bbSamplePng:'data:image/png;base64,AAAA',bbSampleRect:{x:0,y:0,width:10,height:10},bbCarry:'AAAA'});activeLayer(p).operations=[s];
  expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  for(const patch of [{bbAmount:2},{bbSample:'moon'},{brushBlendVersion:3},{bbStyle:'water'},{tool:'eraser'},{bbClean:'yes'},{bbSampleRect:{x:0,y:0,width:.5,height:1}},{bbSamplePng:'http://x'},{bbCarry:'<script>'},{bbWhatever:1}] as unknown as Partial<Stroke>[]){activeLayer(p).operations=[{...s,...patch} as Stroke];expect(()=>validateProject(JSON.parse(JSON.stringify(p))),JSON.stringify(patch)).toThrow();}
  const {brushBlendVersion:_v,...noVersion}=s;activeLayer(p).operations=[noVersion as Stroke];expect(()=>validateProject(JSON.parse(JSON.stringify(p)))).toThrow();
 });
 it('one Blend stroke is exactly one undo step',()=>{
  const p=newProject(),store=new DocumentStore(p),s=stroke(line(10,200,50,40));
  store.commit(appendOperation(p,s));expect(activeLayer(store.getSnapshot()).operations).toHaveLength(1);
  store.undo();expect(store.getSnapshot()).toBe(p);store.redo();expect(activeLayer(store.getSnapshot()).operations[0]).toBe(s);
 });
 it('J switches Paint / Blend by default, can be remapped and never clashes',()=>{
  expect(initialShortcuts.blendToggle).toBe('j');expect(commandLabels.blendToggle).toBeTruthy();
  const values=Object.values(initialShortcuts);expect(new Set(values).size).toBe(values.length);
  const old=normalizeShortcuts({brush:'j'});expect(old.brush).toBe('j');expect(old.blendToggle).not.toBe('j');
  expect(new Set(Object.values(old)).size).toBe(Object.values(old).length);
 });
});
