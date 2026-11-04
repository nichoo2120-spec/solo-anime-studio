import {cloneQuad} from '../math/matrix';
import {move} from './Move';
import type {ModeFunction} from './types';
/** Distort corners move independently; edge midpoint moves its two endpoints.
 * The interior translates the entire shape without changing its distortion. */
export const distort:ModeFunction=(s,d,p,keys)=>{
 if(d.handle.type==='inside'){move(s,d,p,keys);return;}
 if(d.handle.type==='pivot'){s.pivot={x:d.pivot.x+p.x-d.point.x,y:d.pivot.y+p.y-d.point.y};return;}
 const dx=p.x-d.point.x,dy=p.y-d.point.y,next=cloneQuad(d.quad);
 if(d.handle.type==='corner'){
  const i=d.handle.index;next[i]={x:next[i].x+dx,y:next[i].y+dy};
 }else if(d.handle.type==='edge'){
  const i=d.handle.index,j=(i+1)%4;
  for(const k of [i,j])next[k]={x:next[k].x+dx,y:next[k].y+dy};
 }else return;
 s.quad=next;
};
