import {drawPigmentBrush} from './pigmentBrush';
import {colorContacts} from './coloringPath';
import {shadeTexturedColoring} from './texturedColoring';
import {coloringSoftTip} from './coloringSoftTip';
import type {Stroke,Point} from '../core/model';
import {defaultColorNib} from '../core/coloring';
import {watercolorSeedFor} from '../core/paintTips';
import {paintSamples,type PaintPass} from './paintPass';
import {pressureResponse,taperFactor,type strokeGeometry} from './strokeGeometry';
import {widthResponse,opacityResponse} from './pressureChannels';
import {paintHash} from './paintingTips';
import {colorNibFootprint,type NibPoint} from './colorNibs';
import type {RasterRegion} from './liveRaster';
let pooled:HTMLCanvasElement|undefined,small:HTMLCanvasElement|undefined,out:HTMLCanvasElement|undefined;
const littleEndian=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;
function fit(c:HTMLCanvasElement,w:number,h:number){if(c.width<w||c.height<h||c.width*c.height>w*h*4){c.width=Math.ceil(w/64)*64;c.height=Math.ceil(h/64)*64;}}
const clamp=(n:number)=>Math.max(0,Math.min(1,n)),ease=(n:number)=>{n=clamp(n);return n*n*(3-2*n);};
const cross=(a:NibPoint,b:NibPoint,c:NibPoint)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function hull(points:NibPoint[]){points.sort((a,b)=>a.x-b.x||a.y-b.y);const a:NibPoint[]=[],b:NibPoint[]=[];for(const p of points){while(a.length>1&&cross(a.at(-2)!,a.at(-1)!,p)<=0)a.pop();a.push(p);}for(let i=points.length-1;i>=0;i--){const p=points[i];while(b.length>1&&cross(b.at(-2)!,b.at(-1)!,p)<=0)b.pop();b.push(p);}a.pop();b.pop();return a.concat(b);}
type Contact={p:Point;r:number;level:number;co:number;si:number;arc:number;pressure:number};
/** Continuous physical nib sweeps. Coverage is max-composited in an opaque
 * grayscale mask; opacity therefore cannot accumulate at interpolation joins. */
export function drawColoring(ctx:CanvasRenderingContext2D,s:Stroke,g:ReturnType<typeof strokeGeometry>,region?:RasterRegion,pass?:PaintPass){
 // New Blender simulates pigment directly on the layer; its raw color mask is unused.
 if(s.coloringAppearanceVersion===3&&s.brushTip==='color-blender'&&s.tool!=='eraser')return;
 if(s.coloringAppearanceVersion===3){drawPigmentBrush(ctx,s,g,region,pass);return;}
 const samples=pass?.samples??paintSamples(g,.18),points=samples.points;if(!points.length||s.flow===0)return;
 const nib=s.colorNib??defaultColorNib(s.brushTip),newTexture=s.brushTip==='color-texture'&&s.coloringAppearanceVersion===2&&nib!=='rake',textured=s.brushTip==='color-texture'&&!newTexture,soft=s.brushTip==='color-soft',air=s.brushTip==='color-air',blend=s.brushTip==='color-blender',hard=newTexture?1:s.hardness??1,pad=s.size*.76+5;
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;for(const p of points){left=Math.min(left,p.x);top=Math.min(top,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
 const x=Math.max(0,Math.floor(Math.max(left-pad,region?.x??0))),y=Math.max(0,Math.floor(Math.max(top-pad,region?.y??0))),rx=Math.min(ctx.canvas.width,Math.ceil(Math.min(right+pad,region?region.x+region.width:ctx.canvas.width))),by=Math.min(ctx.canvas.height,Math.ceil(Math.min(bottom+pad,region?region.y+region.height:ctx.canvas.height))),w=rx-x,h=by-y;if(w<=0||h<=0)return;
 const mask=pass?.mask??(pooled??=document.createElement('canvas'));if(mask.width!==ctx.canvas.width)mask.width=ctx.canvas.width;if(mask.height!==ctx.canvas.height)mask.height=ctx.canvas.height;const mc=mask.getContext('2d')!;
 mc.save();mc.globalAlpha=1;mc.globalCompositeOperation='source-over';if(!pass?.append){mc.fillStyle='#000';if(!region)mc.fillRect(0,0,mask.width,mask.height);else mc.fillRect(x,y,w,h);if(pass?.base)mc.drawImage(pass.base,x,y,w,h,x,y,w,h);}mc.beginPath();mc.rect(x,y,w,h);mc.clip();mc.globalCompositeOperation='lighten';
 const angle=(s.tipAngle??0)*Math.PI/180,seed=s.colorSeed??watercolorSeedFor(s.rasterSourceId??s.id),shape=colorNibFootprint(nib),contacts=new Map<number,Contact>(),outlines=new Map<number,NibPoint[]>();
 const contact=(i:number)=>{let c=contacts.get(i);if(c)return c;const p=points[i],a=points[i?i-1:0],b=points[i||Math.min(1,points.length-1)],v=s.pressure?pressureResponse(p.p**s.response,s.pressureCurve):1,width=s.pressure&&s.pressureWidth!==false||s.velocityTaper?widthResponse(v*(s.velocityTaper?p.v??1:1),s):1,theta=angle+(s.colorNibFollow&&points.length>1?Math.atan2(b.y-a.y,b.x-a.x)+Math.PI/2:0),r=s.size*.5*width*taperFactor(samples.arc[i],samples.total,s.taperStart,s.taperEnd,Math.max(64,s.size*12)),level=newTexture?1:clamp((s.flow??1)*(s.pressure&&s.pressureFlow?v:1)*(s.pressure&&s.pressureOpacity?opacityResponse(v,s):1));c={p,r,level,co:Math.cos(theta),si:Math.sin(theta),arc:samples.arc[i],pressure:v};contacts.set(i,c);return c;};
 const map=(c:Contact,q:NibPoint)=>({x:c.p.x+(q.x*c.co-q.y*c.si)*c.r,y:c.p.y+(q.x*c.si+q.y*c.co)*c.r});
 const polygon=(a:NibPoint[],b:NibPoint[],ca:Contact,cb:Contact,la=ca.level,lb=cb.level)=>{if(Math.max(la,lb)<=0)return;const pts=hull([...a,...b]);if(pts.length<3)return;const av=Math.round(255*la),bv=Math.round(255*lb);if(av===bv||Math.hypot(cb.p.x-ca.p.x,cb.p.y-ca.p.y)<.001)mc.fillStyle=`rgb(${av} ${av} ${av})`;else{const grad=mc.createLinearGradient(ca.p.x,ca.p.y,cb.p.x,cb.p.y);grad.addColorStop(0,`rgb(${av} ${av} ${av})`);grad.addColorStop(1,`rgb(${bv} ${bv} ${bv})`);mc.fillStyle=grad;}mc.beginPath();mc.moveTo(pts[0].x,pts[0].y);for(let j=1;j<pts.length;j++)mc.lineTo(pts[j].x,pts[j].y);mc.closePath();mc.fill();};
 const outline=(i:number)=>{let p=outlines.get(i);if(!p){const c=contact(i);p=shape.map(q=>map(c,q));outlines.set(i,p);}return p;};
 const lanes=nib==='rake'?7:Math.max(28,Math.min(64,Math.round(s.size*.5))),texture=s.textureStrength??.65;
 const bristle=(c:Contact,lane:number)=>{
  const q=(lane+.5+(paintHash(seed+lane*11,97)-.5)*.8)/lanes*2-1;
  const variation=(key:number,length:number)=>{const packet=c.arc/length,k=Math.floor(packet),t=ease(packet-k);return paintHash(key,k)*(1-t)+paintHash(key,k+1)*t;};
  // Pigment packets travel with the bristle bundles. Shared tuft loading gives
  // broader paint patches while finer loading interrupts long parallel tracks.
  const tuft=variation(seed+Math.floor(lane/4)*173,Math.max(9,s.size*.28)),fine=variation(seed+lane*43,Math.max(2.5,Math.min(9,s.size*.085))),load=tuft*.42+fine*.58;
  const speed=c.p.v??.65,dry=clamp(texture+(.65-speed)*.35),half=(nib==='rake'?.46:nib==='flat'?1.65:1.12+(.6-dry)*.45+c.pressure*.4)/lanes*(.2+load*1.45)*(.7+paintHash(seed+lane*17,113)*.6),rim=nib==='filbert'?Math.sqrt(Math.max(.02,1-q*q)):1,offset=nib==='fan'?Math.sqrt(Math.max(0,1-q*q))*.6-.12:0,depth=(nib==='fan'?.17:.28)*rim*(.65+paintHash(seed+lane*7,151)*.7);
  const flex=q+(fine-.5)*(nib==='rake'?.65:2.2)/lanes,pts=[{x:flex-half,y:offset-depth},{x:flex+half,y:offset-depth},{x:flex+half*(nib==='fan'?1.6:1),y:offset+depth},{x:flex-half*(nib==='fan'?1.6:1),y:offset+depth}].map(p=>map(c,p));return {pts,level:c.level*(.3+.7*load)*ease((load-dry*.26)/.28)};
 };
 const stamped=soft||air||blend||!textured&&hard<.999,step=Math.max(.25,s.size*.035);
 const stamp=(a:Contact,b:Contact,t:number)=>{const r=a.r+(b.r-a.r)*t,level=a.level+(b.level-a.level)*t;if(r<.001||level<=0)return;const theta=Math.atan2(a.si,a.co),other=Math.atan2(b.si,b.co);let delta=other-theta;while(delta>Math.PI/2)delta-=Math.PI;while(delta< -Math.PI/2)delta+=Math.PI;const tip=coloringSoftTip(nib,s.brushTip!,hard,level);mc.save();mc.translate(a.p.x+(b.p.x-a.p.x)*t,a.p.y+(b.p.y-a.p.y)*t);mc.rotate(theta+delta*t);mc.drawImage(tip,-r,-r,r*2,r*2);mc.restore();};
 const segment=(ai:number,bi:number)=>{const a=contact(ai),b=contact(bi);if(Math.max(a.p.x,b.p.x)+pad<x||Math.min(a.p.x,b.p.x)-pad>rx||Math.max(a.p.y,b.p.y)+pad<y||Math.min(a.p.y,b.p.y)-pad>by)return;if(stamped){const length=b.arc-a.arc;if(length<1e-7){stamp(a,a,0);return;}for(let d=Math.ceil((a.arc-1e-7)/step)*step;d<=b.arc+1e-7;d+=step)stamp(a,b,Math.max(0,Math.min(1,(d-a.arc)/length)));}else polygon(outline(ai),outline(bi),a,b);};
 const from=pass?.from??0,to=pass?.to??points.length;
 if(newTexture){
  // Sweep distance-anchored contacts. Pointer-event subdivision must not add
  // extra antialiased polygon edges to the same physical brush envelope.
  const {rows,step:cell}=colorContacts(s,samples),at=(index:number):Contact=>{const row=rows[Math.min(rows.length-1,index)],theta=angle+(s.colorNibFollow?Math.atan2(row.ty,row.tx)+Math.PI/2:0);return {p:{x:row.x,y:row.y,p:row.pressure,v:row.velocity},r:row.radius,level:1,co:Math.cos(theta),si:Math.sin(theta),arc:row.arc,pressure:row.pressure};},sweep=(a:Contact,b:Contact)=>polygon(shape.map(q=>map(a,q)),shape.map(q=>map(b,q)),a,b);
  const start=from?samples.arc[from-1]:0,end=samples.arc[Math.max(0,to-1)];if(!from)sweep(at(0),at(0));for(let n=Math.floor((start+1e-7)/cell)+1;n*cell<=end+1e-7;n++)sweep(at(n-1),at(n));if(!pass?.append&&to===points.length&&samples.total-Math.floor((samples.total+1e-7)/cell)*cell>1e-7)sweep(at(Math.floor(samples.total/cell)),at(rows.length-1));
 }else if(textured){
  // Distance-anchored cells are independent of pointer-event density. Only
  // complete cells enter settled coverage; the moving partial cell stays live.
  const cell=Math.max(.7,Math.min(12,s.size*.08)),gridContacts=new Map<number,Contact>();
  const pointAt=(d:number)=>{let lo=0,hi=points.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(samples.arc[mid]<d)lo=mid+1;else hi=mid;}const i=Math.max(1,lo),a=points[Math.min(points.length-1,i-1)],b=points[Math.min(points.length-1,i)],start=samples.arc[Math.min(points.length-1,i-1)],span=(samples.arc[Math.min(points.length-1,i)]??0)-start,t=span?Math.max(0,Math.min(1,(d-start)/span)):0;return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,p:a.p+(b.p-a.p)*t,v:(a.v??.65)+((b.v??.65)-(a.v??.65))*t};};
  const at=(d:number)=>{let c=gridContacts.get(d);if(c)return c;const p=pointAt(d),back=pointAt(Math.max(0,d-cell*.5)),head=d? p:points[Math.min(1,points.length-1)],tail=d?back:p,theta=angle+(s.colorNibFollow&&points.length>1?Math.atan2(head.y-tail.y,head.x-tail.x)+Math.PI/2:0),v=s.pressure?pressureResponse(p.p**s.response,s.pressureCurve):1,width=s.pressure&&s.pressureWidth!==false||s.velocityTaper?widthResponse(v*(s.velocityTaper?p.v??1:1),s):1;c={p,arc:d,pressure:v,co:Math.cos(theta),si:Math.sin(theta),r:s.size*.5*width*taperFactor(d,samples.total,s.taperStart,s.taperEnd,Math.max(64,s.size*12)),level:clamp((s.flow??1)*(s.pressure&&s.pressureFlow?v:1)*(s.pressure&&s.pressureOpacity?opacityResponse(v,s):1))};gridContacts.set(d,c);return c;};
  const gridHair=new Map<number,{pts:NibPoint[];level:number}[]>(),hairAt=(c:Contact,lane:number)=>{let row=gridHair.get(c.arc);if(!row){row=[];gridHair.set(c.arc,row);}return row[lane]??(row[lane]=bristle(c,lane));};
  const sweep=(a:Contact,b:Contact)=>{if(Math.max(a.p.x,b.p.x)+pad<x||Math.min(a.p.x,b.p.x)-pad>rx||Math.max(a.p.y,b.p.y)+pad<y||Math.min(a.p.y,b.p.y)-pad>by)return;const base=(nib==='flat'?.3:.1)*(1-texture);if(base>0)polygon(shape.map(q=>map(a,q)),shape.map(q=>map(b,q)),a,b,a.level*base,b.level*base);const buckets=new Map<number,Path2D>();for(let lane=0;lane<lanes;lane++){const aa=hairAt(a,lane),bb=hairAt(b,lane);if(nib==='rake'){polygon(aa.pts,bb.pts,a,b,aa.level,bb.level);continue;}const level=Math.round((aa.level+bb.level)*32);if(!level)continue;let path=buckets.get(level);if(!path){path=new Path2D();buckets.set(level,path);}const pts=hull([...aa.pts,...bb.pts]);if(pts.length<3)continue;path.moveTo(pts[0].x,pts[0].y);for(let j=1;j<pts.length;j++)path.lineTo(pts[j].x,pts[j].y);path.closePath();}for(const level of [...buckets.keys()].sort((a,b)=>a-b)){const gray=Math.round(level*255/64);mc.fillStyle=`rgb(${gray} ${gray} ${gray})`;mc.fill(buckets.get(level)!);}};
  const start=from?samples.arc[from-1]:0,end=samples.arc[Math.max(0,to-1)];if(!from)sweep(at(0),at(0));for(let n=Math.floor((start+1e-7)/cell)+1;n*cell<=end+1e-7;n++)sweep(at((n-1)*cell),at(n*cell));if(!pass?.append&&to===points.length&&samples.total-Math.floor((samples.total+1e-7)/cell)*cell>1e-7)sweep(at(Math.floor(samples.total/cell)*cell),at(samples.total));
 }else{if(!from)segment(0,0);for(let i=Math.max(1,from);i<to;i++)segment(i-1,i);if(stamped&&!pass?.append&&to===points.length)stamp(contact(points.length-1),contact(points.length-1),0);}
 mc.restore();if(pass?.append)return;
 const scale=(stamped||newTexture)&&s.size>=128?2:1,halo=newTexture?Math.ceil(Math.min(7,s.size*.045)+5):scale*3,sx=Math.max(0,Math.floor((x-halo)/scale)*scale),sy=Math.max(0,Math.floor((y-halo)/scale)*scale),ex=Math.ceil(Math.min(mask.width,rx+halo)/scale)*scale,ey=Math.ceil(Math.min(mask.height,by+halo)/scale)*scale,cw=(ex-sx)/scale,ch=(ey-sy)/scale;
 const c=small??=document.createElement('canvas');fit(c,cw,ch);const cc=c.getContext('2d',{willReadFrequently:true})!;cc.clearRect(0,0,cw,ch);cc.drawImage(mask,0,0,mask.width,mask.height,-sx/scale,-sy/scale,mask.width/scale,mask.height/scale);const image=cc.getImageData(0,0,cw,ch),data=image.data,rgb=s.color.slice(1).match(/../g)!.map(v=>parseInt(v,16));
 if(newTexture)shadeTexturedColoring(s,samples,image,sx,sy,scale);else if(littleEndian){const packed=new Uint32Array(data.buffer,data.byteOffset,data.length/4),color=rgb[0]|rgb[1]<<8|rgb[2]<<16;for(let i=0;i<packed.length;i++)packed[i]=data[i*4]<<24|color;}else for(let i=0;i<data.length;i+=4){const a=data[i];data[i]=rgb[0];data[i+1]=rgb[1];data[i+2]=rgb[2];data[i+3]=a;}
 const output=out??=document.createElement('canvas');fit(output,cw,ch);const oc=output.getContext('2d')!;
 // Canvas interpolation can sample just outside a source crop. Bucket-sized
 // buffers must keep that padding transparent instead of reusing old pixels.
 oc.clearRect(cw,0,2,ch+2);oc.clearRect(0,ch,cw+2,2);oc.putImageData(image,0,0);ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(output,0,0,cw,ch,sx,sy,cw*scale,ch*scale);ctx.restore();
}
