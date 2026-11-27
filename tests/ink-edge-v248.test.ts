import {createHash} from 'node:crypto';
import {createCanvas,Path2D as CanvasPath} from '@napi-rs/canvas';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {activeLayer,newProject,validateProject,type Stroke} from '../src/core/model';
import {stockPresets,sanitizeBrush} from '../src/core/brushes';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {drawStroke} from '../src/engine/renderer';
import {LiveStrokeRaster} from '../src/engine/liveRaster';
import {strokeGeometry} from '../src/engine/strokeGeometry';

const width=256,height=160;
function surface(){
 return createCanvas(width,height).getContext('2d') as unknown as CanvasRenderingContext2D;
}
const pixels=(ctx:CanvasRenderingContext2D)=>ctx.getImageData(0,0,width,height).data;
const pen=stockPresets.find(p=>p.id==='brush-pen')!.settings;
function stroke(size:number,patch:Partial<Stroke>={}):Stroke{
 return {...brushStrokeMetadata(pen,true),id:'edge-fixture',kind:'stroke',tool:'brush',brushKind:'brush-pen',size,
  opacity:1,color:'#182436',pressure:true,pressureWidth:true,response:pen.response,
  taperStart:.06,taperEnd:.15,stabilization:.35,smoothness:22,
  points:Array.from({length:22},(_,i)=>({x:28+9*i,y:80.27,p:1})),...patch};
}

beforeEach(()=>{
 vi.stubGlobal('Path2D',CanvasPath);
 vi.stubGlobal('document',{createElement:()=>createCanvas(1,1)});
});
afterEach(()=>vi.unstubAllGlobals());

describe('Versioned Paint ink edges',()=>{
 it.each([5,20,60])('Brush Pen at %d px has a 10–90%% transition within two pixels',size=>{
  const ctx=surface();drawStroke(ctx,stroke(size));
  const data=ctx.getImageData(120,0,1,height).data;
  function crossing(target:number){
   for(let y=1;y<80;y++){
    const a=data[(y-1)*4+3]/255,b=data[y*4+3]/255;
    if(a<target&&b>=target)return y-1+(target-a)/(b-a);
   }
   throw new Error('Edge never reached the requested alpha');
  }
  expect(crossing(.9)-crossing(.1)).toBeLessThanOrEqual(2);
  expect(data[80*4+3]).toBe(255);
 });
 it.each(['off','low','normal'] as const)('matches the final document pixels after successive %s live updates',inkAntialiasing=>{
  const s=stroke(20,{inkAntialiasing,inkEdgeSharpness:inkAntialiasing==='normal'?.45:1});
  const live=surface(),final=surface(),raster=new LiveStrokeRaster();
  for(const count of [1,5,12,s.points.length]){
   const sample={...s,points:s.points.slice(0,count)};
   raster.paint(live,sample,strokeGeometry(sample,'live'));
  }
  drawStroke(final,s);
  expect(pixels(live)).toEqual(pixels(final));
 });
 it('uses width-only pressure and round contours without leaking other brush engines',()=>{
  const settings={...pen,pressureOpacity:true,pressureFlow:true,tsEnabled:true,dbEnabled:true,dbTip:'chalk' as const,brushTip:'water-wet' as const,watercolorMode:'wet' as const,edgeDarkness:1,mixColors:true};
  const ink=brushStrokeMetadata(settings,true);
  expect(brushStrokeMetadata(settings).inkEdgeVersion).toBeUndefined();
  expect(ink).toMatchObject({inkEdgeVersion:1,inkEdgeSharpness:1,inkAntialiasing:'low',pressureOpacity:false});
  for(const key of ['stampVersion','watercolorEngine','edgeDarkness','mixVersion','brushBlendVersion'])expect(ink).not.toHaveProperty(key);
  expect(brushStrokeMetadata({...settings,bbEnabled:true},true)).toMatchObject({inkEdgeVersion:1,brushBlendVersion:8});
  expect(brushStrokeMetadata({...settings,nativeMixEnabled:true},true).inkEdgeVersion).toBeUndefined();
  expect(stockPresets.find(p=>p.id==='ink-marker')?.category).toBe('Ink');
  const light=surface(),firm=surface();
  const s=stroke(20),low={...s,points:s.points.map(p=>({...p,p:.3}))};
  drawStroke(light,low);drawStroke(firm,s);
  const center=(ctx:CanvasRenderingContext2D)=>ctx.getImageData(115,80,1,1).data[3];
  const solid=(ctx:CanvasRenderingContext2D)=>Array.from(ctx.getImageData(115,60,1,42).data).filter((v,i)=>i%4===3&&v===255).length;
  expect(center(light)).toBe(255);expect(center(firm)).toBe(255);
  expect(solid(light)).toBeLessThan(solid(firm));
 });
 it('keeps expanded width points within the optional edge mask',()=>{
  const s=stroke(60,{inkAntialiasing:'off',widthPointVersion:1,widthPoints:[{at:0,scale:2},{at:1,scale:2}]});
  const ctx=surface();drawStroke(ctx,s);
  expect(ctx.getImageData(120,23,1,1).data[3]).toBe(255);
  expect(ctx.getImageData(120,17,1,1).data[3]).toBe(0);
 });
 it('saves edge settings, validates the version and changes alpha without changing the brush size',()=>{
  const settings=sanitizeBrush({inkEdgeSharpness:.35,inkAntialiasing:'normal'},pen);
  expect(settings).toMatchObject({inkEdgeSharpness:.35,inkAntialiasing:'normal'});
  const a=surface(),b=surface(),c=surface();
  drawStroke(a,stroke(20,{inkAntialiasing:'off'}));drawStroke(b,stroke(20));drawStroke(c,stroke(20,{inkAntialiasing:'normal',inkEdgeSharpness:.35}));
  expect(Array.from(pixels(a)).every((v,i)=>i%4!==3||v===0||v===255)).toBe(true);
  expect(pixels(a)).not.toEqual(pixels(b));expect(pixels(b)).not.toEqual(pixels(c));
  const project=newProject();activeLayer(project).operations=[stroke(20,{...brushStrokeMetadata(settings,true)})];
  expect(()=>validateProject(JSON.parse(JSON.stringify(project)))).not.toThrow();
  activeLayer(project).operations=[{...stroke(20),inkEdgeVersion:2} as unknown as Stroke];
  expect(()=>validateProject(JSON.parse(JSON.stringify(project)))).toThrow(/Ink edge/);
 });
});

it('keeps the pre-v0.5.248 Brush Pen document pixels byte-identical',()=>{
 const old:Stroke={id:'legacy-ink',kind:'stroke',tool:'brush',brushKind:'brush-pen',engineVersion:10,
  liveRefinementVersion:3,size:20,opacity:1,color:'#182436',pressure:true,pressureWidth:true,response:.65,
  taperStart:.06,taperEnd:.15,stabilization:.35,smoothness:22,
  points:Array.from({length:24},(_,i)=>({x:28+8*i,y:77+Math.sin(i*.19)*15,p:.25+.7*i/23}))};
 const ctx=surface();drawStroke(ctx,old);
 expect(createHash('sha256').update(pixels(ctx)).digest('hex')).toBe('cf1554c3f4b15858076a9fdf009063aaae30b9eb4726de2cd6f09950c3597baa');
});
