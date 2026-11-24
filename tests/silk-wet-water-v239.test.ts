import {describe,it,expect} from 'vitest';
import {stockPresets,newBrushLibrary,restoreBrushLibrary,updatePreset,activePreset} from '../src/core/brushes';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {newProject,activeLayer,validateProject,appendOperation,type Stroke,type Point} from '../src/core/model';
import {DocumentStore} from '../src/core/history';
import {silkPresets,silkModes,silkStrokeMetadata,type SilkMode} from '../src/core/silkBlend';
import {renderSilkStroke,applySilkBlend,resetSilkBlend} from '../src/engine/silkBlend';
import {renderSilkStroke as renderV238} from './fixtures/silk-v238-engine';

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
function scene(kind:'split'|'edge'|'stripes'='split'){
 const s=surface(W,H);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;
  if(kind==='split'){if(y<30||y>=170)continue;const red=x<W/2;s.data.set(red?[230,30,40,255]:[20,70,220,255],i);}
  else if(kind==='edge'){if(x<W/2)s.data.set([230,20,30,255],i);}
  else{s.data.set(Math.floor(x/8)%2?[230,30,40,255]:[20,70,220,255],i);}
 }
 return s;
}
const silk=stockPresets.find(p=>p.id==='silk-blend')!;
function stroke(mode:SilkMode,points:Point[],patch:Partial<Stroke>={}):Stroke{
 const settings={...silk.settings,silkMode:mode,silkTexture:mode==='dry'?.65:0};
 return {...settings,...brushStrokeMetadata(settings),id:'silk-'+mode,kind:'stroke',tool:'brush',color:'#00ff00',size:60,opacity:1,pressure:true,response:1,points,...patch} as Stroke;
}
const line=(x0:number,x1:number,y:number,n=60,p=(t:number)=>.4+.6*Math.sin(t*Math.PI))=>Array.from({length:n},(_,i)=>{const t=i/(n-1);return {x:x0+(x1-x0)*t,y,p:p(t)};});
const hash=(d:Uint8ClampedArray)=>{let h=2166136261;for(let i=0;i<d.length;i++){h^=d[i];h=Math.imul(h,16777619);}return h>>>0;};

const lum=(d:Uint8ClampedArray,i:number)=>.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];
const curve=(n=90)=>Array.from({length:n},(_,i)=>{const t=i/(n-1);return {x:60+t*300,y:100+Math.sin(t*Math.PI*2)*45,p:.35+.65*Math.sin(t*Math.PI)};});
const v1=(mode:SilkMode,points:Point[],patch:Partial<Stroke>={})=>({...stroke(mode,points,patch),silkBlendVersion:1} as Stroke);

describe('Silk Blend v0.5.239 watercolor Wet',()=>{
 it('new strokes are version 2; saved version 1 strokes render byte-identically to v0.5.238 in every mode',()=>{
  expect(stroke('wet',line(100,300,100)).silkBlendVersion).toBe(2);
  for(const mode of ['soft','wet','smudge','dry'] as SilkMode[])for(const kind of ['split','edge','stripes'] as const)for(const pts of [line(80,340,100),curve()]){
   for(const patch of [{},{silkWetness:.9,silkTexture:.5,size:110},{silkStrength:1,silkPickup:.2,size:24,pressure:false}] as Partial<Stroke>[]){
    const a=scene(kind),b=scene(kind);renderSilkStroke(a.ctx,v1(mode,pts,patch));renderV238(b.ctx,v1(mode,pts,patch));
    expect(hash(a.data),mode+' '+kind).toBe(hash(b.data));
   }
  }
 });
 it('version 2 changes only Wet; Soft, Smudge and Dry are unchanged from v0.5.238',()=>{
  for(const mode of ['soft','smudge','dry'] as SilkMode[]){const a=scene(),b=scene();renderSilkStroke(a.ctx,stroke(mode,curve()));renderV238(b.ctx,v1(mode,curve()));expect(hash(a.data),mode).toBe(hash(b.data));}
  const a=scene(),b=scene();renderSilkStroke(a.ctx,stroke('wet',curve()));renderV238(b.ctx,v1('wet',curve()));expect(hash(a.data)).not.toBe(hash(b.data));
 });
 it('mixes colours like transparent pigment: red into blue goes deep violet, darker than an RGB average',()=>{
  const sum=(s:Stroke)=>{const c=scene();renderSilkStroke(c.ctx,s);let L=0,n=0,green=0;for(let y=80;y<120;y++)for(let x=200;x<240;x++){const i=(y*W+x)*4;L+=lum(c.data,i);n++;if(c.data[i+1]>Math.max(c.data[i],c.data[i+2])+15)green++;}return {L:L/n,green,c};};
  const water=sum(stroke('wet',line(80,340,100))),old=sum(v1('wet',line(80,340,100)));
  expect(water.green).toBe(0);
  expect(water.L).toBeLessThan(old.L);
  const i=(100*W+215)*4,d=water.c.data;expect(d[i]).toBeGreaterThan(40);expect(d[i+2]).toBeGreaterThan(80);// both colours present
 });
 it('pigment gathers at the wet edge: the stroke border is darker than its middle on flat colour (saved v0.5.239-242 strokes, no edgeDarkness)',()=>{
  const c=scene('edge'),before=c.data.slice();
  const s=stroke('wet',line(30,180,100,60,()=>.8),{silkStrength:.8,silkWetness:.8,edgeDarkness:undefined});renderSilkStroke(c.ctx,s);
  // walk down across the stroke at several x and compare edge band vs centre
  let edge=0,centre=0;for(const x of [70,100,130]){let best=1e9,mid=0;for(let y=60;y<140;y++){const i=(y*W+x)*4,dl=lum(c.data,i)-lum(before,i);if(Math.abs(y-100)<4)mid+=dl/7;else if(dl<best)best=dl;}edge+=best;centre+=mid;}
  expect(edge).toBeLessThan(centre-6);
  // every changed pixel keeps the layer's own hue (red), only deeper
  for(let i=0;i<c.data.length;i+=4)if(c.data[i+3]>8&&(c.data[i]!==before[i]||c.data[i+3]!==before[i+3])){expect(c.data[i]).toBeGreaterThan(c.data[i+1]+60);expect(c.data[i]).toBeGreaterThan(c.data[i+2]+60);}
 });
 it('soft irregular wet front, no stamps, and the Texture slider adds granulation',()=>{
  const plain=scene('split'),grainy=scene('split');
  renderSilkStroke(plain.ctx,stroke('wet',line(80,340,100),{silkTexture:0}));renderSilkStroke(grainy.ctx,stroke('wet',line(80,340,100),{silkTexture:.9}));
  expect(hash(plain.data)).not.toBe(hash(grainy.data));
  // along the stroke centre, no periodic dab rings: neighbouring pixels change smoothly
  let jumps=0;for(let x=90;x<330;x++){const a=(100*W+x)*4,b=a+4;if(Math.abs(lum(plain.data,a)-lum(plain.data,b))>18)jumps++;}
  expect(jumps).toBeLessThan(6);
 });
 it('live incremental drawing equals reload for watercolor Wet, including restarts and transparent paper',()=>{
  for(const kind of ['split','edge','stripes'] as const)for(const patch of [{},{silkWetness:1,silkTexture:.7},{silkWetness:0,pressure:false}] as Partial<Stroke>[]){
   const full=stroke('wet',curve(120),patch),one=scene(kind);renderSilkStroke(one.ctx,full);
   const base=scene(kind),live=scene(kind);resetSilkBlend();
   for(const n of [1,4,9,30,31,64,64,100,120])applySilkBlend(live.ctx,undefined,{...full,points:full.points.slice(0,n)},0,0,undefined,base.canvas);
   expect(hash(live.data),kind).toBe(hash(one.data));
  }
 });
 it('is not slower than v0.5.238 Wet by more than 2x on a long stroke',()=>{
  const time=(f:()=>void)=>{const t=performance.now();f();return performance.now()-t;};
  const pts=curve(400);let a=0,b=0;for(let k=0;k<3;k++){a+=time(()=>{const c=scene();renderSilkStroke(c.ctx,stroke('wet',pts,{size:90}));});b+=time(()=>{const c=scene();renderV238(c.ctx,v1('wet',pts,{size:90}));});}
  expect(a).toBeLessThan(b*2+200);
 });
});
