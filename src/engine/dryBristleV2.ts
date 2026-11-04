/** v152: independent bristle lift-off, interrupted rails and in-footprint dry grain.
 * Only the opt-in version 2 dry brush is affected; version 1 is unchanged. */
import type {Stroke} from '../core/model';
import {watercolorSeedFor} from '../core/paintTips';
import {paintSamples,type PaintPass,type PaintSamples} from './paintPass';
import {pressureResponse,taperFactor,type strokeGeometry} from './strokeGeometry';
import {widthResponse,opacityResponse} from './pressureChannels';
import type {RasterRegion} from './liveRaster';
import {clamp,smooth,dryNoise1,dryNoise,densityAlpha} from './dryTooth';

type Row={x:number;y:number;tx:number;ty:number;p:number;v:number;width:number;d:number;bend:number};
type Filament={offset:number;within:number;group:number;follow:number;load:number;dep:number;width:number;threshold:number;phase:number;stiff:number;head:number;hair:boolean;uniform:number;tail:number;curl:number;outer:number;split:number;taper:Float32Array};
type Clump={center:number;halfWidth:number;phase:number;strength:number;split:number};
type Flight={position:number;lateral:number;length:number;alpha:number;width:number};
type Model={key:string;seed:number;bristles:Filament[];clumps:Clump[];phases:number[];flights:Flight[];rows:Row[];data:Float64Array;boxes:Float64Array;micro:Float64Array;microD:Float64Array;lastSamples?:PaintSamples;headBox:number[];hairs:number[];capacity:number;generated:number;contacts:{light:number;heavy:number;total:number}};
type Surface={key:string;w:number;h:number;mass:Uint16Array;tone:Uint8Array;previous?:RasterRegion};
const models=new Map<string,Model>(),surfaces=new WeakMap<HTMLCanvasElement,Surface>();
export function resetDryBristleV2Surface(canvas:HTMLCanvasElement){surfaces.delete(canvas);}
let pooled:HTMLCanvasElement|undefined,output:HTMLCanvasElement|undefined;
const material=(s:Stroke)=>s.dryMaterial??'ink';
const signature=(s:Stroke)=>JSON.stringify({...s,points:undefined,mixStops:undefined});
function random32(seed:number){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function newModel(s:Stroke,key:string):Model{
 const seed=s.dryBristleSeed??watercolorSeedFor(s.rasterSourceId??s.id),rnd=random32(Math.imul(seed,7919)+13),S=s.size,ink=material(s)==='ink';
 const N=Math.round(Math.max(24,Math.min(130,S*.46))),bristles:Filament[]=[];
 // A brush is a different bundle for each seed, never four predefined strips.
 const count=ink?3+Math.floor(rnd()*5):3+Math.floor(rnd()*3);
 const gaps=Array.from({length:count-1},()=> (ink?-.015:-.025)+rnd()*(ink?.105:.085));
 const sizes=Array.from({length:count},()=> (ink?.11:.19)+rnd()*(ink?.32:.39));
 const total=sizes.reduce((a,b)=>a+b,0)+gaps.reduce((a,b)=>a+b,0);
 const footprint=(ink?.48:.45)+rnd()*(ink?.45:.52),centerShift=(rnd()-.5)*(ink?.24:.28);
 const scale=2*footprint/total;let edge=-footprint+centerShift;
 const clumps:Clump[]=sizes.map((v,i)=>{
  const width=v*scale,center=edge+width*.5;edge+=width+(gaps[i]??0)*scale;
  return {center,halfWidth:width*.5,phase:rnd()*1000,strength:.72+rnd()*.56,split:(rnd()-.5)*(.18+(ink?.19:.10))};
 });
 // Filament population follows irregular clump width; avoid equal bands.
 const weights=clumps.map(c=>c.halfWidth*(.65+rnd()*.7)),weightTotal=weights.reduce((a,b)=>a+b,0);
 const cumulative=[0];for(const w of weights)cumulative.push(cumulative.at(-1)!+w/weightTotal);
 for(let i=0;i<N;i++){
  const u=(i+.2+.6*rnd())/N;
  let group=0;while(group<count-1&&u>=cumulative[group+1])group++;
  const part=(u-cumulative[group])/Math.max(.00001,cumulative[group+1]-cumulative[group]);
  const within=Math.max(-1,Math.min(1,part*2-1+(rnd()-.5)*.16)),c=clumps[group],stiff=.25+.75*rnd();
  const offset=c.center+c.halfWidth*within;
  bristles.push({offset,within,group,
   follow:1-Math.exp(-1/Math.max(1,S*(s.dryLag??.55)*(.055+.03*(1-stiff)))),
   load:(s.dryLoad??.97)*(ink?.89:.84)*(.76+.34*rnd()),
   dep:Math.max(S,70)*(s.dryDepletion??15)*(ink?1.45:2.35)*(.7+.7*rnd()),
   width:(1.45+1.35*rnd()**2)*Math.max(1,S/55)*(ink?.91:.98),
   threshold:rnd()**(ink?1.1:1.7)*(ink?.82:.66),phase:rnd()*1000,stiff,
   head:S*(.05+.17*Math.min(1,Math.abs(offset)/Math.max(.2,footprint))+.035*rnd()),hair:rnd()<(ink?.67:.43),uniform:(i+.5)/N*2-1,
   tail:rnd(),curl:(rnd()-.5)*.055,
   outer:Math.pow(Math.abs(within),1.25)*Math.sign(within),
   split:(rnd()-.5)*(.2+(ink?.19:.09)),
   taper:Float32Array.from({length:7},(_,j)=>(1-j/6)**(.5+stiff*.7)*(j?1:.75))});
 }
 const candidates=bristles.map((b,i)=>b.hair?i:-1).filter(i=>i>=0);
 const H=Math.min(candidates.length,Math.max(ink?8:5,Math.round((ink?19:12)*(s.dryHair??.35)/.35*Math.min(1,S/70))));
 const hairs=Array.from({length:H},(_,i)=>candidates[Math.round(i*(candidates.length-1)/Math.max(1,H-1))]);
 const phases=Array.from({length:4},()=>rnd()*1000);
 const flightCount=Math.max(S<60?(ink?142:126):S<85?(ink?88:76):(ink?56:46),Math.round(S*(ink?.38:.28)*(.65+(s.dryFlecks??1.8)*.45)));
 // Flecks begin *inside* the body/tail transition, never after an empty gap.
 const flights=Array.from({length:flightCount},()=>{
  const side=rnd()<.5?-1:1;
  return {position:.04+.62*rnd(), // distance back along the actual ink path, in S units
   lateral:side*(.12+.30*rnd()),
   length:Math.min(S<=70?6:Math.max(6,S*.12),S*(.015+.065*rnd())),
   alpha:(ink?.65:.58)+.34*rnd(),width:.35+.65*rnd()};
 });
 return {key,seed,bristles,clumps,phases,flights,rows:[],data:new Float64Array(0),boxes:new Float64Array(0),micro:new Float64Array(0),microD:new Float64Array(0),hairs,capacity:0,generated:0,headBox:[0,0,0,0],contacts:{light:bristles.filter(b=>smooth(b.threshold-.06,b.threshold+.06,.25)>0).length,heavy:N,total:N}};
}
function sampledRows(s:Stroke,samples:PaintSamples,previous?:PaintSamples,old:Row[]=[]){
 const ps=samples.points;if(!ps.length)return[];let shared=0;
 if(previous)while(shared<Math.min(ps.length,previous.points.length)){const a=ps[shared],b=previous.points[shared];if(a.x!==b.x||a.y!==b.y||a.p!==b.p||a.v!==b.v||samples.arc[shared]!==previous.arc[shared])break;shared++;}
 let keep=Math.max(0,Math.min(old.length,Math.floor(shared?samples.arc[shared-1]:0)-16));
 // The final half-footprint is dynamic as the pen moves: rewind those rows
 // so an incremental preview is byte-identical to the complete final replay.
 keep=Math.max(0,Math.min(keep,Math.floor(Math.min(samples.total,previous?.total??0)-s.size*1.1)-8));
 const rows:Row[]=old.slice(0,keep);let k=1;while(k<ps.length-1&&samples.arc[k]<keep)k++;
 const at=(d:number)=>{while(k<ps.length-1&&samples.arc[k]<d)k++;const a=ps[Math.max(0,k-1)]??ps[0],b=ps[k]??a,L=(samples.arc[k]??0)-(samples.arc[k-1]??0),t=L?clamp((d-(samples.arc[k-1]??0))/L):0,p=s.pressure?pressureResponse((a.p+(b.p-a.p)*t)**s.response,s.pressureCurve):1,v=(a.v??.65)+((b.v??.65)-(a.v??.65))*t,width=(s.pressure&&s.pressureWidth!==false||s.velocityTaper?widthResponse(p*(s.velocityTaper?v:1),s):1)*taperFactor(d,samples.total,s.taperStart,0,Math.max(64,s.size*12));rows.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,p,v,width,d,tx:1,ty:0,bend:0});};
 for(let d=keep;d<=samples.total;d++)at(d);if(samples.total-(rows.at(-1)?.d??0)>1e-7)at(samples.total);
 for(let i=keep;i<rows.length;i++){const a=rows[Math.max(0,i-4)],b=rows[Math.min(rows.length-1,i+4)],L=Math.hypot(b.x-a.x,b.y-a.y);rows[i].tx=L?(b.x-a.x)/L:1;rows[i].ty=L?(b.y-a.y)/L:0;}
 for(let i=keep;i<rows.length;i++){const lo=Math.max(0,i-10),hi=Math.min(rows.length-1,i+10),a=rows[lo],b=rows[hi];rows[i].bend=smooth(.10,.30,Math.abs(a.tx*b.ty-a.ty*b.tx)*s.size/Math.max(1,hi-lo));}
 return rows;
}
const same=(a:Row,b:Row)=>a.x===b.x&&a.y===b.y&&a.tx===b.tx&&a.ty===b.ty&&a.p===b.p&&a.v===b.v&&a.width===b.width&&a.d===b.d&&a.bend===b.bend;
const motion=(q:Row)=>clamp((.8-q.v)/.45);
function trajectory(s:Stroke,samples:PaintSamples){
 const key=signature(s);let m=models.get(key);if(!m){m=newModel(s,key);models.set(key,m);}else{models.delete(key);models.set(key,m);}if(m.lastSamples===samples){m.generated=0;return m;}const previous=m.lastSamples;m.lastSamples=samples;const rows=sampledRows(s,samples,previous,m.rows),N=m.bristles.length;let prefix=0;
 while(prefix<Math.min(m.rows.length,rows.length)&&(m.rows[prefix]===rows[prefix]||same(m.rows[prefix],rows[prefix])))prefix++;
 // The bristle lift depends on the current endpoint, not merely row coordinates.
 // Recompute the changing end window even when resampled row positions match.
 if(previous&&Math.abs(samples.total-previous.total)>.01)
  prefix=Math.min(prefix,Math.max(0,Math.floor(Math.min(samples.total,previous.total)-s.size*1.1)));
 if(rows.length>m.capacity){m.capacity=Math.max(64,Math.ceil(rows.length/256)*256);const data=new Float64Array(m.capacity*N*5);data.set(m.data.subarray(0,prefix*N*5));m.data=data;const boxes=new Float64Array(m.capacity*4);boxes.set(m.boxes.subarray(0,prefix*4));m.boxes=boxes;const micro=new Float64Array(m.capacity*N),microD=new Float64Array(m.capacity);micro.set(m.micro);microD.fill(NaN);microD.set(m.microD);m.micro=micro;m.microD=microD;}
 const loaded=clamp((s.dryLoad??.97)/(material(s)==='paint'?.85:.97))**.4;
 for(let k=prefix;k<rows.length;k++){
  const q=rows[k],inkStroke=material(s)==='ink',nx=-q.ty,ny=q.tx,speed=motion(q),widthFactor=Math.max(.25,q.width**.35),flow=(s.flow??1)*(s.pressure&&s.pressureFlow?q.p:1),tone=Math.round(255*loaded*(1-(material(s)==='paint'?.14:.12)*(s.drySpeedDry??2.6)/2.6*speed)*(s.pressure&&s.pressureOpacity?opacityResponse(q.p,s):1));
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  const front=smooth(0,1,q.d/(s.size*(material(s)==='paint'?.87:1.06)*(1-.2*speed)));
  // Low frequency clusters wander, change width and separate/rejoin naturally.
  const clumpX=m.clumps.map(c=>c.center+(.065+speed*.035)*(dryNoise1(q.d*.009+c.phase,m.seed+33)-.5));
  const clumpW=m.clumps.map(c=>c.halfWidth*(.48+1.18*dryNoise1(q.d*.017+c.phase+17,m.seed+47)));
  const active=m.clumps.map(c=>dryNoise1(q.d*.009+c.phase+83,m.seed+61));
  const notchNoise=m.clumps.map(c=>dryNoise1(q.d*.036+c.phase+54,m.seed+31));
  if(m.microD[k]!==q.d){for(let i=0;i<N;i++)m.micro[k*N+i]=.78+.22*dryNoise1(q.d*(material(s)==='paint'?.067:.018)+m.bristles[i].phase,m.seed+5);m.microD[k]=q.d;}
  for(let i=0;i<N;i++){
   const b=m.bristles[i],c=m.clumps[b.group];
   const rough=(dryNoise1(q.d*(.12+speed*.035)+b.phase,m.seed+89)-.5);
   const fray=rough*(s.dryFray??.09)*(material(s)==='paint'?.8:1.0)*1.8*Math.pow(Math.abs(b.within),2)*Math.sign(b.within)*(.7+speed*.85);
   const branch=(dryNoise1(q.d*.018+c.phase+b.phase*.05,m.seed+193)-.5)*b.split*.38*(1+q.bend);
   const offset=clumpX[b.group]+clumpW[b.group]*b.within+branch+c.split*q.bend*.6;
   const lat=(b.uniform*(1-front)+offset*front+fray)*q.width;
   const x=q.x+nx*lat*s.size*.5,y=q.y+ny*lat*s.size*.5,idx=(k*N+i)*5,prev=((k-1)*N+i)*5,step=k?q.d-rows[k-1].d:1,follow=step===1?b.follow:1-(1-b.follow)**step;
   m.data[idx]=k?m.data[prev]+(x-m.data[prev])*follow:x;m.data[idx+1]=k?m.data[prev+1]+(y-m.data[prev+1])*follow:y;
   const pressureBreak=q.p<.62?Math.max(0,(.62-q.p)/.62):0;
   const contact=q.p>=.79?1:smooth(b.threshold-.06,b.threshold+.06,q.p);
   const clumpSkip=smooth(.49,.82,active[b.group]);
   const channelBreak=(material(s)==='ink'?.95:.43)*clumpSkip*(.20+.8*Math.pow(Math.abs(b.within),.7));
   // Each bristle periodically runs dry independently of its neighbours.
   // Clump-wide channels alone made the long, parallel white rails in v151.
   const toothCycle=dryNoise1(q.d*(inkStroke? .057:.044)+b.phase,m.seed+211),
    fineCycle=dryNoise1(q.d*.15+b.phase*.23,m.seed+239);
   const drySkip=smooth(inkStroke?.43:.58,inkStroke?.77:.89,toothCycle)*(.54+.46*fineCycle);
   const independentContact=1-drySkip*(inkStroke?.88:.63)*(.65+.35*Math.abs(b.within));
   const clusterBreak=(1-pressureBreak*(inkStroke?.88:.62)*smooth(.38,.76,1-active[b.group]))*(1-channelBreak)*independentContact;
   const depletion=b.dep/(1+(s.drySpeedDry??2.6)*speed*.35);
   const notch=1-(material(s)==='ink'?.58:.22)*front*Math.min(1,(s.dryFray??.09)/.09)*smooth(.37,.73,notchNoise[b.group]);
   const load=b.load*Math.exp(-q.d/depletion),micro=m.micro[k*N+i];
   // Oval bundle: the centre touches first, outer bristles enter later.
   // Near lift, the outer bristles release early. This is rasterized on the
   // existing path instead of drawing projected caps beyond the pointer.
   const outer=Math.min(1,Math.abs(b.offset)/Math.max(.2,material(s)==='ink'?.75:.82));
   // Outer fibres contact later, with an uneven transition rather than a cut edge.
   const landing=s.size*(.015+.24*outer+.038*dryNoise1(b.phase,m.seed+37));
   const startFactor=smooth(0,Math.max(2,s.size*.045),q.d-landing+2);
   // Independent fibres lift at different distances. Outer fibres lift first;
   // some central hairs persist almost to the real pointer, never past it.
   const tipDistance=Math.max(0,rows[rows.length-1].d-q.d);
   const liftSeed=dryNoise1(b.phase,m.seed+43);
   const liftDist=s.size*(.005+.24*outer+.48*b.tail+.05*liftSeed);
   const tipContact=smooth(liftDist-2, liftDist+Math.max(3,s.size*.045),tipDistance);
   const endWidth=.30+.70*smooth(liftDist-2,liftDist+Math.max(5,s.size*.10),tipDistance);
   m.data[idx+2]=load*contact*clusterBreak*micro*notch*flow*startFactor*tipContact;
   m.data[idx+3]=b.width*widthFactor*(.57+.43*startFactor)*endWidth*(.79+.21*fineCycle);
   m.data[idx+4]=tone;const pad=m.data[idx+3]*.5+2;left=Math.min(left,m.data[idx]-pad);top=Math.min(top,m.data[idx+1]-pad);right=Math.max(right,m.data[idx]+pad);bottom=Math.max(bottom,m.data[idx+1]+pad);
  }
  m.boxes[k*4]=left;m.boxes[k*4+1]=top;m.boxes[k*4+2]=right;m.boxes[k*4+3]=bottom;
 }
 if(prefix===0&&rows.length){const q=rows[0];let l=Infinity,t=Infinity,r=-Infinity,bottom=-Infinity;for(let i=0;i<N;i++){const at=i*5,b=m.bristles[i],x=m.data[at],y=m.data[at+1],pad=m.data[at+3]*.5+1;l=Math.min(l,x-q.tx*b.head-pad,x+q.tx*.5-pad);t=Math.min(t,y-q.ty*b.head-pad,y+q.ty*.5-pad);r=Math.max(r,x-q.tx*b.head+pad,x+q.tx*.5+pad);bottom=Math.max(bottom,y-q.ty*b.head+pad,y+q.ty*.5+pad);}m.headBox=[l,t,r,bottom];}
 m.generated=rows.length-prefix;m.rows=rows;let bytes=0;for(const v of models.values())bytes+=v.data.byteLength+v.micro.byteLength+v.boxes.byteLength;while(models.size>1&&(models.size>4||bytes>16*1024*1024)){const first=models.keys().next().value!,old=models.get(first)!;bytes-=old.data.byteLength+old.micro.byteLength+old.boxes.byteLength;models.delete(first);}return m;
}
function surface(c:HTMLCanvasElement,key:string){let v=surfaces.get(c);if(!v||v.w!==c.width||v.h!==c.height){v={key,w:c.width,h:c.height,mass:new Uint16Array(c.width*c.height),tone:new Uint8Array(c.width*c.height)};surfaces.set(c,v);}else if(v.key!==key){v.mass.fill(0);v.tone.fill(0);v.key=key;v.previous=undefined;}return v;}
// Add optical coverage separately from the maximum pigment-strength envelope.
// Lighter overlapping input cannot dilute existing dry pigment. Both operations
// are commutative, so cached live spans and full replay produce the same bytes.
// Above this optical mass the prescribed tooth curve is fully covered for every grain.
const COVERED_MASS=11000;
const inkMass=Uint16Array.from({length:65536},(_,i)=>Math.min(65535,Math.round(-Math.log1p(-Math.min(.999999,Math.floor(i/256)/255*(i%256)/255))*4096)));
function deposit(v:Surface,x0:number,y0:number,x1:number,y1:number,radius:number,alpha:number,tone:number,clip:RasterRegion){
 const level=Math.round(clamp(alpha)*255);if(!level||radius<=0)return;const margin=radius+.5,outside=margin*margin,inside=margin>=1?(margin-1)**2:-1,l=Math.max(0,clip.x,Math.floor(Math.min(x0,x1)-margin)),r=Math.min(v.w,clip.x+clip.width,Math.ceil(Math.max(x0,x1)+margin)),top=Math.max(0,clip.y,Math.floor(Math.min(y0,y1)-margin)),bottom=Math.min(v.h,clip.y+clip.height,Math.ceil(Math.max(y0,y1)+margin)),dx=x1-x0,dy=y1-y0,inv=1/(dx*dx+dy*dy||1),base=level*256;
 for(let y=top;y<bottom;y++)for(let x=l;x<r;x++){const i=y*v.w+x;if(v.mass[i]>=COVERED_MASS&&tone<=v.tone[i])continue;const t=clamp(((x+.5-x0)*dx+(y+.5-y0)*dy)*inv),vx=x+.5-x0-t*dx,vy=y+.5-y0-t*dy,distance2=vx*vx+vy*vy;if(distance2>=outside)continue;const cov=distance2<=inside?255:Math.round(clamp(margin-Math.sqrt(distance2))*255);if(cov){v.mass[i]=Math.min(COVERED_MASS,v.mass[i]+inkMass[base+cov]);v.tone[i]=Math.max(v.tone[i],cov>=64?tone:Math.round(tone*cov/64));}}
}
function copy(v:Surface,source:Surface|undefined,r:RasterRegion){for(let y=r.y;y<r.y+r.height;y++){const start=y*v.w+r.x,end=start+r.width;if(source){v.mass.set(source.mass.subarray(start,end),start);v.tone.set(source.tone.subarray(start,end),start);}else{v.mass.fill(0,start,end);v.tone.fill(0,start,end);}}}
function rect(x:number,y:number,right:number,bottom:number,w:number,h:number):RasterRegion{const l=Math.max(0,Math.min(w,Math.floor(x))),t=Math.max(0,Math.min(h,Math.floor(y)));return{x:l,y:t,width:Math.max(0,Math.min(w,Math.ceil(right))-l),height:Math.max(0,Math.min(h,Math.ceil(bottom))-t)};}
function union(a:RasterRegion,b?:RasterRegion){if(!b)return a;const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return{x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};}
// Keep physical integration at 1px. Wider nibs rasterize short 6px capsules
// (under 5% of their width), integrating all pressure/load samples in each span.
const rasterSpan=(s:Stroke)=>s.size>=100?8:3;
function bodyBounds(s:Stroke,m:Model,w:number,h:number,from:number,to:number){let l=Infinity,t=Infinity,r=-Infinity,b=-Infinity;const span=rasterSpan(s);for(let k=Math.max(0,Math.floor(Math.max(0,from)/span)*span-span);k<m.rows.length&&m.rows[k].d<=to+1e-7;k++){const idx=k*4;l=Math.min(l,m.boxes[idx]);t=Math.min(t,m.boxes[idx+1]);r=Math.max(r,m.boxes[idx+2]);b=Math.max(b,m.boxes[idx+3]);}
 if(from<0&&m.rows.length){l=Math.min(l,m.headBox[0]);t=Math.min(t,m.headBox[1]);r=Math.max(r,m.headBox[2]);b=Math.max(b,m.headBox[3]);}return rect(l,t,r,b,w,h);
}
const paperTiles=new Map<string,Uint8Array>(),toothTables=new Map<number,Uint8Array>(),TILE=32;
function paper(tx:number,ty:number,scale:number){const key=[tx,ty,scale].join(':'),known=paperTiles.get(key);if(known)return known;const a=new Uint8Array(TILE*TILE);for(let y=0;y<TILE;y++)for(let x=0;x<TILE;x++){const px=tx*TILE+x,py=ty*TILE+y;a[y*TILE+x]=Math.round(255*(.62*dryNoise(px/scale,py/scale,671749)+.26*dryNoise(px/(scale*2.3)+7,py/(scale*2.3)+3,671750)+.12*dryNoise(px/(scale*6)+1,py/(scale*6)+9,671751)));}paperTiles.set(key,a);while(paperTiles.size>2048)paperTiles.delete(paperTiles.keys().next().value!);return a;}
function tooth(k:number){const key=Math.round(k*100),known=toothTables.get(key);if(known)return known;const a=new Uint8Array(65536);for(let A=0;A<256;A++)for(let g=0;g<256;g++){const x=A/255;a[A*256+g]=Math.round(255*smooth(.18,.78,x+(.5-g/255)*(key/100)*4*x*(1-x)));}toothTables.set(key,a);while(toothTables.size>12)toothTables.delete(toothTables.keys().next().value!);return a;}
function finish(ctx:CanvasRenderingContext2D,s:Stroke,v:Surface,r:RasterRegion,replace:boolean){
 if(!r.width||!r.height)return;const c=output??=document.createElement('canvas');if(c.width<r.width)c.width=Math.ceil(r.width/32)*32;if(c.height<r.height)c.height=Math.ceil(r.height/32)*32;const oc=c.getContext('2d',{willReadFrequently:true})!,image=oc.createImageData(r.width,r.height),data=image.data,rgb=s.color.slice(1).match(/../g)!.map(x=>parseInt(x,16)),lut=tooth(s.dryTooth??.9),scale=s.dryToothScale??2.2,paperPeak=170,tx0=r.x>>5,ty0=r.y>>5,columns=((r.x+r.width-1)>>5)-tx0+1,papers=new Array<Uint8Array|undefined>(columns*(((r.y+r.height-1)>>5)-ty0+1));let active:Uint8Array|undefined,oldTx=-1,oldTy=-1;
 for(let y=0;y<r.height;y++){const py=r.y+y,ty=Math.floor(py/TILE);for(let x=0;x<r.width;x++){const px=r.x+x,idx=py*v.w+px,mass=v.mass[idx];if(!mass)continue;const raw=densityAlpha[mass];if(raw<17)continue;const tx=Math.floor(px/TILE);if(tx!==oldTx||ty!==oldTy){const index=(ty-ty0)*columns+tx-tx0;active=papers[index]??(papers[index]=paper(tx,ty,scale));oldTx=tx;oldTy=ty;}const grain=active![(py-ty*TILE)*TILE+px-tx*TILE];let a=lut[raw*256+grain];if(a>=250)a=255;if(grain>paperPeak&&a>215){const tooth=Math.max(0,(grain-paperPeak)/110),toneSoft=material(s)==='paint'?.36:.26;a=Math.round(a*(1-Math.min(.3,toneSoft*tooth*(s.dryTooth??.9))));}a=Math.round(a*v.tone[idx]/255);if(!a)continue;const i=(y*r.width+x)*4;data[i]=rgb[0];data[i+1]=rgb[1];data[i+2]=rgb[2];data[i+3]=a;}}
 oc.putImageData(image,0,0);if(replace)ctx.clearRect(r.x,r.y,r.width,r.height);ctx.drawImage(c,0,0,r.width,r.height,r.x,r.y,r.width,r.height);
}
/** End grain stays on the travelled path. No extrapolation from the last tangent.
 * Accents are short commas or flecks, never detached straight flying hairs. */
function pathRowAt(m:Model,d:number){
 const rows=m.rows;if(!rows.length)return undefined;
 const n=Math.max(0,Math.min(rows.length-1,Math.round(d)));
 return rows[n];
}
function coast(ctx:CanvasRenderingContext2D,s:Stroke,m:Model){
 if(m.rows.length<3)return;
 const q=m.rows[m.rows.length-1],S=s.size,ink=material(s)==='ink',unit=Math.max(1,Math.min(S*.6,q.d*.8));
 const load=clamp((s.dryLoad??.97)/(ink?.97:.85))**.4;
 const alpha=load*(s.flow??1)*(s.pressure&&s.pressureFlow?q.p:1)*(s.pressure&&s.pressureOpacity?opacityResponse(q.p,s):1);
 if(q.d<2||alpha<=0)return;
 ctx.save();ctx.fillStyle=s.color;ctx.strokeStyle=s.color;ctx.lineCap='round';ctx.lineJoin='round';
 // The bristle hairs stay embedded in the last half-footprint of true path.
 for(let j=0;j<m.hairs.length;j++){
  const i=m.hairs[j],b=m.bristles[i];if(q.p<b.threshold-.06)continue;
  const seed=dryNoise1(b.phase,m.seed+27),segment=Math.min(unit*.72,S*.22,Math.max(2,S*(.08+.13*seed)));
  const back=Math.min(q.d,Math.max(segment+2,unit*(.32+.30*dryNoise1(b.phase,m.seed+29))));
  const from=pathRowAt(m,q.d-back),mid=pathRowAt(m,q.d-back+segment*.50),to=pathRowAt(m,q.d-back+segment);
  if(!from||!mid||!to)continue;
  const side=b.offset*S*.49,fx=from.x-from.ty*side,fy=from.y+from.tx*side,
   mx=mid.x-mid.ty*side,my=mid.y+mid.tx*side,tx=to.x-to.ty*side,ty=to.y+to.tx*side;
  ctx.globalAlpha=alpha*(ink?.41:.27)*(.45+.35*b.stiff);
  ctx.lineWidth=Math.max(.28,Math.min(.75,S*.008));
  ctx.beginPath();ctx.moveTo(fx,fy);ctx.quadraticCurveTo(mx,my,tx,ty);ctx.stroke();
 }
 // Flecks are tiny local grain, attached beside/behind the real stroke;
 // never lines pointing along the pen's last tangent or more than 0.3 S ahead.
 for(const f of m.flights){
  const q0=pathRowAt(m,q.d-S*f.position);if(!q0)continue;
  const offset=f.lateral*S*Math.max(.65,q0.width),x=q0.x-q0.ty*offset,y=q0.y+q0.tx*offset;
  const radius=Math.max(.18,Math.min(S<=70?1.1:1.6,f.length*.17));
  ctx.globalAlpha=alpha*f.alpha*(ink?.47:.35);
  ctx.beginPath();ctx.ellipse(x,y,radius,Math.max(.22,radius*.47),Math.atan2(q0.ty,q0.tx),0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}
/** Broad conservative dirty rectangle follows the last S of actual path,
 * including hooks and loops; no overhang extending forwards. */
function coastBounds(s:Stroke,m:Model,w:number,h:number){
 const rows=m.rows;if(!rows.length)return rect(0,0,0,0,w,h);
 const end=rows.at(-1)!.d,back=Math.max(s.size*.75,6),pad=s.size*.80+5;
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(let d=Math.max(0,Math.floor(end-back));d<=end;d+=Math.max(1,Math.floor(s.size/12))){
  const q=pathRowAt(m,d);if(!q)continue;
  left=Math.min(left,q.x-pad);right=Math.max(right,q.x+pad);top=Math.min(top,q.y-pad);bottom=Math.max(bottom,q.y+pad);
 }
 const q=rows[rows.length-1];left=Math.min(left,q.x-pad);right=Math.max(right,q.x+pad);top=Math.min(top,q.y-pad);bottom=Math.max(bottom,q.y+pad);
 return rect(left,top,right,bottom,w,h);
}
function paintBody(s:Stroke,m:Model,v:Surface,from:number,to:number,r:RasterRegion,append:boolean,head:boolean){
 const N=m.bristles.length,span=rasterSpan(s);
 if(head){const q=m.rows[0];for(let i=0;i<N;i++){const b=m.bristles[i],idx=i*5,x=m.data[idx],y=m.data[idx+1];deposit(v,x,y,x,y,m.data[idx+3]*.5,m.data[idx+2],m.data[idx+4],r);}}
 if(to<0)return;
 // Filament phases stagger short capsule joins; no shared cadence across the nib.
 for(let k=Math.max(span,Math.floor(Math.max(0,from)/span)*span);k<m.rows.length+span*2;k+=span){
  for(let i=0;i<N;i++){
   const phase=Math.floor(m.bristles[i].phase)%span,natural=k-span+phase,end=Math.min(natural,m.rows.length-1),first=Math.max(0,natural-span);
   if(end<=first||append&&end!==natural)continue;const q=m.rows[end];if(q.d<=from+1e-7||q.d>to+1e-7)continue;
   const idx=(end*N+i)*5,prev=(first*N+i)*5;let alpha=0,width=0,tone=0;
   for(let j=first+1;j<=end;j++){const at=(j*N+i)*5;alpha+=m.data[at+2];width+=m.data[at+3];tone+=m.data[at+4];}
   const count=end-first;alpha/=count;const radius=width/count*.5,factor=(2+Math.PI*radius)/(2+Math.PI*radius/count);
   deposit(v,m.data[prev],m.data[prev+1],m.data[idx],m.data[idx+1],radius,1-(1-alpha)**factor,Math.round(tone/count),r);
  }
 }
}
export const dryBristleV2Diagnostics={enabled:false,records:[]as{append:boolean;generatedSteps:number;bristles:number;lightContacts:number;heavyContacts:number;depositionMs:number;toothMs:number;tailMs:number;pixels:number;presentationPixels:number}[],clear(){this.records=[];}};
export function drawDryBristleV2(ctx:CanvasRenderingContext2D,s:Stroke,g:ReturnType<typeof strokeGeometry>,_region?:RasterRegion,pass?:PaintPass){
 const samples=pass?.samples??paintSamples(g,.18);if(!samples.points.length||s.flow===0||s.dryLoad===0||s.pressure&&s.pressureWidth!==false&&s.maxSize===0||s.pressure&&s.pressureOpacity&&s.maxOpacity===0)return;
 const timed=dryBristleV2Diagnostics.enabled,start=timed?performance.now():0,m=trajectory(s,samples),canvas=pass?.mask??(pooled??=document.createElement('canvas'));if(canvas.width!==ctx.canvas.width)canvas.width=ctx.canvas.width;if(canvas.height!==ctx.canvas.height)canvas.height=ctx.canvas.height;
 const v=surface(canvas,m.key),from=pass?.from?samples.arc[pass.from-1]:-1,to=pass?samples.arc[Math.max(0,pass.to-1)]:samples.total,N=m.bristles.length,r=bodyBounds(s,m,v.w,v.h,from,to);if(!r.width||!r.height)return;if(!pass?.append)copy(v,pass?.base?surfaces.get(pass.base):undefined,r);
 paintBody(s,m,v,from,to,r,!!pass?.append,from<0);
 const deposited=timed?performance.now():0;let shown=r;
 if(pass?.append)finish(canvas.getContext('2d')!,s,v,r,true);
 else{if(pass){shown=union(union(r,coastBounds(s,m,v.w,v.h)),v.previous);ctx.clearRect(shown.x,shown.y,shown.width,shown.height);if(pass.base)ctx.drawImage(pass.base,shown.x,shown.y,shown.width,shown.height,shown.x,shown.y,shown.width,shown.height);}finish(ctx,s,v,r,!!pass);}
 const finished=timed?performance.now():0;if(!pass?.append){coast(ctx,s,m);v.previous=union(r,coastBounds(s,m,v.w,v.h));}
 if(timed)dryBristleV2Diagnostics.records.push({append:!!pass?.append,generatedSteps:m.generated,bristles:N,lightContacts:m.contacts.light,heavyContacts:m.contacts.heavy,depositionMs:deposited-start,toothMs:finished-deposited,tailMs:performance.now()-finished,pixels:r.width*r.height,presentationPixels:shown.width*shown.height});return shown;
}

/** Cache immutable mass separately from the presented body. Only the old/new
 * changing body is finished, once; flying hairs never enter the grain pass. */
export class LiveDryBristleV2{
 private key='';private body?:HTMLCanvasElement;private work?:HTMLCanvasElement;
 private previousRows?:Row[];private committed=0;private changing?:RasterRegion;
 private allBody?:RasterRegion;private presented?:RasterRegion;
 lastRegion?:RasterRegion;
 reset(){this.key='';for(const c of [this.body,this.work])if(c)c.width=c.height=0;this.body=this.work=undefined;this.previousRows=undefined;this.committed=0;this.changing=this.allBody=this.presented=this.lastRegion=undefined;}
 paint(ctx:CanvasRenderingContext2D,s:Stroke,g:ReturnType<typeof strokeGeometry>){
  if(!g.points.length||s.flow===0||s.dryLoad===0||s.pressure&&s.pressureWidth!==false&&s.maxSize===0||s.pressure&&s.pressureOpacity&&s.maxOpacity===0){ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);this.reset();return 0;}
  const timed=dryBristleV2Diagnostics.enabled,start=timed?performance.now():0,samples=paintSamples(g,.18),m=trajectory(s,samples),body=this.body??=document.createElement('canvas'),work=this.work??=document.createElement('canvas');
  const fresh=this.key!==m.key||body.width!==ctx.canvas.width||body.height!==ctx.canvas.height;
  if(fresh){body.width=work.width=ctx.canvas.width;body.height=work.height=ctx.canvas.height;resetDryBristleV2Surface(body);resetDryBristleV2Surface(work);this.committed=0;this.previousRows=undefined;this.changing=this.allBody=this.presented=undefined;ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);}
  const stable=surface(body,m.key),transient=surface(work,m.key);let common=0;
  while(this.previousRows&&common<Math.min(this.previousRows.length,m.rows.length)&&(this.previousRows[common]===m.rows[common]||same(this.previousRows[common],m.rows[common])))common++;
  // Endpoint-dependent lift means identical positions may carry different ink.
  // Do not promote provisional end-window deposits to the committed cache.
  if(this.previousRows&&Math.abs((this.previousRows.at(-1)?.d??0)-samples.total)>.01)
   common=Math.min(common,Math.max(0,Math.floor(Math.min(samples.total,this.previousRows.at(-1)?.d??0)-s.size*1.1)));
  const span=rasterSpan(s),commit=Math.max(0,Math.floor((common-1)/span)*span),rewind=!!this.previousRows&&(common===0||commit<this.committed),oldBody=rewind?this.allBody:undefined;
  if(fresh||rewind){if(rewind){stable.mass.fill(0);stable.tone.fill(0);}this.committed=0;const head=bodyBounds(s,m,stable.w,stable.h,-1,-1);paintBody(s,m,stable,-1,-1,head,true,true);}
  if(commit>this.committed){const from=m.rows[this.committed]?.d??0,to=m.rows[commit]?.d??0,r=bodyBounds(s,m,stable.w,stable.h,from,to);paintBody(s,m,stable,from,to,r,true,false);this.committed=commit;}
  const from=m.rows[this.committed]?.d??0,current=bodyBounds(s,m,stable.w,stable.h,this.committed?from:-1,samples.total),dirty=union(union(current,this.changing),oldBody);
  copy(transient,stable,dirty);paintBody(s,m,transient,from,samples.total,dirty,false,false);
  const deposited=timed?performance.now():0;finish(body.getContext('2d',{willReadFrequently:true})!,s,transient,dirty,true);const finished=timed?performance.now():0;
  const end=coastBounds(s,m,stable.w,stable.h),shown=union(union(dirty,end),this.presented);ctx.clearRect(shown.x,shown.y,shown.width,shown.height);ctx.drawImage(body,shown.x,shown.y,shown.width,shown.height,shown.x,shown.y,shown.width,shown.height);coast(ctx,s,m);
  this.key=m.key;this.previousRows=m.rows;this.changing=current;this.presented=union(current,end);this.allBody=bodyBounds(s,m,stable.w,stable.h,-1,samples.total);this.lastRegion=shown;
  if(timed)dryBristleV2Diagnostics.records.push({append:false,generatedSteps:m.generated,bristles:m.bristles.length,lightContacts:m.contacts.light,heavyContacts:m.contacts.heavy,depositionMs:deposited-start,toothMs:finished-deposited,tailMs:performance.now()-finished,pixels:dirty.width*dirty.height,presentationPixels:shown.width*shown.height});return shown.width*shown.height;
 }
}
