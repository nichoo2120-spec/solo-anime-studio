import type {XY} from './perspectiveWarp';

/** Screen-size-consistent handles. All positions use document coordinates, not CSS pixels. */
export type FreeformHit={kind:'corner'|'edge'|'rotation'|'none';index?:number};
export const midpoint=(a:XY,b:XY):XY=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
export const edgeHandles=(corners:XY[]):XY[]=>corners.map((p,i)=>midpoint(p,corners[(i+1)%4]));
export const rotationRadius=(center:XY,top:XY,zoom:number,corners:XY[]=[])=>(Math.max(22/zoom,Math.hypot(top.x-center.x,top.y-center.y)+20/zoom,...corners.map(p=>Math.hypot(p.x-center.x,p.y-center.y)+20/zoom)));
export function freeformHit(point:XY,corners:XY[],rotation:XY,center:XY,top:XY,zoom:number,perspective=false):FreeformHit{
 const near=(p:XY,px=11)=>Math.hypot(p.x-point.x,p.y-point.y)<=px/zoom;
 const corner=corners.findIndex(p=>near(p));
 if(corner>=0)return {kind:'corner',index:corner};
 if(!perspective){const edge=edgeHandles(corners).findIndex(p=>near(p));if(edge>=0)return {kind:'edge',index:edge};}
 const radius=rotationRadius(center,top,zoom,corners);
 if(near(rotation,14)||Math.abs(Math.hypot(point.x-center.x,point.y-center.y)-radius)<8/zoom)return {kind:'rotation'};
 return {kind:'none'};
}
