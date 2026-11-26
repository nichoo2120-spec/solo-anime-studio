import {expect,test,vi} from 'vitest';
import {TipOutlineCache,tipTransform,traceTipMask,type TipMask} from '../src/engine/tipContours';

function mask(side: number, contains: (x: number, y: number) => boolean): TipMask {
 const alpha = new Uint8Array(side * side);
 for (let y = 0; y < side; y++) {
  for (let x = 0; x < side; x++) alpha[y * side + x] = contains((x + .5) / side - .5, (y + .5) / side - .5) ? 255 : 0;
 }
 return {width: side, height: side, alpha};
}

test('marching squares closes a square at the edge of the mask', () => {
 const contours = traceTipMask(mask(64, () => true));
 expect(contours).toHaveLength(1);
 expect(contours[0]).toHaveLength(4);
 const x = contours[0].map(p => p.x), y = contours[0].map(p => p.y);
 expect(Math.min(...x)).toBe(-.5);
 expect(Math.max(...x)).toBe(.5);
 expect(Math.min(...y)).toBe(-.5);
 expect(Math.max(...y)).toBe(.5);
});

test('a star retains its tips and concave valleys', () => {
 const star = Array.from({length: 10}, (_, i) => {
  const angle = Math.PI * i / 5 - Math.PI / 2, r = i % 2 ? .16 : .46;
  return {x: r * Math.cos(angle), y: r * Math.sin(angle)};
 });
 const [outline] = traceTipMask(mask(128, (x,y) => {
  let inside = false;
  for (let i = 0, j = star.length - 1; i < star.length; j = i++) {
   const a = star[i], b = star[j];
   if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
 }));
 const radii = outline.map(({x,y}) => Math.hypot(x,y));
 expect(radii.filter(r => r > .41).length).toBeGreaterThanOrEqual(5);
 expect(radii.filter(r => r < .19).length).toBeGreaterThanOrEqual(5);
});

test('keeps separated components and a transparent hole', () => {
 const [, ...others] = traceTipMask(mask(64, (x,y) => {
  const ring = Math.hypot(x + .13, y);
  return ring > .07 && ring < .22 || Math.hypot(x - .33, y) < .05;
 }));
 expect(others).toHaveLength(2);
});

test('brush size, angle, roundness and flip transform the same normalized contour', () => {
 const [a,b,c,d,x,y] = tipTransform(10,20,64,Math.PI / 2,-1,.5);
 const map = (u:number,v:number) => [a*u+c*v+x,b*u+d*v+y];
 expect(map(.5,0)[0]).toBeCloseTo(10);
 expect(map(.5,0)[1]).toBeCloseTo(-12);
 expect(map(0,.5)[0]).toBeCloseTo(-6);
 expect(map(0,.5)[1]).toBeCloseTo(20);
});

test('reuses a tip path while moving or resizing within a bucket', () => {
 const create = vi.fn((loops: unknown) => ({loops}));
 const sample = vi.fn((size: number) => mask(size, () => true));
 const cache = new TipOutlineCache(create), tip = {key: 'square', mask: sample};
 const small = cache.get(tip,34);
 expect(cache.get(tip,95)).toBe(small);
 expect(cache.get(tip,97)).not.toBe(small);
 expect(cache.get({...tip,key:'another-tip'},34)).not.toBe(small);
 expect(sample.mock.calls).toEqual([[64],[96],[64]]);
 expect(create).toHaveBeenCalledTimes(3);
});
