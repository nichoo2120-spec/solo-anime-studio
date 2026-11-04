import {cloneQuad,centroid,type Pt} from '../math/matrix';
import {move} from './Move';
import type {ModeFunction} from './types';
/** Edge drag shears along the actual edge tangent; corner drag combines both
 * shears around the pivot. The pointer-down snapshot prevents incremental drift. */
export const skew:ModeFunction=(s,d,p,keys)=>{
 if(d.handle.type==='inside'){move(s,d,p,keys);return;}
 if(d.handle.type==='pivot'){s.pivot={x:d.pivot.x+p.x-d.point.x,y:d.pivot.y+p.y-d.point.y};return;}
 const dx=p.x-d.point.x,dy=p.y-d.point.y,q=d.quad;
 if(d.handle.type==='edge'){
  const i=d.handle.index%4,a=q[i],b=q[(i+1)%4],delta={x:b.x-a.x,y:b.y-a.y},length=Math.hypot(delta.x,delta.y);
  if(length<1e-5)return;
  const horizontal=i===0||i===2;
  if((s.skewAxis==='horizontal'&&!horizontal)||(s.skewAxis==='vertical'&&horizontal))return;
  const tangent={x:delta.x/length,y:delta.y/length};
  let distance=dx*tangent.x+dy*tangent.y;
  const oppositeStart=q[(i+2)%4],oppositeEnd=q[(i+3)%4],oppositeMid={x:(oppositeStart.x+oppositeEnd.x)/2,y:(oppositeStart.y+oppositeEnd.y)/2};
  const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  const span=Math.max(1,Math.hypot(mid.x-oppositeMid.x,mid.y-oppositeMid.y));
  let angle=Math.atan2(distance,span)*180/Math.PI;
  if(s.skewSnap){angle=Math.round(angle/s.skewSnap)*s.skewSnap;distance=Math.tan(angle*Math.PI/180)*span;}
  const offset:Pt={x:tangent.x*distance,y:tangent.y*distance};
  const next=cloneQuad(q);next[i]={x:q[i].x+offset.x,y:q[i].y+offset.y};
  next[(i+1)%4]={x:q[(i+1)%4].x+offset.x,y:q[(i+1)%4].y+offset.y};
  s.quad=next;s.skew=d.skew+angle;return;
 }
 if(d.handle.type!=='corner')return;
 // Combined shear keeps straight parallel edges and preserves the centre.
 const pivot=d.pivot??centroid(q);const corner=q[d.handle.index];
 const vx=corner.x-pivot.x,vy=corner.y-pivot.y;
 const applyX=s.skewAxis!=='vertical'&&Math.abs(vy)>1e-5;
 const applyY=s.skewAxis!=='horizontal'&&Math.abs(vx)>1e-5;
 let kx=applyX?dx/vy:0,ky=applyY?dy/vx:0;
 const snapAngle=s.skewSnap;
 if(snapAngle){const snap=(slope:number)=>Math.tan(Math.round(Math.atan(slope)*180/Math.PI/snapAngle)*snapAngle*Math.PI/180);kx=snap(kx);ky=snap(ky);}
 s.quad=q.map(v=>({x:v.x+kx*(v.y-pivot.y),y:v.y+ky*(v.x-pivot.x)})) as typeof q;
 s.skew=d.skew+Math.atan(kx)*180/Math.PI;
};
