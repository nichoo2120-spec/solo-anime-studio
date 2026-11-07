import type {Stroke} from './model';
import {supportsInkTip} from './inkTip';
export type WidthPoint={at:number;scale:number};
export type WidthPointControls={widthPointVersion?:1;widthPoints?:WidthPoint[]};
export function validWidthPoints(v:unknown):v is WidthPoint[]{return Array.isArray(v)&&v.length>=2&&v.length<=32&&v.every((p,i)=>p&&Number.isFinite(p.at)&&p.at>=0&&p.at<=1&&Number.isFinite(p.scale)&&p.scale>=.05&&p.scale<=2&&(!i||p.at>v[i-1].at))&&v[0].at===0&&v.at(-1).at===1;}
export function canEditStrokeWidth(s:Stroke){return s.points.length>1&&s.points.some(p=>p.x!==s.points[0].x||p.y!==s.points[0].y)&&s.tool==='brush'&&s.engineVersion===10&&supportsInkTip(s.brushKind)&&!s.nativeMixVersion&&!s.mixStops?.length&&!s.paintTipVersion&&!s.perspective;}
/** Only edited saved strokes opt in. Drawing capture never adds this metadata. */
export function widthPointFactor(s:WidthPointControls,distance:number,total:number){
 if(s.widthPointVersion!==1||!s.widthPoints?.length)return 1;
 const t=total>0?Math.max(0,Math.min(1,distance/total)):0,points=s.widthPoints;
 let i=1;while(i<points.length-1&&points[i].at<t)i++;
 const a=points[i-1],b=points[i],u=Math.max(0,Math.min(1,(t-a.at)/(b.at-a.at))),smooth=u*u*(3-2*u);
 return a.scale+(b.scale-a.scale)*smooth;
}
export function widthPointExtent(s:WidthPointControls){return s.widthPointVersion===1&&s.widthPoints?.length?Math.max(1,...s.widthPoints.map(p=>p.scale)):1;}

