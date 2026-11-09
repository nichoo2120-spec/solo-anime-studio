import type {Stroke,Point} from '../core/model';
import {finalGeometry} from './geometryCache';
import {flattenCubic,type strokeGeometry} from './strokeGeometry';
import {projectPoint} from './perspectiveWarp';

/** The same editable, pressure-bearing geometry is used by native page
 * rendering and device-resolution display. Never flatten transformed ink
 * into a saved image or derive new source strokes from a display bitmap.
 *
 * Homographies cannot generally map a cubic to another cubic. Subdivide the
 * original curves once, then use straight micro-cubics whose endpoints retain
 * the original pen pressure. This matches the legacy projective renderer
 * while permitting crisp high-DPI redraws after reload.
 */
export function projectiveInkGeometry(stroke:Stroke,geometry:ReturnType<typeof strokeGeometry>=finalGeometry(stroke)):ReturnType<typeof strokeGeometry>{
 if(!stroke.perspective)return geometry;
 const raw=geometry.cubics.length
  ?geometry.cubics.flatMap((curve,index)=>flattenCubic(curve,1.0).slice(index?1:0))
  :geometry.points;
 const points:Point[]=raw.map(pt=>({...pt,...projectPoint(pt,stroke.perspective!)}));
 const cubics=points.slice(1).map((b,i)=>{
  const a=points[i];
  return {a,c1:{...a,x:a.x+(b.x-a.x)/3,y:a.y+(b.y-a.y)/3},
   c2:{...b,x:a.x+(b.x-a.x)*2/3,y:a.y+(b.y-a.y)*2/3},b};
 });
 return {points,cubics};
}
