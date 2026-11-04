import type {Point} from '../core/model';
import {flattenCubic,type strokeGeometry} from './strokeGeometry';
export type PaintSamples={points:Point[];arc:number[];ends:number[];total:number};
/** Shared sampling for the settled mask and the changing tail. Indices retain
 * the full stroke's arc lengths, pressure and document-anchored stamp phase. */
export function paintSamples(g:ReturnType<typeof strokeGeometry>,tolerance:number):PaintSamples{
 const points:Point[]=[],ends:number[]=[];
 if(g.cubics.length)for(let i=0;i<g.cubics.length;i++){points.push(...flattenCubic(g.cubics[i],tolerance).slice(i?1:0));ends.push(points.length);}else points.push(...g.points);
 const arc=[0];for(let i=1;i<points.length;i++)arc.push(arc[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
 return {points,arc,ends,total:arc.at(-1)??0};
}
export type PaintPass={samples:PaintSamples;from:number;to:number;mask:HTMLCanvasElement;base?:HTMLCanvasElement;append?:boolean};
