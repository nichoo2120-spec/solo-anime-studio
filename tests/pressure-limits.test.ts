import {describe,it,expect} from 'vitest';
import {widthResponse,opacityResponse,velocityWidth} from '../src/engine/pressureChannels';
import {taperFactor,smoothPoints} from '../src/engine/strokeGeometry';
import {newBrushLibrary,restoreBrushLibrary,updatePreset} from '../src/core/brushes';
import {newProject,appendOperation,validateProject} from '../src/core/model';
describe('advanced pressure and taper',()=>{
 it('preserves the legacy response until limits are explicitly edited',()=>{for(const p of [0,.02,.2,.7,1])expect(widthResponse(p,{})).toBe(Math.max(.06,p));expect(opacityResponse(.4,{})).toBe(.4);});
 it('bounds width and opacity deterministically',()=>{expect(widthResponse(0,{minSize:.2,maxSize:.8})).toBe(.2);expect(widthResponse(1,{minSize:.2,maxSize:.8})).toBeCloseTo(.8);expect(opacityResponse(.5,{minOpacity:.2,maxOpacity:.6})).toBeCloseTo(.4);expect(velocityWidth(100,10)).toBeLessThan(velocityWidth(100,200));expect(velocityWidth(100,0,.7)).toBe(.7);});
 it('accepts full-length taper without changing old 45 percent tapers or dots',()=>{expect(taperFactor(20,100,1,0)).toBe(.2);expect(taperFactor(50,100,.45,.45)).toBe(1);expect(taperFactor(0,0,1,1)).toBe(1);});
 it('retains pressure and velocity peaks during geometric smoothing',()=>{const p=[{x:0,y:0,p:.1,v:1},{x:50,y:0,p:.9,v:.2},{x:100,y:0,p:.1,v:1}];expect(smoothPoints(p,100)).toContainEqual(p[1]);});
 it('persists separate limits and validates editable artwork',()=>{const library=newBrushLibrary(),s={...library.presets[0].settings,minSize:.2,maxSize:.8,minOpacity:.1,maxOpacity:.6,velocityTaper:true,taperStart:1,taperEnd:1},restored=restoreBrushLibrary(updatePreset(library,'hb',s));expect(restored.presets[0].settings).toMatchObject(s);const p=appendOperation(newProject(),{...s,id:'limited',kind:'stroke',tool:'brush',pressure:false,engineVersion:2,points:[{x:0,y:0,p:1,v:.8},{x:100,y:0,p:1,v:.3}]});expect(validateProject(JSON.parse(JSON.stringify(p))).version).toBe(3);expect(()=>validateProject({...p,layers:p.layers.map(l=>({...l,operations:l.operations.map(o=>({...o,minSize:.9,maxSize:.1}))}))})).toThrow();});
});
