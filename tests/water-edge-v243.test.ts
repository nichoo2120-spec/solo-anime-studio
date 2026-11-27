// v0.5.243 (owner pt88u): no dark wet edge on new watercolor / Silk Wet / Blend
// strokes; only the stock "Watercolor Edge" brush keeps it (Edge darkness).
import {describe,it,expect} from 'vitest';
import {brushBlendSettingsFor} from '../src/core/brushBlend';
import {stockPresets,newBrushLibrary,restoreBrushLibrary} from '../src/core/brushes';
import {brushStrokeMetadata,isNewWatercolorTip} from '../src/core/paintTips';
import {newProject,activeLayer,validateProject,type Stroke,type Point} from '../src/core/model';
import {renderSilkStroke} from '../src/engine/silkBlend';
import {renderBrushBlend} from '../src/engine/brushBlend';

/** Minimal byte-exact 2D context: enough for the Silk renderer's tile I/O. */
function surface(width:number,height:number){
 const data=new Uint8ClampedArray(width*height*4);let reads=0,readPx=0,writes=0;
 const canvas={width,height} as {width:number;height:number;getContext?:()=>unknown};
 const ctx={canvas,
  getImageData(x:number,y:number,w:number,h:number){reads++;readPx+=w*h;const out=new Uint8ClampedArray(w*h*4);for(let j=0;j<h;j++)out.set(data.subarray(((y+j)*width+x)*4,((y+j)*width+x+w)*4),j*w*4);return {data:out,width:w,height:h};},
  putImageData(img:{data:Uint8ClampedArray;width:number;height:number},x:number,y:number){writes++;for(let j=0;j<img.height;j++)data.set(img.data.subarray(j*img.width*4,(j+1)*img.width*4),((y+j)*width+x)*4);},
  createImageData(w:number,h:number){return {data:new Uint8ClampedArray(w*h*4),width:w,height:h};},
 };
 canvas.getContext=()=>ctx;
 return {ctx:ctx as unknown as CanvasRenderingContext2D,canvas:canvas as unknown as HTMLCanvasElement,data,stats:()=>({reads,readPx,writes})};
}
const W=420,H=200;
const lum=(d:Uint8ClampedArray,i:number)=>.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];
const hash=(d:Uint8ClampedArray)=>{let h=2166136261;for(let i=0;i<d.length;i++){h^=d[i];h=Math.imul(h,16777619);}return h>>>0;};
const flat=()=>{const s=surface(W,H);for(let i=0;i<W*H;i++)s.data.set([230,20,30,255],i*4);return s;};
const line=(x0:number,x1:number,y:number,n=60)=>Array.from({length:n},(_,i)=>{const t=i/(n-1);return {x:x0+(x1-x0)*t,y,p:.8};});
function mask(points:Point[],r=26){const m=surface(W,H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){for(const p of points)if(Math.hypot(x-p.x,y-p.y)<r){m.data[(y*W+x)*4+3]=255;break;}}return m;}
function make(id:string,extra:Record<string,unknown>={},patch:Partial<Stroke>={}):Stroke{
 const p=stockPresets.find(p=>p.id===id)!;const settings={...p.settings,...extra};const {bbEnabled:_b,...plain}=settings as Record<string,unknown>;
 const metadata=brushStrokeMetadata(settings as never);
 return {...plain,...metadata,id:'edge-'+id,kind:'stroke',tool:'brush',color:'#00ff00',size:60,opacity:1,pressure:true,response:1,points:line(40,380,100),...patch} as Stroke;
}
/** Mean luminance change per row across the stroke (columns 80..340):
 * edge = darkest row in the outer band, centre = middle rows, light = brightest row at/just outside the border. */
function rim(before:Uint8ClampedArray,after:Uint8ClampedArray){const P:number[]=[];for(let y=0;y<H;y++){let t=0;for(let x=80;x<340;x++){const i=(y*W+x)*4;t+=lum(after,i)-lum(before,i);}P.push(t/260);}
 let edge=0,centre=0,n=0,light=-1e9;for(let y=55;y<146;y++){const d=Math.abs(y-100);if(d<6){centre+=P[y];n++;}else if(d>=8&&d<=42)edge=Math.min(edge,P[y]);if(d>=24&&d<=48)light=Math.max(light,P[y]);}
 centre/=n;return {edge:edge-Math.min(0,centre),centre,light};}
const silkWet={silkMode:'wet',silkStrength:.8,silkWetness:.8};
function historicalWaterBlend(s:Stroke):Stroke{
 const {bbBlur:_blur,...saved}=s;
 const preset=stockPresets.find(p=>p.settings.brushTip===s.brushTip&&(p.settings.edgeDarkness??0)===(s.edgeDarkness??0))!;
 return {...saved,...brushBlendSettingsFor(preset.settings,6),brushBlendVersion:6,bbBlur:undefined};
}
describe('water edge v0.5.243',()=>{
 it('new strokes of every normal watercolor brush, Silk Wet and Blend watercolor save Edge darkness 0; only Watercolor Edge keeps it',()=>{
  const water=stockPresets.filter(p=>isNewWatercolorTip(p.settings.brushTip));
  expect(water.map(p=>p.id)).toEqual(['water-smooth','water-rough','water-wet','water-flat','water-gradient','water-edge']);
  for(const p of water){const s=make(p.id),b=make(p.id,{bbEnabled:true});const want=p.id==='water-edge'?1:0;expect(s.edgeDarkness,p.id).toBe(want);expect(b.edgeDarkness,p.id+' blend').toBe(want);expect(b.brushBlendVersion).toBe(7);expect(b.bbEdgeDarkness).toBe(p.id==='water-smooth'?.14:want);}
  expect(stockPresets.find(p=>p.id==='water-edge')!.name).toBe('Watercolor Edge');
  expect(make('silk-blend',silkWet).edgeDarkness).toBe(0);
  expect(make('silk-blend',{silkMode:'soft'}).edgeDarkness).toBeUndefined();
  for(const id of ['hb','g-pen','soft-paint','marker','paint','flat','color-soft','color-air','color-texture','dry-paint'])expect(make(id).edgeDarkness,id).toBeUndefined();
 });
 it('Edge darkness is validated (0..1) and kept in the brush library',()=>{
  const p=newProject(),ok=make('water-edge',{edgeDarkness:.4});activeLayer(p).operations=[ok];expect(()=>validateProject(JSON.parse(JSON.stringify(p)))).not.toThrow();
  for(const v of [-.1,1.5,'x'])expect(()=>{activeLayer(p).operations=[{...ok,edgeDarkness:v} as Stroke];validateProject(JSON.parse(JSON.stringify(p)));},String(v)).toThrow();
  const lib=newBrushLibrary(),i=lib.presets.findIndex(x=>x.id==='water-edge');lib.presets[i]={...lib.presets[i],settings:{...lib.presets[i].settings,edgeDarkness:.35}};
  expect(restoreBrushLibrary(JSON.parse(JSON.stringify(lib))).presets.find(x=>x.id==='water-edge')!.settings.edgeDarkness).toBe(.35);
 });
 it('Silk Wet: new strokes have no dark border and no lighter rim; old strokes keep the edge byte-identically',()=>{
  const c=flat(),before=c.data.slice();renderSilkStroke(c.ctx,make('silk-blend',silkWet));const r=rim(before,c.data);
  expect(r.edge).toBeGreaterThan(-1.5);// no darker band
  expect(r.light).toBeLessThan(1.5);// no lighter rim
  const old=flat(),ob=old.data.slice(),legacy={...make('silk-blend',silkWet),edgeDarkness:undefined};renderSilkStroke(old.ctx,legacy);expect(rim(ob,old.data).edge).toBeLessThan(-4);
  const one=flat();renderSilkStroke(one.ctx,{...legacy,edgeDarkness:1});expect(hash(one.data)).toBe(hash(old.data));
 });
 for(const id of ['water-wet','water-rough','water-flat'])it(id+' in Blend mode: no dark border and no lighter rim; v0.5.242 strokes unchanged',()=>{
  const s=historicalWaterBlend(make(id,{bbEnabled:true})),m=mask(s.points);
  const c=flat(),before=c.data.slice();renderBrushBlend(c.ctx,m.canvas,s);const r=rim(before,c.data);expect(r.edge).toBeGreaterThan(-1.5);expect(r.light).toBeLessThan(1.5);
  const {bbMode:_mode,bbColorCarry:_carry,bbSoftness:_softness,bbTextureKeep:_texture,bbSmoothing:_smoothing,bbEdgeDarkness:_edge,bbStrength:_strength,bbMinPressure:_min,bbPressureCurve:_curve,bbRenderStyle:_style,...rest}=s;
  const legacy:Stroke={...rest,brushBlendVersion:2,bbPressure:true,edgeDarkness:undefined},o=flat(),ob=o.data.slice();renderBrushBlend(o.ctx,m.canvas,legacy);expect(rim(ob,o.data).edge).toBeLessThan(-3);
  const one=flat();renderBrushBlend(one.ctx,m.canvas,{...legacy,edgeDarkness:1});expect(hash(one.data)).toBe(hash(o.data));
 });
 it('Watercolor Edge in Blend mode keeps the darker wet edge, and Edge darkness 0 removes it',()=>{
  const s=historicalWaterBlend(make('water-edge',{bbEnabled:true})),m=mask(s.points);
  const c=flat(),b=c.data.slice();renderBrushBlend(c.ctx,m.canvas,s);const strong=rim(b,c.data).edge;
  const z=flat(),zb=z.data.slice();renderBrushBlend(z.ctx,m.canvas,{...s,bbEdgeDarkness:0});const none=rim(zb,z.data).edge;
  expect(strong).toBeLessThan(-3);expect(none).toBeGreaterThan(-1.5);
 });
});
