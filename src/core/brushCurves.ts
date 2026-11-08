export type CurveNode={x:number;y:number};
export type BrushProfileControls={inkProfileVersion?:1;inkProfile?:CurveNode[];inkProfileLength?:number};
export const defaultBrushProfile:CurveNode[]=[{x:0,y:.2},{x:.5,y:1},{x:1,y:.2}];
export function validCurve(v:unknown,monotone=true):v is CurveNode[]{return Array.isArray(v)&&v.length>=2&&v.length<=32&&v[0]?.x===0&&v.at(-1)?.x===1&&v.every((p,i)=>p&&Number.isFinite(p.x)&&p.x>=0&&p.x<=1&&Number.isFinite(p.y)&&p.y>=(monotone?0:.05)&&p.y<=1&&(!i||p.x>v[i-1].x&&(!monotone||p.y>=v[i-1].y)))&&(monotone||v[0].y===v.at(-1).y);}
export function profileValue(curve:CurveNode[],x:number){let i=1;while(i<curve.length-1&&curve[i].x<x)i++;const a=curve[i-1],b=curve[i],u=Math.max(0,Math.min(1,(x-a.x)/(b.x-a.x)));return a.y+(b.y-a.y)*u*u*(3-2*u);}
export function brushProfileFactor(s:BrushProfileControls&{size:number},distance:number){if(s.inkProfileVersion!==1||!s.inkProfile)return 1;const span=Math.max(24,s.size*3,s.inkProfileLength??180),phase=((distance%span)+span)%span/span;return profileValue(s.inkProfile,phase);}

