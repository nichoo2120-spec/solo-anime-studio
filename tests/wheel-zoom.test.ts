import {describe,it,expect} from 'vitest';
import {wheelZoom} from '../src/core/wheelZoom';
import {toProject,toScreen} from '../src/core/geometry';
describe('wheel zoom',()=>{
 it('normalizes wheel units',()=>{const v={x:13,y:29,zoom:2,rotation:.4},p={x:350,y:210};expect(wheelZoom(v,p,16,0)).toEqual(wheelZoom(v,p,1,1));expect(wheelZoom(v,p,80,0)).toEqual(wheelZoom(v,p,.1,2,800));});
 it('keeps the cursor anchor through repeated rotated zooms and both caps',()=>{for(const rotation of [0,.5,1.8,-2.1]){let v={x:-14,y:30,zoom:1,rotation};const p={x:432,y:287},anchor=toProject(p,v);for(const delta of [...Array(60).fill(-100),...Array(100).fill(100)]){v=wheelZoom(v,p,delta);const screen=toScreen(anchor,v);expect(screen.x).toBeCloseTo(p.x,7);expect(screen.y).toBeCloseTo(p.y,7);expect(v.zoom).toBeGreaterThanOrEqual(.25);expect(v.zoom).toBeLessThanOrEqual(8);}}});
 it('bounds a single page event and ignores invalid deltas',()=>{const v={x:0,y:0,zoom:1,rotation:0},p={x:300,y:200};expect(wheelZoom(v,p,-100,2).zoom).toBeLessThan(1.25);expect(wheelZoom(v,p,NaN)).toBe(v);});
});
