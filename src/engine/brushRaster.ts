import {importedGrainSampler} from '../core/importedGrain';
import {inkTipGeometry} from '../core/inkTip';
import {inkFlowFactor} from '../core/inkFlow';
import {drawDryBristleV3} from './dryBristleV3';
import {drawDryBristleV2} from './dryBristleV2';
import {drawDryBristle} from './dryBristle';
import {tintMix} from './mixing';
import {drawPainting} from './painting';
import {drawTexturedPaint} from './texturedPaint';
import type {Stroke,Point} from '../core/model';
import {strokeGeometry,flattenCubic,pressureResponse,taperFactor} from './strokeGeometry';
import {finalGeometry} from './geometryCache';
import {widthResponse,opacityResponse} from './pressureChannels';
import {drawFlatInk} from './flatInk';
import {drawSolidInkV10} from './solidInkV10';
import type {RasterRegion} from './liveRaster';
import {drawDryMediaV9,isDryMediaV9} from './dryMediaV9';
import {drawPaintStroke} from './paintRaster';
import {drawAirbrushV8,drawTexturedPaintV8} from './paintRasterV8';
import type {PaintPass} from './paintPass';
import {paintColorFilter} from './paintColorFilter';
let pooled:HTMLCanvasElement|undefined,anchoredMask:HTMLCanvasElement|undefined;
const mask=(w:number,h:number)=>{const c=pooled??=documentSafeCanvas(w,h);if(c.width<w)c.width=Math.ceil(w/128)*128;if(c.height<h)c.height=Math.ceil(h/128)*128;return c;};
const littleEndian=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;
function documentSafeCanvas(w:number,h:number){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
/** New strokes use curves; legacy operations retain their original renderer. */
let mixedBase:HTMLCanvasElement|undefined;
export function drawModernStroke(ctx:CanvasRenderingContext2D,stroke:Stroke,phase:'live'|'final'='final',geometry?:ReturnType<typeof strokeGeometry>,region?:RasterRegion,pass?:PaintPass,origin?:{x:number;y:number}){
 if(!stroke.mixStops?.length||pass?.append){drawBaseStroke(ctx,stroke,phase,geometry,region,pass,origin);return;}
 const c=mixedBase??=document.createElement('canvas');if(c.width!==ctx.canvas.width)c.width=ctx.canvas.width;if(c.height!==ctx.canvas.height)c.height=ctx.canvas.height;const cc=c.getContext('2d')!;cc.clearRect(0,0,c.width,c.height);drawBaseStroke(cc,{...stroke,mixStops:undefined},phase,geometry,undefined,pass);ctx.drawImage(c,0,0);tintMix(ctx,stroke);
}
function drawBaseStroke(ctx:CanvasRenderingContext2D,stroke:Stroke,phase:'live'|'final'='final',geometry?:ReturnType<typeof strokeGeometry>,region?:RasterRegion,pass?:PaintPass,origin?:{x:number;y:number}){
 const roundInk=stroke.brushKind==='studio-ink'||stroke.brushKind==='contour-flow';
 const resolved=geometry??(phase==='final'?finalGeometry(stroke):strokeGeometry(stroke,phase));
 if(stroke.dryBristleVersion===3){drawDryBristleV3(ctx,stroke,resolved,region,pass);return;}
 if(stroke.dryBristleVersion===2){drawDryBristleV2(ctx,stroke,resolved,region,pass);return;}
 if(stroke.dryBristleVersion===1){drawDryBristle(ctx,stroke,resolved,region,pass);return;}
 if(stroke.paintTipVersion===2){drawPainting(ctx,stroke,resolved,region,pass);return;}
 if(stroke.paintTipVersion===1){drawTexturedPaint(ctx,stroke,resolved,region,pass);return;}
 if(stroke.engineVersion===9&&isDryMediaV9(stroke.brushKind)){drawDryMediaV9(ctx,stroke,resolved,region,pass,origin);return;}
 if(stroke.engineVersion===8){if(stroke.brushKind==='airbrush'){drawAirbrushV8(ctx,stroke,resolved,region);return;}if(stroke.brushKind==='dry-grain'||stroke.brushKind==='watercolor'){drawTexturedPaintV8(ctx,stroke,resolved,region,pass);return;}}
 if(stroke.engineVersion===7&&['dry-grain','airbrush'].includes(stroke.brushKind??'')){drawPaintStroke(ctx,stroke,resolved,region);return;}
 if(stroke.flatNibVersion===1&&drawFlatInk(ctx,stroke,resolved,region))return;
 const {points,cubics}=resolved;if(!points.length)return;
 const tapered=!!(stroke.taperStart||stroke.taperEnd),varyingWidth=stroke.pressure&&stroke.pressureWidth!==false||!!stroke.velocityTaper;
 if(!stroke.inkTipVersion&&!stroke.pressureOpacity&&!tapered&&!varyingWidth&&(!stroke.brushKind||stroke.brushKind==='technical'||stroke.brushKind==='eraser-hard')){
  ctx.save();ctx.strokeStyle=stroke.color;ctx.fillStyle=stroke.color;ctx.lineWidth=stroke.size;ctx.lineCap='round';ctx.lineJoin='round';
  if(!cubics.length){ctx.beginPath();ctx.arc(points[0].x,points[0].y,stroke.size/2,0,Math.PI*2);ctx.fill();}else{ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const c of cubics)ctx.bezierCurveTo(c.c1.x,c.c1.y,c.c2.x,c.c2.y,c.b.x,c.b.y);ctx.stroke();}ctx.restore();return;
 }
 if(stroke.engineVersion===10&&drawSolidInkV10(ctx,stroke,resolved,region))return;
 const optimizedWash=stroke.engineVersion===7&&stroke.brushKind==='watercolor';
 const samples:Point[]=pass?.samples.points??(cubics.length?cubics.flatMap((c,i)=>flattenCubic(c,optimizedWash?.7:stroke.inkFlowVersion===1?.12:.18).slice(i?1:0)):points);
 const pad=stroke.size*(stroke.paintNibVersion===1?.5:1)+3;let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const p of samples){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
 const x=Math.max(region?.x??0,Math.floor(minX-pad)),y=Math.max(region?.y??0,Math.floor(minY-pad)),w=Math.min(region?region.x+region.width:ctx.canvas.width,Math.ceil(maxX+pad))-x,h=Math.min(region?region.y+region.height:ctx.canvas.height,Math.ceil(maxY+pad))-y;if(w<=0||h<=0)return;
 const colorFilter=paintColorFilter(stroke),anchored=(stroke.engineVersion===6||stroke.engineVersion===7||stroke.engineVersion===10),tile=pass?.mask??(anchored?(anchoredMask??=documentSafeCanvas(ctx.canvas.width,ctx.canvas.height)):mask(w,h));if(anchored){if(tile.width!==ctx.canvas.width)tile.width=ctx.canvas.width;if(tile.height!==ctx.canvas.height)tile.height=ctx.canvas.height;}const ox=anchored?x:0,oy=anchored?y:0,mc=tile.getContext('2d',colorFilter?undefined:{willReadFrequently:true})!;mc.save();mc.globalCompositeOperation='source-over';mc.globalAlpha=1;if(!pass?.append){if(pass?.base)mc.drawImage(pass.base,ox,oy,w,h,ox,oy,w,h);else{mc.fillStyle='#000';mc.fillRect(ox,oy,w,h);}}mc.globalCompositeOperation='lighten';
 let total=pass?.samples.total??0;if(!pass)for(let i=1;i<samples.length;i++)total+=Math.hypot(samples[i].x-samples[i-1].x,samples[i].y-samples[i-1].y);
 const micro:{x:number;y:number;energy:number}[]=[];let along=pass?pass.samples.arc[Math.max(0,pass.from-1)]??0:0;
 for(let i=pass?.from??0;i<(pass?.to??samples.length);i++){const p=samples[i],a=samples[Math.max(0,i-1)],length=Math.hypot(p.x-a.x,p.y-a.y);
  // Live raster updates often change only the nib/tail. Skip *whole* old
  // segments whose maximal nib footprint cannot intersect the dirty tile.
  // Keep their arc length in 'along' so pressure/taper remain unchanged.
  if(region){const margin=stroke.size+2;if(Math.max(a.x,p.x)<x-margin||Math.min(a.x,p.x)>x+w+margin||Math.max(a.y,p.y)<y-margin||Math.min(a.y,p.y)>y+h+margin){along+=length;continue;}}
  // Broad soft nibs overlap at a small fraction of their diameter. A fixed
  // one-pixel spacing did the same large gradient work hundreds of times.
  // New paint strokes scale spacing with diameter; the same radial profile,
  // pressure samples and curve endpoints remain in use.
  const fastPaint=stroke.paintNibVersion===1&&['paint','marker','eraser-soft'].includes(stroke.brushKind??'')&&stroke.size>=32;
  const nibFactor=(p:Point,d:number)=>{
   const response=stroke.pressure?pressureResponse(Math.pow(p.p,stroke.response),stroke.pressureCurve):1,velocity=stroke.velocityTaper?p.v??1:1;
   return (varyingWidth?widthResponse(response*velocity,stroke):1)*taperFactor(d,total,stroke.taperStart,stroke.taperEnd,Math.max(64,stroke.size*12));
  };
  // Keep fine sampling wherever pressure or taper makes a broad brush narrow.
  const spacing=fastPaint?Math.max(.25,Math.min(8,stroke.size*.05*Math.min(nibFactor(a,along),nibFactor(p,along+length)))):optimizedWash?Math.min(2.5,Math.max(1.3,stroke.size*.065)):stroke.brushKind==='flat'?.25:Math.max(.25,Math.min(1,stroke.size*.08)),steps=Math.min(8192,Math.max(1,Math.ceil(length/spacing)));
  const tangent=i===0&&stroke.engineVersion===10?samples[1]??p:p;const angle=Math.atan2(tangent.y-a.y,tangent.x-a.x);
  for(let j=i?1:0;j<=steps;j++){const t=j/steps,px=a.x+(p.x-a.x)*t,py=a.y+(p.y-a.y)*t;if(region&&(px<x-stroke.size||py<y-stroke.size||px>x+w+stroke.size||py>y+h+stroke.size))continue;const reported=a.p+(p.p-a.p)*t,response=stroke.pressure?pressureResponse(Math.pow(reported,stroke.response),stroke.pressureCurve):1,velocity=stroke.velocityTaper?(a.v??1)+((p.v??1)-(a.v??1))*t:1,radius=stroke.size/2*(varyingWidth?widthResponse(response*velocity,stroke):1)*(roundInk?Math.sin(taperFactor(along+length*t,total,stroke.taperStart,stroke.taperEnd,Math.max(4,stroke.size*4))*Math.PI/2):taperFactor(along+length*t,total,stroke.taperStart,stroke.taperEnd,stroke.engineVersion===6||stroke.engineVersion===7||stroke.engineVersion===10?Math.max(64,stroke.size*12):undefined))*inkFlowFactor(stroke,along+length*t);if(radius<.01)continue;
   const intensity=Math.round(255*(stroke.pressure&&stroke.pressureOpacity?opacityResponse(response,stroke):1)),kind=stroke.brushKind;
   let aspect=1,rotation=0,softness=0;
   if(kind==='2b')softness=.22;else if(kind==='hb'||kind==='blue')softness=.1;else if(kind==='marker'){aspect=.8;softness=.3;}else if(kind==='g-pen'){aspect=.74;rotation=-.55;}else if(kind==='mapping'){aspect=.48;rotation=-.55;}else if(kind==='brush-pen'){aspect=.52;rotation=angle+.6;}else if(kind==='paint'){aspect=.72;rotation=angle+.25;softness=.16;}else if(kind==='dry'||kind==='dry-grain'){aspect=.65;rotation=-.6;}else if(kind==='watercolor'){aspect=.9;softness=stroke.engineVersion===7?.43:.67;}else if(kind==='airbrush')softness=1;else if(kind==='eraser-soft')softness=.8;
   if(stroke.inkTipVersion===1){const tip=inkTipGeometry(stroke,angle);aspect=tip.aspect;rotation=tip.rotation;}
   // Canvas sampling can entirely miss a subpixel nib. Preserve its
   // integrated coverage with a bounded pixel filter instead of enlarging it.
   if((stroke.engineVersion===4||stroke.engineVersion===5||stroke.engineVersion===6||stroke.engineVersion===7||stroke.engineVersion===10)&&radius<.75&&kind!=='flat'){micro.push({x:px-x,y:py-y,energy:Math.PI*radius*radius*aspect*intensity*(kind==='airbrush'?73/300:1-softness+softness*softness/3)});continue;}
   mc.save();mc.translate(anchored?px:px-x,anchored?py:py-y);mc.rotate(rotation);mc.scale(1,aspect);
   if(kind==='flat'){mc.rotate(-.55);mc.fillStyle=`rgb(${intensity} ${intensity} ${intensity})`;mc.fillRect(-radius,-radius*.3,radius*2,radius*.6);}
   else{if(softness){const gradient=mc.createRadialGradient(0,0,radius*(1-softness),0,0,radius);gradient.addColorStop(0,`rgb(${intensity} ${intensity} ${intensity})`);if(kind==='airbrush')gradient.addColorStop(.35,`rgb(${Math.round(intensity*.45)} ${Math.round(intensity*.45)} ${Math.round(intensity*.45)})`);gradient.addColorStop(1,'#000');mc.fillStyle=gradient;}else mc.fillStyle=`rgb(${intensity} ${intensity} ${intensity})`;mc.beginPath();mc.arc(0,0,radius,0,Math.PI*2);mc.fill();}mc.restore();
  }along+=length;
 }
 mc.restore();if(pass?.append)return;
 if(colorFilter){
  // Integrated subpixel dabs are exact one-pixel max operations, so even a
  // tapered tip does not require reading the entire mask back to JavaScript.
  if(micro.length){mc.save();mc.globalCompositeOperation='lighten';for(const dab of micro){const ix=Math.floor(dab.x-.5),iy=Math.floor(dab.y-.5),fx=dab.x-.5-ix,fy=dab.y-.5-iy;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const px=ix+dx,py=iy+dy;if(px<0||py<0||px>=w||py>=h)continue;const alpha=Math.min(255,Math.round(dab.energy*(dx?fx:1-fx)*(dy?fy:1-fy)));mc.fillStyle=`rgb(${alpha} 0 0)`;mc.fillRect(ox+px,oy+py,1,1);}}mc.restore();}
  ctx.save();ctx.filter=colorFilter;ctx.drawImage(tile,ox,oy,w,h,x,y,w,h);ctx.restore();return;
 }
 const pixels=mc.getImageData(ox,oy,w,h),rgb=stroke.color.slice(1).match(/../g)!.map(n=>parseInt(n,16));
 for(const dab of micro){const ix=Math.floor(dab.x-.5),iy=Math.floor(dab.y-.5),fx=dab.x-.5-ix,fy=dab.y-.5-iy;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const px=ix+dx,py=iy+dy;if(px<0||py<0||px>=w||py>=h)continue;const index=(py*w+px)*4,alpha=Math.round(dab.energy*(dx?fx:1-fx)*(dy?fy:1-fy));pixels.data[index]=Math.max(pixels.data[index],Math.min(255,alpha));}}
 const strength=stroke.textureStrength??0,kind=stroke.brushKind,imageGrain=importedGrainSampler(stroke);
 // Read mask luminance once per pixel. Transparent pixels need no color/texture
 // work; packing RGBA avoids four byte stores across the mostly empty rectangle.
 if(littleEndian){const words=new Uint32Array(pixels.data.buffer,pixels.data.byteOffset,pixels.data.byteLength/4),color=rgb[0]|rgb[1]<<8|rgb[2]<<16;
  for(let i=0;i<words.length;i++){let alpha=words[i]&255;if(!alpha){words[i]=0;continue;}if(strength){const px=x+i%w,py=y+Math.floor(i/w);let hash=Math.imul(Math.floor(px*1.4/(stroke.inkTipVersion===1?stroke.inkGrainScale??1:1))^Math.imul(Math.floor(py*1.4/(stroke.inkTipVersion===1?stroke.inkGrainScale??1:1)),374761393),668265263);hash=(hash^(hash>>>13))>>>0;const paper=(hash%1024)/1023;
   if(kind==='dry-grain'){
    // Directional broken bristles + coarse patches. Anchored in document space
    // so incremental tile painting cannot make the texture swim behind the pen.
    const fiber=Math.sin(px*.7+py*1.8)+.48*Math.sin(px*.23+py*.86+1.7);
    const gaps=fiber<-.16?.99:fiber<.25?.73:.18+paper*.36;
    alpha*=1-strength*gaps;
   }else if(kind==='dry'){const bristle=.5+.5*Math.sin(px*.7+py*1.8);alpha*=1-strength*(bristle<.42?.98:.18+paper*.28);}
   else if(kind==='watercolor'){
    // Transparent paper-granulated pigment with low-frequency wash variation.
    // Overlapping *strokes* build up naturally via normal layer compositing.
    const pools=.5+.25*Math.sin(px*.13+py*.083)+.25*Math.sin(px*.051-py*.12);
    alpha*=Math.max(.12,.78-strength*(.35+paper*.47)+(pools-.5)*.42);
    if(stroke.engineVersion===7){const wetRim=Math.max(0,1-Math.abs(alpha-102)/100),sediment=.89+.14*Math.sin(px*.047+py*.107)+.09*Math.sin(px*.16-py*.06);alpha*=Math.max(.4,sediment+wetRim*.23);if(paper<.055)alpha*=.56;}
   }else if(kind==='paint')alpha*=1-strength*(.3+.3*Math.sin(px*.3+py*1.3))*(.5+paper*.5);
   else alpha*=1-strength*(.25+paper*.75);
  }if(imageGrain)alpha*=imageGrain(x+i%w,y+Math.floor(i/w));words[i]=color|Math.round(alpha)<<24;}
 }else for(let i=0;i<pixels.data.length;i+=4){let alpha=pixels.data[i];if(alpha&&strength){const px=x+(i/4)%w,py=y+Math.floor(i/4/w);let hash=Math.imul(Math.floor(px*1.4)^Math.imul(Math.floor(py*1.4),374761393),668265263);hash=(hash^(hash>>>13))>>>0;const paper=(hash%1024)/1023;
   if(kind==='dry-grain'){
    // Directional broken bristles + coarse patches. Anchored in document space
    // so incremental tile painting cannot make the texture swim behind the pen.
    const fiber=Math.sin(px*.7+py*1.8)+.48*Math.sin(px*.23+py*.86+1.7);
    const gaps=fiber<-.16?.99:fiber<.25?.73:.18+paper*.36;
    alpha*=1-strength*gaps;
   }else if(kind==='dry'){const bristle=.5+.5*Math.sin(px*.7+py*1.8);alpha*=1-strength*(bristle<.42?.98:.18+paper*.28);}
   else if(kind==='watercolor'){
    // Transparent paper-granulated pigment with low-frequency wash variation.
    // Overlapping *strokes* build up naturally via normal layer compositing.
    const pools=.5+.25*Math.sin(px*.13+py*.083)+.25*Math.sin(px*.051-py*.12);
    alpha*=Math.max(.12,.78-strength*(.35+paper*.47)+(pools-.5)*.42);
    if(stroke.engineVersion===7){const wetRim=Math.max(0,1-Math.abs(alpha-102)/100),sediment=.89+.14*Math.sin(px*.047+py*.107)+.09*Math.sin(px*.16-py*.06);alpha*=Math.max(.4,sediment+wetRim*.23);if(paper<.055)alpha*=.56;}
   }else if(kind==='paint')alpha*=1-strength*(.3+.3*Math.sin(px*.3+py*1.3))*(.5+paper*.5);
   else alpha*=1-strength*(.25+paper*.75);
  }if(imageGrain)alpha*=imageGrain(x+(i/4)%w,y+Math.floor(i/4/w));pixels.data[i]=rgb[0];pixels.data[i+1]=rgb[1];pixels.data[i+2]=rgb[2];pixels.data[i+3]=Math.round(alpha);}
 mc.putImageData(pixels,ox,oy);ctx.drawImage(tile,ox,oy,w,h,x,y,w,h);
}

