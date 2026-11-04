import type {ModeFunction} from './types';
/** Non-shrinking, snapshot-based mesh deformation. Smoothness is applied to
 * DISPLACEMENTS, never to absolute coordinates: smoothing absolute positions
 * contracts boundaries with every drag even when the pointer has not moved. */
export const meshWarp:ModeFunction=(s,d,p)=>{
 const index=d.handle.index;
 if(d.handle.type!=='node'||index<0||index>=d.grid.nodes.length)return;
 const {rows,cols}=d.grid,stride=cols+1;
 const dx=p.x-d.point.x,dy=p.y-d.point.y;
 // A click without movement must not change the mesh or raster mapping.
 if(Math.hypot(dx,dy)<1e-7)return;
 const influence=Math.max(0,Math.min(100,s.meshFalloff??50))/100;
 // Zero influence moves only the selected handle. Larger values distribute
 // the displacement in a Gaussian envelope without modifying other geometry.
 const radius=influence*3.2;
 const gx=index%stride,gy=Math.floor(index/stride);
 const corners=new Set([0,cols,rows*stride,rows*stride+cols]);
 if((s.meshLockBorder&&(gx===0||gx===cols||gy===0||gy===rows))||(s.meshLockCorners&&corners.has(index)))return;
 const nodes=d.grid.nodes.map((v,i)=>{
  const ix=i%stride,iy=Math.floor(i/stride);
  // Lock border includes every edge node, including corners, even if directly dragged.
  if(s.meshLockBorder&&(ix===0||ix===cols||iy===0||iy===rows))return {...v};
  if(s.meshLockCorners&&corners.has(i))return {...v};
  if(i===index)return {x:v.x+dx,y:v.y+dy};
  if(radius<=0)return {...v};
  // Distances in grid-index space are stable even with prior deformation,
  // unlike measuring from the already warped/uneven node coordinates.
  const distance=Math.hypot(ix-gx,iy-gy);
  const t=distance/radius;
  const weight=t>=1?0:s.meshSmooth===false?Math.max(0,1-t):Math.exp(-3*t*t)*(1-t*t)**2;
  return {x:v.x+dx*weight,y:v.y+dy*weight};
 });
 // No free-running Laplacian relaxation: it caused contraction on every drag.
 // Preserve the immutable source lattice. Dropping sourceNodes makes the raster
 // renderer fall back to rectangular UV mapping on the very first drag, which
 // can shrink/misplace the character inside the unchanged mesh rectangle.
 s.grid={rows,cols,mode:d.grid.mode,uStops:d.grid.uStops?.slice(),vStops:d.grid.vStops?.slice(),sourceNodes:(d.grid.sourceNodes??d.grid.nodes).map(v=>({...v})),nodes,pins:d.grid.pins?.map(pin=>({...pin}))};
 s.quad=[nodes[0],nodes[cols],nodes.at(-1)!,nodes[rows*stride]];
};
