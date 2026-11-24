import {describe,it,expect} from 'vitest';
import {stockPresets,newBrushLibrary,restoreBrushLibrary,updatePreset,activePreset} from '../src/core/brushes';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {newProject,activeLayer,validateProject,appendOperation,type Stroke,type Point} from '../src/core/model';
import {DocumentStore} from '../src/core/history';
import {silkPresets,silkModes,silkStrokeMetadata,type SilkMode} from '../src/core/silkBlend';
import {renderSilkStroke,applySilkBlend,resetSilkBlend,SilkGesture} from '../src/engine/silkBlend';

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

describe('Silk Blend v0.5.238',()=>{
 it('is a new stock brush with its own family, presets and four modes',()=>{
  expect(silk).toMatchObject({name:'Silk Blend',category:'Paint',family:'blend'});
  expect(silkModes.map(m=>m.id)).toEqual(['soft','wet','smudge','dry']);
  expect(silkPresets.map(p=>p.name)).toEqual(['Silk Soft','Silk Wet','Silk Dry']);
  expect(silkPresets.map(p=>p.values.silkMode)).toEqual(['soft','wet','dry']);
 });
 it('adds Silk metadata only to Silk strokes, so every other brush stays byte-identical',()=>{
  for(const p of stockPresets.filter(p=>p.id!=='silk-blend')){const m=brushStrokeMetadata(p.settings) as Record<string,unknown>;for(const k of ['silkBlendVersion','silkMode','silkStrength','silkPickup','silkWetness','silkTexture'])expect(m[k],p.id+' '+k).toBeUndefined();}
  expect(brushStrokeMetadata(silk.settings)).toMatchObject({silkBlendVersion:1,silkMode:'soft',silkStrength:.55,silkPickup:.7,silkWetness:.35,silkTexture:0});
  expect(silkStrokeMetadata({brushKind:'paint'})).toEqual({});
 });
 it('blends the existing paint in all four modes, differently, without adding the brush colour',()=>{
  const hashes=new Set<number>();
  for(const mode of ['soft','wet','smudge','dry'] as SilkMode[]){
   const s=scene(),before=s.data.slice();renderSilkStroke(s.ctx,stroke(mode,line(120,320,100)));
   let changed=0,green=0;for(let i=0;i<s.data.length;i+=4){if(s.data[i]!==before[i]||s.data[i+1]!==before[i+1]||s.data[i+2]!==before[i+2]||s.data[i+3]!==before[i+3])changed++;if(s.data[i+3]>20&&s.data[i+1]>Math.max(s.data[i],s.data[i+2])+15)green++;}
   expect(changed,mode).toBeGreaterThan(2000);expect(green,mode).toBe(0);hashes.add(hash(s.data));
   // Colour really travels: the far side picks up some of the other colour.
   const at=(x:number,y:number)=>Array.from(s.data.subarray((y*W+x)*4,(y*W+x)*4+4));
   if(mode!=='dry')expect(at(225,100)[0],mode+' red carried into blue').toBeGreaterThan(30);
  }
  expect(hashes.size).toBe(4);
 });
 it('never makes grey or dark halos on transparent paper (premultiplied colour)',()=>{
  for(const mode of ['soft','wet','smudge','dry'] as SilkMode[]){
   const s=scene('edge');renderSilkStroke(s.ctx,stroke(mode,[{x:150,y:60,p:.8},{x:270,y:140,p:.8},{x:150,y:180,p:.8}].flatMap((p,i,a)=>i?line(a[i-1].x,p.x,0,30).map((q,j)=>({x:q.x,y:a[i-1].y+(p.y-a[i-1].y)*j/29,p:.8})):[])));
   let soft=0;for(let i=0;i<s.data.length;i+=4){const a=s.data[i+3];if(a>0&&a<255){soft++;expect(s.data[i],mode+' red kept').toBeGreaterThan(200);expect(s.data[i+1],mode).toBeLessThan(40);expect(s.data[i+2],mode).toBeLessThan(50);}}
   if(mode!=='dry')expect(soft,mode+' spreads softly onto empty paper').toBeGreaterThan(200);
  }
 });
 it('live incremental pieces give exactly the same pixels as one reload pass',()=>{
  for(const mode of ['soft','wet','smudge','dry'] as SilkMode[]){
   const full=stroke(mode,line(60,360,100,140)),one=scene();renderSilkStroke(one.ctx,full);
   const base=scene(),live=scene();resetSilkBlend();let regions=0;
   for(const n of [1,2,7,20,21,55,90,90,139,140]){const r=applySilkBlend(live.ctx,undefined,{...full,points:full.points.slice(0,n)},0,0,undefined,base.canvas);if(r){regions++;expect(r.width*r.height).toBeLessThan(W*H);}}
   expect(regions).toBeGreaterThan(3);expect(hash(live.data),mode).toBe(hash(one.data));
   expect(Array.from(base.data)).toEqual(Array.from(scene().data));
  }
 });
 it('restarts cleanly if the live path changes, and still matches the final pass',()=>{
  const full=stroke('wet',line(60,360,100,80)),base=scene(),live=scene();resetSilkBlend();
  applySilkBlend(live.ctx,undefined,{...full,points:[...full.points.slice(0,30),{x:999,y:-50,p:1}]},0,0,undefined,base.canvas);
  applySilkBlend(live.ctx,undefined,full,0,0,undefined,base.canvas);
  const one=scene();renderSilkStroke(one.ctx,full);expect(hash(live.data)).toBe(hash(one.data));
 });
 it('has no gaps or stamps on very fast strokes (points 150 px apart)',()=>{
  const s=scene('stripes'),before=s.data.slice(),pts=[{x:20,y:100,p:.7},{x:170,y:100,p:.7},{x:320,y:100,p:.7},{x:400,y:100,p:.7}];
  const g=new SilkGesture(stroke('soft',pts,{size:40}),W,H,s.ctx);g.advance(pts);g.flush(s.ctx);
  expect(g.dabs).toBeGreaterThan(140);// ~2.5 px spacing along 380 px
  let changed=0;for(let x=24;x<396;x++){const i=(100*W+x)*4;if(s.data[i]!==before[i]||s.data[i+2]!==before[i+2])changed++;}
  expect(changed/372).toBeGreaterThan(.97);
 });
 it('reads and writes only 64 px tiles near the stroke (dirty rectangle)',()=>{
  const big=surface(2048,1152);const st=stroke('soft',line(900,1100,600,40),{size:60});renderSilkStroke(big.ctx,st);
  const {readPx,writes}=big.stats();expect(readPx).toBeLessThan(2048*1152/20);expect(writes).toBeGreaterThan(0);expect(writes).toBeLessThan(40);
 });
 it('pressure changes size and blend strength',()=>{
  const lo=scene(),hi=scene(),pts=(p:number)=>line(120,320,100,60,()=>p);
  renderSilkStroke(lo.ctx,stroke('soft',pts(.15)));renderSilkStroke(hi.ctx,stroke('soft',pts(1)));
  const diff=(s:ReturnType<typeof scene>)=>{const b=scene().data;let n=0,sum=0;for(let i=0;i<b.length;i+=4){const d=Math.abs(s.data[i]-b[i])+Math.abs(s.data[i+2]-b[i+2]);if(d)n++;sum+=d;}return {n,sum};};
  const a=diff(lo),b=diff(hi);expect(b.n).toBeGreaterThan(a.n*1.3);expect(b.sum).toBeGreaterThan(a.sum*1.5);
 });
 it('saves and reloads every Silk setting with the brush, and cleans bad values',()=>{
  let lib=newBrushLibrary();lib={...lib,brushId:'silk-blend'};
  lib=updatePreset(lib,'silk-blend',{...activePreset(lib).settings,size:88,opacity:.7,silkMode:'smudge',silkStrength:.31,silkPickup:.12,silkWetness:.9,silkTexture:.44,stabilization:.5,tipSpacing:.2});
  const back=restoreBrushLibrary(JSON.parse(JSON.stringify(lib)));
  expect(back.brushId).toBe('silk-blend');
  expect(activePreset(back).settings).toMatchObject({size:88,opacity:.7,silkMode:'smudge',silkStrength:.31,silkPickup:.12,silkWetness:.9,silkTexture:.44,stabilization:.5,tipSpacing:.2});
  const bad=JSON.parse(JSON.stringify(lib));bad.presets.find((p:{id:string})=>p.id==='silk-blend').settings={...bad.presets.find((p:{id:string})=>p.id==='silk-blend').settings,silkMode:'lava',silkStrength:7,silkPickup:-2,silkWetness:'x'};
  expect(activePreset(restoreBrushLibrary(bad)).settings).toMatchObject({silkMode:'soft',silkStrength:1,silkPickup:0,silkWetness:.35});
  const other=restoreBrushLibrary(JSON.parse(JSON.stringify({...lib,presets:lib.presets.map(p=>p.id==='hb'?{...p,settings:{...p.settings,silkMode:'dry',silkStrength:.5}}:p)})));
  expect(other.presets.find(p=>p.id==='hb')!.settings.silkMode).toBeUndefined();
 });
 it('presets and Reset return the documented values',()=>{
  let lib=newBrushLibrary();
  for(const preset of silkPresets){lib=updatePreset(lib,'silk-blend',{...lib.presets.find(p=>p.id==='silk-blend')!.settings,...preset.values});expect(lib.presets.find(p=>p.id==='silk-blend')!.settings).toMatchObject(preset.values);}
  const p=lib.presets.find(p=>p.id==='silk-blend')!;lib=updatePreset(lib,p.id,{...p.defaults});expect(lib.presets.find(q=>q.id==='silk-blend')!.settings).toEqual(silk.defaults);
 });
 it('saves Silk strokes in projects and rejects broken Silk data',()=>{
  const p=newProject(),s=stroke('dry',line(10,90,40,10));activeLayer(p).operations=[s];
  expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  for(const patch of [{silkMode:'lava'},{silkStrength:2},{silkBlendVersion:2},{tool:'eraser'}] as Partial<Stroke>[]){activeLayer(p).operations=[{...s,...patch} as Stroke];expect(()=>validateProject(JSON.parse(JSON.stringify(p))),JSON.stringify(patch)).toThrow();}
  const {silkBlendVersion:_v,...noVersion}=s;activeLayer(p).operations=[noVersion as Stroke];expect(()=>validateProject(JSON.parse(JSON.stringify(p)))).toThrow();
 });
 it('one Silk stroke is exactly one undo step',()=>{
  const p=newProject(),store=new DocumentStore(p),s=stroke('wet',line(10,200,50,40));
  store.commit(appendOperation(p,s));expect(activeLayer(store.getSnapshot()).operations).toHaveLength(1);
  store.undo();expect(activeLayer(store.getSnapshot()).operations).toHaveLength(0);expect(store.getSnapshot()).toBe(p);
  store.redo();expect(activeLayer(store.getSnapshot()).operations[0]).toBe(s);
 });
 it('renders a long, large stroke quickly (CPU budget sanity check)',()=>{
  const s=surface(1920,1080),st=stroke('wet',line(100,1800,540,400),{size:120});
  const t=performance.now();renderSilkStroke(s.ctx,st);const ms=performance.now()-t;
  expect(ms).toBeLessThan(4000);
 });
 it('Smoothing changes the path and stays identical between live drawing and reload',()=>{
  const wobble=Array.from({length:120},(_,i)=>{const t=i/119;return {x:40+t*340,y:100+(i%2?9:-9),p:.8};});
  const out=(patch:Partial<Stroke>)=>{const c=scene();renderSilkStroke(c.ctx,stroke('wet',wobble,patch));return c;};
  const raw=out({stabilization:0,smoothness:0}),smooth=out({stabilization:.9,smoothness:90});
  expect(hash(smooth.data)).not.toBe(hash(raw.data));
  const full=stroke('wet',wobble,{stabilization:.9,smoothness:90}),base=scene(),live=scene();resetSilkBlend();
  for(const n of [3,10,40,41,80,120])applySilkBlend(live.ctx,undefined,{...full,points:full.points.slice(0,n)},0,0,undefined,base.canvas);
  expect(hash(live.data)).toBe(hash(smooth.data));
 });
});
