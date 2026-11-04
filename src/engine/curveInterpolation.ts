import type {Point} from '../core/model';
import type {Cubic} from './strokeGeometry';
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const dot=(a:{x:number;y:number},b:{x:number;y:number})=>a.x*b.x+a.y*b.y;
const unit=(a:Point,b:Point)=>{const d=distance(a,b);return d>.0001?{x:(b.x-a.x)/d,y:(b.y-a.y)/d}:undefined;};
function neighbors(points:Point[],i:number){
 const closed=points.length>3&&distance(points[0],points.at(-1)!)<.5,n=closed?points.length-1:points.length,index=closed?i%n:i;
 const find=(step:number)=>{const result:Point[]=[];let previous=points[index];for(let k=1;k<n&&result.length<2;k++){const raw=index+step*k;if(!closed&&(raw<0||raw>=n))break;const p=points[(raw+n)%n];if(distance(previous,p)>.0001){result.push(p);previous=p;}}return result;};
 return {before:find(-1),after:find(1)};
}
/** A lone large turn is ambiguous sparse input, not evidence of a hard corner.
 * Straight supporting samples on both arms (or a true reversal) establish a cusp. */
export function supportedCorner(points:Point[],i:number){
 const p=points[i],{before,after}=neighbors(points,i);if(!before[0]||!after[0])return false;const incoming=unit(before[0],p)!,outgoing=unit(p,after[0])!,turn=dot(incoming,outgoing);if(turn<-.94)return true;if(turn>=.45||!before[1]||!after[1])return false;
 return dot(unit(before[1],before[0])!,incoming)>.985&&dot(outgoing,unit(after[0],after[1])!)>.985;
}
/** Retain every turning sample. Sparse paths have no redundant samples to remove.
 * Existing controls still provide bounded local filtering on dense paths. */
export function filterCapturedPoints(points:Point[],strength:number):Point[]{
 if(strength<=0||points.length<=12)return points;const s=Math.min(1,strength);
 return points.map((p,i)=>{if(!i||i===points.length-1||supportedCorner(points,i))return p;const a=points[i-1],b=points[i+1],d1=distance(a,p),d2=distance(p,b);if(Math.max(d1,d2)>12)return p;const dx=(a.x+b.x-2*p.x)*s*.25,dy=(a.y+b.y-2*p.y)*s*.25,d=Math.hypot(dx,dy),limit=Math.min(2.5*s,Math.min(d1,d2)*.15),f=d?Math.min(1,limit/d):0;return {...p,x:p.x+dx*f,y:p.y+dy*f};});
}
function tangent(points:Point[],i:number,chord:number,corner:(points:Point[],i:number)=>boolean){
 if(corner(points,i))return {x:0,y:0};const p=points[i],{before,after}=neighbors(points,i),a=before[0],b=after[0];const incoming=a?unit(a,p):undefined,outgoing=b?unit(p,b):undefined;
 if(!incoming&&!outgoing)return {x:0,y:0};if(!incoming||!outgoing){const u=incoming??outgoing!;return {x:u.x*chord/3,y:u.y*chord/3};}
 const da=distance(a,p),db=distance(p,b),x=incoming.x*db+outgoing.x*da,y=incoming.y*db+outgoing.y*da,length=Math.hypot(x,y);if(length<.0001)return {x:0,y:0};
 const angle=Math.acos(Math.max(-1,Math.min(1,dot(incoming,outgoing)))),handle=Math.min(chord/(3*Math.cos(angle/4)**2),chord*.5,Math.min(da,db)*.75);
 return {x:x/length*handle,y:y/length*handle};
}
export function interpolateCapturedPoints(points:Point[],corner=supportedCorner):Cubic[]{
 const out:Cubic[]=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=distance(a,b);if(length<.0001)continue;const ta=tangent(points,i-1,length,corner),tb=tangent(points,i,length,corner),direction={x:(b.x-a.x)/length,y:(b.y-a.y)/length};
  // No backwards handles at direction reversals or extremely uneven spacing.
  const ca=dot(ta,direction)>0?ta:{x:0,y:0},cb=dot(tb,direction)>0?tb:{x:0,y:0};out.push({a,c1:{...a,x:a.x+ca.x,y:a.y+ca.y},c2:{...b,x:b.x-cb.x,y:b.y-cb.y},b});
 }return out;
}
