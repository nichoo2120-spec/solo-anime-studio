import type {Point,Stroke} from '../core/model';
import {drawFlatInk,type FlatPathInfo} from './flatInk';
import type {strokeGeometry} from './strokeGeometry';
type Rect={x:number;y:number;w:number;h:number};
const same=(a:Point,b:Point)=>a.x===b.x&&a.y===b.y&&a.p===b.p&&a.v===b.v;
/** Keep completed native path batches at display resolution. A long flat-brush
 * scribble only repaints its unfinished batches, with identical fill ordering. */
export class FlatLiveRaster{
 lastRegion?:Rect;
 lastPaths?:{scale:number;items:Path2D[]};
 private stable?:HTMLCanvasElement;private surface?:HTMLCanvasElement;private key='';private id='';private count=0;private previous?:FlatPathInfo;private dirty?:Rect;
 matches(s:Stroke){return this.id===s.id;}
 clear(){for(const c of [this.stable,this.surface])if(c)c.width=c.height=0;this.stable=this.surface=undefined;this.key='';this.id='';this.count=0;this.previous=undefined;this.dirty=undefined;this.lastRegion=undefined;this.lastPaths=undefined;}
 paint(s:Stroke,g:ReturnType<typeof strokeGeometry>,m:DOMMatrix,w:number,h:number){
  const {points:raw,...settings}=s;const key=JSON.stringify([settings,m.a,m.b,m.c,m.d,m.e,m.f,w,h]);
  const stable=this.stable??=document.createElement('canvas'),surface=this.surface??=document.createElement('canvas');
  const paths:Path2D[]=[],info:FlatPathInfo={ends:[]},scale=Math.hypot(m.a,m.b),quality=Math.max(1,Math.ceil(scale*2-1e-6)/2);
  drawFlatInk(surface.getContext('2d')!,s,g,undefined,quality,paths,info);
  const points=info.points??[],old=this.previous?.points??[];let prefix=0;
  if(key===this.key)while(prefix<Math.min(points.length,old.length)&&same(points[prefix],old[prefix]))prefix++;
  const endLength=Math.max(64,s.size*12)*(s.taperEnd??0);
  for(const list of [points,old]){let i=list.length-1,d=0;while(i>0&&d<endLength){d+=Math.hypot(list[i].x-list[i-1].x,list[i].y-list[i-1].y);i--;}if(endLength)prefix=Math.min(prefix,i);}
  // Before the short-stroke taper span settles, beginning taper can still move.
  if(s.taperStart&&(info.total??0)<Math.max(32,s.size*2)/.45)prefix=0;
  const sealed=this.previous?.ends[this.count-1]??-1;
  const reset=key!==this.key||prefix<=sealed||stable.width!==w||stable.height!==h;
  if(reset){stable.width=surface.width=w;stable.height=surface.height=h;this.count=0;this.dirty=undefined;}
  let count=this.count;while(count<paths.length&&info.ends[count]<prefix-1)count++;
  const sc=stable.getContext('2d')!;sc.setTransform(m);sc.fillStyle=s.color;for(let i=this.count;i<count;i++)sc.fill(paths[i]);this.count=count;
  if(reset)surface.getContext('2d')!.drawImage(stable,0,0);
  const start=count?Math.max(0,info.ends[count-1]-1):0,pad=s.size*Math.max(1,s.maxSize??1)+3;
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const p of points.slice(start))for(const dx of [-pad,pad])for(const dy of [-pad,pad]){const x=m.a*(p.x+dx)+m.c*(p.y+dy)+m.e,y=m.b*(p.x+dx)+m.d*(p.y+dy)+m.f;left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  const rect={x:Math.max(0,Math.floor(left)),y:Math.max(0,Math.floor(top)),w:0,h:0};rect.w=Math.max(0,Math.min(w,Math.ceil(right))-rect.x);rect.h=Math.max(0,Math.min(h,Math.ceil(bottom))-rect.y);
  const prior=this.dirty,x=Math.min(rect.x,prior?.x??rect.x),y=Math.min(rect.y,prior?.y??rect.y),R=Math.max(rect.x+rect.w,prior?prior.x+prior.w:0),B=Math.max(rect.y+rect.h,prior?prior.y+prior.h:0),ctx=surface.getContext('2d')!;
  ctx.resetTransform();if(R>x&&B>y){ctx.clearRect(x,y,R-x,B-y);ctx.drawImage(stable,x,y,R-x,B-y,x,y,R-x,B-y);}ctx.setTransform(m);ctx.fillStyle=s.color;for(let i=count;i<paths.length;i++)ctx.fill(paths[i]);ctx.resetTransform();
  this.lastPaths={scale:quality,items:paths};this.lastRegion=reset?undefined:{x,y,w:Math.max(0,R-x),h:Math.max(0,B-y)};this.dirty=rect;this.key=key;this.id=s.id;this.previous=info;return surface;
 }
}
