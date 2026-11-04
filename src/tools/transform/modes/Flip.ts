import {cloneQuad,centroid,type Quad} from '../math/matrix';
import type {Session} from './types';
/** Reflect destination geometry around the chosen document-space pivot. */
export function flip(s:Session,axis:'h'|'v'){
 const q=cloneQuad(s.quad),center=centroid(q),pivot=s.pivot;
 const dx=axis==='h'?2*(pivot.x-center.x):0,dy=axis==='v'?2*(pivot.y-center.y):0;
 const swapped:Quad=axis==='h'?[q[1],q[0],q[3],q[2]]:[q[3],q[2],q[1],q[0]];
 s.quad=swapped.map(p=>({x:p.x+dx,y:p.y+dy})) as Quad;
 const rows=s.grid.rows,cols=s.grid.cols,previous=s.grid.nodes,stride=cols+1;
 s.grid.nodes=previous.map((_,i)=>{
  const x=i%stride,y=Math.floor(i/stride);
  const ix=axis==='h'?cols-x:x,iy=axis==='v'?rows-y:y;
  const node=previous[iy*stride+ix];return {x:node.x+dx,y:node.y+dy};
 });
}
