import {bounds,toProject,transformMatrix,type View} from '../core/geometry';
import type {Matrix,Point} from '../core/model';
export type TransformSettings={dx:number;dy:number;scale:number;angle:number;scaleX?:number;scaleY?:number};
export const applyMatrix=(p:{x:number;y:number},m:Matrix)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
export function selectionMatrix(points:Point[],t:TransformSettings):Matrix{const b=bounds(points);return transformMatrix(b.x+b.w/2,b.y+b.h/2,t.dx,t.dy,t.scale*(t.scaleX??1),t.angle*Math.PI/180,t.scale*(t.scaleY??1));}
export function controls(points:Point[],t:TransformSettings,zoom:number){const b=bounds(points),m=selectionMatrix(points,t),corners=[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}].map(p=>applyMatrix(p,m)),top=applyMatrix({x:b.x+b.w/2,y:b.y},m),a=t.angle*Math.PI/180,rotation={x:top.x+Math.sin(a)*30/zoom,y:top.y-Math.cos(a)*30/zoom},center=applyMatrix({x:b.x+b.w/2,y:b.y+b.h/2},m);return {corners,top,rotation,center,bounds:b};}
export const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function rectangle(a:Point,b:Point):Point[]{return [{x:a.x,y:a.y,p:1},{x:b.x,y:a.y,p:1},{x:b.x,y:b.y,p:1},{x:a.x,y:b.y,p:1}];}
