import {expect,test} from 'vitest';
import {calibratePressure,mapPenPressure,penPresets} from '../src/core/penPressure';

test('pressure rises smoothly from light contact and returns to the light end',()=>{
 const settings={curve:penPresets.Normal,min:0,max:1};
 const raw=[0,.01,.05,.10,.20,.30,.50,.75,1,.75,.50,.30,.20,.10,.05,.01,0];
 const pressure=raw.map(p=>mapPenPressure(p,settings));
 expect(pressure[0]).toBeLessThan(.1);
 expect(pressure[4]).toBeGreaterThan(.3);
 expect(pressure[8]).toBe(1);
 expect(pressure[15]).toBeLessThan(.1);
 for(let i=2;i<=8;i++)expect(pressure[i]).toBeGreaterThan(pressure[i-1]);
 for(let i=9;i<=15;i++)expect(pressure[i]).toBeLessThan(pressure[i-1]);
 expect(mapPenPressure(0,settings,pressure[15])).toBe(pressure[15]);
});

test('presets and calibration map contact pressure without inventing driver readings',()=>{
 const limits={min:0,max:1};
 const map=(name:keyof typeof penPresets)=>mapPenPressure(.25,{...limits,curve:penPresets[name]});
 expect(map('Soft')).toBeGreaterThan(map('Normal'));
 expect(map('Normal')).toBeGreaterThan(map('Firm'));
 expect(calibratePressure(.5,.5)).toBeUndefined();
 expect(calibratePressure(0,0)).toBeUndefined();
 const calibrated={curve:penPresets.Normal,...calibratePressure(.17,.72)!};
 expect(mapPenPressure(.72,calibrated)).toBe(1);
 expect(mapPenPressure(.17,calibrated)).toBeCloseTo(.06);
});
