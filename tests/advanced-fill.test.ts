import {describe,it,expect} from 'vitest';
import {advancedFill,morphology} from '../src/engine/advancedFill';
const outline=(gap=false)=>{const w=24,h=24,data=new Uint8ClampedArray(w*h*4);for(let i=4;i<=19;i++){for(const [x,y] of [[i,4],[i,19],[4,i],[19,i]])data[(y*w+x)*4+3]=255;}if(gap)data[(4*24+12)*4+3]=0;return data;};
describe('referenced worker fill',()=>{
 it('uses a separate line buffer without painting or changing that reference',()=>{const ref=outline(),before=ref.slice(),r=advancedFill(ref,24,24,10,10,[255,0,0,255],10,0,0);expect(r.touchesEdge).toBe(false);expect(r.output[(10*24+10)*4]).toBe(255);expect(r.output[(1*24+1)*4+3]).toBe(0);expect(ref).toEqual(before);});
 it('closes a one-pixel opening and keeps the exterior unfilled',()=>{expect(advancedFill(outline(true),24,24,10,10,[0,0,255,255],0).touchesEdge).toBe(true);const closed=advancedFill(outline(true),24,24,10,10,[0,0,255,255],0,2);expect(closed.touchesEdge).toBe(false);expect(closed.output[3]).toBe(0);});
 it('expands fill under boundaries without enlarging the seed flood',()=>{const a=advancedFill(outline(),24,24,10,10,[20,40,60,255],0),b=advancedFill(outline(),24,24,10,10,[20,40,60,255],0,0,2);expect(a.output[(10*24+4)*4+3]).toBe(0);expect(b.output[(10*24+4)*4+3]).toBe(255);expect(b.count).toBe(a.count);});
 it('gives partial coverage at anti-aliased line edges',()=>{const data=outline();data[(10*24+4)*4+3]=100;const r=advancedFill(data,24,24,10,10,[255,0,0,255],0);expect(r.output[(10*24+4)*4+3]).toBe(155);});
 it('morphology stays bounded at image edges',()=>{const a=new Uint8Array(25);a[12]=1;expect([...morphology(a,5,5,1,true)].reduce((a,b)=>a+b,0)).toBe(9);expect([...morphology(a,5,5,0,true)]).toEqual([...a]);});
});
