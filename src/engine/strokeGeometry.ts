import type {Point,Stroke} from '../core/model';
import {filterCapturedPoints,interpolateCapturedPoints} from './curveInterpolation';
import {processedGeometry,structuralGeometry} from './strokeProcessing';
export type PressureNode={x:number;y:number};
export type Cubic={a:Point;c1:Point;c2:Point;b:Point};
export const linearPressure:PressureNode[]=[{x:0,y:0},{x:.25,y:.25},{x:.5,y:.5},{x:.75,y:.75},{x:1,y:1}];
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const mix=(a:Point,b:Point,t:number):Point=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,p:a.p+(b.p-a.p)*t,...(a.v!==undefined||b.v!==undefined?{v:(a.v??1)+((b.v??1)-(a.v??1))*t}:{})});
export function sharpCorner(points:Point[],i:number){
 if(i===0||i===points.length-1){if(points.length<4||distance(points[0],points.at(-1)!)>.5)return false;const a=points[points.length-2],b=points[0],c=points[1],d1=distance(a,b),d2=distance(b,c);return d1>.01&&d2>.01&&((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y))/(d1*d2)<.45;}
 let l=i-1,r=i+1;while(l>0&&distance(points[l],points[i])<5)l--;while(r<points.length-1&&distance(points[r],points[i])<5)r++;
 const a=points[l],b=points[i],c=points[r],d1=distance(a,b),d2=distance(b,c);
 return d1>.01&&d2>.01&&((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y))/(d1*d2)<.45;
}
/** Symmetric spatial filtering: newest point and both endpoints are always exact.
 * Displacement is bounded in document pixels, rather than accumulating an EMA tail.
 */
export function stabilizePoints(points:Point[],strength:number):Point[]{
 if(!strength||points.length<3)return points;
 const s=Math.max(0,Math.min(1,strength));
 return points.map((p,i)=>{if(!i||i===points.length-1||sharpCorner(points,i))return p;const a=points[i-1],b=points[i+1],dx=(a.x+b.x-2*p.x)*s*.25,dy=(a.y+b.y-2*p.y)*s*.25,length=Math.hypot(dx,dy),limit=Math.min(2.5*s,Math.min(distance(a,p),distance(b,p))*.15),factor=length?Math.min(1,limit/length):0;return {...p,x:p.x+dx*factor,y:p.y+dy*factor};});
}
function segmentDistance(p:Point,a:Point,b:Point){const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
/** Bounded, corner-preserving RDP. Original input remains in the project log. */
export function smoothPoints(points:Point[],amount:number):Point[]{
 if(amount<=0||points.length<3)return points;
 const epsilon=2*Math.pow(Math.min(100,amount)/100,1.5),filtered=stabilizePoints(points,amount/100),keep=new Set([0,points.length-1]);
 for(let i=1;i<points.length-1;i++){const a=points[i-1],p=points[i],b=points[i+1],t=distance(a,p)/(distance(a,p)+distance(p,b)||1),deviates=(key:'p'|'v')=>Math.abs((p[key]??1)-((a[key]??1)+((b[key]??1)-(a[key]??1))*t))>.025;if(sharpCorner(points,i)||deviates('p')||deviates('v'))keep.add(i);}
 const breaks=[...keep].sort((a,b)=>a-b),stack:[number,number][]=[];
 for(let i=1;i<breaks.length;i++)stack.push([breaks[i-1],breaks[i]]);
 while(stack.length){const [a,b]=stack.pop()!;let index=-1,max=epsilon;for(let i=a+1;i<b;i++){const d=segmentDistance(filtered[i],filtered[a],filtered[b]);if(d>max){max=d;index=i;}}if(index>=0){keep.add(index);stack.push([a,index],[index,b]);}}
 return [...keep].sort((a,b)=>a-b).map(i=>filtered[i]);
}
function tangent(points:Point[],i:number,length:number){
 if(sharpCorner(points,i))return {x:0,y:0};
 const closed=points.length>3&&distance(points[0],points.at(-1)!)<.5,a=points[i===0&&closed?points.length-2:Math.max(0,i-1)],b=points[i===points.length-1&&closed?1:Math.min(points.length-1,i+1)],d=distance(a,b),scale=d?Math.min(length/3,d/6)/d:0;
 return {x:(b.x-a.x)*scale,y:(b.y-a.y)*scale};
}
export function fitCubics(points:Point[]):Cubic[]{
 const result:Cubic[]=[];
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=distance(a,b);if(length<.0001)continue;const ta=tangent(points,i-1,length),tb=tangent(points,i,length);result.push({a,c1:{...a,x:a.x+ta.x,y:a.y+ta.y},c2:{...b,x:b.x-tb.x,y:b.y-tb.y},b});}
 return result;
}
export function cubicAt(c:Cubic,t:number):Point{const u=1-t;return {...mix(c.a,c.b,t),x:u*u*u*c.a.x+3*u*u*t*c.c1.x+3*u*t*t*c.c2.x+t*t*t*c.b.x,y:u*u*u*c.a.y+3*u*u*t*c.c1.y+3*u*t*t*c.c2.y+t*t*t*c.b.y};}
export function flattenCubic(c:Cubic,tolerance=.18):Point[]{
 const out:Point[]=[c.a];
 const visit=(a:Point,c1:Point,c2:Point,b:Point,depth:number)=>{if(depth>=10||Math.max(segmentDistance(c1,a,b),segmentDistance(c2,a,b))<=tolerance){out.push(b);return;}const ac=mix(a,c1,.5),cc=mix(c1,c2,.5),cb=mix(c2,b,.5),left=mix(ac,cc,.5),right=mix(cc,cb,.5),middle=mix(left,right,.5);visit(a,ac,left,middle,depth+1);visit(middle,right,cb,b,depth+1);};
 visit(c.a,c.c1,c.c2,c.b,0);return out;
}
/** Use 121% as the reference screen-space sampling feel.  At other canvas zooms,
 * raw tablet coordinates cover different distances in project pixels for exactly
 * the same physical pen motion.  Process NEW strokes in reference screen units,
 * then project the resulting Bézier geometry back into document coordinates.
 *
 * No brush size, canvas transform, pressure, or pen-tip position is changed.
 * Capture zoom is stored with each stroke so reopening / exporting at another
 * viewport zoom never changes artwork. Strokes lacking captureZoom are legacy
 * artwork and keep their precise previous geometry and rendering behavior.
 */
export const STROKE_FEEL_REFERENCE_ZOOM=1.21;
const followLiveInkTip=(stroke:Stroke)=>stroke.liveRefinementVersion===3&&['g-pen','mapping','brush-pen'].includes(stroke.brushKind??'');
function screenSpaceGeometry(stroke:Stroke,phase:'live'|'final',calculate:(source:Point[])=>{points:Point[];cubics:Cubic[]}){
 const zoom=stroke.captureZoom;
 if(zoom===undefined||!Number.isFinite(zoom)||zoom<=0)return calculate(stroke.points);
 const ratio=zoom/STROKE_FEEL_REFERENCE_ZOOM;
 if(Math.abs(ratio-1)<1e-9)return calculate(stroke.points);
 const input=stroke.points.map(p=>({...p,x:p.x*ratio,y:p.y*ratio}));
 const geometry=calculate(input),inv=1/ratio;
 const project=(p:Point):Point=>({...p,x:p.x*inv,y:p.y*inv});
 const points=geometry.points.map(project);
 // Keep the newest live preview and the finished stroke at the captured
 // endpoint, including when converting back from reference screen units.
 if(points.length){points[0]={...stroke.points[0]};
  if(phase==='final'||followLiveInkTip(stroke)||(stroke.stabilization??0)===0)points[points.length-1]={...stroke.points.at(-1)!};
 }
 const cubics=geometry.cubics.map(c=>({a:project(c.a),c1:project(c.c1),c2:project(c.c2),b:project(c.b)}));
 if(cubics.length){cubics[0].a={...points[0]};cubics[cubics.length-1].b={...points.at(-1)!};}
 return {points,cubics};
}
export function strokeGeometry(stroke:Stroke,phase:'live'|'final'='final'){
 if(stroke.engineVersion===6||stroke.engineVersion===7||stroke.engineVersion===8||stroke.engineVersion===9||stroke.engineVersion===10){
  const calculation=(source:Point[])=>structuralGeometry(source,stroke.stabilization??0,stroke.smoothness??0,phase,stroke.brushKind==='mapping'?Math.min(24,Math.max(2,stroke.size*1.5))*(stroke.stabilization??0)**2:Infinity,!!stroke.liveRefinementVersion,(stroke.liveRefinementVersion??0)>=2,stroke.liveRefinementVersion!==3,followLiveInkTip(stroke));
  return screenSpaceGeometry(stroke,phase,calculation);
 }
 if(stroke.engineVersion===5)return structuralGeometry(stroke.points,stroke.stabilization??0,stroke.smoothness??0,phase);
 if(stroke.engineVersion===4)return processedGeometry(stroke.points,stroke.stabilization??0,stroke.smoothness??0,phase);
 if(stroke.engineVersion===3){const points=filterCapturedPoints(stroke.points,Math.max(stroke.stabilization??0,(stroke.smoothness??0)/100));return {points,cubics:interpolateCapturedPoints(points)};}
 const stabilized=stabilizePoints(stroke.points,stroke.stabilization??0),points=smoothPoints(stabilized,stroke.smoothness??0);
 return {points,cubics:fitCubics(points)};
}
/** Monotone cubic Hermite interpolation: editable response with no overshoot. */
export function pressureResponse(value:number,curve:PressureNode[]=linearPressure){
 const x=Math.max(0,Math.min(1,value));let i=0;while(i<curve.length-2&&x>curve[i+1].x)i++;
 const a=curve[i],b=curve[i+1],d=(b.y-a.y)/(b.x-a.x),slope=(j:number)=>{if(j===0)return (curve[1].y-curve[0].y)/(curve[1].x-curve[0].x);if(j===curve.length-1)return (curve[j].y-curve[j-1].y)/(curve[j].x-curve[j-1].x);const l=(curve[j].y-curve[j-1].y)/(curve[j].x-curve[j-1].x),r=(curve[j+1].y-curve[j].y)/(curve[j+1].x-curve[j].x);return l*r<=0?0:2*l*r/(l+r);};
 if(!d)return a.y;const t=(x-a.x)/(b.x-a.x),h=b.x-a.x;
 return Math.max(a.y,Math.min(b.y,(2*t*t*t-3*t*t+1)*a.y+(t*t*t-2*t*t+t)*h*slope(i)+(-2*t*t*t+3*t*t)*b.y+(t*t*t-t*t)*h*slope(i+1)));
}
export function taperFactor(distanceAlong:number,total:number,start=0,end=0,fixedSpan?:number){if(total<.5)return 1;const span=fixedSpan??total;return Math.max(0,Math.min(1,start?distanceAlong/(span*Math.min(1,start)):1,end?(total-distanceAlong)/(span*Math.min(1,end)):1));}
export function pointInPolygon(point:{x:number;y:number},polygon:Point[]){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
export function intersectsPolygon(points:Point[],polygon:Point[]){if(points.some(p=>pointInPolygon(p,polygon)))return true;const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);for(let i=1;i<points.length;i++)for(let j=0;j<polygon.length;j++){const a=points[i-1],b=points[i],c=polygon[j],d=polygon[(j+1)%polygon.length];if(Math.max(a.x,b.x)<Math.min(c.x,d.x)||Math.min(a.x,b.x)>Math.max(c.x,d.x)||Math.max(a.y,b.y)<Math.min(c.y,d.y)||Math.min(a.y,b.y)>Math.max(c.y,d.y))continue;if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0)return true;}return false;}

