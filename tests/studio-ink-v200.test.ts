import {describe,it,expect} from 'vitest';
import {stockPresets,newBrushLibrary,restoreBrushLibrary} from '../src/core/brushes';
import {brushStrokeMetadata} from '../src/core/paintTips';
import type {Stroke} from '../src/core/model';
import {strokeGeometry,pressureResponse} from '../src/engine/strokeGeometry';
import {widthResponse} from '../src/engine/pressureChannels';

describe('Studio Ink and Contour Flow',()=>{
 const ids=['studio-ink','contour-flow'];
 it('adds both Ink presets to existing libraries without replacing their selected brush',()=>{
  const previous=newBrushLibrary();previous.presets=previous.presets.filter(p=>!ids.includes(p.id));
  previous.brushId='g-pen';const oldSettings=previous.presets.find(p=>p.id==='g-pen')!.settings;oldSettings.size=23;
  const restored=restoreBrushLibrary(previous);
  expect(restored.brushId).toBe('g-pen');expect(restored.presets.find(p=>p.id==='g-pen')!.settings.size).toBe(23);
  for(const id of ids)expect(restored.presets.filter(p=>p.id===id&&p.category==='Ink')).toHaveLength(1);
 });
 it('makes Contour Flow more expressive at the same light and firm pressures',()=>{
  const range=(id:string)=>{const s=stockPresets.find(p=>p.id===id)!.settings;return [.2,.9].map(p=>widthResponse(pressureResponse(p**s.response,s.pressureCurve),s));};
  const studio=range('studio-ink'),contour=range('contour-flow');
  expect(contour[1]/contour[0]).toBeGreaterThan(studio[1]/studio[0]);
  expect(contour[1]/contour[0]).toBeGreaterThan(6);
 });
 for(const id of ids)it(`${id} preserves pressure pulses and keeps the live/final curve identical`,()=>{
  const s=stockPresets.find(p=>p.id===id)!.settings;
  for(const captureZoom of [.25,.74,1,1.21,2]){
   const stroke:Stroke={...s,...brushStrokeMetadata(s),id:'sample',kind:'stroke',tool:'brush',pressure:true,captureZoom,points:Array.from({length:180},(_,i)=>({x:30+i*2,y:100+40*Math.sin(i*.06),p:.12+.8*Math.sin(i/179*Math.PI*2)**2}))};
   const live=strokeGeometry(stroke,'live');
   expect(stroke.liveRefinementVersion).toBe(3);expect(live).toEqual(strokeGeometry(stroke,'final'));
   expect(live.points.at(-1)).toEqual(stroke.points.at(-1));
   expect(live.points.every((p,i)=>p.p===stroke.points[i].p)).toBe(true);
   const partial=strokeGeometry({...stroke,points:stroke.points.slice(0,100)},'live');
   expect(partial.points.slice(0,90)).toEqual(live.points.slice(0,90));
  }
 });
});

