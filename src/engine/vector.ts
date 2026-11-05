import {fitInkNodes} from './flowCurveFitting';
import {fitCleanInkNodes} from './cleanInkFitting';
import {cleanInkPathData,traceCleanInk} from './cleanInkContour';
import type {ArtworkOrigin,Matrix,Point} from '../core/model';
import {projectPoint,type H} from './perspectiveWarp';
import {cubicAt,flattenCubic,pressureResponse,type Cubic,type PressureNode} from './strokeGeometry';
export type Handle={x:number;y:number};
export type VectorNode=Point&{in:Handle;out:Handle};
export type InkSection={end:number;widthProfile:{t:number;p:number}[]};
export type VectorLine={id:string;kind:'vector';nodes:VectorNode[];width:number;opacity:number;color:string;pressure:boolean;pressureCurve?:PressureNode[];smoothness:number;sourceNodes?:VectorNode[];/** Versioned so existing drawings retain their original appearance. */profileVersion?:1|2|3|4|5|6;minWidthPercent?:number;maxWidthPercent?:number;taperStart?:number;taperEnd?:number;widthProfile?:{t:number;p:number}[];inkSections?:InkSection[];/** Internal section offsets, derived from saved geometry. */inkOffset?:number;inkTotal?:number};
export type InkPreviewOptions={width:number;pressure:boolean;pressureCurve?:PressureNode[];minWidthPercent?:number;maxWidthPercent?:number;taperStart?:number;taperEnd?:number};
export function vectorCubics(line:VectorLine):Cubic[]{return line.nodes.slice(1).map((b,i)=>({a:line.nodes[i],c1:{...line.nodes[i].out,p:line.nodes[i].p},c2:{...b.in,p:b.p},b}));}
export function createVector(id:string,a:Point,b:Point,curved:boolean,width:number,color:string,pressure=false):VectorLine{
 const dx=b.x-a.x,dy=b.y-a.y,nx=curved?-dy*.22:0,ny=curved?dx*.22:0;
 return {id,kind:'vector',nodes:[{...a,in:{x:a.x,y:a.y},out:{x:a.x+dx/3+nx,y:a.y+dy/3+ny}},{...b,in:{x:a.x+dx*2/3+nx,y:a.y+dy*2/3+ny},out:{x:b.x,y:b.y}}],width,opacity:1,color,pressure,smoothness:100};
}
/** A pressure-aware, editable freehand Bézier line (Flash/Animate style).
 * Points are simplified before constructing anchors so fast pen gestures don't
 * create hundreds of expensive handles. Uses only the existing v3 vector format. */
export function createFreehandVector(id:string,samples:Point[],width:number,color:string,pressure:boolean,tolerance=1.4):VectorLine{
 const nodes=fitInkNodes(samples,tolerance);
 if(!nodes.length)throw Error('A freehand vector requires pen input.');
 // Keep a tiny single-point mark selectable without fabricating a long stroke.
 if(nodes.length===1){const a=nodes[0];nodes.push({...a,x:a.x+.01,in:{x:a.x,y:a.y},out:{x:a.x+.01,y:a.y}});}
 return {id,kind:'vector',nodes,width,opacity:1,color,pressure,smoothness:100};
}
/** Clean, pressure-sensitive animation ink. Older stroke constructors and
 * renderers stay intact; only newly drawn vectors use the new contour. */
export function createCleanFreehandVector(id:string,samples:Point[],width:number,color:string,pressure:boolean,smoothness=65,tangents:{startTangent?:Handle;endTangent?:Handle}={}):VectorLine{
 const nodes=fitCleanInkNodes(samples,smoothness,tangents);
 if(!nodes.length)throw Error('A freehand vector requires pen input.');
 if(nodes.length===1){const a=nodes[0];nodes.push({...a,x:a.x+.001,in:{x:a.x,y:a.y},out:{x:a.x+.001,y:a.y}});}
 const measured=buildInkPressureProfile(samples);
 const widthProfile=measured.map((key,i)=>{
  if(!i||i===measured.length-1)return key;
  let sum=key.p*3,weight=3;
  for(const delta of [-2,-1,1,2]){const j=i+delta;if(j<0||j>=measured.length)continue;const w=Math.abs(delta)===1?2:1;sum+=measured[j].p*w;weight+=w;}
  return {t:key.t,p:sum/weight};
 });
 return {id,kind:'vector',nodes,width,opacity:1,color,pressure,smoothness:100,profileVersion:5,widthProfile,minWidthPercent:20,maxWidthPercent:100,taperStart:0,taperEnd:0};
}
export function transformVector(line:VectorLine,m:Matrix):VectorLine{
 const apply=(p:Handle)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]}),nodes=(items:VectorNode[])=>items.map(p=>({...p,...apply(p),in:apply(p.in),out:apply(p.out)}));
 const {inShot:_inShot,inPreviousStage:_inPreviousStage,...editable}=line as VectorLine&ArtworkOrigin;
 return {...editable,nodes:nodes(line.nodes),sourceNodes:line.sourceNodes?nodes(line.sourceNodes):undefined,width:Math.max(.1,Math.min(500,line.width*Math.sqrt(Math.abs(m[0]*m[3]-m[1]*m[2]))))};
}
/** Warp vector anchors and handles separately; remains an editable Bézier stroke. */
export function projectiveVector(line:VectorLine,h:H):VectorLine{
 const nodes=(items:VectorNode[])=>items.map(p=>({...p,...projectPoint(p,h),in:projectPoint(p.in,h),out:projectPoint(p.out,h)}));
 const {inShot:_inShot,inPreviousStage:_inPreviousStage,...editable}=line as VectorLine&ArtworkOrigin;
 return {...editable,nodes:nodes(line.nodes),sourceNodes:line.sourceNodes?nodes(line.sourceNodes):undefined};
}
export function adjustVectorSmoothness(line:VectorLine,amount:number):VectorLine{
 const sourceNodes=line.sourceNodes??line.nodes,copy=sourceNodes.map(p=>({...p,in:{...p.in},out:{...p.out}})),t=amount/100;
 for(let i=1;i<copy.length;i++){const a=sourceNodes[i-1],b=sourceNodes[i];copy[i-1].out={x:a.x+(b.x-a.x)/3+(a.out.x-a.x-(b.x-a.x)/3)*t,y:a.y+(b.y-a.y)/3+(a.out.y-a.y-(b.y-a.y)/3)*t};copy[i].in={x:a.x+(b.x-a.x)*2/3+(b.in.x-a.x-(b.x-a.x)*2/3)*t,y:a.y+(b.y-a.y)*2/3+(b.in.y-a.y-(b.y-a.y)*2/3)*t};}
 return {...line,nodes:copy,sourceNodes,smoothness:amount};
}
/** A Flash-style editable ink outline with controllable pressure floor/ceiling and tip taper.
 * The contour lives in project coordinates, so zooming does not alter its shape.
 * Cached for unchanged saved/vector objects; live drafts receive a new geometry object per frame. */
const flashOutlineCache=new WeakMap<VectorLine,Handle[]>();
const flashPathCache=new WeakMap<VectorLine,Path2D>();
export function flashVectorOutline(line:VectorLine):Handle[]{
 const found=flashOutlineCache.get(line);if(found)return found;
 const curves=vectorCubics(line);
 // A larger tolerance and fewer fit nodes avoid unnecessary flattening during every frame.
 const samples=curves.flatMap((c,i)=>flattenCubic(c,.55).slice(i?1:0));
 if(!samples.length)return [];
 const distances=[0];for(let i=1;i<samples.length;i++)distances.push(distances[i-1]+Math.hypot(samples[i].x-samples[i-1].x,samples[i].y-samples[i-1].y));
 const len=distances.at(-1)!;
 const startLen=line.taperStart?Math.max(1,line.width*(.5+line.taperStart*8)):0;
 const endLen=line.taperEnd?Math.max(1,line.width*(.5+line.taperEnd*8)):0;
 const min=Math.max(.01,Math.min(2,(line.minWidthPercent??15)/100));
 const max=Math.max(min,Math.min(3,(line.maxWidthPercent??100)/100));
 const left:Handle[]=[],right:Handle[]=[];
 for(let i=0;i<samples.length;i++){
  const pt=samples[i],prev=samples[Math.max(0,i-1)],next=samples[Math.min(samples.length-1,i+1)];
  const dx=next.x-prev.x,dy=next.y-prev.y,den=Math.hypot(dx,dy)||1;
  const actualPressure=line.pressure?pressureResponse(pt.p,line.pressureCurve):1;
  const widthFactor=line.pressure?min+(max-min)*actualPressure:1;
  const startFactor=startLen?Math.min(1,distances[i]/startLen):1;
  const endFactor=endLen?Math.min(1,(len-distances[i])/endLen):1;
  const r=line.width/2*widthFactor*Math.max(.012,Math.min(startFactor,endFactor));
  const nx=-dy/den*r,ny=dx/den*r;left.push({x:pt.x+nx,y:pt.y+ny});right.push({x:pt.x-nx,y:pt.y-ny});
 }
 const polygon=[...left,...right.reverse()];flashOutlineCache.set(line,polygon);return polygon;
}

/** FlowCurve v2: solid-contour ink, inspired by the behavior of vector ink
 * tools rather than image blur. The final shape is one opaque filled path with
 * round end caps. Separate centerline/width interpolation prevents doubled
 * semi-transparent overlaps, seams and unintentional pencil-like fuzziness. */
const flowContourCache=new WeakMap<VectorLine,Handle[]>();
const flowPathCache=new WeakMap<VectorLine,Path2D>();
const clamp01=(n:number)=>Math.max(0,Math.min(1,n));
export function flowPressureWidth(line:VectorLine,p:number){
 if(!line.pressure)return 1;
 // Storyboard/Flash-like ink should keep a healthy body while still reacting to pressure.
 const sensed=Math.pow(clamp01(pressureResponse(clamp01(p),line.pressureCurve)),.62);
 const low=Math.max(.24,Math.min(1,(line.minWidthPercent??34)/100));
 const high=Math.max(low,Math.min(3,(line.maxWidthPercent??100)/100));
 return low+(high-low)*sensed;
}
function smoothCenterlineSamples(samples:Point[],closed:boolean){
 if(samples.length<5)return samples.map(p=>({...p}));
 let current=samples.map(p=>({...p}));
 const isProtected=(i:number)=>{
  if(!closed&&(i<2||i>current.length-3))return true;
  const a=current[(i-1+current.length)%current.length],b=current[i],c=current[(i+1)%current.length];
  const ux=b.x-a.x,uy=b.y-a.y,vx=c.x-b.x,vy=c.y-b.y,du=Math.hypot(ux,uy)||1,dv=Math.hypot(vx,vy)||1;
  const cosine=(ux*vx+uy*vy)/(du*dv);
  return cosine<.45;
 };
 for(let pass=0;pass<2;pass++){
  const next=current.map(p=>({...p}));
  for(let i=0;i<current.length;i++){
   if(isProtected(i))continue;
   const a=current[(i-2+current.length)%current.length],b=current[(i-1+current.length)%current.length],p=current[i],c=current[(i+1)%current.length],d=current[(i+2)%current.length];
   if(!closed&&(i<2||i>current.length-3))continue;
   next[i]={...p,
    x:(a.x*1+b.x*3+p.x*8+c.x*3+d.x*1)/16,
    y:(a.y*1+b.y*3+p.y*8+c.y*3+d.y*1)/16,
    p:(a.p*1+b.p*3+p.p*8+c.p*3+d.p*1)/16
   };
  }
  current=next;
 }
 return current;
}
function smoothWidthProfile(widths:number[],distances:number[],lineWidth:number,closed:boolean){
 if(widths.length<4)return widths.slice();
 let current=widths.slice();
 const radius=Math.max(lineWidth*2.1,8);
 for(let pass=0;pass<1;pass++){
  const next=current.slice();
  for(let i=0;i<current.length;i++){
   if(!closed&&(i===0||i===current.length-1))continue;
   let sum=current[i]*2,weight=2;
   for(const dir of [-1,1])for(let step=1;step<=20;step++){
    const j=i+dir*step;
    if(!closed&&(j<0||j>=current.length))break;
    const k=(j+current.length)%current.length;
    const d=Math.abs(distances[k]-distances[i]);
    if(d>radius)break;
    const w=Math.pow(1-d/radius,2);
    sum+=current[k]*w;weight+=w;
   }
   next[i]=sum/weight;
  }
  current=next;
 }
 return current;
}
function buildStylizedOutline(samples:Point[],widths:number[],closed:boolean){
 let left:Handle[]=[],right:Handle[]=[];
 for(let i=0;i<samples.length;i++){
  const pt=samples[i],a=closed?samples[(i-2+samples.length)%samples.length]:samples[Math.max(0,i-2)],b=closed?samples[(i+2)%samples.length]:samples[Math.min(samples.length-1,i+2)];
  let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(d<1e-7){dx=1;dy=0;d=1;}
  const r=widths[i],nx=-dy/d*r,ny=dx/d*r;
  left.push({x:pt.x+nx,y:pt.y+ny});right.push({x:pt.x-nx,y:pt.y-ny});
 }
 const smoothOpen=(arr:Handle[])=>arr.map((p,i)=>i===0||i===arr.length-1?p:{x:(arr[i-1].x+arr[i].x*6+arr[i+1].x)/8,y:(arr[i-1].y+arr[i].y*6+arr[i+1].y)/8});
 const smoothClosed=(arr:Handle[])=>arr.map((p,i)=>({x:(arr[(i-1+arr.length)%arr.length].x+arr[i].x*6+arr[(i+1)%arr.length].x)/8,y:(arr[(i-1+arr.length)%arr.length].y+arr[i].y*6+arr[(i+1)%arr.length].y)/8}));
 for(let pass=0;pass<3;pass++){
  if(closed){left=smoothClosed(left);right=smoothClosed(right);}else{left=smoothOpen(left);right=smoothOpen(right);}
 }
 const polygon=[...left];
 const cap=(idx:number,ending:boolean)=>{
  const p=samples[idx],a=samples[Math.max(0,idx-1)],b=samples[Math.min(samples.length-1,idx+1)];
  const theta=Math.atan2(b.y-a.y,b.x-a.x),r=widths[idx];
  for(let k=1;k<=14;k++){
   const angle=ending?theta+Math.PI/2-k*Math.PI/14:theta-Math.PI/2-k*Math.PI/14;
   polygon.push({x:p.x+Math.cos(angle)*r,y:p.y+Math.sin(angle)*r});
  }
 };
 if(!closed)cap(samples.length-1,true); else polygon.push(right[right.length-1]);
 for(let i=right.length-2;i>=0;i--)polygon.push(right[i]);
 if(!closed)cap(0,false);
 return polygon;
}

export function flowVectorOutline(line:VectorLine):Handle[]{
 const found=flowContourCache.get(line);if(found)return found;
 const curves=vectorCubics(line),rawSamples=curves.flatMap((c,i)=>flattenCubic(c,.35).slice(i?1:0));
 if(!rawSamples.length)return [];
 if(rawSamples.length===1){const p=rawSamples[0],r=line.width*.5*flowPressureWidth(line,p.p);return Array.from({length:20},(_,i)=>({x:p.x+Math.cos(i*Math.PI/10)*r,y:p.y+Math.sin(i*Math.PI/10)*r}));}
 const rawDistances=[0];for(let i=1;i<rawSamples.length;i++)rawDistances[i]=rawDistances[i-1]+Math.hypot(rawSamples[i].x-rawSamples[i-1].x,rawSamples[i].y-rawSamples[i-1].y);
 const rawLength=rawDistances[rawDistances.length-1];
 const closed=rawLength>line.width*6&&Math.hypot(rawSamples[0].x-rawSamples[rawSamples.length-1].x,rawSamples[0].y-rawSamples[rawSamples.length-1].y)<Math.max(1,line.width*.22);
 const samples=smoothCenterlineSamples(rawSamples,closed);
 const distances=[0];for(let i=1;i<samples.length;i++)distances[i]=distances[i-1]+Math.hypot(samples[i].x-samples[i-1].x,samples[i].y-samples[i-1].y);
 const length=distances[distances.length-1];
 const beginSpan=!closed?Math.max(4,line.width*(1.2+((line.taperStart??.05)*8))):0;
 const endSpan=!closed?Math.max(4,line.width*(1.2+((line.taperEnd??.08)*8))):0;
 let widths=samples.map((pt,i)=>{
  const t1=beginSpan?Math.min(1,distances[i]/beginSpan):1;
  const t2=endSpan?Math.min(1,(length-distances[i])/endSpan):1;
  const tipEase=Math.min(t1,t2);
  const body=.18+.82*Math.pow(Math.max(.06,tipEase),.72);
  return Math.max(.12,line.width*.5*flowPressureWidth(line,pt.p)*body);
 });
 widths=smoothWidthProfile(widths,distances,line.width,closed);
 const polygon=buildStylizedOutline(samples,widths,closed);
 flowContourCache.set(line,polygon);return polygon;
}

function buildSmoothClosedPath(points:Handle[]){
 const path=new Path2D();
 if(!points.length)return path;
 if(points.length===1){const p=points[0];path.arc(p.x,p.y,.5,0,Math.PI*2);return path;}
 if(points.length===2){path.moveTo(points[0].x,points[0].y);path.lineTo(points[1].x,points[1].y);path.closePath();return path;}
 const mids=points.map((p,i)=>({x:(p.x+points[(i+1)%points.length].x)/2,y:(p.y+points[(i+1)%points.length].y)/2}));
 path.moveTo(mids[0].x,mids[0].y);
 for(let i=0;i<points.length;i++)path.quadraticCurveTo(points[(i+1)%points.length].x,points[(i+1)%points.length].y,mids[(i+1)%points.length].x,mids[(i+1)%points.length].y);
 path.closePath();
 return path;
}


/** Solid Ink (v3). Reference target: smooth, clean vector ink with optional
 * pressure-driven width variation and crisp edges. No lumpy contour filters,
 * no forced pointed tips, and the same geometry logic can be reused for live
 * preview so the stroke does not morph on pen-up. */
const solidOutlineCache=new WeakMap<VectorLine,Handle[]>();
const solidPathCache=new WeakMap<VectorLine,Path2D>();
/** Separate pressure from Bezier handles, otherwise a straight ink stroke
 * fitted to two anchors loses every light/heavy variation between them. */
export function buildInkPressureProfile(raw:Point[],maxKeys=129){
 if(!raw.length)return [{t:0,p:1},{t:1,p:1}];
 const input:Point[]=[raw[0]];
 for(let i=1;i<raw.length;i++)if(Math.hypot(raw[i].x-input.at(-1)!.x,raw[i].y-input.at(-1)!.y)>.001)input.push(raw[i]);
 if(input.length===1)return [{t:0,p:input[0].p},{t:1,p:input[0].p}];
 const distance=[0];for(let i=1;i<input.length;i++)distance.push(distance.at(-1)!+Math.hypot(input[i].x-input[i-1].x,input[i].y-input[i-1].y));
 const length=distance.at(-1)!;
 const count=Math.max(2,Math.min(maxKeys,Math.ceil(length/2.5)+1));
 const profile:{t:number;p:number}[]=[];let index=1;
 for(let i=0;i<count;i++){
  const t=i/(count-1),position=length*t;
  while(index<distance.length-1&&distance[index]<position)index++;
  const a=input[index-1],b=input[index],span=distance[index]-distance[index-1]||1;
  const ratio=Math.max(0,Math.min(1,(position-distance[index-1])/span));
  profile.push({t,p:Math.max(0,Math.min(1,a.p+(b.p-a.p)*ratio))});
 }
 return profile;
}
export function solidInkVariable(line:VectorLine){
 return line.pressure || (line.taperStart??0)>0 || (line.taperEnd??0)>0;
}
const solidClamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
function densifyOpenSamples(input:Point[],spacing:number){
 if(input.length<2)return input.map(p=>({...p}));
 const out:Point[]=[{...input[0]}];
 for(let i=1;i<input.length;i++){
  const a=input[i-1],b=input[i],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(d<1e-6)continue;
  const steps=Math.max(1,Math.ceil(d/spacing));
  for(let step=1;step<=steps;step++){
   const t=step/steps;
   out.push({x:a.x+dx*t,y:a.y+dy*t,p:a.p+(b.p-a.p)*t});
  }
 }
 return out;
}
function smoothOpenPressurePath(samples:Point[]){
 if(samples.length<5)return samples.map(p=>({...p}));
 let current=samples.map(p=>({...p}));
 for(let pass=0;pass<2;pass++){
  const next=current.map(p=>({...p}));
  for(let i=1;i<current.length-1;i++){
   next[i]={...current[i],
    x:(current[i-1].x+current[i].x*4+current[i+1].x)/6,
    y:(current[i-1].y+current[i].y*4+current[i+1].y)/6,
    p:(current[i-1].p+current[i].p*4+current[i+1].p)/6
   };
  }
  current=next;
 }
 current[0]={...samples[0]};
 current[current.length-1]={...samples[samples.length-1]};
 return current;
}
function buildVariableInkOutline(samplesIn:Point[],opts:InkPreviewOptions):Handle[]{
 if(!samplesIn.length)return [];
 if(samplesIn.length===1){
  const pt=samplesIn[0],r=Math.max(.05,opts.width/2);return Array.from({length:28},(_,i)=>({x:pt.x+Math.cos(i*Math.PI/14)*r,y:pt.y+Math.sin(i*Math.PI/14)*r}));
 }
 const dense=smoothOpenPressurePath(densifyOpenSamples(samplesIn,Math.max(.7,opts.width*.32)));
 const samples:Point[]=[dense[0]];
 for(let i=1;i<dense.length;i++){
  const p=dense[i],prev=samples[samples.length-1];
  if(Math.hypot(p.x-prev.x,p.y-prev.y)>.01)samples.push(p);
 }
 if(samples.length<2)return buildVariableInkOutline([samples[0]],opts);
 const lengths=[0];
 for(let i=1;i<samples.length;i++)lengths.push(lengths[i-1]+Math.hypot(samples[i].x-samples[i-1].x,samples[i].y-samples[i-1].y));
 const total=lengths[lengths.length-1]||1;
 const startTaper=solidClamp(opts.taperStart??0,0,1)*Math.min(total*.45,opts.width*11);
 const endTaper=solidClamp(opts.taperEnd??0,0,1)*Math.min(total*.45,opts.width*11);
 const min=solidClamp((opts.minWidthPercent??28)/100,.05,1.3),max=solidClamp((opts.maxWidthPercent??100)/100,min,2.5);
 const rawWidths=samples.map((pt,i)=>{
  const sensed=opts.pressure?solidClamp(pressureResponse(solidClamp(pt.p,0,1),opts.pressureCurve),0,1):1;
  const factor=opts.pressure?(min+(max-min)*Math.pow(sensed,.72)):1;
  const start=startTaper?Math.min(1,lengths[i]/startTaper):1;
  const end=endTaper?Math.min(1,(total-lengths[i])/endTaper):1;
  const taper=Math.min(start,end);
  return Math.max(.03,opts.width*.5*factor*taper);
 });
 const widths=rawWidths.map((w,i)=>{
  const radius=Math.max(10,opts.width*1.8);
  let sum=w*3,weight=3;
  for(const sign of [-1,1]){
   for(let step=1;step<=30;step++){
    const j=i+sign*step;
    if(j<0||j>=rawWidths.length)break;
    const d=Math.abs(lengths[j]-lengths[i]);
    if(d>radius)break;
    const s=(1-d/radius); const k=s*s;
    sum+=rawWidths[j]*k;weight+=k;
   }
  }
  return sum/weight;
 });
 const left:Handle[]=[],right:Handle[]=[];
 for(let i=0;i<samples.length;i++){
  const a=samples[Math.max(0,i-1)],b=samples[Math.min(samples.length-1,i+1)];
  let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(d<1e-6){dx=1;dy=0;d=1;}
  const r=widths[i],nx=-dy/d*r,ny=dx/d*r;
  left.push({x:samples[i].x+nx,y:samples[i].y+ny});
  right.push({x:samples[i].x-nx,y:samples[i].y-ny});
 }
 const result:Handle[]=[...left];
 const addCap=(index:number,end:boolean)=>{
  const p=samples[index],a=samples[Math.max(0,index-1)],b=samples[Math.min(samples.length-1,index+1)];
  const theta=Math.atan2(b.y-a.y,b.x-a.x),r=widths[index];
  for(let k=1;k<=18;k++){
   const angle=(end?theta+Math.PI/2:theta-Math.PI/2)-k*Math.PI/18;
   result.push({x:p.x+Math.cos(angle)*r,y:p.y+Math.sin(angle)*r});
  }
 };
 addCap(samples.length-1,true);
 for(let i=right.length-1;i>=0;i--)result.push(right[i]);
 addCap(0,false);
 return result;
}
export function previewInkOutline(samples:Point[],options:InkPreviewOptions):Handle[]{
 return buildVariableInkOutline(samples,options);
}
export function solidInkOutline(line:VectorLine):Handle[]{
 const cached=solidOutlineCache.get(line);if(cached)return cached;
 const cubics=vectorCubics(line);
 const samples=cubics.flatMap((c,i)=>flattenCubic(c,.32).slice(i?1:0));
 const result=buildVariableInkOutline(samples,{width:line.width,pressure:line.pressure,pressureCurve:line.pressureCurve,minWidthPercent:line.minWidthPercent,maxWidthPercent:line.maxWidthPercent,taperStart:line.taperStart,taperEnd:line.taperEnd});
 solidOutlineCache.set(line,result);return result;
}
const referenceOutlineCache=new WeakMap<VectorLine,Handle[]>();
const referencePathCache=new WeakMap<VectorLine,Path2D>();
/** V4 variable-width ink. Samples come from the fitted Bézier centerline.
 * Do NOT smooth the centerline a second time while constructing its contour. */
export function referenceInkOutline(line:VectorLine):Handle[]{
 const cached=referenceOutlineCache.get(line);if(cached)return cached;
 const cubics=vectorCubics(line);
 const raw=cubics.flatMap((c,i)=>flattenCubic(c,.3).slice(i?1:0));
 if(raw.length<2){
  const pt=line.nodes[0];if(!pt)return [];
  const radius=Math.max(.06,line.width/2),circle=Array.from({length:24},(_,i)=>({x:pt.x+radius*Math.cos(i*Math.PI/12),y:pt.y+radius*Math.sin(i*Math.PI/12)}));
  referenceOutlineCache.set(line,circle);return circle;
 }
 const rawArc=raw.reduce((length,p,i)=>i?length+Math.hypot(p.x-raw[i-1].x,p.y-raw[i-1].y):0,0);
 // Even straight Bezier sections require intermediate width stations when the
 // artist varies pen pressure while drawing along an otherwise straight path.
 const dense=densifyOpenSamples(raw,Math.max(1.5,line.width*.34,rawArc/1200));
 const samples:Point[]=[dense[0]];
 for(let i=1;i<dense.length;i++)if(Math.hypot(dense[i].x-samples.at(-1)!.x,dense[i].y-samples.at(-1)!.y)>.005)samples.push(dense[i]);
 if(samples.length<2){return referenceInkOutline({...line,nodes:line.nodes.slice(0,1)});}
 const distances=[0];for(let i=1;i<samples.length;i++)distances.push(distances.at(-1)!+Math.hypot(samples[i].x-samples[i-1].x,samples[i].y-samples[i-1].y));
 const length=distances.at(-1)!||1;
 const close=Math.hypot(samples[0].x-samples.at(-1)!.x,samples[0].y-samples.at(-1)!.y);
 const closed=length>line.width*6&&close<Math.max(.3,line.width*.16);
 const startTaper=closed?0:(line.taperStart??0)*Math.min(length*.42,line.width*12);
 const endTaper=closed?0:(line.taperEnd??0)*Math.min(length*.42,line.width*12);
 const lo=Math.max(.06,Math.min(1.5,(line.minWidthPercent??28)/100)),hi=Math.max(lo,Math.min(2.5,(line.maxWidthPercent??100)/100));
 const samplePressure=(t:number,fallback:number)=>{
  const profile=line.widthProfile;
  if(!profile||profile.length<2)return fallback;
  let lo=0,hi=profile.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(profile[mid].t<t)lo=mid;else hi=mid;}
  const a=profile[lo],b=profile[hi];const ratio=(t-a.t)/Math.max(1e-8,b.t-a.t);
  return a.p+(b.p-a.p)*Math.max(0,Math.min(1,ratio));
 };
 const radii=samples.map((p,i)=>{
  const measured=line.pressure?pressureResponse(Math.max(0,Math.min(1,samplePressure(distances[i]/length,p.p))),line.pressureCurve):1;
  const w=line.pressure?lo+(hi-lo)*Math.pow(measured,.72):1;
  const a=startTaper?Math.min(1,distances[i]/startTaper):1;
  const b=endTaper?Math.min(1,(length-distances[i])/endTaper):1;
  // Taper is optional and is only applied along a requested length.
  return Math.max(.025,line.width*.5*w*Math.min(a,b));
 });
 // Smooth width alone in distance space. Preserve actual curve geometry and
 // avoid sudden pressure spikes that make lumps in the outer contour.
 const widthRadius=Math.max(4,line.width*1.4);
 const widths=radii.map((w,i)=>{
  if(!line.pressure)return w;
  let total=w*2,weight=2;
  for(const direction of [-1,1])for(let k=1;k<=22;k++){
   const j=i+direction*k;if(j<0||j>=radii.length)break;
   const d=Math.abs(distances[j]-distances[i]);if(d>widthRadius)break;
   const influence=(1-d/widthRadius)**2;total+=radii[j]*influence;weight+=influence;
  }
  return total/weight;
 });
 const left:Handle[]=[],right:Handle[]=[];
 const uniqueEnd=closed?samples.length-1:samples.length;
 for(let i=0;i<uniqueEnd;i++){
  const prior=closed?samples[(i-1+uniqueEnd)%uniqueEnd]:samples[Math.max(0,i-1)];
  const after=closed?samples[(i+1)%uniqueEnd]:samples[Math.min(samples.length-1,i+1)];
  let dx=after.x-prior.x,dy=after.y-prior.y;
  const dist=Math.hypot(dx,dy)||1;dx/=dist;dy/=dist;
  const radius=widths[i];
  left.push({x:samples[i].x-dy*radius,y:samples[i].y+dx*radius});
  right.push({x:samples[i].x+dy*radius,y:samples[i].y-dx*radius});
 }
 if(closed){
  const polygon=[...left,...right.reverse()];referenceOutlineCache.set(line,polygon);return polygon;
 }
 const polygon=[...left],last=uniqueEnd-1;
 const cap=(i:number,isEnd:boolean)=>{
  const a=samples[Math.max(0,i-1)],b=samples[Math.min(samples.length-1,i+1)];
  const theta=Math.atan2(b.y-a.y,b.x-a.x),r=widths[i];
  const base=isEnd?theta+Math.PI/2:theta-Math.PI/2;
  for(let j=1;j<=16;j++){
   const ang=base-j*Math.PI/16;
   polygon.push({x:samples[i].x+Math.cos(ang)*r,y:samples[i].y+Math.sin(ang)*r});
  }
 };
 cap(last,true);
 for(let i=last-1;i>=0;i--)polygon.push(right[i]);
 cap(0,false);
 referenceOutlineCache.set(line,polygon);return polygon;
}

function nativeVectorPath(ctx:CanvasRenderingContext2D,line:VectorLine){
 const start=line.nodes[0];if(!start)return;
 ctx.beginPath();ctx.moveTo(start.x,start.y);
 for(const c of vectorCubics(line))ctx.bezierCurveTo(c.c1.x,c.c1.y,c.c2.x,c.c2.y,c.b.x,c.b.y);
}
const cleanPathCache=new WeakMap<VectorLine,Path2D>();

export function drawVector(ctx:CanvasRenderingContext2D,line:VectorLine){
 ctx.save();ctx.globalAlpha*=line.opacity;ctx.strokeStyle=line.color;ctx.fillStyle=line.color;ctx.lineWidth=line.width;ctx.lineCap='round';ctx.lineJoin='round';
 if(line.profileVersion===5||line.profileVersion===6){
  if(line.profileVersion===5&&!solidInkVariable(line)){nativeVectorPath(ctx,line);ctx.stroke();}
  else if(typeof Path2D!=='undefined'){
   let path=cleanPathCache.get(line);if(!path){path=new Path2D(cleanInkPathData(line));cleanPathCache.set(line,path);}ctx.fill(path);
  }else{traceCleanInk(ctx,line);ctx.fill();}
  ctx.restore();return;
 }
 if(line.profileVersion===4){
  if(!solidInkVariable(line)){
   nativeVectorPath(ctx,line);ctx.stroke();
  }else{
   const outline=referenceInkOutline(line);
   if(outline.length){
    let path=referencePathCache.get(line);
    if(typeof Path2D!=='undefined'){
     if(!path){path=new Path2D();outline.forEach((p,i)=>i?path!.lineTo(p.x,p.y):path!.moveTo(p.x,p.y));path.closePath();referencePathCache.set(line,path);}
     ctx.fill(path);
    }else{
     ctx.beginPath();outline.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();
    }
   }
  }
  ctx.restore();return;
 }
 if(line.profileVersion===3){
  if(!solidInkVariable(line)){
   nativeVectorPath(ctx,line);ctx.stroke();
  }else{
   const outline=solidInkOutline(line);
   if(outline.length){
    let path=solidPathCache.get(line);
    if(typeof Path2D!=='undefined'){
     if(!path){path=new Path2D();outline.forEach((p,i)=>i?path!.lineTo(p.x,p.y):path!.moveTo(p.x,p.y));path.closePath();solidPathCache.set(line,path);}
     ctx.fill(path);
    }else{
     ctx.beginPath();outline.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();
    }
   }
  }
  ctx.restore();return;
 }
 if(line.profileVersion===1||line.profileVersion===2){
  const outline=line.profileVersion===2?flowVectorOutline(line):flashVectorOutline(line);
  if(outline.length){
   if(typeof Path2D!=='undefined'){
    const cache=line.profileVersion===2?flowPathCache:flashPathCache;
    let path=cache.get(line);
    if(!path){path=line.profileVersion===2?buildSmoothClosedPath(outline):new Path2D();if(line.profileVersion!==2){outline.forEach((p,i)=>i?path!.lineTo(p.x,p.y):path!.moveTo(p.x,p.y));path.closePath();}cache.set(line,path);}
    ctx.fill(path);
   }else{
    if(line.profileVersion===2&&outline.length>2){
     const mids=outline.map((p,i)=>({x:(p.x+outline[(i+1)%outline.length].x)/2,y:(p.y+outline[(i+1)%outline.length].y)/2}));
     ctx.beginPath();ctx.moveTo(mids[0].x,mids[0].y);for(let i=0;i<outline.length;i++)ctx.quadraticCurveTo(outline[(i+1)%outline.length].x,outline[(i+1)%outline.length].y,mids[(i+1)%outline.length].x,mids[(i+1)%outline.length].y);ctx.closePath();ctx.fill();
    }else{ctx.beginPath();outline.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();}
   }
  }ctx.restore();return;
 }
 const curves=vectorCubics(line);
 if(!line.pressure){ctx.beginPath();ctx.moveTo(line.nodes[0].x,line.nodes[0].y);for(const c of curves)ctx.bezierCurveTo(c.c1.x,c.c1.y,c.c2.x,c.c2.y,c.b.x,c.b.y);ctx.stroke();}
 else{const m=ctx.getTransform(),scale=Math.max(1,Math.hypot(m.a,m.b),Math.hypot(m.c,m.d)),samples=curves.flatMap((c,i)=>flattenCubic(c,.25/scale).slice(i?1:0)),left:Handle[]=[],right:Handle[]=[];for(let i=0;i<samples.length;i++){const p=samples[i],a=samples[Math.max(0,i-1)],b=samples[Math.min(samples.length-1,i+1)],length=Math.hypot(b.x-a.x,b.y-a.y)||1,r=line.width/2*Math.max(.06,pressureResponse(p.p,line.pressureCurve)),nx=-(b.y-a.y)/length*r,ny=(b.x-a.x)/length*r;left.push({x:p.x+nx,y:p.y+ny});right.push({x:p.x-nx,y:p.y-ny});}ctx.beginPath();[...left,...right.reverse()].forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();}
 ctx.restore();
}
export function vectorDistance(line:VectorLine,p:Handle){let best=Infinity;for(const c of vectorCubics(line)){const samples=flattenCubic(c,.5);for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i],dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d)):0;best=Math.min(best,Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t));}}return best;}
export function vectorSvg(line:VectorLine,width:number,height:number){
 const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));let d=`M${line.nodes[0].x} ${line.nodes[0].y}`;
 for(const c of vectorCubics(line))d+=` C${c.c1.x} ${c.c1.y} ${c.c2.x} ${c.c2.y} ${c.b.x} ${c.b.y}`;
 let path=`<path d="${d}" fill="none" stroke="${escape(line.color)}" stroke-width="${line.width}" stroke-opacity="${line.opacity}" stroke-linecap="round" stroke-linejoin="round"/>`;
 if(line.profileVersion===5||line.profileVersion===6){
  if(line.profileVersion===6||solidInkVariable(line))path=`<path d="${cleanInkPathData(line)}" fill="${escape(line.color)}" fill-opacity="${line.opacity}"/>`;
 }
 else if(line.profileVersion===4){
  if(!solidInkVariable(line)){
   path=`<path d="${d}" fill="none" stroke="${escape(line.color)}" stroke-width="${line.width}" stroke-opacity="${line.opacity}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }else{
   const outline=referenceInkOutline(line);
   d=outline.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ')+' Z';
   path=`<path d="${d}" fill="${escape(line.color)}" fill-opacity="${line.opacity}"/>`;
  }
 }
 else if(line.profileVersion===3){
  if(!solidInkVariable(line)){
   // Native true Bezier stroke: no outline faceting, no blur, no automatic taper.
   path=`<path d="${d}" fill="none" stroke="${escape(line.color)}" stroke-width="${line.width}" stroke-opacity="${line.opacity}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }else{
   const outline=solidInkOutline(line);
   d=outline.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ')+' Z';
   path=`<path d="${d}" fill="${escape(line.color)}" fill-opacity="${line.opacity}"/>`;
  }
 }
 else if(line.profileVersion===1||line.profileVersion===2){
  const outline=line.profileVersion===2?flowVectorOutline(line):flashVectorOutline(line);
  if(line.profileVersion===2&&outline.length>2){
   const mids=outline.map((p,i)=>({x:(p.x+outline[(i+1)%outline.length].x)/2,y:(p.y+outline[(i+1)%outline.length].y)/2}));
   d=`M${mids[0].x} ${mids[0].y}`;
   for(let i=0;i<outline.length;i++){const p=outline[(i+1)%outline.length],m=mids[(i+1)%outline.length];d+=` Q${p.x} ${p.y} ${m.x} ${m.y}`;}
   d+=' Z';
  }else d=outline.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ')+' Z';
  path=`<path d="${d}" fill="${escape(line.color)}" fill-opacity="${line.opacity}"/>`;
 }
 else if(line.pressure){const samples=vectorCubics(line).flatMap((c,i)=>flattenCubic(c).slice(i?1:0)),left:Handle[]=[],right:Handle[]=[];for(let i=0;i<samples.length;i++){const p=samples[i],a=samples[Math.max(0,i-1)],b=samples[Math.min(samples.length-1,i+1)],length=Math.hypot(b.x-a.x,b.y-a.y)||1,r=line.width/2*Math.max(.06,pressureResponse(p.p,line.pressureCurve)),nx=-(b.y-a.y)/length*r,ny=(b.x-a.x)/length*r;left.push({x:p.x+nx,y:p.y+ny});right.push({x:p.x-nx,y:p.y-ny});}d=[...left,...right.reverse()].map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ')+' Z';path=`<path d="${d}" fill="${escape(line.color)}" fill-opacity="${line.opacity}"/>`;}
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${path}</svg>`;
}
export {cubicAt};
