import type {Point,Stroke} from '../core/model';
import {flattenCubic,pressureResponse,taperFactor} from './strokeGeometry';
import {widthResponse,opacityResponse} from './pressureChannels';
import {getPaintNibV8,paintPaperGrain,paintPaperGrainRow,paintVariationSeed} from './paintNibsV8';
import type {RasterRegion} from './liveRaster';
import type {strokeGeometry} from './strokeGeometry';
import type {PaintPass} from './paintPass';

let paintTile:HTMLCanvasElement|undefined;
let airbrushTile:HTMLCanvasElement|undefined;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
type PaperTile={a:Float64Array;b:Float64Array;c:Float64Array;rows:Uint8Array};
let paperKey='';const paperTiles=new Map<string,PaperTile>();
/** Cache only document-anchored pigment factors; changing pressure still uses
 * the current mask value. 160 tiles keep this cache below 16 MiB. */
function paperRow(kind:'dry-grain'|'watercolor',x:number,y:number,seed:number,strength:number){
 const tx=x>>6,key=tx+':'+(y>>6);let tile=paperTiles.get(key);
 if(!tile){if(paperTiles.size>=160)paperTiles.delete(paperTiles.keys().next().value!);tile={a:new Float64Array(4096),b:new Float64Array(4096),c:new Float64Array(4096),rows:new Uint8Array(64)};paperTiles.set(key,tile);}
 const offset=(y&63)*64;
 if(!tile.rows[y&63]){
  const paper=paintPaperGrainRow(tx*64,y,64,seed);
  if(kind==='dry-grain'){
   const island=paintPaperGrainRow(tx*64,y,64,seed+731,.67);
   for(let i=0;i<64;i++){const gaps=paper[i]<.27?.13:paper[i]<.41?.37:paper[i]<.56?.74:1;tile.a[offset+i]=1-strength+strength*gaps;tile.b[offset+i]=.36+1.10*island[i];}
  }else{
   const pool=paintPaperGrainRow(tx*64,y,64,seed+47,.30),pigment=paintPaperGrainRow(tx*64,y,64,seed+215,.80);
   for(let i=0;i<64;i++){tile.a[offset+i]=.22+1.35*pool[i];tile.b[offset+i]=1-strength*(paper[i]<.22?.78:paper[i]<.44?.50:.11);tile.c[offset+i]=.4+.95*pigment[i];}
  }
  tile.rows[y&63]=1;
 }
 return tile;
}
function buffer(old:HTMLCanvasElement|undefined,w:number,h:number){const c=old??document.createElement('canvas');const W=Math.ceil(w/64)*64,H=Math.ceil(h/64)*64;if(c.width!==W)c.width=W;if(c.height!==H)c.height=H;return c;}

/** Constant-speed, constant-width airbrush when pressure is OFF. One blurred
 * continuous path, rather than hundreds of overlapping stamps. Pressure-ON
 * uses sampled alpha/width but blurs only once after painting the mask. */
export function drawAirbrushV8(ctx:CanvasRenderingContext2D,stroke:Stroke,geometry:ReturnType<typeof strokeGeometry>,region?:RasterRegion){
 const {points,cubics}=geometry;if(!points.length)return;
 const pad=Math.ceil(stroke.size*1.4+9);
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const p of points){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
 for(const c of cubics)for(const p of [c.c1,c.c2]){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
 const x=Math.max(0,Math.floor(Math.max(minX-pad,(region?.x??0)-pad))),y=Math.max(0,Math.floor(Math.max(minY-pad,(region?.y??0)-pad)));
 const right=Math.min(ctx.canvas.width,Math.ceil(Math.min(maxX+pad,(region?region.x+region.width+pad:ctx.canvas.width))));
 const bottom=Math.min(ctx.canvas.height,Math.ceil(Math.min(maxY+pad,(region?region.y+region.height+pad:ctx.canvas.height))));
 const w=right-x,h=bottom-y;if(w<=0||h<=0)return;
 airbrushTile=buffer(airbrushTile,w,h);
 const mc=airbrushTile.getContext('2d')!;mc.clearRect(0,0,airbrushTile.width,airbrushTile.height);mc.save();mc.translate(-x,-y);mc.beginPath();
 const variable=stroke.pressure&&(stroke.pressureWidth!==false||stroke.pressureOpacity===true)||!!stroke.velocityTaper||!!stroke.taperStart||!!stroke.taperEnd;
 if(!variable){
  mc.moveTo(points[0].x,points[0].y);
  if(cubics.length)for(const c of cubics)mc.bezierCurveTo(c.c1.x,c.c1.y,c.c2.x,c.c2.y,c.b.x,c.b.y);
  mc.lineWidth=Math.max(.5,stroke.size*.43);mc.strokeStyle=stroke.color;mc.lineJoin='round';mc.lineCap='round';
  if(cubics.length)mc.stroke();else{mc.arc(points[0].x,points[0].y,stroke.size*.215,0,Math.PI*2);mc.fillStyle=stroke.color;mc.fill();}
 }else{
  const sampled=cubics.length?cubics.flatMap((c,i)=>flattenCubic(c,1).slice(i?1:0)):points;
  // Smooth pressure by segment; avoid subpixel dabs and speed-dependent coverage.
  const total=sampled.slice(1).reduce((t,p,i)=>t+Math.hypot(p.x-sampled[i].x,p.y-sampled[i].y),0);
  let along=0;
  for(let i=1;i<sampled.length;i++){
   const a=sampled[i-1],b=sampled[i],length=Math.hypot(b.x-a.x,b.y-a.y);if(length<.01)continue;
   const value=stroke.pressure?pressureResponse(Math.pow((a.p+b.p)*.5,stroke.response),stroke.pressureCurve):1;
   const vel=stroke.velocityTaper?((a.v??1)+(b.v??1))*.5:1;
   const width=(stroke.pressure&&stroke.pressureWidth!==false||stroke.velocityTaper)?widthResponse(value*vel,stroke):1;
   const taper=taperFactor(along+length/2,total,stroke.taperStart,stroke.taperEnd,Math.max(64,stroke.size*12));
   const opacity=stroke.pressure&&stroke.pressureOpacity?opacityResponse(value,stroke):1;
   mc.beginPath();mc.moveTo(a.x,a.y);mc.lineTo(b.x,b.y);mc.lineCap='round';mc.lineJoin='round';mc.strokeStyle=stroke.color;mc.lineWidth=Math.max(.12,stroke.size*.43*width*taper);mc.globalAlpha=opacity;mc.stroke();along+=length;
  }
  if(sampled.length===1){mc.beginPath();mc.fillStyle=stroke.color;mc.globalAlpha=stroke.pressure&&stroke.pressureOpacity?opacityResponse(sampled[0].p,stroke):1;mc.arc(sampled[0].x,sampled[0].y,stroke.size*.215,0,Math.PI*2);mc.fill();}
 }
 mc.restore();
 ctx.save();if(region){ctx.beginPath();ctx.rect(region.x,region.y,region.width,region.height);ctx.clip();}
 const blur=Math.max(.8,stroke.size*.24);
 ctx.filter=`blur(${blur.toFixed(2)}px)`;
 // Only the occupied region is copied. The tile has at least one blur halo.
 ctx.drawImage(airbrushTile,0,0,w,h,x,y,w,h);
 ctx.restore();
}

/** Revision-8 textured paints. Full pixels only in the occupied dirty box,
 * anchored grain in document space, no repeating three-stamp pattern. */
export function drawTexturedPaintV8(ctx:CanvasRenderingContext2D,stroke:Stroke,geometry:ReturnType<typeof strokeGeometry>,region?:RasterRegion,pass?:PaintPass){
 const kind=stroke.brushKind==='dry-grain'?'dry-grain':'watercolor';
 const points:Point[]=pass?.samples.points??(geometry.cubics.length?geometry.cubics.flatMap((c,i)=>flattenCubic(c,.8).slice(i?1:0)):geometry.points);
 if(!points.length)return;
 const anchored=stroke.paintNibVersion===1,pad=Math.ceil(stroke.size*(anchored&&kind==='watercolor'?.5:1.8)+7);
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const p of points){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
 const x=Math.max(0,Math.floor(Math.max(minX-pad,region?.x??0))),y=Math.max(0,Math.floor(Math.max(minY-pad,region?.y??0)));
 const w=Math.min(ctx.canvas.width,Math.ceil(Math.min(maxX+pad,region?region.x+region.width:ctx.canvas.width)))-x;
 const h=Math.min(ctx.canvas.height,Math.ceil(Math.min(maxY+pad,region?region.y+region.height:ctx.canvas.height)))-y;if(w<=0||h<=0)return;
 const ox=anchored?x:0,oy=anchored?y:0;
 const surface=pass?.mask??(paintTile=buffer(paintTile,anchored?ctx.canvas.width:w,anchored?ctx.canvas.height:h));const mc=surface.getContext('2d',{willReadFrequently:true})!;
 mc.save();mc.globalCompositeOperation='source-over';mc.globalAlpha=1;if(!pass?.append){if(pass?.base)mc.drawImage(pass.base,ox,oy,w,h,ox,oy,w,h);else{mc.fillStyle='black';mc.fillRect(ox,oy,w,h);}}if(!anchored){mc.beginPath();mc.rect(0,0,w,h);mc.clip();mc.translate(-x,-y);}
 mc.globalCompositeOperation='lighten';
 const spacing=kind==='watercolor'?Math.min(5.8,Math.max(1,stroke.size*.14)):Math.min(4,Math.max(1,stroke.size*.09));
 let lengthTotal=pass?.samples.total??0;if(!pass)for(let i=1;i<points.length;i++)lengthTotal+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
 let along=pass?pass.samples.arc[Math.max(0,pass.from-1)]??0:0,stamp=0,next=along?Math.ceil(along/spacing)*spacing:0;
 const seed=paintVariationSeed(stroke.id);
 const dab=(p:Point,angle:number,distance:number)=>{
  if(p.x<x-pad||p.y<y-pad||p.x>x+w+pad||p.y>y+h+pad)return;
  const response=stroke.pressure?pressureResponse(Math.pow(p.p,stroke.response),stroke.pressureCurve):1;
  const velocity=stroke.velocityTaper?p.v??1:1;
  const radius=stroke.size*.5*(stroke.pressure&&stroke.pressureWidth!==false||stroke.velocityTaper?widthResponse(response*velocity,stroke):1)*taperFactor(distance,lengthTotal,stroke.taperStart,stroke.taperEnd,Math.max(64,stroke.size*12));
  if(radius<=.04)return;
  const opacity=stroke.pressure&&stroke.pressureOpacity?opacityResponse(response,stroke):1;
  const nib=getPaintNibV8(kind,255*opacity,kind==='watercolor'?0:(Math.floor(distance/spacing+1e-5)+seed)%9);
  const rx=radius*(kind==='dry-grain'?1.8:1),ry=radius*(kind==='dry-grain'?.82:1);
  mc.save();mc.translate(p.x,p.y);if(kind==='dry-grain')mc.rotate(angle);mc.drawImage(nib,-rx,-ry,2*rx,2*ry);mc.restore();stamp++;
 };
 if(points.length===1)dab(points[0],0,0);
 for(let i=Math.max(1,pass?.from??1);i<(pass?.to??points.length);i++){
  const a=points[i-1],b=points[i],len=Math.hypot(b.x-a.x,b.y-a.y);if(len<1e-6)continue;
  const angle=Math.atan2(b.y-a.y,b.x-a.x);
  if(region&&(Math.max(a.x,b.x)<x-pad||Math.min(a.x,b.x)>x+w+pad||Math.max(a.y,b.y)<y-pad||Math.min(a.y,b.y)>y+h+pad)){along+=len;continue;}
  if(next<along)next=Math.ceil(along/spacing)*spacing;
  while(next<=along+len+1e-5){const t=clamp((next-along)/len);dab({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,p:a.p+(b.p-a.p)*t,v:(a.v??1)+((b.v??1)-(a.v??1))*t},angle,next);next+=spacing;}
  along+=len;
 }
 mc.restore();if(pass?.append)return;const pixels=mc.getImageData(ox,oy,w,h),rgba=pixels.data;
 const red=parseInt(stroke.color.slice(1,3),16),green=parseInt(stroke.color.slice(3,5),16),blue=parseInt(stroke.color.slice(5,7),16);
 const strength=clamp(stroke.textureStrength??.5);
 const key=seed+':'+kind+':'+strength;if(key!==paperKey){paperKey=key;paperTiles.clear();}
 let factors:PaperTile|undefined,lastChunk=-1,lastRow=-1;
 for(let i=0;i<rgba.length;i+=4){const light=rgba[i];if(light<1){rgba[i+3]=0;continue;}
  const px=x+(i/4)%w,py=y+Math.floor(i/4/w),p=light/255;
  if(stroke.size>=32){if((px>>6)!==lastChunk||py!==lastRow){factors=paperRow(kind,px,py,seed,strength);lastChunk=px>>6;lastRow=py;}}
  let alpha:number;
  if(factors){
   const j=(py&63)*64+(px&63);
   if(kind==='dry-grain')alpha=255*p*factors.a[j]*factors.b[j];
   else{const edge=1+.31*Math.exp(-Math.pow((p-.40)/.16,2));alpha=255*p*factors.a[j]*factors.b[j]*edge*factors.c[j];}
  }else if(kind==='dry-grain'){
   // Naturally broken deposits without periodic horizontal/diagonal line bands.
   const paper=paintPaperGrain(px,py,seed),island=paintPaperGrain(px*.67,py*.67,seed+731);
   const gaps=paper<.27?.13:paper<.41?.37:paper<.56?.74:1;
   alpha=255*p*(1-strength+strength*gaps)*(.36+1.10*island);
  }else{
   // Non-repeating pigment cloud + soft wet perimeter; each pixel is anchored
   // to the canvas and remains visually fixed as new dabs are added.
   const paper=paintPaperGrain(px,py,seed),pool=paintPaperGrain(px*.30,py*.30,seed+47);
   const pigment=paintPaperGrain(px*.80,py*.80,seed+215);
   // Paper pockets produce mottling instead of a repeating stamped nib.
   const sediment=.22+1.35*pool;
   const granule=1-strength*(paper<.22?.78:paper<.44?.50:.11);
   const edge=1+.31*Math.exp(-Math.pow((p-.40)/.16,2));
   const blooms=.4+.95*pigment;
   alpha=255*p*sediment*granule*edge*blooms;
  }
  rgba[i]=red;rgba[i+1]=green;rgba[i+2]=blue;rgba[i+3]=Math.round(clamp(alpha/255)*255);
 }
 mc.putImageData(pixels,ox,oy);ctx.drawImage(surface,ox,oy,w,h,x,y,w,h);
}
