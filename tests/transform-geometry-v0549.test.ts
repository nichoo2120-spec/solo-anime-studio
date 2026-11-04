import {describe,it,expect} from 'vitest';
import {rectQuad,centroid,type Quad} from '../src/tools/transform/math/matrix';
import {makeGrid,gridPoint} from '../src/tools/transform/math/meshWarp';
import {modeFns} from '../src/tools/transform/modes';
import {flip} from '../src/tools/transform/modes/Flip';
import type {Mode,Session,Gesture,Handle,PointerModifiers} from '../src/tools/transform/modes/types';
const box={x:100,y:100,w:200,h:300},quad=rectQuad(box),center=centroid(quad);
function setup(mode:Mode,handle:Handle,point:{x:number;y:number}){
 const grid=makeGrid(quad,4),s:Session={mode,quad:rectQuad(box),initial:rectQuad(box),pivot:{...center},grid,initialGrid:makeGrid(quad,4),angle:0,skew:0,lock:false};
 const g:Gesture={point,quad:rectQuad(box),grid:makeGrid(quad,4),pivot:{...center},angle:0,skew:0,index:handle.index,handle};
 return {s,g};
}
const mod:PointerModifiers={alt:false,ctrl:false,shift:false};
describe('Full Transform v0.5.49 geometry',()=>{
 it('moves by exact document pixels',()=>{const {s,g}=setup('move',{type:'inside',index:0},{x:150,y:200});modeFns.move(s,g,{x:180,y:215},mod);expect(s.quad[0]).toEqual({x:130,y:115});});
 it('scales corner using opposite corner anchor',()=>{const {s,g}=setup('scale',{type:'corner',index:2},quad[2]);modeFns.scale(s,g,{x:400,y:500},mod);expect(s.quad[0]).toEqual(quad[0]);expect(s.quad[2].x).toBeGreaterThan(quad[2].x);});
 it('scales a side without changing the opposite edge',()=>{const {s,g}=setup('scale',{type:'edge',index:0},{x:200,y:100});modeFns.scale(s,g,{x:200,y:70},mod);expect(s.quad[2].y).toBe(400);});
 it('snaps rotation to 15 degrees',()=>{const {s,g}=setup('rotate',{type:'rotate',index:0},{x:300,y:250});modeFns.rotate(s,g,{x:200,y:350},{...mod,shift:true});expect(s.angle%15).toBe(0);});
 it('mirrors opposite perspective corner',()=>{const {s,g}=setup('perspective',{type:'corner',index:0},quad[0]);modeFns.perspective(s,g,{x:140,y:120},{...mod,shift:true});expect(s.quad[2]).toEqual({x:260,y:380});});
 it('skews edge independently',()=>{const {s,g}=setup('skew',{type:'edge',index:0},{x:200,y:100});modeFns.skew(s,g,{x:230,y:100},mod);expect(s.quad[1].x).toBe(330);});
 it('distorts one corner only',()=>{const {s,g}=setup('distort',{type:'corner',index:0},quad[0]);modeFns.distort(s,g,{x:120,y:155},mod);expect(s.quad[0]).toEqual({x:120,y:155});expect(s.quad[2]).toEqual(quad[2]);});
 it('warps an individual mesh node (4 by 4 cells)',()=>{const {s,g}=setup('mesh',{type:'node',index:5},{x:100,y:175});modeFns.mesh(s,g,{x:125,y:185},mod);expect(s.grid.nodes[5].x).toBe(125);expect(s.grid.nodes).toHaveLength(25);});
 it('supports 2 to 8 grid densities',()=>{expect(makeGrid(quad,2).nodes).toHaveLength(9);expect(makeGrid(quad,8).nodes).toHaveLength(81);expect(gridPoint(makeGrid(quad,4),0,0)).toEqual(quad[0]);});
 it('flips horizontally and vertically',()=>{const {s}=setup('flip',{type:'inside',index:0},quad[0]);flip(s,'h');expect(s.quad[0]).toEqual(quad[1]);flip(s,'v');expect(s.quad[0]).toEqual(quad[2]);});
 it('moves a pivot without moving content',()=>{const {s,g}=setup('pivot',{type:'pivot',index:0},center);modeFns.pivot(s,g,{x:center.x+12,y:center.y-4},mod);expect(s.quad).toEqual(quad);expect(s.pivot).toEqual({x:center.x+12,y:center.y-4});});
 it('free transform switches between move and scale handles',()=>{const {s,g}=setup('free',{type:'inside',index:0},{x:150,y:200});modeFns.free(s,g,{x:160,y:220},mod);expect(s.quad[0]).toEqual({x:110,y:120});});
});
