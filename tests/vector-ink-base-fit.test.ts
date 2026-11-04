import {describe,it,expect} from 'vitest';
import {fitInkNodes,inkCornerIndices,resampleInkPath} from '../src/engine/flowCurveFitting';
import {createFreehandVector,flowVectorOutline,vectorCubics} from '../src/engine/vector';
const point=(x:number,y:number,p=.5)=>({x,y,p});
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const circle=Array.from({length:220},(_,i)=>point(80+50*Math.cos(2*Math.PI*i/219),80+50*Math.sin(2*Math.PI*i/219)));
const wave=Array.from({length:420},(_,i)=>point(i*2,100+30*Math.sin(i*2/70)+Math.sin(i*2*.8)*.7));
describe('FlowCurve intrinsic curve fit at zero user smoothing',()=>{
 it('turns a long jittery wave into far fewer smooth cubic sections',()=>{const nodes=fitInkNodes(wave,1.4);expect(nodes.length).toBeGreaterThan(4);expect(nodes.length).toBeLessThan(65);expect(nodes[0].x).toBe(0);expect(nodes.at(-1)?.x).toBe(838);});
 it('keeps smooth circular curves with coherent contour',()=>{const nodes=fitInkNodes(circle,1.4);expect(nodes.length).toBeLessThan(30);expect(distance(nodes[0],circle[0])).toBeLessThan(.001);expect(distance(nodes.at(-1)!,circle.at(-1)!)).toBeLessThan(.001);const line={...createFreehandVector('circle',circle,6,'#000',true,1.4),profileVersion:2 as const};expect(flowVectorOutline(line).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);});
 it('preserves a deliberate V corner',()=>{const path=Array.from({length:61},(_,i)=>i<31?point(i*2,i*2):point(i*2,120-i*2));const nodes=fitInkNodes(path);expect(nodes.some(n=>distance(n,point(60,60))<5)).toBe(true);});
 it('handles two point and tiny paths',()=>{const nodes=fitInkNodes([point(0,0),point(1,0)]);expect(nodes.length).toBe(2);expect(resampleInkPath([point(0,0)]).length).toBe(1);});
});
