import type {Point,Stroke} from '../core/model';
const same=(a:Point,b:Point)=>a.x===b.x&&a.y===b.y&&a.p===b.p&&a.v===b.v;
/** Only seal samples that are identical, beyond lookahead and outside BOTH
 * moving end tapers. A short, length-dependent beginning taper is never sealed. */
export function livePathPrefix(s:Stroke,points:Point[],old:Point[],total:number,oldTotal:number,localTaper:boolean){
 let prefix=0;while(prefix<Math.min(points.length,old.length)&&same(points[prefix],old[prefix]))prefix++;
 const span=localTaper?Math.min(total*.45,Math.max(32,s.size*2)):Math.max(64,s.size*12);
 const oldSpan=localTaper?Math.min(oldTotal*.45,Math.max(32,s.size*2)):Math.max(64,s.size*12);
 if(s.taperStart&&span!==oldSpan)return 0;
 for(const [list,length] of [[points,span],[old,oldSpan]] as const){let i=list.length-1,travel=0;while(i>0&&travel<length*(s.taperEnd??0)){travel+=Math.hypot(list[i].x-list[i-1].x,list[i].y-list[i-1].y);i--;}if(s.taperEnd)prefix=Math.min(prefix,i);}
 return prefix;
}
