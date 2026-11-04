import {describe,it,expect} from 'vitest';
import {inputPressure,widthResponse} from '../src/engine/pressureChannels';
import {newBrushLibrary,updatePreset,restoreBrushLibrary,activePreset} from '../src/core/brushes';
import {strokeGeometry} from '../src/engine/strokeGeometry';
import {noisyContours,noisyLine} from './fixtures/drawingSequences';

describe('Correction 3 shared pressure and preset boundary',()=>{
 it('bounds malformed device values without producing a full-size starting response',()=>{
  for(const p of [NaN,Infinity,-Infinity,-2,0,undefined as unknown as number])expect(inputPressure(p)).toBe(.5);
  for(const p of [.01,.1,.5,.9,1])expect(inputPressure(p)).toBe(p);expect(inputPressure(2)).toBe(1);expect(inputPressure(0,.2)).toBe(.2);expect(inputPressure(NaN,NaN)).toBe(.5);
 });
 it('preserves configured minimum/maximum size and deliberate broad pressure',()=>{
  expect(widthResponse(inputPressure(.1),{minSize:.2,maxSize:.8})).toBeCloseTo(.26);
  expect(widthResponse(inputPressure(1),{minSize:.2,maxSize:.8})).toBe(.8);
 });
 it('retains every individual preset across repeated switching, serialization and restoration',()=>{
  let library=newBrushLibrary();for(const p of library.presets)library=updatePreset(library,p.id,{...p.settings,size:11+p.settings.size,opacity:.73});
  const restored=restoreBrushLibrary(JSON.parse(JSON.stringify(library)));for(let i=0;i<100;i++)for(const id of ['g-pen','mapping','g-pen']){restored.brushId=id;expect(activePreset(restored).settings).toEqual(library.presets.find(p=>p.id===id)!.settings);}
 });
 it('does not mutate recorded source samples at any accepted smoothing/stabilization level',()=>{
  for(const points of [noisyLine,...Object.values(noisyContours).map(c=>c.points)])for(const level of [0,25,50,75,100]){
   const source=structuredClone(points),stroke={id:'regression',kind:'stroke' as const,tool:'brush' as const,engineVersion:4 as const,points:source,size:7,color:'#000000',opacity:1,pressure:false,response:1,smoothness:level,stabilization:level/100};
   strokeGeometry(stroke,'live');strokeGeometry(stroke);expect(source).toEqual(points);
  }
 });
});
