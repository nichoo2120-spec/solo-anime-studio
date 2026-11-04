import {describe,it,expect} from 'vitest';
import {pointerBatch,appendPath} from '../src/engine/inputPath';
import {fitView,toScreen} from '../src/core/geometry';
import {rectangle,selectionMatrix,applyMatrix,angleDelta} from '../src/engine/selectionControls';
describe('complete input and selection geometry',()=>{
 it('keeps coalesced order and an omitted outer tail, with a safe fallback',()=>{const a={clientX:1,clientY:0,pressure:1},b={clientX:2,clientY:0,pressure:1},e={clientX:3,clientY:0,pressure:1,getCoalescedEvents:()=>[a,b]} as unknown as PointerEvent;expect(pointerBatch(e)).toEqual([a,b,e]);expect(pointerBatch({...e,getCoalescedEvents:()=>{throw Error();}} as PointerEvent)).toHaveLength(1);});
 it('accepts buffered cancellation samples without inventing the cancel event origin',()=>{const accepted={clientX:50,clientY:80,pressure:1},cancel={clientX:0,clientY:0,pressure:0,getCoalescedEvents:()=>[accepted]} as unknown as PointerEvent;expect(pointerBatch(cancel,false)).toEqual([accepted]);expect(pointerBatch({...cancel,getCoalescedEvents:()=>[]} as PointerEvent,false)).toEqual([]);});
 it('preserves short accepted segments, release coordinates and pressure changes',()=>{const p=[{x:0,y:0,p:1}];appendPath(p,{x:.04,y:0,p:1});appendPath(p,{x:.04,y:0,p:.5});appendPath(p,p.at(-1)!);expect(p).toHaveLength(3);});
 it('rectangle and nonuniform transform share document coordinates',()=>{const p=rectangle({x:10,y:20,p:1},{x:110,y:70,p:1}),m=selectionMatrix(p,{dx:30,dy:-10,scale:1,scaleX:2,scaleY:3,angle:90});expect(applyMatrix({x:60,y:45},m)).toEqual({x:90,y:35});expect(p).toHaveLength(4);});
 it('fits all corners of a rotated frame without resetting rotation',()=>{for(const rotation of [.2,.9,Math.PI/2,2.1]){const v=fitView(900,600,1920,1080,rotation);expect(v.rotation).toBe(rotation);for(const x of [0,1920])for(const y of [0,1080]){const p=toScreen({x,y},v);expect(p.x).toBeGreaterThanOrEqual(44);expect(p.x).toBeLessThanOrEqual(856);expect(p.y).toBeGreaterThanOrEqual(44);expect(p.y).toBeLessThanOrEqual(556);}}expect(angleDelta(-Math.PI+.1,Math.PI-.1)).toBeCloseTo(.2);});
});
