import {createCanvas,Path2D} from '@napi-rs/canvas';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {stockPresets} from '../src/core/brushes';
import {brushStrokeMetadata} from '../src/core/paintTips';
import type {Stroke} from '../src/core/model';
import {MixerPreview} from '../src/engine/mixerPreview';
import {drawStroke} from '../src/engine/renderer';
import {renderBrushBlend} from '../src/engine/brushBlend';
import {drawPigmentBrush} from '../src/engine/pigmentBrush';
import {finalGeometry} from '../src/engine/geometryCache';
import {prepareBlendMaskPressure} from '../src/core/brushBlend';

beforeEach(()=>{
 vi.stubGlobal('Path2D',Path2D);
 vi.stubGlobal('document',{createElement:()=>createCanvas(1,1)});
});
afterEach(()=>vi.unstubAllGlobals());

it.each(stockPresets.filter(p=>p.category!=='Eraser'))('$id preserves the Paint mask on light contact',preset=>{
 const common={...preset.settings,id:'shape',kind:'stroke' as const,tool:'brush' as const,
  size:100,opacity:1,color:'#ffffff',pressure:true,taperStart:.12,taperEnd:.15,
  points:Array.from({length:5},(_,i)=>({x:85+12*i,y:75+i,p:.22+.025*i}))};
 const paint:Stroke={...common,...brushStrokeMetadata({...preset.settings,bbEnabled:false},true)};
 const blend:Stroke={...common,...brushStrokeMetadata({...preset.settings,bbEnabled:true},true)};
 prepareBlendMaskPressure(blend);
 for(let n=1;n<=5;n++){
  const a=createCanvas(230,160).getContext('2d') as unknown as CanvasRenderingContext2D;
  const b=createCanvas(230,160).getContext('2d') as unknown as CanvasRenderingContext2D;
  paint.points=blend.points=common.points.slice(0,n);
  if(paint.brushTip==='color-blender')drawPigmentBrush(a,paint,finalGeometry(paint));
  else drawStroke(a,paint);
  drawStroke(b,blend);
  const reference=a.getImageData(0,0,230,160).data,actual=b.getImageData(0,0,230,160).data;
  let maxAlphaError=0;
  for(let i=3;i<actual.length;i+=4)maxAlphaError=Math.max(maxAlphaError,Math.abs(reference[i]-actual[i]));
  expect(maxAlphaError).toBe(0);
 }
});

it.each([150,300,500])('presents full-resolution pigment at 30%% pressure while a %i px brush moves',size=>{
 const width=344,height=160,edge=160;
 const surface=()=>createCanvas(width,height) as unknown as HTMLCanvasElement;
 const base=surface(),ctx=base.getContext('2d')!;
 ctx.fillStyle='#00ff00';ctx.fillRect(0,0,edge,height);
 ctx.fillStyle='#ff0000';ctx.fillRect(edge,0,width-edge,height);
 const preset=stockPresets.find(p=>p.id==='brush-pen')!.settings;
 const settings={...preset,bbEnabled:true,bbPressureWet:true,bbPressureMix:true,bbPaintLoad:0};
 const s:Stroke={...settings,...brushStrokeMetadata(settings,true),kind:'stroke',tool:'brush',
  id:'first-contact',color:'#010203',size,pressure:true,response:1,opacity:1,points:[]};
 const live=new MixerPreview(base);
 for(let i=0;i<10;i++){
  s.points.push({x:edge-8+8*i,y:80,p:.3});
  const pixels=live.paint(s,base).getContext('2d')!.getImageData(0,0,width,height).data;
  const mask=surface(),expected=surface().getContext('2d')!;
  drawStroke(mask.getContext('2d')!,s);
  expected.drawImage(base,0,0);renderBrushBlend(expected,mask,s);
  const final=expected.getImageData(0,0,width,height).data;
  let difference=0,transport=0;
  for(let k=0;k<pixels.length;k++)difference=Math.max(difference,Math.abs(pixels[k]-final[k]));
  expect(difference).toBeLessThanOrEqual(1);
  if([3,5,10].includes(i+1)){
   for(let x=edge;x<=s.points[i].x;x++)transport=Math.max(transport,pixels[4*(80*width+x)+1]);
   expect(transport).toBeGreaterThan(8);
  }
 }
});
