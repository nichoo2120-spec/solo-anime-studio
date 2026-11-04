import {describe,it,expect} from 'vitest';
import {mixColorChangeRegion} from '../src/engine/mixing';
const old=[{x:50,y:100,color:'#123456'},{x:80,y:100,color:'#234567'}];
describe('color transfer invalidation',()=>{
 it('leaves unchanged stops alone and fully refreshes a changed base colour',()=>{expect(mixColorChangeRegion(old,old,100,1000,600)).toBeNull();expect(mixColorChangeRegion(old,[{...old[0],color:'#ffffff'},old[1]],100,1000,600)).toBeUndefined();});
 it('does not recolour settled coverage when a uniform colour plane stays uniform',()=>{const start=[old[0]],next=[old[0],{x:700,y:350,color:old[0].color}];expect(mixColorChangeRegion(start,next,150,1000,600)).toBeNull();expect(mixColorChangeRegion(old,next,150,1000,600)).not.toBeNull();});
 it('uses the real pen tail even when a stabilizer trails far behind it',()=>{const next=[...old,{x:700,y:350,color:'#345678'}],r=mixColorChangeRegion(old,next,100,1000,600)!;expect(r.x).toBe(0);expect(r.x+r.width).toBeGreaterThan(830);expect(r.y+r.height).toBeGreaterThan(480);});
 it('includes both the erased and replacement colour segments during replay',()=>{const a=[...old,{x:900,y:450,color:'#345678'}],b=[...old,{x:100,y:200,color:'#789abc'}],r=mixColorChangeRegion(a,b,100,1000,600)!;expect(r.x+r.width).toBe(1000);expect(r.y+r.height).toBeGreaterThan(570);expect(r.y).toBe(0);});
});
