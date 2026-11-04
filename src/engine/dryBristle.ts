/** Production descendant of the supplied per-bristle prototype. Physical paths
 * are appended once; fixed-point deposition and a shared mask make live/replay
 * independent of event count and raster-pass boundaries. */
import type {Stroke} from '../core/model';
import {watercolorSeedFor} from '../core/paintTips';
import {dryLiftSpan,dryRasterPadding} from '../core/dryBrush';
import {paintSamples,type PaintPass,type PaintSamples} from './paintPass';
import {pressureResponse,taperFactor,type strokeGeometry} from './strokeGeometry';
import {widthResponse,opacityResponse} from './pressureChannels';
import type {RasterRegion} from './liveRaster';
import {clamp,smooth,dryNoise1,rasterBristle,finishDry,densityAlpha} from './dryTooth';
type Row={x:number;y:number;tx:number;ty:number;p:number;v:number;width:number;d:number};
type Bristle={offset:number;stiff:number;follow:number;load:number;depletion:number;width:number;threshold:number;tail:number;clump:number;span:number;hair:boolean;phase:number;delay:number;fray:number;curl:number};
type Fleck={position:number;lateral:number;length:number;alpha:number;width:number};
type Model={key:string;seed:number;bristles:Bristle[];clumpPhase:number[];flecks:Fleck[];rows:Row[];records:Float64Array;capacity:number;generated:number;contacts:{light:number;heavy:number;total:number}};
type Mask={key:string;w:number;h:number;density:Uint16Array;previous?:RasterRegion};
const models=new Map<string,Model>(),masks=new WeakMap<HTMLCanvasElement,Mask>();let pooled:HTMLCanvasElement|undefined;
const signature=(s:Stroke)=>JSON.stringify({...s,points:undefined,mixStops:undefined});
function random32(seed:number){let a=seed>>>0||1;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function newModel(s:Stroke,key:string):Model{
 const seed=s.dryBristleSeed??watercolorSeedFor(s.rasterSourceId??s.id),rnd=random32(Math.imul(seed,7919)+13),S=s.size,N=Math.round(Math.max(24,Math.min(140,S*.6))),K=Math.max(2,Math.round(N/(s.dryClumps??16))),bristles:Bristle[]=[];
 for(let i=0;i<N;i++){const u=(i+.15+.7*rnd())/N,group=Math.min(K-1,Math.floor(u*K)),offset=-1+(group+.5)*2/K+(u*K-group-.5)*2/K*.94,edge=Math.abs(offset),stiff=.15+.85*rnd()**.8,hair=rnd()<(s.dryHair??.35)&&edge>.15,lagPx=S*(s.dryLag??.55)*(.1+1-stiff);
  bristles.push({offset,stiff,follow:1-Math.exp(-1/Math.max(1,lagPx)),load:Math.max(.05,clamp((s.dryLoad??.97)*(.55+.45*rnd())*(1-.55*smooth(.7,1,edge)))),depletion:S*(s.dryDepletion??15)*(.35+2.5*rnd()**1.6)*(1-.35*smooth(.6,1,edge)),width:(.8+1.7*rnd()**2)*Math.max(1,S/55)*1.06,threshold:rnd()**1.4*.7,tail:S*(hair?.7+1.5*rnd():.04+.55*rnd()**2),clump:Math.max(0,Math.min(K-1,Math.floor((offset*.5+.5)*K+(rnd()-.5)*.8))),span:S*(s.dryLift??.8)*(.15+1.6*(1-stiff)**1.2),hair,phase:rnd()*1000,delay:S*.12*rnd()**1.5*(.3+edge),fray:(s.dryFray??.09)*(.3+.7*edge)*(.5+rnd()),curl:(rnd()-.5)*.0025+(hair?Math.sign(offset)*.0015:0)});
 }
 const clumpPhase=Array.from({length:K},()=>rnd()*1000),flecks=Array.from({length:Math.round((s.dryFlecks??1.8)*S*.45)},()=>({position:-.4+rnd()**1.5*1.9,lateral:(rnd()*2-1)*.95,length:1+rnd()*(2+6*rnd()),alpha:(.25+.6*rnd())*(s.dryLoad??.97),width:.8+rnd()*1.3}));
 return {key,seed,bristles,clumpPhase,flecks,rows:[],records:new Float64Array(0),capacity:0,generated:0,contacts:{light:bristles.filter(b=>smooth(b.threshold-.06,b.threshold+.06,.25)>0).length,heavy:bristles.filter(b=>smooth(b.threshold-.06,b.threshold+.06,.95)>0).length,total:N}};
}
function sampledRows(s:Stroke,samples:PaintSamples){
 const rows:Row[]=[],ps=samples.points;if(!ps.length)return rows;let segment=1;
 const evaluate=(d:number)=>{while(segment<ps.length-1&&samples.arc[segment]<d)segment++;const a=ps[Math.max(0,segment-1)]??ps[0],b=ps[segment]??a,span=(samples.arc[segment]??0)-(samples.arc[segment-1]??0),t=span?clamp((d-(samples.arc[segment-1]??0))/span):0,pressure=s.pressure?pressureResponse((a.p+(b.p-a.p)*t)**s.response,s.pressureCurve):1,v=(a.v??.65)+((b.v??.65)-(a.v??.65))*t,width=(s.pressure&&s.pressureWidth!==false||s.velocityTaper?widthResponse(pressure*(s.velocityTaper?v:1),s):1)*taperFactor(d,samples.total,s.taperStart,s.taperEnd,Math.max(64,s.size*12));rows.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,p:pressure,v,width,d,tx:1,ty:0});};
 for(let d=0;d<=samples.total;d++)evaluate(d);if(samples.total-(rows.at(-1)?.d??0)>1e-7)evaluate(samples.total);
 for(let i=0;i<rows.length;i++){const a=rows[Math.max(0,i-4)],b=rows[Math.min(rows.length-1,i+4)],length=Math.hypot(b.x-a.x,b.y-a.y);rows[i].tx=length?(b.x-a.x)/length:1;rows[i].ty=length?(b.y-a.y)/length:0;}
 return rows;
}
const sameRow=(a:Row,b:Row)=>a.x===b.x&&a.y===b.y&&a.tx===b.tx&&a.ty===b.ty&&a.p===b.p&&a.v===b.v&&a.width===b.width&&a.d===b.d;
function trajectory(s:Stroke,samples:PaintSamples){
 const key=signature(s);let m=models.get(key);if(!m){m=newModel(s,key);models.set(key,m);}else{models.delete(key);models.set(key,m);}
 const rows=sampledRows(s,samples),N=m.bristles.length;let prefix=0;while(prefix<Math.min(m.rows.length,rows.length)&&sameRow(m.rows[prefix],rows[prefix]))prefix++;
 if(rows.length>m.capacity){const capacity=Math.max(64,Math.ceil(rows.length/256)*256),records=new Float64Array(capacity*N*4);records.set(m.records.subarray(0,prefix*N*4));m.records=records;m.capacity=capacity;}
 for(let k=prefix;k<rows.length;k++){const q=rows[k],d=q.d,step=k?q.d-rows[k-1].d:1,speed=clamp((1-q.v)/.85),nx=-q.ty,ny=q.tx;
  for(let i=0;i<N;i++){const b=m.bristles[i],cj=(dryNoise1(d*(.009+b.clump*.00137)+m.clumpPhase[b.clump],m.seed+3)-.5)*2*(s.dryClumpAmp??.30),fj=(dryNoise1(d*.05+b.phase,m.seed+9)-.5)*2*b.fray,lat=(b.offset+cj*(1-Math.abs(b.offset)*.3)+fj)*q.width,x=q.x+nx*lat*s.size*.5,y=q.y+ny*lat*s.size*.5,base=(k*N+i)*4,previous=((k-1)*N+i)*4,follow=step===1?b.follow:1-(1-b.follow)**step;
   m.records[base]=k?m.records[previous]+(x-m.records[previous])*follow:x;m.records[base+1]=k?m.records[previous+1]+(y-m.records[previous+1])*follow:y;
   const contact=smooth(b.threshold-.06,b.threshold+.06,q.p),attack=s.size*.18,depletion=b.depletion/(1+(s.drySpeedDry??2.6)*speed*1.6),load=b.load*Math.exp(-Math.max(0,d-attack)/depletion),skip=smooth(.14,.42,dryNoise1(d*.045+b.phase*3.1,m.seed+5)*.6+.4*dryNoise1(d*.011+b.phase,m.seed+11)),att=d<attack?.75+.25*d/attack:1,channels=(s.flow??1)*(s.pressure&&s.pressureFlow?q.p:1)*(s.pressure&&s.pressureOpacity?opacityResponse(q.p,s):1);
   m.records[base+2]=(d<b.delay?0:1)*load*contact*(.2+.8*skip)*att*(b.hair?.95:1)*channels;m.records[base+3]=b.width*Math.max(.15,q.width**.35);
  }
 }
 m.generated=rows.length-prefix;m.rows=rows;
 let bytes=0;for(const v of models.values())bytes+=v.records.byteLength;while(models.size>1&&(models.size>4||bytes>16*1024*1024)){const first=models.keys().next().value!,old=models.get(first)!;bytes-=old.records.byteLength;models.delete(first);}return m;
}
function maskState(c:HTMLCanvasElement,key:string){let m=masks.get(c);if(!m||m.w!==c.width||m.h!==c.height){m={key,w:c.width,h:c.height,density:new Uint16Array(c.width*c.height)};masks.set(c,m);}else if(m.key!==key){m.density.fill(0);m.key=key;m.previous=undefined;}return m;}
function copyRegion(target:Mask,source:Mask|undefined,r:RasterRegion){for(let y=r.y;y<r.y+r.height;y++){const start=y*target.w+r.x;if(source)target.density.set(source.density.subarray(start,start+r.width),start);else target.density.fill(0,start,start+r.width);}}
function bounds(s:Stroke,m:Model,width:number,height:number,from:number,to:number,append:boolean,previous?:RasterRegion,region?:RasterRegion){
 let l=Infinity,t=Infinity,r=-Infinity,b=-Infinity;const include=(x:number,y:number,margin=4)=>{l=Math.min(l,x-margin);t=Math.min(t,y-margin);r=Math.max(r,x+margin);b=Math.max(b,y+margin);},N=m.bristles.length;
 for(let k=Math.max(0,Math.floor(Math.max(0,from)/3)*3);k<m.rows.length;k++){if(m.rows[k].d>to+1e-7)break;for(let i=0;i<N;i++){const j=(k*N+i)*4;include(m.records[j],m.records[j+1],m.records[j+3]*.5+4);}}
 if(!append&&m.rows.length){const q=m.rows.at(-1)!;for(let i=0;i<N;i++){const hair=m.bristles[i],j=((m.rows.length-1)*N+i)*4,n=Math.round(hair.tail),theta=hair.curl,ratio=Math.abs(theta)<1e-8?n:Math.sin(n*theta/2)/Math.sin(theta/2),a=(n+1)*theta/2,tx=q.tx*Math.cos(a)-q.ty*Math.sin(a),ty=q.tx*Math.sin(a)+q.ty*Math.cos(a),margin=Math.abs(theta)*n*n/8+hair.width+5;include(m.records[j],m.records[j+1],margin);include(m.records[j]+tx*ratio,m.records[j+1]+ty*ratio,margin);}
  for(const f of m.flecks){const d=q.d+f.position*s.size,row=m.rows[Math.max(0,Math.min(m.rows.length-1,Math.floor(d)))],ex=Math.max(0,d-q.d),x=row.x+row.tx*ex-row.ty*f.lateral*s.size*.5*q.width,y=row.y+row.ty*ex+row.tx*f.lateral*s.size*.5*q.width;include(x,y,f.length+5);}
 }
 if(from<0&&m.rows.length){const q=m.rows[0];include(q.x,q.y,s.size*.65+8);}if(previous){include(previous.x,previous.y,0);include(previous.x+previous.width,previous.y+previous.height,0);}const x=Math.max(0,Math.floor(Math.max(l,region?.x??0))),y=Math.max(0,Math.floor(Math.max(t,region?.y??0))),right=Math.min(width,Math.ceil(Math.min(r,region?region.x+region.width:width))),bottom=Math.min(height,Math.ceil(Math.min(b,region?region.y+region.height:height)));return {x,y,width:Math.max(0,right-x),height:Math.max(0,bottom-y)};
}
function tails(s:Stroke,m:Model,state:Mask,r:RasterRegion){
 const rows=m.rows,last=rows.at(-1)!,total=last.d;if(total<2)return;const speed=clamp((1-last.v)/.85),N=m.bristles.length,attack=s.size*.18;
 for(let i=0;i<N;i++){const b=m.bristles[i],contact=smooth(b.threshold-.06,b.threshold+.06,last.p),load=b.load*Math.exp(-Math.max(0,total-attack)/(b.depletion/(1+(s.drySpeedDry??2.6)*speed*1.6)))*contact*(s.flow??1)*(s.pressure&&s.pressureFlow?last.p:1)*(s.pressure&&s.pressureOpacity?opacityResponse(last.p,s):1);if(load<.03)continue;
  const start=((rows.length-1)*N+i)*4;let px=m.records[start],py=m.records[start+1],tx=last.tx,ty=last.ty;const steps=Math.max(1,Math.round(b.tail)),width=b.hair?Math.max(1,Math.min(1.4,m.records[start+3]*.35)):m.records[start+3],c=Math.cos(b.curl*3),sn=Math.sin(b.curl*3);
  for(let j=3;j<steps+3;j+=3){const stride=Math.min(3,steps-(j-3)),gap=b.hair?Math.min(steps*.45,s.size*(.15+.35*(1-b.stiff))):0,t=clamp((Math.min(steps,j)-gap)/Math.max(1,steps-gap)),a=clamp(load*(b.hair?1.6:.85))*(1-t)**(b.hair?.7:1.6)*(.35+.65*smooth(.2,.5,dryNoise1(j*.07+b.phase,m.seed+17))),ntx=tx*c-ty*sn,nty=tx*sn+ty*c;tx=ntx;ty=nty;const x=px+tx*stride,y=py+ty*stride,factor=(2+Math.PI*width*.5)/(2+Math.PI*width*.5/stride);if(j>=gap)rasterBristle(state.density,state.w,state.h,px,py,x,y,width*.5,1-(1-a)**factor,r);px=x;py=y;}
 }
 for(const f of m.flecks){const d=total+f.position*s.size,index=Math.max(0,Math.min(rows.length-1,Math.floor(d))),q=rows[index],extra=Math.max(0,d-total),nx=-q.ty,ny=q.tx,x=q.x+q.tx*extra+nx*f.lateral*s.size*.5*last.width,y=q.y+q.ty*extra+ny*f.lateral*s.size*.5*last.width,cp=smooth(.1,.5,last.p);rasterBristle(state.density,state.w,state.h,x,y,x+q.tx*f.length,y+q.ty*f.length,f.width*.5,f.alpha*(1-Math.max(0,f.position)/1.5*.6)*cp*(s.flow??1)*(s.pressure&&s.pressureFlow?last.p:1)*(s.pressure&&s.pressureOpacity?opacityResponse(last.p,s):1),r);}
}
function flushMask(canvas:HTMLCanvasElement,state:Mask,r:RasterRegion){const ctx=canvas.getContext('2d')!,image=ctx.createImageData(r.width,r.height);for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)image.data[(y*r.width+x)*4+3]=densityAlpha[state.density[(r.y+y)*state.w+r.x+x]];ctx.putImageData(image,r.x,r.y);}
export const dryBristleDiagnostics={enabled:false,records:[] as {append:boolean;generatedSteps:number;paintedSteps:number;bristles:number;lightContacts:number;heavyContacts:number;depositionMs:number;toothMs:number;pixels:number}[],clear(){this.records=[];}};
export function drawDryBristle(ctx:CanvasRenderingContext2D,s:Stroke,g:ReturnType<typeof strokeGeometry>,region?:RasterRegion,pass?:PaintPass){
 const samples=pass?.samples??paintSamples(g,.18);if(!samples.points.length||s.flow===0||s.dryLoad===0||s.pressure&&s.pressureWidth!==false&&s.maxSize===0||s.pressure&&s.pressureOpacity&&s.maxOpacity===0)return;const timed=dryBristleDiagnostics.enabled,start=timed?performance.now():0,m=trajectory(s,samples),canvas=pass?.mask??(pooled??=document.createElement('canvas'));if(canvas.width!==ctx.canvas.width)canvas.width=ctx.canvas.width;if(canvas.height!==ctx.canvas.height)canvas.height=ctx.canvas.height;
 const state=maskState(canvas,m.key),from=pass?.from?samples.arc[pass.from-1]:-1,to=pass?samples.arc[Math.max(0,pass.to-1)]:samples.total,N=m.bristles.length,current=bounds(s,m,state.w,state.h,from,to,!!pass?.append,undefined,region),r=pass&&!pass.append&&state.previous?{x:Math.min(current.x,state.previous.x),y:Math.min(current.y,state.previous.y),width:Math.max(current.x+current.width,state.previous.x+state.previous.width)-Math.min(current.x,state.previous.x),height:Math.max(current.y+current.height,state.previous.y+state.previous.height)-Math.min(current.y,state.previous.y)}:current;if(!r.width||!r.height)return;if(!pass?.append)copyRegion(state,pass?.base?masks.get(pass.base):undefined,r);let painted=0;
 // Distance-anchored three-step spans preserve all 1px physical simulation.
 // Capsule mass is normalized for the longer raster interval. Passes only commit
 // complete spans, so a settled/live boundary never deposits a span twice.
 for(let k=3;k<m.rows.length+3;k+=3){let end=Math.min(k,m.rows.length-1);if(pass?.append&&end!==k)break;const q=m.rows[end];if(q.d<=from+1e-7||q.d>to+1e-7)continue;const first=Math.max(0,k-3);if(first>=end)continue;painted+=end-first;
  for(let i=0;i<N;i++){const b=m.bristles[i],base=(end*N+i)*4,previous=(first*N+i)*4;let alpha=0,width=0;for(let j=first+1;j<=end;j++){const idx=(j*N+i)*4,remain=samples.total-m.rows[j].d,lift=1-smooth(0,1,1-clamp(remain/b.span));alpha+=m.records[idx+2]*lift;width+=m.records[idx+3];}alpha/=end-first;width/=end-first;if(alpha<.012)continue;const radius=width*.5,factor=(2+Math.PI*radius)/(2+Math.PI*radius/(end-first));rasterBristle(state.density,state.w,state.h,m.records[previous],m.records[previous+1],m.records[base],m.records[base+1],radius,1-(1-alpha)**factor,r);
  }
 }
 if(from<0){const q=m.rows[0],nx=-q.ty,ny=q.tx;for(const b of m.bristles){const lat=b.offset*q.width*s.size*.5,x=q.x+nx*lat,y=q.y+ny*lat,depth=s.size*.075*(.3+.7*b.stiff),a=b.load*smooth(b.threshold-.06,b.threshold+.06,q.p)*(s.flow??1)*(s.pressure&&s.pressureFlow?q.p:1)*(s.pressure&&s.pressureOpacity?opacityResponse(q.p,s):1);rasterBristle(state.density,state.w,state.h,x-q.tx*depth,y-q.ty*depth,x+q.tx*depth,y+q.ty*depth,b.width*.5,a,r);}}
 if(!pass?.append){tails(s,m,state,r);state.previous=current;}else flushMask(canvas,state,r);const deposited=timed?performance.now():0;if(!pass?.append){if(pass)ctx.clearRect(r.x,r.y,r.width,r.height);finishDry(ctx,s,state.density,r);}if(timed)dryBristleDiagnostics.records.push({append:!!pass?.append,generatedSteps:m.generated,paintedSteps:painted,bristles:N,lightContacts:m.contacts.light,heavyContacts:m.contacts.heavy,depositionMs:deposited-start,toothMs:performance.now()-deposited,pixels:r.width*r.height});return r;
}
export {dryLiftSpan,dryRasterPadding};
