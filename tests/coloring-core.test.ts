import {describe,it,expect} from 'vitest';
import {stockPresets,newBrushLibrary,restoreBrushLibrary,legacyAirbrushPreset} from '../src/core/brushes';
import {brushStrokeMetadata,watercolorSeedFor} from '../src/core/paintTips';
import {coloringNibs,isColoringTip,defaultColorNib} from '../src/core/coloring';
import {newProject,activeLayer,validateProject,type Stroke} from '../src/core/model';
import {colorNibFootprint} from '../src/engine/colorNibs';
import {blendPixels} from '../src/engine/colorBlend';
const coloring=stockPresets.filter(p=>p.family==='coloring');
describe('five coloring brushes and physical nibs',()=>{
 it('adds one focused family and keeps 20 existing presets after retiring the duplicate Airbrush',()=>{expect(coloring.filter(p=>p.settings.smudgeVersion!==2).map(p=>p.name)).toEqual(['Solid Paint','Soft Paint','Airbrush','Textured Paint','Blender']);expect(stockPresets.filter(p=>p.family!=='coloring'&&!['dry-ink-bristle','dry-paint'].includes(p.id))).toHaveLength(20);expect(coloring.every(p=>isColoringTip(p.settings.brushTip))).toBe(true);});
 it('persists the style, nib, direction and stable seed without versioning old artwork',()=>{
  const p=newProject();for(const preset of coloring)for(const nib of coloringNibs(preset.settings.brushTip)){const settings={...preset.settings,colorNib:nib,colorNibFollow:true},s:Stroke={...settings,...brushStrokeMetadata(settings),id:preset.id+'-'+nib,kind:'stroke',tool:'brush',colorSeed:watercolorSeedFor(preset.id),points:[{x:30,y:40,p:.6}]};activeLayer(p).operations=[s];expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);expect(s.coloringEngine).toBe(1);}
  expect(stockPresets.filter(p=>p.family!=='coloring').every(p=>brushStrokeMetadata(p.settings).coloringEngine===undefined)).toBe(true);
 });
 it('rejects mismatched or invalid coloring metadata',()=>{
  const settings=coloring[0].settings,s:Stroke={...settings,...brushStrokeMetadata(settings),id:'s',kind:'stroke',tool:'brush',points:[{x:20,y:20,p:1}]},p=newProject();for(const patch of [{coloringEngine:undefined},{coloringEngine:2},{colorNib:'rake'},{colorNibFollow:1},{colorSeed:-1},{colorSeed:.5},{brushTip:'soft-round'}]){activeLayer(p).operations=[{...s,...patch} as Stroke];expect(()=>validateProject(p)).toThrow();}
 });
 it('sanitizes saved nib choices while keeping artist sizes and existing presets',()=>{
  const library=newBrushLibrary(),p=library.presets.find(p=>p.id==='color-solid')!;p.settings={...p.settings,size:137,colorNib:'rake',colorNibFollow:true};const restored=restoreBrushLibrary(library).presets.find(q=>q.id===p.id)!;expect(restored.settings).toMatchObject({size:137,colorNib:defaultColorNib(p.settings.brushTip),colorNibFollow:true,coloringEngine:1});
 });
 it('uses flat, asymmetric chisel, oval and fan contacts with different geometry',()=>{
  const round=colorNibFootprint('round'),flat=colorNibFootprint('flat'),chisel=colorNibFootprint('chisel'),oval=colorNibFootprint('oval'),filbert=colorNibFootprint('filbert'),fan=colorNibFootprint('fan');expect(flat).toHaveLength(4);expect(flat[0].y).toBe(flat[1].y);expect(chisel[0].y).not.toBe(chisel[1].y);expect(Math.max(...oval.map(p=>p.y))).toBeLessThan(Math.max(...round.map(p=>p.y)));expect(filbert).not.toEqual(oval);expect(fan[0]).toEqual({x:0,y:-.65});
 });
});
describe('existing-paint color blender',()=>{
 it('ignores RGB stored in transparent pixels when mixing paint',()=>{
  const data=new Uint8ClampedArray([255,0,0,0,0,100,240,255,0,100,240,255]),a=blendPixels(data,3,1,1);for(let x=0;x<3;x++){const i=x*4;expect(a[i]/a[i+3]).toBe(0);expect(a[i+1]/a[i+3]).toBeCloseTo(100,4);expect(a[i+2]/a[i+3]).toBeCloseTo(240,4);}
 });
 it('mixes existing blue/violet RGB without modifying source pixels',()=>{
  const data=new Uint8ClampedArray([0,60,240,255,0,60,240,255,140,40,200,255,140,40,200,255]),copy=data.slice(),a=blendPixels(data,4,1,1);expect(data).toEqual(copy);expect(a[4]).toBeGreaterThan(0);expect(a[4]).toBeLessThan(140);expect(a[7]).toBe(1);expect(Array.from(blendPixels(new Uint8ClampedArray(64),4,4,2)).every(n=>n===0)).toBe(true);
 });
});
