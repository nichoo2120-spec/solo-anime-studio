import type {Stroke,Point} from '../core/model';
import {flattenCubic,pressureResponse,type strokeGeometry} from './strokeGeometry';
import {widthResponse} from './pressureChannels';
import type {RasterRegion} from './liveRaster';
import {livePathPrefix} from './livePathPrefix';

type Dab={x:number;y:number;radius:number;aspect:number;rotation:number};
type PathState={i:number;j:number;along:number;previousDab?:Dab};
export type SolidPathInfo={ends:number[];states:PathState[];points?:Point[];total?:number;reused?:number;builtDabs?:number;previous?:{info:SolidPathInfo;paths:Path2D[]}};

/** Solid nib union: bounded Canvas fills, no pixel readback or size-squared CPU pass.
 * Saved older strokes keep their renderer. All subpaths have identical winding,
 * so overlap forms solid ink without accumulating opacity or cutting holes. */
export function drawSolidInkV10(ctx:CanvasRenderingContext2D,s:Stroke,g:ReturnType<typeof strokeGeometry>,region?:RasterRegion,displayScale=0,paths?:Path2D[],info?:SolidPathInfo):boolean{
 const kind=s.brushKind??'technical';
 const roundInk=kind==='studio-ink'||kind==='contour-flow';
 if(!displayScale&&s.size<64&&!roundInk||(displayScale?s.pressure&&s.pressureOpacity:s.pressureOpacity)||s.textureStrength||!['studio-ink','contour-flow','technical','eraser-hard','g-pen','mapping','brush-pen','flat'].includes(kind))return false;
 const points:Point[]=g.cubics.length?g.cubics.flatMap((c,i)=>flattenCubic(c,.18/Math.max(1,displayScale)).slice(i?1:0)):g.points;
 if(!points.length)return true;
 let total=0;for(let i=1;i<points.length;i++)total+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
 let resumed:PathState|undefined;
 if(info){
  info.points=points;info.total=total;info.reused=0;info.builtDabs=0;
  if(paths&&info.previous){const old=info.previous.info,prefix=livePathPrefix(s,points,old.points??[],total,old.total??0,!roundInk&&s.engineVersion===10&&s.size>=64&&!s.pressureOpacity);let n=0;
   // The last batch is deliberately unfinished. Its phase and predecessor dab
   // are replayed exactly, rather than opening a new path at the dirty boundary.
   while(n<old.states.length&&old.ends[n]<prefix-1)n++;
   paths.push(...info.previous.paths.slice(0,n));info.ends.push(...old.ends.slice(0,n));info.states.push(...old.states.slice(0,n));info.reused=n;resumed=old.states[n-1];
  }
 }
 // Bound taper to a local tip, including short strokes. The sine shoulder
 // joins full width smoothly instead of a visible linear taper corner.
 const taper=(d:number)=>{if(total<.5)return 1;if(roundInk){const span=Math.max(4,s.size*4),a=s.taperStart?Math.min(1,d/(span*s.taperStart)):1,b=s.taperEnd?Math.min(1,(total-d)/(span*s.taperEnd)):1;return Math.sin(Math.max(0,Math.min(a,b))*Math.PI/2);}if(displayScale&&!(s.engineVersion===10&&s.size>=64&&!s.pressureOpacity)){const span=[6,7,10].includes(s.engineVersion??0)?Math.max(64,s.size*12):total;return Math.max(0,Math.min(1,s.taperStart?d/(span*s.taperStart):1,s.taperEnd?(total-d)/(span*s.taperEnd):1));}const span=Math.min(total*.45,Math.max(32,s.size*2));const a=s.taperStart?Math.min(1,d/(span*s.taperStart)):1,b=s.taperEnd?Math.min(1,(total-d)/(span*s.taperEnd)):1;return Math.sin(Math.max(0,Math.min(a,b))*Math.PI/2);};
 ctx.save();if(region){ctx.beginPath();ctx.rect(region.x,region.y,region.width,region.height);ctx.clip();}ctx.fillStyle=s.color;
 let previousDab:Dab|undefined=resumed?.previousDab;
 const support=(d:Dab,nx:number,ny:number)=>{const c=Math.cos(d.rotation),sn=Math.sin(d.rotation),u=nx*c+ny*sn,v=-nx*sn+ny*c,rr=d.radius*d.radius,aa=d.aspect*d.aspect,den=Math.sqrt(rr*(u*u+aa*v*v));return den?{x:(rr*u*c-rr*aa*v*sn)/den,y:(rr*u*sn+rr*aa*v*c)/den}:{x:0,y:0};};
 let path=new Path2D(),dabs=0;const flush=(state?:PathState)=>{if(paths)paths.push(path);else ctx.fill(path);if(info&&state){info.ends.push(state.i);info.states.push(state);}path=new Path2D();dabs=0;};let along=resumed?.along??0;
 for(let i=resumed?.i??0;i<points.length;i++){
  const a=points[Math.max(0,i-1)],b=points[i],next=points[Math.min(points.length-1,i+1)];
  const len=Math.hypot(b.x-a.x,b.y-a.y),tip=i||s.engineVersion!==10?b:next,angle=Math.atan2(tip.y-a.y,tip.x-a.x);
  if(region&&(Math.max(a.x,b.x)<region.x-s.size||Math.min(a.x,b.x)>region.x+region.width+s.size||Math.max(a.y,b.y)<region.y-s.size||Math.min(a.y,b.y)>region.y+region.height+s.size)){along+=len;continue;}
  const steps=Math.max(1,Math.ceil(len/Math.max(.25,Math.min(1.5,s.size*.025)/Math.sqrt(Math.max(1,displayScale)))));
  for(let j=resumed&&i===resumed.i?resumed.j+1:i?1:0;j<=steps;j++){
   const t=j/steps,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,p=a.p+(b.p-a.p)*t;
   const response=s.pressure?pressureResponse(Math.pow(p,s.response),s.pressureCurve):1;
   const velocity=s.velocityTaper?(a.v??1)+((b.v??1)-(a.v??1))*t:1;
   const radius=s.size*.5*(s.pressure&&s.pressureWidth!==false||s.velocityTaper?widthResponse(response*velocity,s):1)*taper(along+len*t);
   if(radius<.01){if(displayScale||roundInk)previousDab={x,y,radius:0,aspect:1,rotation:0};continue;}
   const aspect=kind==='g-pen'?.74:kind==='mapping'?.48:kind==='brush-pen'?.52:1;
   const rotation=kind==='brush-pen'?angle+.6:kind==='g-pen'||kind==='mapping'||kind==='flat'?-.55:0;
   if((displayScale||roundInk)&&kind!=='flat'){
    const nextDab={x,y,radius,aspect,rotation};
    if(previousDab){const a=previousDab,dx=x-a.x,dy=y-a.y,len=Math.hypot(dx,dy);if(len){const nx=-dy/len,ny=dx/len,A=support(a,nx,ny),B=support(nextDab,nx,ny);path.moveTo(a.x+A.x,a.y+A.y);path.lineTo(a.x-A.x,a.y-A.y);path.lineTo(x-B.x,y-B.y);path.lineTo(x+B.x,y+B.y);path.closePath();}}
    previousDab=nextDab;
   }
   if(kind==='flat'){
    const c=Math.cos(rotation),sn=Math.sin(rotation),rx=radius,ry=radius*.3;
    const pt=(u:number,v:number)=>({x:x+u*c-v*sn,y:y+u*sn+v*c});
    const q=[pt(-rx,-ry),pt(rx,-ry),pt(rx,ry),pt(-rx,ry)];path.moveTo(q[0].x,q[0].y);for(const v of q.slice(1))path.lineTo(v.x,v.y);path.closePath();
   }else{path.moveTo(x+Math.cos(rotation)*radius,y+Math.sin(rotation)*radius);path.ellipse(x,y,radius,radius*aspect,rotation,0,Math.PI*2);path.closePath();}
   if(info)info.builtDabs!++;
   if(++dabs>=64)flush({i,j,along,previousDab});
  }along+=len;
 }
 flush();ctx.restore();return true;
}

