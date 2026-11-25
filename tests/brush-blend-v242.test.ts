import {describe,it,expect} from 'vitest';
import {stockPresets} from '../src/core/brushes';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {newProject,activeLayer,validateProject,type Stroke,type Point} from '../src/core/model';
import {blendStyleFor,isBlendStyle} from '../src/core/brushBlend';
import {renderBrushBlend,applyBrushBlendLive,resetBrushBlend} from '../src/engine/brushBlend';
import {displayCleanInk} from '../src/engine/InkDisplay';

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

const line=(x0:number,x1:number,y:number,n=70)=>Array.from({length:n},(_,i)=>{const t=i/(n-1);return {x:x0+(x1-x0)*t,y:y+40*Math.sin(t*Math.PI*2),p:.4+.6*Math.sin(t*Math.PI)};});
function stroke(id:string,blend:Record<string,unknown>={},patch:Partial<Stroke>={}):Stroke{
 const preset=stockPresets.find(p=>p.id===id)!;const settings={...preset.settings,bbEnabled:true,...blend};const {bbEnabled:_e,...plain}=settings;
 const metadata={...brushStrokeMetadata(settings)} as Record<string,unknown>;for(const key of ['bbMode','bbColorCarry','bbSoftness','bbTextureKeep','bbSmoothing','bbEdgeDarkness'])delete metadata[key];metadata.brushBlendVersion=2;
 return {...plain,...metadata,id:'v2-'+id,kind:'stroke',tool:'brush',color:'#00ff00',size:40,opacity:1,pressure:true,response:1,points:line(40,380,100),...patch} as Stroke;
}
const expected:Record<string,string>={'water-smooth':'water','water-rough':'water','water-wet':'water','water-flat':'water','water-gradient':'water','dry':'dry','dry-ink-bristle':'dry','dry-paint':'dry',hb:'pencil','2b':'pencil',mechanical:'pencil',blue:'pencil','g-pen':'ink',mapping:'ink',technical:'ink','brush-pen':'ink','studio-ink':'ink','contour-flow':'ink','color-air':'air',paint:'oil',flat:'oil','color-solid':'oil',marker:'marker','color-texture':'texture','color-soft':'soft','soft-paint':'soft'};
describe('Blend v2 family styles v0.5.242',()=>{
 it('every blendable stock brush gets Blend v2 with its family style',()=>{
  for(const [id,style] of Object.entries(expected)){const s=stroke(id);expect(s.brushBlendVersion,id).toBe(2);expect(s.bbStyle,id).toBe(style);}
  expect(blendStyleFor({brushKind:'watercolor-new',brushTip:'water-wet'})).toBe('water');
  expect(isBlendStyle('moon')).toBe(false);
 });
 it('validates v2 strokes and rejects mixed or unknown versions',()=>{
  const p=newProject();const ok=stroke('water-wet');activeLayer(p).operations=[ok];expect(()=>validateProject(JSON.parse(JSON.stringify(p)))).not.toThrow();
  for(const patch of [{bbStyle:undefined},{bbStyle:'moon'},{brushBlendVersion:1},{brushBlendVersion:3}] as Partial<Stroke>[]){activeLayer(p).operations=[{...ok,...patch} as Stroke];expect(()=>validateProject(JSON.parse(JSON.stringify(p))),JSON.stringify(patch)).toThrow();}
 });
 it('ink brushes in Blend mode are not shown as clean ink (they blend instead of painting)',()=>{
  const ink=stroke('g-pen'),{brushBlendVersion:_v,bbStyle:_s,...paint}=ink;
  expect(displayCleanInk(ink)).toBe(false);
  for(const k of Object.keys(paint))if(k.startsWith('bb'))delete (paint as Record<string,unknown>)[k];
  expect(displayCleanInk(paint as Stroke)).toBe(true);
 });
 for(const id of ['water-wet','dry-paint','hb','g-pen','color-air','paint','marker','color-texture','soft-paint'])it(id+': blends without adding colour or thinning paint, and live == reload',()=>{
  const s=stroke(id),before=scene(),m=mask(s.points,26,id==='dry-paint');
  const ref=scene();renderBrushBlend(ref.ctx,m.canvas,s);
  let changed=0,green=0,drop=0;for(let i=0;i<ref.data.length;i+=4){if(ref.data[i]!==before.data[i]||ref.data[i+2]!==before.data[i+2])changed++;if(ref.data[i+1]>Math.max(ref.data[i],ref.data[i+2])+90&&ref.data[i+3]>20)green++;if(ref.data[i+3]+1<before.data[i+3])drop++;}
  expect(changed,id).toBeGreaterThan(1500);expect(green,id).toBe(0);expect(drop,id).toBe(0);
  resetBrushBlend();const live=scene(),base=scene();
  for(const n of [1,9,30,31,55,70])applyBrushBlendLive(live.ctx,m.canvas,s,base.canvas,false,s.points.slice(0,n));
  applyBrushBlendLive(live.ctx,m.canvas,s,base.canvas,true,s.points);
  let diff=0;for(let i=0;i<ref.data.length;i++)if(ref.data[i]!==live.data[i])diff++;expect(diff,id).toBe(0);
 });
 it('watercolor bleeds wider than oil, and dry leaves broken gaps',()=>{
  const touched=(id:string,grain=false)=>{const s=stroke(id),b=scene(),m=mask(s.points,26,grain),r=scene();renderBrushBlend(r.ctx,m.canvas,s);let n=0;for(let i=0;i<r.data.length;i+=4)if(Math.abs(r.data[i]-b.data[i])+Math.abs(r.data[i+2]-b.data[i+2])>4)n++;return n;};
  expect(touched('dry-paint')).toBeLessThan(touched('paint'));
  expect(touched('water-wet')).toBeGreaterThan(touched('dry-paint'));
 });
 it('Watercolor Edge (v0.5.243: the one brush with the edge) leaves a darker wet edge (tide line) and mixes red + blue as transparent pigment',()=>{
  const s=stroke('water-edge',{},{points:Array.from({length:40},(_,i)=>({x:60+i*8,y:100,p:1}))}),b=scene(),m=mask(s.points,26),r=scene();renderBrushBlend(r.ctx,m.canvas,s);
  const lum=(x:number,y:number)=>{const k=(y*W+x)*4;return .3*r.data[k]+.59*r.data[k+1]+.11*r.data[k+2];};
  // inside the pure red half: the bank of the wash is darker than its middle
  let edge=0,mid=0;for(let x=70;x<180;x++){edge+=Math.min(lum(x,100-22),lum(x,100+22));mid+=lum(x,100);}
  expect(edge).toBeLessThan(mid);
  // across the red|blue border the mix stays saturated (violet), not grey
  let sat=0,n=0;for(let x=200;x<230;x++)for(let y=90;y<110;y++){const k=(y*W+x)*4;if(r.data[k]!==b.data[k]){sat+=Math.max(r.data[k],r.data[k+2])-r.data[k+1];n++;}}
  expect(n).toBeGreaterThan(50);expect(sat/n).toBeGreaterThan(90);
 });
});
