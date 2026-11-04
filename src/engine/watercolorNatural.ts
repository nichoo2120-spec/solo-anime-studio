import {watercolorAppearance,watercolorGranulation,type WaterAppearance} from './watercolorAppearance';
import {watercolorFootprint} from './watercolorShapes';
import type {Stroke,Point} from '../core/model';
import {paintSamples,type PaintPass} from './paintPass';
import {taperFactor,type strokeGeometry} from './strokeGeometry';
import type {RasterRegion} from './liveRaster';
import {contact,depositionField,waterKind,waterEase,type Deposit} from './watercolorTransport';
import {finishNewWaterPaper} from './watercolorPaperSurface';
type XY={x:number;y:number};let pooled:HTMLCanvasElement|undefined,down:HTMLCanvasElement|undefined,output:HTMLCanvasElement|undefined;
let coverageStorage=new Uint8Array(0),distanceStorage=new Float32Array(0);
function shaderArrays(count:number){if(count>4194304)return {coverage:new Uint8Array(count),distance:new Float32Array(count)};if(coverageStorage.length<count){const capacity=Math.ceil(count/16384)*16384;coverageStorage=new Uint8Array(capacity);distanceStorage=new Float32Array(capacity);}return {coverage:coverageStorage.subarray(0,count),distance:distanceStorage.subarray(0,count)};}
function shaderCanvas(canvas:HTMLCanvasElement,w:number,h:number){if(canvas.width<w||canvas.height<h||canvas.width*canvas.height>w*h*4){canvas.width=Math.ceil(w/64)*64;canvas.height=Math.ceil(h/64)*64;}}

const cross=(a:XY,b:XY,c:XY)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function hull(points:XY[]){points.sort((a,b)=>a.x-b.x||a.y-b.y);const a:XY[]=[],b:XY[]=[];for(const p of points){while(a.length>1&&cross(a.at(-2)!,a.at(-1)!,p)<=0)a.pop();a.push(p);}for(let i=points.length-1;i>=0;i--){const p=points[i];while(b.length>1&&cross(b.at(-2)!,b.at(-1)!,p)<=0)b.pop();b.push(p);}a.pop();b.pop();return a.concat(b);}
const round=Array.from({length:32},(_,i)=>({x:Math.cos(i*Math.PI/16),y:Math.sin(i*Math.PI/16)})),flat=[{x:-.22,y:-.94},{x:-.17,y:-1},{x:.17,y:-1},{x:.22,y:-.94},{x:.22,y:.94},{x:.17,y:1},{x:-.17,y:1},{x:-.22,y:.94}];
/** Continuous swept contact and transported pigment are separate. The contact
 * buffer is max coverage, so overlapping interpolation segments cannot print
 * dark stamp rings. This renderer does not call any retired water finish. */
export function drawNaturalWatercolor(ctx:CanvasRenderingContext2D,s:Stroke,g:ReturnType<typeof strokeGeometry>,region?:RasterRegion,pass?:PaintPass){
 const samples=pass?.samples??paintSamples(g,.18),points=samples.points;if(!points.length||s.flow===0||s.pigmentAmount===0)return;const kind=waterKind(s),pad=s.size*.76+4;
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;for(const p of points){left=Math.min(left,p.x);top=Math.min(top,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
 const x=Math.max(0,Math.floor(Math.max(left-pad,region?.x??0))),y=Math.max(0,Math.floor(Math.max(top-pad,region?.y??0))),rx=Math.min(ctx.canvas.width,Math.ceil(Math.min(right+pad,region?region.x+region.width:ctx.canvas.width))),by=Math.min(ctx.canvas.height,Math.ceil(Math.min(bottom+pad,region?region.y+region.height:ctx.canvas.height))),w=rx-x,h=by-y;if(w<=0||h<=0)return;
 const mask=pass?.mask??(pooled??=document.createElement('canvas'));if(mask.width!==ctx.canvas.width)mask.width=ctx.canvas.width;if(mask.height!==ctx.canvas.height)mask.height=ctx.canvas.height;const mc=mask.getContext('2d')!;mc.save();mc.globalAlpha=1;mc.globalCompositeOperation='source-over';if(!pass?.append){mc.fillStyle='#000';if(!region)mc.fillRect(0,0,mask.width,mask.height);else mc.fillRect(x,y,w,h);if(pass?.base)mc.drawImage(pass.base,x,y,w,h,x,y,w,h);}mc.beginPath();mc.rect(x,y,w,h);mc.clip();mc.globalCompositeOperation='lighten';
 const soft=s.edgeSoftness??.18,wet=s.waterAmount??.4,diffuse=kind==='wet'?(s.wetDiffusion??.65)*wet:0,feather=kind==='wet'?.04+soft*.16+diffuse*.11:.006+soft*.04,spread=1+diffuse*.24+(kind==='rough'?.035:0),layers=1;
 const angle=(s.tipAngle??0)*Math.PI/180,isFlat=s.watercolorShape?['angular','filbert','mop'].includes(s.watercolorShape):kind==='flat'||kind==='gradient',shape=s.watercolorShape?watercolorFootprint(s.watercolorShape):isFlat?flat:kind==='wet'?round.map(p=>({x:p.x*.55,y:p.y})):round;
 const footprints=new Map<number,{radius:number;outline:XY[]}>();
 const footprint=(p:Point,i:number,r:number)=>{const cached=footprints.get(i);if(cached?.radius===r)return cached.outline;const a=points[i?i-1:0],b=points[i||Math.min(points.length-1,1)],direction=isFlat||!s.watercolorShape&&kind==='wet'?Math.atan2(b.y-a.y,b.x-a.x)+angle:angle,co=Math.cos(direction),si=Math.sin(direction);const outline=shape.map(q=>({x:p.x+(q.x*co-q.y*si)*r,y:p.y+(q.x*si+q.y*co)*r}));footprints.set(i,{radius:r,outline});return outline;};
 const segment=(a:Point,b:Point,ai:number,bi:number)=>{if(Math.max(a.x,b.x)+pad<x||Math.min(a.x,b.x)-pad>rx||Math.max(a.y,b.y)+pad<y||Math.min(a.y,b.y)-pad>by)return;const ar=contact(s,a,samples.arc[ai]).radius*taperFactor(samples.arc[ai],samples.total,s.taperStart,s.taperEnd,Math.max(64,s.size*12)),br=contact(s,b,samples.arc[bi]).radius*taperFactor(samples.arc[bi],samples.total,s.taperStart,s.taperEnd,Math.max(64,s.size*12));
  for(let layer=0;layer<layers;layer++){const t=(layer+1)/layers,k=spread,load=Math.round(255*t*t*(3-2*t)),polygon=hull([...footprint(a,ai,ar*k),...footprint(b,bi,br*k)]);if(!polygon.length)continue;mc.fillStyle=`rgb(${load} ${load} ${load})`;mc.beginPath();mc.moveTo(polygon[0].x,polygon[0].y);for(let j=1;j<polygon.length;j++)mc.lineTo(polygon[j].x,polygon[j].y);mc.closePath();mc.fill();}
 };
 const from=pass?.from??0,to=pass?.to??points.length;if(!from)segment(points[0],points[0],0,0);for(let i=Math.max(1,from);i<to;i++)segment(points[i-1],points[i],i-1,i);mc.restore();if(pass?.append)return;
 // Broad-paint material runs at a bounded document-space rate. The swept mask
 // is constructed natively, then filtered for shading; final paper grain is
 // native resolution. Neither sampling grid follows canvas zoom.
 const scale=s.watercolorAppearanceVersion===1?(s.watercolorShape==='liner'?(s.size>=192?2:1):s.size>=192||kind==='wet'&&s.size>=128?3:s.size>=64?2:1):s.size>=64?2:1,halo=Math.ceil(s.size*(feather+.12)+4),sx=Math.max(0,Math.floor((x-halo)/scale)*scale),sy=Math.max(0,Math.floor((y-halo)/scale)*scale),ex=Math.ceil(Math.min(mask.width,rx+halo)/scale)*scale,ey=Math.ceil(Math.min(mask.height,by+halo)/scale)*scale,cw=(ex-sx)/scale,ch=(ey-sy)/scale;
 const d=down??=document.createElement('canvas');shaderCanvas(d,cw,ch);const dc=d.getContext('2d',{willReadFrequently:true})!;dc.save();dc.beginPath();dc.rect(0,0,cw,ch);dc.clip();dc.clearRect(0,0,cw,ch);
 // Keep the full-source sampling matrix and an integer document-grid origin.
 // Only the destination buffer is cropped; pigment coordinates never change.
 dc.drawImage(mask,0,0,mask.width,mask.height,-sx/scale,-sy/scale,mask.width/scale,mask.height/scale);dc.restore();const image=dc.getImageData(0,0,cw,ch),data=image.data,{coverage,distance}=shaderArrays(cw*ch);for(let i=0;i<coverage.length;i++)coverage[i]=data[i*4];
 // Distance from the continuous boundary supplies a smooth water front.
 // This filters coverage, not pigment RGB, and leaves native paper unblurred.
 for(let i=0;i<distance.length;i++)distance[i]=coverage[i]===0?0:coverage[i]<255?coverage[i]/255:1e6;
 for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const i=y*cw+x;if(x)distance[i]=Math.min(distance[i],distance[i-1]+1);if(y){distance[i]=Math.min(distance[i],distance[i-cw]+1);if(x)distance[i]=Math.min(distance[i],distance[i-cw-1]+1.4142);if(x+1<cw)distance[i]=Math.min(distance[i],distance[i-cw+1]+1.4142);}}
 for(let y=ch-1;y>=0;y--)for(let x=cw-1;x>=0;x--){const i=y*cw+x;if(x+1<cw)distance[i]=Math.min(distance[i],distance[i+1]+1);if(y+1<ch){distance[i]=Math.min(distance[i],distance[i+cw]+1);if(x)distance[i]=Math.min(distance[i],distance[i+cw-1]+1.4142);if(x+1<cw)distance[i]=Math.min(distance[i],distance[i+cw+1]+1.4142);}}
 const field=depositionField(s,samples),deposit:Deposit={radius:0,density:0,water:0,grain:0,dx:0,dy:0,edge:0},rgb=s.color.slice(1).match(/../g)!.map(v=>parseInt(v,16));
 const appearance=s.watercolorAppearanceVersion===1?watercolorAppearance(s):undefined,material:WaterAppearance={pigment:1,grain:.5,edge:0,pool:0};
 const granulation=appearance?watercolorGranulation(s):undefined,meanPigment=kind==='rough'?1.38:kind==='wet'?1.29:kind==='flat'?1.35:1.37;
 field.prepare(sx,sy,ex-sx,ey-sy);
 const sampleMask=(x:number,y:number)=>{const fx=Math.max(0,Math.min(cw-1,x)),fy=Math.max(0,Math.min(ch-1,y)),ix=Math.floor(fx),iy=Math.floor(fy),jx=Math.min(cw-1,ix+1),jy=Math.min(ch-1,iy+1),u=fx-ix,v=fy-iy;return ((distance[iy*cw+ix]*(1-u)+distance[iy*cw+jx]*u)*(1-v)+(distance[jy*cw+ix]*(1-u)+distance[jy*cw+jx]*u)*v);};
 for(let row=0;row<ch;row++)for(let col=0;col<cw;col++){
  const i=row*cw+col,j=i*4;let c=coverage[i]/255;if(!c){data[j+3]=0;continue;}
  field.sample(sx+col*scale,sy+row*scale,deposit);const moved=sampleMask(col+deposit.dx/scale,row+deposit.dy/scale);
  const contactSize=s.watercolorShape?Math.min(s.size,Math.max(1,deposit.radius*2)):s.size,roughDepth=kind==='rough'?contactSize*(.035+.10*(s.dryness??.72)):kind==='wet'?contactSize*.23*(s.edgeBleeding??.7):Math.min(2,contactSize*.018);
  if(appearance){if(deposit.paintPigment!==undefined){const grain=granulation!(sx+col*scale,sy+row*scale);material.pigment=Math.max(.25,meanPigment+(deposit.paintPigment-meanPigment)*2)*(1+(grain-.5)*(.25+(s.textureStrength??.2)*.8));material.grain=kind==='rough'?(deposit.paintGrain??deposit.grain)*.55+grain*.45:grain;material.edge=Math.max(-1,Math.min(1,(deposit.paintPigment-1.2)*2));material.pool=Math.max(0,deposit.paintPigment-1.1)*(kind==='wet'?.4:.18);}else appearance(deposit,material);}
  // Wet edges follow broad carried-pigment patches. Fine granules affect the
  // deposited interior, rather than cutting a dry, serrated wet boundary.
  const erosion=roughDepth*(1-(appearance?(kind==='wet'?.5+material.edge*.2:material.grain):deposit.grain))*(appearance?(kind==='rough'?.65:kind==='wet'?.24:1):1)+(appearance?contactSize*material.edge*(kind==='wet'?.018:kind==='rough'?.024:.008):0);
  c=waterEase(0,Math.max(.65,contactSize*feather/scale),moved-erosion/scale);
  const dryness=s.dryness??0,edge=1-c,gap=waterEase(.22,.58,1-deposit.grain),breakup=dryness*gap*(.15+edge*.85),settling=(s.pigmentBuildup??.45)*edge*deposit.edge*.10;
  let a=Math.max(0,c-breakup)*deposit.density+settling*c*deposit.density;
  if(appearance){const dryGap=kind==='rough'?(s.dryness??.72)*waterEase(.30,.66,1-material.grain)*(.22+(1-c)*.78):0;a=Math.max(0,c-breakup-dryGap)*deposit.density*material.pigment+material.pool*c*(1-c)*deposit.density*(s.pigmentBuildup??.4)*2;}
  if(kind==='wet'){const bleed=(s.edgeBleeding??.55)*deposit.water;a*=1-edge*bleed*.35;const bank=waterEase(.15,.6,c)*(1-waterEase(.65,1,c));a+=Math.max(0,deposit.edge-.5)*deposit.water*(s.pigmentBuildup??.4)*.6*bank*Math.min(1,deposit.density*2);}
  data[j]=rgb[0];data[j+1]=rgb[1];data[j+2]=rgb[2];data[j+3]=Math.round(255*Math.min(1,a));
 }
 const out=output??=document.createElement('canvas');if(out.width!==cw)out.width=cw;if(out.height!==ch)out.height=ch;out.getContext('2d')!.putImageData(image,0,0);ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(out,0,0,cw,ch,sx,sy,cw*scale,ch*scale);ctx.restore();finishNewWaterPaper(ctx,(s.textureStrength??.18)*(appearance?.65:1),x,y,w,h);
}
