import {describe,it,expect} from 'vitest';
import {floodFill} from '../src/engine/flood';
describe('connected-region flood fill',()=>{
 it('fills enclosed transparent pixels without changing the outline',()=>{const data=new Uint8ClampedArray(5*5*4);for(let y=0;y<5;y++)for(let x=0;x<5;x++)if(x===0||y===0||x===4||y===4)data.set([0,0,0,255],(y*5+x)*4);const original=data.slice();const r=floodFill(data,5,5,2,2,[255,0,0,255],0);expect(r.count).toBe(9);expect(r.touchesEdge).toBe(false);expect(r.output[3]).toBe(0);expect(data).toEqual(original);});
 it('warns on open regions and supports transparent-layer RGB differences',()=>{const data=new Uint8ClampedArray(4*4*4);data[0]=255;const r=floodFill(data,4,4,1,1,[0,255,0,128],0);expect(r.count).toBe(16);expect(r.touchesEdge).toBe(true);expect(r.output[3]).toBe(128);});
 it('applies tolerance to contiguous similar pixels only',()=>{const data=new Uint8ClampedArray([10,10,10,255,20,20,20,255,100,100,100,255,15,15,15,255]);expect(floodFill(data,4,1,0,0,[1,2,3,255],15).count).toBe(2);expect(floodFill(data,4,1,0,0,[1,2,3,255],0).count).toBe(1);});
 it('safely ignores seeds outside the frame',()=>{expect(floodFill(new Uint8ClampedArray(16),2,2,-1,0,[0,0,0,255],0).count).toBe(0);});
 it('handles a full HD transparent frame within the reference budget',()=>{const start=performance.now(),r=floodFill(new Uint8ClampedArray(1920*1080*4),1920,1080,300,300,[1,2,3,255],0);expect(r.count).toBe(1920*1080);expect(performance.now()-start).toBeLessThan(4000);});
});
