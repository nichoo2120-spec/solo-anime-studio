import type {Stroke} from '../core/model';
import {projectPoint,type H} from './perspectiveWarp';
import {drawSolidInkV10} from './solidInkV10';
import type {strokeGeometry} from './strokeGeometry';

export const preservesFlowContour=(s:Stroke)=>s.engineVersion===10&&['studio-ink','contour-flow'].includes(s.brushKind??'')&&!s.nativeMixVersion&&!s.mixStops&&!s.paintTipVersion&&!s.widthPointVersion&&!s.textureStrength&&!(s.pressure&&s.pressureOpacity)&&!(s.inkImage&&(s.inkImageAmount??1)>0);
export function projectedFlowBounds(s:Stroke,g:ReturnType<typeof strokeGeometry>,pad:number){
 if(!s.perspective)return;
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;const visit=(p:{x:number;y:number})=>{left=Math.min(left,p.x-pad);top=Math.min(top,p.y-pad);right=Math.max(right,p.x+pad);bottom=Math.max(bottom,p.y+pad);};g.points.forEach(visit);for(const c of g.cubics){visit(c.c1);visit(c.c2);}const corners=[{x:left,y:top},{x:right,y:top},{x:left,y:bottom},{x:right,y:bottom}].map(p=>projectPoint(p,s.perspective!));return {left:Math.min(...corners.map(p=>p.x)),top:Math.min(...corners.map(p=>p.y)),right:Math.max(...corners.map(p=>p.x)),bottom:Math.max(...corners.map(p=>p.y))};
}
/** Project the finished nib outline, never a new brush along a warped centreline.
 * Source arc length, pressure, taper and repeating width phase remain unchanged.
 * Each ellipse is adaptively flattened AFTER projection at display resolution. */
let ProjectedInkPath:(new(h:H,tolerance:number)=>Path2D)|undefined;
function projectedPath(h:H,tolerance:number){
 ProjectedInkPath??=class extends Path2D{
 constructor(private h:H,private tolerance:number){super();}
 moveTo(x:number,y:number){const p=projectPoint({x,y},this.h);super.moveTo(p.x,p.y);}
 lineTo(x:number,y:number){const p=projectPoint({x,y},this.h);super.lineTo(p.x,p.y);}
 ellipse(x:number,y:number,rx:number,ry:number,rotation:number,start:number,end:number,anticlockwise=false){
  const co=Math.cos(rotation),sn=Math.sin(rotation),point=(a:number)=>projectPoint({x:x+rx*Math.cos(a)*co-ry*Math.sin(a)*sn,y:y+rx*Math.cos(a)*sn+ry*Math.sin(a)*co},this.h);
  const first=point(start);super.lineTo(first.x,first.y);
  const visit=(a:number,b:number,A:{x:number;y:number},B:{x:number;y:number},depth:number)=>{const m=(a+b)/2,M=point(m),dx=B.x-A.x,dy=B.y-A.y,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((M.x-A.x)*dx+(M.y-A.y)*dy)/d)):0;if(depth<10&&Math.hypot(M.x-A.x-t*dx,M.y-A.y-t*dy)>this.tolerance){visit(a,m,A,M,depth+1);visit(m,b,M,B,depth+1);}else super.lineTo(B.x,B.y);};
  let span=end-start;if(anticlockwise&&span>0)span-=Math.PI*2;if(!anticlockwise&&span<0)span+=Math.PI*2;
  const count=Math.max(1,Math.ceil(Math.abs(span)/(Math.PI/4)));for(let i=0;i<count;i++){const a=start+span*i/count,b=start+span*(i+1)/count;visit(a,b,point(a),point(b),0);}
 }
 };
 return new ProjectedInkPath(h,tolerance);
}
export function drawProjectiveFlowInk(ctx:CanvasRenderingContext2D,s:Stroke,g:ReturnType<typeof strokeGeometry>,scale=1,paths?:Path2D[]):boolean{
 if(!s.perspective||!preservesFlowContour(s))return false;
 return drawSolidInkV10(ctx,s,g,undefined,Math.max(1,scale),paths,undefined,()=>projectedPath(s.perspective!,Math.max(.005,.1/Math.max(1,scale))));
}
