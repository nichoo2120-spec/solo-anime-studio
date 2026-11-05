/** Stroke-aware selection helpers. All geometry is in document coordinates.
 * Unlike a pixel marquee this returns operation IDs, so unrelated marks are never cut. */
import type {ArtworkOrigin,Matrix,Point,Stroke,Layer} from '../core/model';
import type {VectorLine} from './vector';
import {finalGeometry} from './geometryCache';
import {vectorCubics} from './vector';
import {flattenCubic} from './strokeGeometry';
import {affineH,multiplyH,projectPoint,type H} from './perspectiveWarp';
export type Selectable=Stroke|VectorLine;
export type PickMode='touch'|'enclose';
export const IDENTITY:Matrix=[1,0,0,1,0,0];
export function mul(a:Matrix,b:Matrix):Matrix{return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
export function mapPoint(p:{x:number;y:number},m:Matrix){return {x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]};}
export function scaleOf(m:Matrix){return Math.sqrt(Math.max(0.0001,Math.abs(m[0]*m[3]-m[1]*m[2])));}
export function selectable(layer:Layer):Selectable[]{return layer.operations.filter((o):o is Selectable=>o.kind==='vector'||o.kind==='stroke'&&o.tool==='brush');}
const pathCache=new WeakMap<Selectable,{x:number;y:number}[]>();
export function polyline(op:Selectable):{x:number;y:number}[]{
 const cached=pathCache.get(op);if(cached)return cached;
 if(op.kind==='stroke'){
  const points=op.engineVersion?finalGeometry(op).points:op.points;
  const result=op.perspective?points.map(p=>projectPoint(p,op.perspective!)):op.transform?points.map(p=>mapPoint(p,op.transform!)):points;pathCache.set(op,result);return result;
 }
 const curves=vectorCubics(op),out:{x:number;y:number}[]=[];
 for(const [i,c] of curves.entries())out.push(...flattenCubic(c,1.8).slice(i?1:0));
 const result=out.length?out:op.nodes;pathCache.set(op,result);return result;
}
export function boundsOf(ops:Selectable[]){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const op of ops){const pad=(op.kind==='stroke'?op.size*scaleOf(op.transform??IDENTITY):op.width)/2;
  for(const p of polyline(op)){minX=Math.min(minX,p.x-pad);minY=Math.min(minY,p.y-pad);maxX=Math.max(maxX,p.x+pad);maxY=Math.max(maxY,p.y+pad);}
 }
 return isFinite(minX)?{x:minX,y:minY,w:Math.max(1,maxX-minX),h:Math.max(1,maxY-minY)}:null;
}
function segmentDistance(x:number,y:number,a:{x:number;y:number},b:{x:number;y:number}){const vx=b.x-a.x,vy=b.y-a.y,den=vx*vx+vy*vy,t=den?Math.max(0,Math.min(1,((x-a.x)*vx+(y-a.y)*vy)/den)):0;return Math.hypot(x-a.x-vx*t,y-a.y-vy*t);}
// Prefer the stroke nearest the pen tip, not just the topmost stroke whose
// broad click tolerance happens to overlap. This matters for closely spaced
// ink/hair lines, where a 7px touch radius could otherwise select the wrong one.
const hitBounds=new WeakMap<Selectable,ReturnType<typeof boundsOf>>();
export function hitStroke(layer:Layer,p:{x:number;y:number},zoom:number):Selectable|undefined{
 const ops=selectable(layer),tolerance=7/Math.max(.25,zoom);let winner:Selectable|undefined,best=Infinity;
 for(let i=ops.length-1;i>=0;i--){const op=ops[i];let b=hitBounds.get(op);if(b===undefined){b=boundsOf([op]);hitBounds.set(op,b);}if(!b)continue;
  if(p.x<b.x-tolerance||p.x>b.x+b.w+tolerance||p.y<b.y-tolerance||p.y>b.y+b.h+tolerance)continue;
  const radius=(op.kind==='stroke'?op.size*scaleOf(op.transform??IDENTITY):op.width)/2;
  const points=polyline(op);let distance=Infinity;
  if(points.length===1)distance=Math.hypot(p.x-points[0].x,p.y-points[0].y);
  for(let j=1;j<points.length;j++)distance=Math.min(distance,segmentDistance(p.x,p.y,points[j-1],points[j]));
  if(distance>radius+tolerance)continue;
  const score=distance/Math.max(radius,1);if(score<best-1e-6){best=score;winner=op;}
  if(best<.0001)break; // Exact hit on the uppermost matching stroke.
 }
 return winner;
}
function inPoly(p:{x:number;y:number},poly:{x:number;y:number}[]){if(poly.length<3)return false;for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length];if(segmentDistance(p.x,p.y,a,b)<1e-6&&p.x>=Math.min(a.x,b.x)-1e-6&&p.x<=Math.max(a.x,b.x)+1e-6&&p.y>=Math.min(a.y,b.y)-1e-6&&p.y<=Math.max(a.y,b.y)+1e-6)return true;}let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
function segmentsCross(a:{x:number;y:number},b:{x:number;y:number},c:{x:number;y:number},d:{x:number;y:number}){
 const det=(p:{x:number;y:number},q:{x:number;y:number},r:{x:number;y:number})=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
 const x=det(a,b,c),y=det(a,b,d),u=det(c,d,a),v=det(c,d,b);if(x*y<0&&u*v<0)return true;const on=(p:{x:number;y:number},s:{x:number;y:number},t:{x:number;y:number})=>segmentDistance(p.x,p.y,s,t)<1e-6&&p.x>=Math.min(s.x,t.x)-1e-6&&p.x<=Math.max(s.x,t.x)+1e-6&&p.y>=Math.min(s.y,t.y)-1e-6&&p.y<=Math.max(s.y,t.y)+1e-6;return on(a,c,d)||on(b,c,d)||on(c,a,b)||on(d,a,b);
}
export function inMarquee(op:Selectable,poly:{x:number;y:number}[],mode:PickMode){
 const pts=polyline(op),inside=pts.map(p=>inPoly(p,poly));if(!pts.length)return false;
 if(mode==='enclose')return inside.every(Boolean);
 if(inside.some(Boolean))return true;
 for(let j=1;j<pts.length;j++)for(let k=0;k<poly.length;k++)if(segmentsCross(pts[j-1],pts[j],poly[k],poly[(k+1)%poly.length]))return true;
 return false;
}
export function idsInMarquee(layer:Layer,poly:Point[],mode:PickMode){return selectable(layer).filter(o=>inMarquee(o,poly,mode)).map(o=>o.id);}
export function nearSelection(p:{x:number;y:number},poly:Point[],tol=0){if(inPoly(p,poly))return true;for(let i=0;i<poly.length;i++)if(segmentDistance(p.x,p.y,poly[i],poly[(i+1)%poly.length])<=tol)return true;return false;}
export function transformedStroke(op:Stroke,m:Matrix):Stroke{
 const {inShot:_inShot,inPreviousStage:_inPreviousStage,...editable}=op as Stroke&ArtworkOrigin;
 return op.perspective?{...editable,perspective:multiplyH(affineH(m),op.perspective)}:{...editable,transform:mul(m,op.transform??IDENTITY)};
}
/** Apply a fresh projective change outside all previously committed transforms. */
export function projectiveStroke(op:Stroke,h:H):Stroke{
 const {inShot:_inShot,inPreviousStage:_inPreviousStage,...editable}=op as Stroke&ArtworkOrigin;
 return {...editable,transform:undefined,perspective:multiplyH(h,op.perspective??affineH(op.transform??IDENTITY))};
}
