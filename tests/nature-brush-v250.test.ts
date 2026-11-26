import {createHash} from 'node:crypto';
import {createCanvas} from '@napi-rs/canvas';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {activeLayer,newProject,validateProject,type Stroke} from '../src/core/model';
import {activePreset,createCustomBrush,newBrushLibrary,restoreBrushLibrary,stockPresets} from '../src/core/brushes';
import {natureCategory,naturePresets} from '../src/core/natureBrush';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {drawStroke} from '../src/engine/renderer';
import {LiveStrokeRaster} from '../src/engine/liveRaster';
import {strokeGeometry} from '../src/engine/strokeGeometry';
import {natureTipAlpha} from '../src/engine/natureTips';
import {traceTipMask} from '../src/engine/tipContours';

const width=390,height=210;
const surface=()=>createCanvas(width,height).getContext('2d') as unknown as CanvasRenderingContext2D;
const data=(ctx:CanvasRenderingContext2D)=>ctx.getImageData(0,0,width,height).data;
const fingerprint=(bytes:Uint8ClampedArray)=>createHash('sha256').update(bytes).digest('hex');
const presets=stockPresets.filter(p=>p.category===natureCategory);
const points=Array.from({length:36},(_,i)=>({x:64+i*7.1,y:113+Math.sin(i*.18)*12,p:.8}));
const stroke=(p:typeof presets[number],settings=p.settings):Stroke=>({
 ...brushStrokeMetadata(settings),id:'nature-test',kind:'stroke',tool:'brush',brushKind:settings.brushKind,
 points,size:72,color:settings.color,opacity:settings.opacity,pressure:false,response:1,
});
const render=(s:Stroke)=>{const ctx=surface();drawStroke(ctx,s);return data(ctx);};
beforeEach(()=>vi.stubGlobal('document',{createElement:()=>createCanvas(1,1)}));
afterEach(()=>vi.unstubAllGlobals());

it('renders every procedural preset distinctly and repeats exactly for a saved seed',()=>{
 const signatures=new Set<string>();
 for(const preset of presets){
  const s=stroke(preset),bytes=render(s),sig=fingerprint(bytes);
  expect(bytes.some((v,i)=>i%4===3&&v>0),preset.name).toBe(true);
  expect(signatures.has(sig),preset.name).toBe(false);signatures.add(sig);
  expect(fingerprint(render(JSON.parse(JSON.stringify(s)))),preset.name).toBe(sig);
  expect(fingerprint(render({...s,nature:{...s.nature!,seed:s.nature!.seed+99}})),preset.name).not.toBe(sig);
 }
 expect(signatures.size).toBe(naturePresets.length);
});
it('uses the same stroke pixels for growing previews and replay, including Tip shape and Dual Brush',()=>{
 for(const settings of [presets[0].settings,{
  ...presets[0].settings,tsEnabled:true,tsRoundness:.65,tsScaleX:1.3,tsAngle:28,
  dbEnabled:true,dbTip:'soft-round' as const,dbNatureTip:'leaves-pointed' as const,dbScale:1,dbScatter:.15,dbSpacing:.32,dbAmount:.55,
 }]){
  const s=stroke(presets[0],settings),ctx=surface(),live=new LiveStrokeRaster();
  for(const length of [1,4,9,17,points.length]){
   const growing={...s,points:points.slice(0,length)};
   live.paint(ctx,growing,strokeGeometry(growing));
  }
  expect(fingerprint(data(ctx))).toBe(fingerprint(render(s)));
  const project=newProject();activeLayer(project).operations.push(s);
  expect(()=>validateProject(JSON.parse(JSON.stringify(project)))).not.toThrow();
 }
});
it('stores a custom brush and captures the original seeded tip for Blend',()=>{
 const preset=presets[0],settings={...preset.settings,nature:{...preset.settings.nature!,seed:122222,scatter:.73,second:'#d25a4e'}};
 const library=createCustomBrush(newBrushLibrary(),'Tuft',preset,settings);
 const selected=activePreset(restoreBrushLibrary(JSON.parse(JSON.stringify(library))));
 expect(selected).toMatchObject({name:'Tuft',category:natureCategory,settings:{nature:settings.nature}});
 const blend=brushStrokeMetadata({...selected.settings,bbEnabled:true});
 expect(blend).toMatchObject({natureVersion:1,brushBlendVersion:6,nature:settings.nature});
 const project=newProject();project.customBrushes=[selected];
 expect(()=>validateProject(JSON.parse(JSON.stringify(project)))).not.toThrow();
 activeLayer(project).operations.push({...stroke(preset),nature:{...settings.nature,seed:-1}});
 expect(()=>validateProject(project)).toThrow(/Nature brush/);
});

it('traces the real tall-grass tip with separated blades and open space above their roots',()=>{
 const contours=traceTipMask(natureTipAlpha('grass-tall'));
 const points=contours.flat();
 expect(contours.length).toBeGreaterThan(1);
 expect(points.some(p=>p.y<-.25)).toBe(true);
 expect(points.some(p=>p.y>.04)).toBe(true);
 expect(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))).toBeGreaterThan(.65);
});
