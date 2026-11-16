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
/** Reuse flattened samples for unchanged live cubics; only sample the new tail. */
export function extendPaintSamples(g:ReturnType<typeof strokeGeometry>,tolerance:number,previous:PaintSamples|undefined,prefix:number):PaintSamples{
 if(!g.cubics.length||!previous||prefix<1||prefix>previous.ends.length)return paintSamples(g,tolerance);
 const count=previous.ends[prefix-1];if(!count||count>previous.points.length)return paintSamples(g,tolerance);
 const points=previous.points.slice(0,count),arc=previous.arc.slice(0,count),ends=previous.ends.slice(0,prefix);let total=arc.at(-1)??0;
 for(let i=prefix;i<g.cubics.length;i++){
  const flat=flattenCubic(g.cubics[i],tolerance);
  for(let j=i?1:0;j<flat.length;j++){const p=flat[j],last=points.at(-1);if(last)total+=Math.hypot(p.x-last.x,p.y-last.y);points.push(p);arc.push(total);}
  ends.push(points.length);
 }
 return {points,arc,ends,total};
}
export type PaintPass={samples:PaintSamples;from:number;to:number;mask:HTMLCanvasElement;base?:HTMLCanvasElement;append?:boolean};
