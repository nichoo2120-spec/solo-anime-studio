import {bilerp} from '../math/matrix';
import type {ModeFunction} from './types';

/** Each drag is measured against its pointer-down snapshot, not the last frame.
 * Shift uses a stable diagonal projection rather than switching between X/Y
 * as the dominant axis changes; this prevents sudden size jumps on a tablet.
 */
export const scale:ModeFunction=(s,d,p,keys)=>{
 const {handle}=d,index=handle.index;
 const opposite=d.quad[(index+2)%4];
 const sideAnchors=[bilerp(d.quad,.5,1),bilerp(d.quad,0,.5),bilerp(d.quad,.5,0),bilerp(d.quad,1,.5)];
 const center=keys.alt?d.pivot:handle.type==='corner'?opposite:sideAnchors[index];
 const dx=d.point.x-center.x,dy=d.point.y-center.y;
 let sx=Math.abs(dx)>1e-5?(p.x-center.x)/dx:1;
 let sy=Math.abs(dy)>1e-5?(p.y-center.y)/dy:1;
 if(handle.type==='edge'){
  if(index===0||index===2)sx=1;
  else sy=1;
 }
 if(keys.shift||s.lock){
  // For diagonal drags, project onto the original diagonal to get ONE stable
  // proportional factor. Switching x/y factors made Shift+drag stutter.
  const uniform=handle.type==='corner'
   ? ((p.x-center.x)*dx+(p.y-center.y)*dy)/Math.max(1e-5,dx*dx+dy*dy)
   : (index===0||index===2?sy:sx);
  sx=uniform;sy=uniform;
 }
 sx=Math.sign(sx||1)*Math.max(.02,Math.abs(sx));
 sy=Math.sign(sy||1)*Math.max(.02,Math.abs(sy));
 const apply=(v:{x:number;y:number})=>({x:center.x+(v.x-center.x)*sx,y:center.y+(v.y-center.y)*sy});
 s.quad=d.quad.map(apply) as typeof s.quad;
 s.grid={rows:d.grid.rows,cols:d.grid.cols,mode:d.grid.mode,nodes:d.grid.nodes.map(apply)};
 s.pivot=apply(d.pivot);
};
