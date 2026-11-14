import {widthPointExtent} from '../core/widthPoints';
/** Stroke-aware selection helpers. All geometry is in document coordinates.
 * Unlike a pixel marquee this returns operation IDs, so unrelated marks are never cut. */
import type {ArtworkOrigin,Matrix,Point,Stroke,Layer} from '../core/model';
import type {VectorLine} from './vector';
import {finalGeometry} from './geometryCache';
import {vectorCubics} from './vector';
import {flattenCubic} from './strokeGeometry';
import {affineH,multiplyH,projectPoint,type H} from './perspectiveWarp';
import {preservesFlowContour,projectedFlowBounds} from './projectiveFlowInk';
export type Selectable=Stroke|VectorLine;
export type PickMode='touch'|'enclose';
export const IDENTITY:Matrix=[1,0,0,1,0,0];
export function mul(a:Matrix,b:Matrix):Matrix{return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
export function mapPoint(p:{x:number;y:number},m:Matrix){return {x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]};}
export function scaleOf(m:Matrix){return Math.sqrt(Math.max(0.0001,Math.abs(m[0]*m[3]-m[1]*m[2])));}
export function selectable(layer:Layer):Selectable[]{return layer.operations.filter((o):o is Selectable=>o.kind==='vector'||o.kind==='stroke'&&o.tool==='brush'&&!o.worldStroke);}
const pathCache=new WeakMap<Selectable,{x:number;y:number}[]>();
const sourcePathCache=new WeakMap<Stroke,{x:number;y:number}[]>();
/** Pick in the original pen coordinates after undoing the rendered transform.
 * Re-inverting a flattened, already transformed polyline introduces selection
 * drift each time a curved stroke is scaled or distorted again.
 */
function sourcePolyline(op:Stroke):{x:number;y:number}[]{
 const cached=sourcePathCache.get(op);if(cached)return cached;
 const g=op.engineVersion?finalGeometry(op):undefined;
 const path=g?.cubics.length?g.cubics.flatMap((curve,index)=>flattenCubic(curve,.35).slice(index?1:0)):(g?.points??op.points);
 sourcePathCache.set(op,path);
 return path;
}
export function polyline(op:Selectable):{x:number;y:number}[]{
 const cached=pathCache.get(op);if(cached)return cached;
 if(op.kind==='stroke'){
  const geometry=op.engineVersion?finalGeometry(op):undefined;
  const map=(p:Point):Point=>({...p,...(op.perspective?projectPoint(p,op.perspective):op.transform?mapPoint(p,op.transform):p)});
  const points=geometry?.cubics.length?geometry.cubics.flatMap((curve,index)=>{
   // Flatten after the affine transform so a stretched curve keeps its visible bends.
   if(op.perspective)return flattenCubic(curve,.5).slice(index?1:0).map(map);
   return flattenCubic({a:map(curve.a),b:map(curve.b),c1:map(curve.c1),c2:map(curve.c2)},.5).slice(index?1:0);
  }):(geometry?.points??op.points).map(map);
  pathCache.set(op,points);return points;
 }
 const curves=vectorCubics(op),out:{x:number;y:number}[]=[];
 for(const [i,c] of curves.entries())out.push(...flattenCubic(c,1.8).slice(i?1:0));
 const result=out.length?out:op.nodes;pathCache.set(op,result);return result;
}
export function boundsOf(ops:Selectable[]){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const op of ops){const radius=(op.kind==='stroke'?op.size*widthPointExtent(op):op.width)/2;
  if(op.kind==='stroke'&&op.perspective&&preservesFlowContour(op)){const b=projectedFlowBounds(op,finalGeometry(op),radius)!;minX=Math.min(minX,b.left);minY=Math.min(minY,b.top);maxX=Math.max(maxX,b.right);maxY=Math.max(maxY,b.bottom);continue;}
  const [a,b,c,d]=op.kind==='stroke'&&!op.perspective?op.transform??IDENTITY:IDENTITY;
  const xPad=radius*Math.hypot(a,c),yPad=radius*Math.hypot(b,d);
  for(const p of polyline(op)){minX=Math.min(minX,p.x-xPad);minY=Math.min(minY,p.y-yPad);maxX=Math.max(maxX,p.x+xPad);maxY=Math.max(maxY,p.y+yPad);}
  if(op.kind==='stroke'&&op.perspective){
   // Perspective changes the width too, not only the stroke centre. Include
   // projected nib corners so the selection box still encloses enlarged ink.
   const samples=finalGeometry(op).points,step=Math.max(1,Math.floor(samples.length/64));
   for(let i=0;i<samples.length;i+=step){const q=samples[i];
    for(const dx of [-radius,radius])for(const dy of [-radius,radius]){
     const p=projectPoint({x:q.x+dx,y:q.y+dy},op.perspective);
     minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);
    }
   }
  }
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
  if(!('perspective' in op&&op.perspective)&&(p.x<b.x-tolerance||p.x>b.x+b.w+tolerance||p.y<b.y-tolerance||p.y>b.y+b.h+tolerance))continue;
  const radius=(op.kind==='stroke'?op.size*widthPointExtent(op):op.width)/2;
  const points=polyline(op);let distance=Infinity;
  const affine=op.kind==='stroke'&&!op.perspective?op.transform:undefined;
  if(op.kind==='stroke'&&affine){
   const [a,b,c,d,x,y]=affine,det=a*d-b*c;
   if(Math.abs(det)>1e-8){
    const local=(q:{x:number;y:number})=>({x:(d*(q.x-x)-c*(q.y-y))/det,y:(a*(q.y-y)-b*(q.x-x))/det});
    const tip=local(p),origin=sourcePolyline(op);
    let localDistance=origin.length===1?Math.hypot(tip.x-origin[0].x,tip.y-origin[0].y):Infinity;
    for(let j=1;j<origin.length;j++)localDistance=Math.min(localDistance,segmentDistance(tip.x,tip.y,origin[j-1],origin[j]));
    const localTolerance=tolerance*Math.max(Math.hypot(d,b),Math.hypot(c,a))/Math.abs(det);
    if(localDistance<=radius+localTolerance){const score=localDistance/Math.max(radius,1);if(score<best){best=score;winner=op;}if(best<.0001)break;continue;}
   }
  }
  if(op.kind==='stroke'&&op.perspective){
   const [a,b,c,d,e,f,g,h,i]=op.perspective;
   const determinant=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);
   if(Math.abs(determinant)>1e-12){
    const inverse:H=[(e*i-f*h)/determinant,(c*h-b*i)/determinant,(b*f-c*e)/determinant,
     (f*g-d*i)/determinant,(a*i-c*g)/determinant,(c*d-a*f)/determinant,
     (d*h-e*g)/determinant,(b*g-a*h)/determinant,(a*e-b*d)/determinant];
    const tip=projectPoint(p,inverse),origin=sourcePolyline(op);
    const xp=projectPoint({x:p.x+tolerance,y:p.y},inverse),yp=projectPoint({x:p.x,y:p.y+tolerance},inverse);
    const localTolerance=Math.max(Math.hypot(xp.x-tip.x,xp.y-tip.y),Math.hypot(yp.x-tip.x,yp.y-tip.y));
    let localDistance=origin.length===1?Math.hypot(tip.x-origin[0].x,tip.y-origin[0].y):Infinity;
    for(let j=1;j<origin.length;j++)localDistance=Math.min(localDistance,segmentDistance(tip.x,tip.y,origin[j-1],origin[j]));
    if(localDistance<=radius+localTolerance){const score=localDistance/Math.max(radius,1);if(score<best){best=score;winner=op;}if(best<.0001)break;continue;}
   }
  }
  if(points.length===1)distance=Math.hypot(p.x-points[0].x,p.y-points[0].y);
  for(let j=1;j<points.length;j++)distance=Math.min(distance,segmentDistance(p.x,p.y,points[j-1],points[j]));
  if(distance>(affine?0:radius)+tolerance)continue;
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
 if(op.worldStroke)return op;
 const {inShot:_inShot,inPreviousStage:_inPreviousStage,...editable}=op as Stroke&ArtworkOrigin;
 return op.perspective?{...editable,perspective:multiplyH(affineH(m),op.perspective)}
  :{...editable,transform:mul(m,op.transform??IDENTITY),rasterTransformVersion:1,rasterSourceId:op.rasterSourceId??op.id};
}
/** Apply a fresh projective change outside all previously committed transforms. */
export function projectiveStroke(op:Stroke,h:H):Stroke{
 if(op.worldStroke)return op;
 const {inShot:_inShot,inPreviousStage:_inPreviousStage,...editable}=op as Stroke&ArtworkOrigin;
 return {...editable,transform:undefined,perspective:multiplyH(h,op.perspective??affineH(op.transform??IDENTITY))};
}
