import type {Stroke,Point} from '../core/model';
import {watercolorSeedFor} from '../core/paintTips';
import type {PaintSamples} from './paintPass';
import {pressureResponse} from './strokeGeometry';
import {widthResponse,opacityResponse} from './pressureChannels';
import {paintHash} from './paintingTips';
import {watercolorAppearance,type WaterAppearance} from './watercolorAppearance';
export type WaterKind='smooth'|'rough'|'wet'|'flat'|'gradient';
export const waterKind=(s:Pick<Stroke,'brushTip'>):WaterKind=>s.brushTip?.slice(6) as WaterKind;
const profiles={smooth:{bands:16,variation:.17,packet:30,mix:.48,drag:.10},rough:{bands:28,variation:.65,packet:10,mix:.08,drag:.5},wet:{bands:10,variation:.9,packet:55,mix:.5,drag:.2},flat:{bands:20,variation:.3,packet:20,mix:.24,drag:.22},gradient:{bands:20,variation:.34,packet:17,mix:.28,drag:.14}};
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const waterEase=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
export type Contact={p:Point;arc:number;pressure:number;radius:number;speed:number};
export function contact(s:Stroke,p:Point,arc:number):Contact{const pressure=s.pressure?pressureResponse(Math.pow(p.p,s.response),s.pressureCurve):1,width=s.pressure&&s.pressureWidth!==false||s.velocityTaper?widthResponse(pressure*(s.velocityTaper?p.v??1:1),s):1;return {p,arc,pressure,radius:s.size*.5*width*(s.watercolorShape==='liner'?.2:1),speed:p.v??.65};}
/** A causal pigment reservoir carried by a row of bristle lanes. Targets are
 * keyed to travelled-distance packets, not canvas XY or dab/frame number.
 * Neighbor exchange approximates water mixing between bristles. */
export function transportPigment(s:Stroke,samples:PaintSamples){
 const kind=waterKind(s),profile=profiles[kind],bands=profile.bands,step=Math.max(1.5,Math.min(5,s.size*.04)),count=Math.max(2,Math.ceil(samples.total/step)+1),mass=new Float32Array(count*bands),water=new Float32Array(count),drift=new Float32Array(count),pressure=new Float32Array(count),radii=new Float32Array(count),speed=new Float32Array(count),xs=new Float32Array(count),ys=new Float32Array(count),txs=new Float32Array(count),tys=new Float32Array(count);
 const seed=s.watercolorSeed??watercolorSeedFor(s.id),seedX=seed&65535,seedY=seed>>>16,state=Float32Array.from({length:bands},(_,b)=>1+(paintHash(seedX+b*7,seedY)-.5)*profile.variation),next=new Float32Array(bands),packet=Math.max(4,profile.packet*Math.sqrt(s.size/75));
 let segment=1,reservoir=s.pigmentAmount??.76,previousDistance=0,side=0;
 for(let i=0;i<count;i++){
  const distance=Math.min(samples.total,i*step),travel=distance-previousDistance;previousDistance=distance;
  while(segment<samples.points.length-1&&samples.arc[segment]<distance)segment++;
  const a=samples.points[Math.max(0,segment-1)]??samples.points[0],b=samples.points[segment]??a,span=(samples.arc[segment]??0)-(samples.arc[segment-1]??0),t=span?clamp((distance-(samples.arc[segment-1]??0))/span):0,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,p:a.p+(b.p-a.p)*t,v:(a.v??.65)+((b.v??.65)-(a.v??.65))*t},c=contact(s,p,distance),wet=clamp((s.waterAmount??.4)+(.65-c.speed)*.12);
  const depletion=s.pigmentDepletion??(kind==='gradient'?.85:0);reservoir*=Math.exp(-travel*depletion*.0045*Math.max(.8,60/s.size));
  if(s.pigmentReload&&depletion>0)reservoir+=((s.pigmentAmount??.76)-reservoir)*(1-Math.exp(-travel/Math.max(24,s.size*1.4)));
  water[i]=wet;pressure[i]=c.pressure;radii[i]=c.radius;speed[i]=c.speed;xs[i]=p.x;ys[i]=p.y;const length=Math.hypot(b.x-a.x,b.y-a.y)||1;txs[i]=(b.x-a.x)/length||1;tys[i]=(b.y-a.y)/length;
  const packetIndex=Math.floor(distance/packet),fraction=waterEase(0,1,distance/packet-packetIndex),exchange=profile.mix*wet*.32,relax=1-Math.exp(-travel/Math.max(3,packet*.32));
  for(let lane=0;lane<bands;lane++){
   const from=paintHash(seedX+lane*13,seedY+packetIndex*23),to=paintHash(seedX+lane*13,seedY+(packetIndex+1)*23),target=1+((from+(to-from)*fraction)-.5)*profile.variation*2;
   const neighbors=(state[Math.max(0,lane-1)]+state[Math.min(bands-1,lane+1)])*.5;
   next[lane]=(state[lane]+(target-state[lane])*relax)*(1-exchange)+neighbors*exchange;
   mass[i*bands+lane]=Math.max(.01,reservoir)*next[lane];
  }
  state.set(next);side+=( (paintHash(seedX+41,seedY+packetIndex*5)-.5)-side)*Math.min(1,travel/Math.max(12,packet));drift[i]=side;
 }
 return {kind,profile,bands,step,count,mass,water,drift,pressure,radii,speed,xs,ys,txs,tys};
}
type Segment={order:number;a:Point;b:Point;dx:number;dy:number;l:number;arc:number;span:number;curvature:number};
type SegmentTree={left:number;top:number;right:number;bottom:number;items?:Segment[];a?:SegmentTree;b?:SegmentTree};
type Nearest={best:number;next:number;q:Segment;second?:Segment;t:number;t2:number};
function segmentTree(items:Segment[]):SegmentTree{let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;for(const q of items){left=Math.min(left,q.a.x,q.b.x);top=Math.min(top,q.a.y,q.b.y);right=Math.max(right,q.a.x,q.b.x);bottom=Math.max(bottom,q.a.y,q.b.y);}const tree:SegmentTree={left,top,right,bottom};if(items.length<=4)tree.items=items;else{const horizontal=right-left>=bottom-top,sorted=items.slice().sort((a,b)=>horizontal?(a.a.x+a.b.x)-(b.a.x+b.b.x)||a.order-b.order:(a.a.y+a.b.y)-(b.a.y+b.b.y)||a.order-b.order),mid=sorted.length>>1;tree.a=segmentTree(sorted.slice(0,mid));tree.b=segmentTree(sorted.slice(mid));}return tree;}
function treeDistance(tree:SegmentTree,x:number,y:number){const dx=Math.max(tree.left-x,0,x-tree.right),dy=Math.max(tree.top-y,0,y-tree.bottom);return dx*dx+dy*dy;}
function queryTree(tree:SegmentTree,x:number,y:number,near:Nearest){if(treeDistance(tree,x,y)>near.next+1e-7)return;if(tree.items){for(const q of tree.items){const t=clamp(((x-q.a.x)*q.dx+(y-q.a.y)*q.dy)/(q.l*q.l)),dx=x-q.a.x-q.dx*t,dy=y-q.a.y-q.dy*t,d=dx*dx+dy*dy;if(d<near.best||d===near.best&&q.order<near.q.order){near.second=near.q;near.next=near.best;near.t2=near.t;near.best=d;near.q=q;near.t=t;}else if(d<near.next||d===near.next&&q.order<(near.second?.order??Infinity)){near.second=q;near.next=d;near.t2=t;}}return;}const a=tree.a!,b=tree.b!;if(treeDistance(a,x,y)<=treeDistance(b,x,y)){queryTree(a,x,y,near);queryTree(b,x,y,near);}else{queryTree(b,x,y,near);queryTree(a,x,y,near);}}
export type Deposit={along?:number;across?:number;paintPigment?:number;paintGrain?:number;radius:number;density:number;water:number;grain:number;dx:number;dy:number;edge:number};
/** Project only occupied pixels onto nearby continuous path segments. Values
 * come from transported bristle mass; fixed paper is applied separately. */
export function depositionField(s:Stroke,samples:PaintSamples){
 const transport=transportPigment(s,samples),segments:Segment[]=[],bins=new Map<number,Segment[]>(),bin=Math.max(24,s.size),padding=s.size*.8+12;
 let prior=0;const spacing=Math.max(1.5,s.size*.07);
 for(let i=1;i<samples.points.length;i++){const a=samples.points[prior],b=samples.points[i];if(i<samples.points.length-1&&Math.hypot(b.x-a.x,b.y-a.y)<spacing&&Math.abs(a.p-b.p)<.06&&Math.abs((a.v??.65)-(b.v??.65))<.06)continue;const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);if(l<.0001)continue;const prev=segments.at(-1),curvature=prev?clamp(1-(prev.dx*dx+prev.dy*dy)/(prev.l*l)):0,q={order:segments.length,a,b,dx,dy,l,arc:samples.arc[prior],span:samples.arc[i]-samples.arc[prior],curvature};prior=i;segments.push(q);
  for(let y=Math.floor((Math.min(a.y,b.y)-padding)/bin);y<=Math.floor((Math.max(a.y,b.y)+padding)/bin);y++)for(let x=Math.floor((Math.min(a.x,b.x)-padding)/bin);x<=Math.floor((Math.max(a.x,b.x)+padding)/bin);x++){const key=y*1048576+x,list=bins.get(key);if(list)list.push(q);else bins.set(key,[q]);}
 }
 if(!segments.length){const a=samples.points[0],angle=(s.tipAngle??0)*Math.PI/180;segments.push({order:0,a,b:a,dx:Math.cos(angle),dy:Math.sin(angle),l:1,arc:0,span:0,curvature:0});}
 const sampleLane=(row:number,lane:number)=>{const b=clamp(lane,0,transport.bands-1),j=Math.floor(b),u=b-j;return transport.mass[row*transport.bands+j]*(1-u)+transport.mass[row*transport.bands+Math.min(transport.bands-1,j+1)]*u;};
 const evaluate=(q:Segment,t:number,x:number,y:number,out:Deposit)=>{
  const tx=q.dx/q.l,ty=q.dy/q.l,cx=q.a.x+q.dx*t,cy=q.a.y+q.dy*t,along=clamp((q.arc+t*q.span)/transport.step,0,transport.count-1),row=Math.floor(along),next=Math.min(transport.count-1,row+1),u=along-row;
  const lerp=(values:Float32Array)=>values[row]*(1-u)+values[next]*u,radius=Math.max(1,lerp(transport.radii)),cross=(-(x-cx)*ty+(y-cy)*tx)/radius,drift=lerp(transport.drift),lane=(cross*.5+.5+drift*.08)*transport.bands-.5;
  const load=sampleLane(row,lane)*(1-u)+sampleLane(next,lane)*u,pressure=lerp(transport.pressure),velocity=lerp(transport.speed),water=lerp(transport.water),flow=(s.flow??.65)*(s.pressure&&s.pressureFlow?pressure:1)*(s.pressure&&s.pressureOpacity?opacityResponse(pressure,s):1),drag=1+(velocity-.65)*transport.profile.drag;
  const concentration=load*flow*2.6*(.85+.3*(s.pigmentBuildup??.45))/(.65+water*.7),density=(1-Math.exp(-concentration))*drag;
  // Bristle mass differences make the rough brush break along travel. Smaller
  // packet-scale granules come from this stroke's seed and bristle coordinates.
  const seed=s.watercolorSeed??watercolorSeedFor(s.id),grain=paintHash((seed&65535)+Math.floor((q.arc+t*q.span+(x-cx)*tx+(y-cy)*ty)/2.7), (seed>>>16)+Math.floor((cross+2)*s.size*.22));
  if(s.watercolorAppearanceVersion===1){out.along=q.arc+t*q.span+(x-cx)*tx+(y-cy)*ty;out.across=-(x-cx)*ty+(y-cy)*tx;}
  out.radius=radius;out.density=clamp(density*(.95+grain*.1)*(1+q.curvature*.08*(s.pigmentBuildup??.5)),0,1);out.water=water;out.grain=clamp(.55*(load/Math.max(.05,s.pigmentAmount??.76)-.6)+grain*.45-(.65-velocity)*(s.dryness??0)*.45-(1-pressure)*(s.dryness??0)*.15);
  const bleed=(s.edgeBleeding??.45)*(s.wetDiffusion??.5)*water,displace=(s.watercolorShape?radius*2:s.size)*(transport.kind==='wet'?.32*bleed:.012)*(drift*(transport.kind==='wet'?3:1.6)+(out.grain-.5)*.45);
  out.dx=-ty*displace;out.dy=tx*displace;out.edge=clamp(pressure*.5+velocity*.3+out.grain*.2);return out;
 };
 // New appearance blends the mass of all nearby contacts, including dry
 // styles. Nearest-centerline selection can jump between weak and broad
 // contacts on tight pressure curves and print hard pigment boundaries.
 // A normalized compact kernel carries mass without additive dab alpha.
 // Historical wet strokes retain their original kernel and channel format.
 const fastWet=transport.kind==='wet'&&!!s.watercolorShape||s.watercolorAppearanceVersion===1,wetAppearance=fastWet&&s.watercolorAppearanceVersion===1?watercolorAppearance(s):undefined,roughAppearance=!!wetAppearance&&transport.kind==='rough',channels=fastWet?(wetAppearance?(roughAppearance?13:12):11):5,grid=wetAppearance&&s.watercolorShape!=='liner'&&s.size>=128?(s.size>=192?10:8):s.size>=64?6:s.size>=24?3:1,radiusFactor=wetAppearance&&transport.kind!=='wet'?1.25:1.5;let gx0=0,gy0=0,columns=0,wetNodes:Float32Array|undefined;
 const carried:Deposit={radius:0,density:0,water:0,grain:0,dx:0,dy:0,edge:0},material:WaterAppearance={pigment:1,grain:.5,edge:0,pool:0};
 const materialBands=Math.max(12,Math.min(32,Math.ceil(s.size/4)));let wetMaterial:Float32Array|undefined,materialRows:Uint8Array|undefined;
 const prepare=(x:number,y:number,w:number,h:number)=>{
  if(transport.kind!=='wet'&&!wetAppearance)return;gx0=Math.floor(x/grid);gy0=Math.floor(y/grid);columns=Math.ceil((x+w)/grid)-gx0+2;const rows=Math.ceil((y+h)/grid)-gy0+2;wetNodes=new Float32Array(columns*rows*channels);
  const materialChannels=roughAppearance?2:1;
  if(wetAppearance&&!wetMaterial){wetMaterial=new Float32Array(transport.count*materialBands*materialChannels);materialRows=new Uint8Array(transport.count);}
  const stride=Math.max(1,Math.floor(s.size*.08/transport.step));
  for(let i=0;i<transport.count&&i*transport.step<=samples.total+1e-7;i+=stride){
   const radius=Math.max(1,transport.radii[i])*radiusFactor,cx=transport.xs[i],cy=transport.ys[i],tx=transport.txs[i],ty=transport.tys[i];
   const minX=Math.max(gx0,Math.floor((cx-radius)/grid)),maxX=Math.min(gx0+columns-1,Math.ceil((cx+radius)/grid)),minY=Math.max(gy0,Math.floor((cy-radius)/grid)),maxY=Math.min(gy0+rows-1,Math.ceil((cy+radius)/grid));
   if(minX>maxX||minY>maxY)continue;
   // Live painting shades a cropped tail. Build carried material only for the
   // sampled contacts that can touch that tail, rather than the entire stroke.
   if(wetAppearance&&!materialRows![i]){for(let lane=0;lane<materialBands;lane++){carried.along=Math.min(samples.total,i*transport.step);carried.across=(lane/(materialBands-1)*2-1)*Math.max(1,transport.radii[i])*radiusFactor;wetAppearance(carried,material);const k=(i*materialBands+lane)*materialChannels;wetMaterial![k]=material.pigment;if(roughAppearance)wetMaterial![k+1]=material.grain;}materialRows![i]=1;}
   const flow=(s.flow??.65)*(s.pressure&&s.pressureFlow?transport.pressure[i]:1)*(s.pressure&&s.pressureOpacity?opacityResponse(transport.pressure[i],s):1),buildup=.85+.3*(s.pigmentBuildup??.45),denominator=.65+transport.water[i]*.7,drag=1+(transport.speed[i]-.65)*transport.profile.drag,densityFor=(load:number)=>(1-Math.exp(-(load*flow*2.6*buildup/denominator)))*drag,firstLoad=transport.mass[i*transport.bands],lastLoad=transport.mass[i*transport.bands+transport.bands-1],firstDensity=densityFor(firstLoad),lastDensity=densityFor(lastLoad);let previousLoad=NaN,previousDensity=0;
   for(let gy=minY;gy<=maxY;gy++)for(let gx=minX;gx<=maxX;gx++){
    const dx=gx*grid-cx,dy=gy*grid-cy,nx=(dx*tx+dy*ty)/radius,ny=(-dx*ty+dy*tx)/radius,r2=nx*nx+ny*ny;if(r2>=1)continue;
    const weight=(1-r2)**2,cross=(-dx*ty+dy*tx)/Math.max(1,transport.radii[i]),lane=(cross*.5+.5+transport.drift[i]*.08)*transport.bands-.5,load=sampleLane(i,lane),density=load===firstLoad?firstDensity:load===lastLoad?lastDensity:load===previousLoad?previousDensity:densityFor(load),k=((gy-gy0)*columns+gx-gx0)*channels;
    previousLoad=load;previousDensity=density;wetNodes![k]+=weight;wetNodes![k+1]+=weight*density;wetNodes![k+2]+=weight*transport.water[i];wetNodes![k+3]+=weight*transport.drift[i];wetNodes![k+4]+=weight*(load/Math.max(.05,s.pigmentAmount??.76));if(fastWet){wetNodes![k+5]+=weight*transport.radii[i];wetNodes![k+6]+=weight*tx;wetNodes![k+7]+=weight*ty;wetNodes![k+8]+=weight*cx;wetNodes![k+9]+=weight*cy;wetNodes![k+10]+=weight*Math.min(samples.total,i*transport.step);}
    // Mix deposited pigment values, not averaged texture coordinates. Opposing
    // wet contacts can cancel their tangents; normalizing that direction and
    // sampling it as one stroke would create horizontal striations in fills.
    if(wetMaterial){const position=clamp((ny*.5+.5)*(materialBands-1),0,materialBands-1),lane=Math.floor(position),u=position-lane,a=(i*materialBands+lane)*materialChannels,b=(i*materialBands+Math.min(materialBands-1,lane+1))*materialChannels;wetNodes![k+11]+=weight*(wetMaterial[a]*(1-u)+wetMaterial[b]*u);if(roughAppearance)wetNodes![k+12]+=weight*(wetMaterial[a+1]*(1-u)+wetMaterial[b+1]*u);}
   }
  }
  if(fastWet)for(let i=0;i<wetNodes.length;i+=channels){const weight=wetNodes[i];if(weight>1e-6)for(let j=1;j<channels;j++)wetNodes[i+j]/=weight;}
 };
 const wetValues=new Float64Array(fastWet?channels-1:10);
 const fastWetSample=(x:number,y:number,out:Deposit)=>{
  if(!wetNodes)return false;const fx=x/grid-gx0,fy=y/grid-gy0,ix=Math.floor(fx),iy=Math.floor(fy),u=fx-ix,v=fy-iy;wetValues.fill(0);let valid=0;
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const k=((iy+dy)*columns+ix+dx)*channels;if(wetNodes[k]<=1e-6)continue;const blend=(dx?u:1-u)*(dy?v:1-v);valid+=blend;for(let j=0;j<wetValues.length;j++)wetValues[j]+=wetNodes[k+j+1]*blend;}
  if(valid<.999)return false;const radius=Math.max(1,wetValues[4]),norm=Math.hypot(wetValues[5],wetValues[6])||1,tx=wetValues[5]/norm,ty=wetValues[6]/norm,dx=x-wetValues[7],dy=y-wetValues[8],along=wetValues[9]+dx*tx+dy*ty,cross=(-dx*ty+dy*tx)/radius,seed=s.watercolorSeed??watercolorSeedFor(s.id),grain=paintHash((seed&65535)+Math.floor(along/2.7),(seed>>>16)+Math.floor((cross+2)*s.size*.22));
  if(s.watercolorAppearanceVersion===1){out.along=along;out.across=-dx*ty+dy*tx;}
  if(wetAppearance){out.paintPigment=wetValues[10];if(roughAppearance)out.paintGrain=wetValues[11];}
  out.radius=radius;out.density=wetValues[0];out.water=wetValues[1];out.grain=clamp((.55*(wetValues[3]-.6)+grain*.45)*.25+(.45+(wetValues[3]-1)*.6)*.75);out.edge=clamp(.5+(wetValues[3]-1)*4+wetValues[2]*.3);const bleed=(s.edgeBleeding??.45)*(s.wetDiffusion??.5)*out.water,displace=Math.min(s.size,radius*2)*.32*bleed*(wetValues[2]*3+(out.grain-.5)*.45);out.dx=-ty*displace;out.dy=tx*displace;return true;
 };
 const wetSample=(x:number,y:number,out:Deposit)=>{
  if(!wetNodes)return out;const fx=x/grid-gx0,fy=y/grid-gy0,ix=Math.floor(fx),iy=Math.floor(fy),u=fx-ix,v=fy-iy;
  const sums=[0,0,0,0];let valid=0;
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const k=((iy+dy)*columns+ix+dx)*channels,weight=wetNodes[k];if(weight<=.000001)continue;const blend=(dx?u:1-u)*(dy?v:1-v);valid+=blend;for(let j=0;j<4;j++)sums[j]+=wetNodes[k+j+1]/weight*blend;}
  if(valid>.99){out.density=sums[0];out.water=sums[1];out.grain=clamp(out.grain*.25+(.45+(sums[3]-1)*.6)*.75);out.edge=clamp(.5+(sums[3]-1)*4+sums[2]*.3);}
  return out;
 };
 const other:Deposit={radius:0,density:0,water:0,grain:0,dx:0,dy:0,edge:0},trees=new Map<number,SegmentTree>(),near:Nearest={best:Infinity,next:Infinity,q:segments[0],t:0,t2:0};
 return {transport,prepare,sample(x:number,y:number,out:Deposit){
  if(fastWet&&fastWetSample(x,y,out))return out;
  if(wetAppearance){delete out.paintPigment;delete out.paintGrain;}
  const key=Math.floor(y/bin)*1048576+Math.floor(x/bin),list=bins.get(key)??segments;let best=Infinity,next=Infinity,q=segments[0],second:Segment|undefined,t=0,t2=0;
  if(list.length>12){let tree=trees.get(key);if(!tree){tree=segmentTree(list);trees.set(key,tree);}near.best=near.next=Infinity;near.q=segments[0];near.second=undefined;near.t=near.t2=0;queryTree(tree,x,y,near);best=near.best;next=near.next;q=near.q;second=near.second;t=near.t;t2=near.t2;}else for(const candidate of list){const v=clamp(((x-candidate.a.x)*candidate.dx+(y-candidate.a.y)*candidate.dy)/(candidate.l*candidate.l)),dx=x-candidate.a.x-candidate.dx*v,dy=y-candidate.a.y-candidate.dy*v,d=dx*dx+dy*dy;if(d<best){second=q;next=best;t2=t;best=d;q=candidate;t=v;}else if(d<next){second=candidate;next=d;t2=v;}}
  evaluate(q,t,x,y,out);
  if(second&&Math.abs(second.arc-q.arc)>s.size*.4&&next-best<(s.size*.28)**2){evaluate(second,t2,x,y,other);const weight=.5*(1-waterEase(0,(s.size*.28)**2,next-best));for(const key of ['radius','density','water','grain','dx','dy','edge'] as const)out[key]+=(other[key]-out[key])*weight;}
  return fastWet?out:wetSample(x,y,out);
 }};
}
