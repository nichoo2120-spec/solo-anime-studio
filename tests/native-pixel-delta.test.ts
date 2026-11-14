import {describe,it,expect} from 'vitest';
import {nativePixelsDiffer} from '../src/engine/nativePixelDelta';
const pixel=(r:number,g:number,b:number,a:number)=>new Uint8ClampedArray([r,g,b,a]);
describe('Native paint ownership',()=>{
 it('ignores readback rounding that stores the same translucent pixel',()=>expect(nativePixelsDiffer(pixel(35,41,48,133),pixel(34,41,48,133),0)).toBe(false));
 it('retains real pigment changes',()=>expect(nativePixelsDiffer(pixel(35,41,48,133),pixel(45,41,48,133),0)).toBe(true));
 it('retains alpha changes and opaque one-level changes',()=>{expect(nativePixelsDiffer(pixel(35,41,48,133),pixel(35,41,48,134),0)).toBe(true);expect(nativePixelsDiffer(pixel(35,41,48,255),pixel(34,41,48,255),0)).toBe(true);});
 it('ignores invisible RGB under zero alpha',()=>expect(nativePixelsDiffer(pixel(0,0,0,0),pixel(255,64,12,0),0)).toBe(false));
});
