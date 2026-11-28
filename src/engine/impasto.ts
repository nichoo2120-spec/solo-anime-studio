import type {Stroke} from '../core/model';
import type {StampDab} from './stampBrush';
import type {RasterRegion} from './liveRaster';

const tipCache=new Map<string,HTMLCanvasElement>();
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const surface=()=>document.createElement('canvas');
const lanes={sketch:9,filbert:21,bristle:29,flat:17,highlight:13};
let height:HTMLCanvasElement|undefined;
let lit:HTMLCanvasElement|undefined;

/** The normal Paint dab plan still supplies position, angle, pressure and taper. */
export function oilNib(s:Stroke,pressure=1){
 const rectangular=s.oilTip==='bristle'||s.oilTip==='flat';
 const softness=s.oilSoftness??.2,pickup=s.oilPickup??.08;
 const dry=(s.impastoVersion??0)>=2?1-Math.round(clamp(pressure)*8)/8:0;
 const key=[s.impastoVersion,s.oilTip,softness,pickup,dry].join(':');
 const cached=tipCache.get(key);
 if(cached)return cached;
 const c=surface();c.width=c.height=128;
 const ctx=c.getContext('2d')!,pixels=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const u=Math.abs((x+.5)/64-1),v=Math.abs((y+.5)/64-1);
  const distance=rectangular?Math.max(u,v):Math.hypot(u,v);
  const bristle=(Math.sin(y*2.71)*.65+Math.sin(y*.67)*.35)*.025;
    const edge=clamp((1-distance+bristle)/(.025+.13*softness));
  const lane=(.5+.5*Math.sin(x*1.74+Math.sin(x*.35)*1.25))**2;
  const thin=(s.impastoVersion??0)>=2?clamp((distance-.69)/.29)*(.22+.78*dry)*lane:0;
  const k=(y*128+x)*4;
  pixels.data[k]=pixels.data[k+1]=pixels.data[k+2]=255;
  pixels.data[k+3]=Math.round(255*edge*(1-pickup*(1-edge))*(1-thin*.83));
 }
 ctx.putImageData(pixels,0,0);
 if(tipCache.size>=64)tipCache.delete(tipCache.keys().next().value!);
 tipCache.set(key,c);
 return c;
}

function fit(c:HTMLCanvasElement,w:number,h:number){
 if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
 return c.getContext('2d',{willReadFrequently:true})!;
}

/** Bristle lanes are continuous polygons following the sampled centerline.
 * Each lane has its own spacing and height. The nib mask clips the ends. */
function bristleHeight(s:Stroke,dabs:StampDab[],box:RasterRegion){
 const c=height??=surface(),ctx=fit(c,box.width,box.height);
 const body=s.oilDepth??.65,base=Math.round(115*body),sculpted=s.impastoVersion===4;
 const floor=sculpted?Math.round(base*.36):base;
 ctx.fillStyle='rgb('+floor+' '+floor+' '+floor+')';ctx.fillRect(0,0,box.width,box.height);
 const count=lanes[s.oilTip??'filbert'],relief=s.impastoVersion===3?1.52:s.impastoVersion===2?1.25:1,depth=body*(s.oilBristles??.75);
 if((sculpted?!body:!depth)||dabs.length===0)return c;
 const rails=dabs.map((d,i)=>{
  const a=dabs[Math.max(0,i-1)],b=dabs[Math.min(dabs.length-1,i+1)];
  const dir=a===b?d.angle-Math.PI/2:Math.atan2(b.y-a.y,b.x-a.x);
  const nx=-Math.sin(dir),ny=Math.cos(dir),u=d.angle-dir;
  const width=Math.hypot(d.rx*Math.sin(u),d.ry*Math.cos(u));
  return {x:d.x-box.x,y:d.y-box.y,nx,ny,width,tx:Math.cos(dir),ty:Math.sin(dir),lead:Math.max(Math.abs(d.rx),Math.abs(d.ry))};
 });
 const at=(i:number,offset:number)=>{
  const p=rails[Math.max(0,Math.min(rails.length-1,i))],end=i<0?-1:i>=rails.length?1:0;
  return [p.x+p.nx*p.width*offset+end*p.tx*p.lead,p.y+p.ny*p.width*offset+end*p.ty*p.lead] as const;
 };
 const band=(left:number,right:number,gray:number)=>{
  ctx.fillStyle='rgb('+gray+' '+gray+' '+gray+')';
  ctx.beginPath();ctx.moveTo(...at(-1,left));
  for(let j=0;j<=rails.length;j++)ctx.lineTo(...at(j,left));
  for(let j=rails.length;j>=-1;j--)ctx.lineTo(...at(j,right));
  ctx.closePath();ctx.fill();
 };
 if(sculpted){
  // Sweep the rounded paint body first, then deposit bristle ridges on top.
  const rounded=s.oilTip!=='bristle'&&s.oilTip!=='flat';
  const shoulders=rounded?[.96,.89,.80,.68,.49]:[.98,.94,.89,.83,.73];
  for(let i=0;i<shoulders.length;i++){
   const half=shoulders[i],offset=.015*i;
   band(offset-half,offset+half,Math.round(base*(.59+i*.16)));
  }
  ctx.globalCompositeOperation='lighter';
  for(let i=0;i<count;i++){
   const center=(i+.5)*2/count-1+Math.sin(i*6.17)*.32/count;
   const width=(.54+.31*Math.sin(i*1.91)**2)/count;
   const deposit=Math.round(113*depth*(.26+.74*Math.sin(i*2.32+.4)**2));
   band(center-width,center+width,Math.round(deposit*.53));
   band(center-width*.35,center+width*.62,Math.round(deposit*.47));
  }
  ctx.globalCompositeOperation='source-over';
  return c;
 }
 for(let i=0;i<count;i++){
  const center=(i+.5)*2/count-1+(Math.sin(i*6.17)*.28)/count;
  const width=(.35+.24*Math.sin(i*1.91)**2)/count;
  const value=Math.min(255,Math.round(base+115*relief*depth*((s.impastoVersion??0)>=2?.40+.60*Math.sin(i*2.32+.4)**2:.45+.55*Math.sin(i*2.32+.4)**2)));
  const profile=s.impastoVersion===3?[.43,.75,1]:[1];
  for(const [band,weight] of profile.entries()){
   const halfWidth=width*(1-band*.22);
   const gray=Math.round(base+(value-base)*weight);
   ctx.fillStyle='rgb('+gray+' '+gray+' '+gray+')';
   ctx.beginPath();ctx.moveTo(...at(-1,center-halfWidth));
   for(let j=0;j<=rails.length;j++)ctx.lineTo(...at(j,center-halfWidth));
   for(let j=rails.length;j>=-1;j--)ctx.lineTo(...at(j,center+halfWidth));
   ctx.closePath();ctx.fill();
  }
 }
 return c;
}

type Light={x:number;y:number;weave:number;jitter:number;offsetX:number;offsetY:number;sculpted:boolean};
const gpuVertex='#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}';
const gpuFragment=`#version 300 es
precision highp float;
uniform sampler2D heights;
uniform vec2 direction, origin;
uniform vec3 pigment;
uniform float weave,jitter,sculpted;
out vec4 outColor;
float h(ivec2 p){return texelFetch(heights,clamp(p,ivec2(0),textureSize(heights,0)-1),0).r;}
void main(){
 ivec2 p=ivec2(gl_FragCoord.x, float(textureSize(heights,0).y)-gl_FragCoord.y);
 float slope=dot(vec2(h(p+ivec2(1,0))-h(p-ivec2(1,0)),h(p+ivec2(0,1))-h(p-ivec2(0,1))),direction);
 vec2 q=vec2(p)+origin;
 float grain=weave*sin(q.x*1.57)*sin(q.y*1.57)*.033;
 float light=clamp(-slope+grain+(h(p)-.48)*jitter,-.44,.36);
 if(sculpted>.5){
  float shoulder=dot(vec2(h(p+ivec2(3,0))-h(p-ivec2(3,0)),h(p+ivec2(0,3))-h(p-ivec2(0,3))),direction);
  float diffuse=clamp(-slope*.52-shoulder*.74+grain,-.40,.20);
  float sheen=clamp(max(0.,-shoulder-.065)*1.3+max(0.,-slope-.15)*.40,0.,.26);
  vec3 colour=pigment*(1.+diffuse+(h(p)-.43)*jitter);
  outColor=vec4(colour+(1.-colour)*sheen,1.);
 }else{
  outColor=vec4(light>=0.?pigment+(1.-pigment)*light:pigment*(1.+light),1.);
 }
}`;
let gpu:{canvas:HTMLCanvasElement;gl:WebGL2RenderingContext;program:WebGLProgram;texture:WebGLTexture;maxSize:number;direction:WebGLUniformLocation|null;origin:WebGLUniformLocation|null;pigment:WebGLUniformLocation|null;weave:WebGLUniformLocation|null;jitter:WebGLUniformLocation|null;sculpted:WebGLUniformLocation|null}|undefined;
let gpuUnavailable=false;
function gpuLight(source:HTMLCanvasElement,rgb:number[],light:Light){
 if(gpuUnavailable)return;
 try{
  if(!gpu){
   const canvas=surface(),gl=canvas.getContext('webgl2',{powerPreference:'high-performance',failIfMajorPerformanceCaveat:true,alpha:false,antialias:false,preserveDrawingBuffer:true});
   if(!gl){gpuUnavailable=true;return;}
   canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();gpu=undefined;gpuUnavailable=true;});
   canvas.addEventListener('webglcontextrestored',()=>{gpuUnavailable=false;});
   const program=gl.createProgram()!;
   for(const [type,code] of [[gl.VERTEX_SHADER,gpuVertex],[gl.FRAGMENT_SHADER,gpuFragment]] as const){
    const shader=gl.createShader(type)!;gl.shaderSource(shader,code);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('Impasto shader compilation failed');
    gl.attachShader(program,shader);gl.deleteShader(shader);
   }
   gl.linkProgram(program);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Impasto shader linking failed');
   const texture=gl.createTexture()!;
   gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gpu={canvas,gl,program,texture,maxSize:gl.getParameter(gl.MAX_TEXTURE_SIZE),
    direction:gl.getUniformLocation(program,'direction'),origin:gl.getUniformLocation(program,'origin'),
    pigment:gl.getUniformLocation(program,'pigment'),weave:gl.getUniformLocation(program,'weave'),jitter:gl.getUniformLocation(program,'jitter'),sculpted:gl.getUniformLocation(program,'sculpted')};
  }
  const {canvas,gl,program,texture}=gpu;
  if(source.width>gpu.maxSize||source.height>gpu.maxSize)return;
  if(canvas.width!==source.width)canvas.width=source.width;
  if(canvas.height!==source.height)canvas.height=source.height;
  gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);
  gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
  gl.uniform2f(gpu.direction,light.x,light.y);
  gl.uniform2f(gpu.origin,light.offsetX,light.offsetY);
  gl.uniform3f(gpu.pigment,rgb[0]/255,rgb[1]/255,rgb[2]/255);
  gl.uniform1f(gpu.weave,light.weave);
  gl.uniform1f(gpu.jitter,light.jitter);
  gl.uniform1f(gpu.sculpted,Number(light.sculpted));
 gl.drawArrays(gl.TRIANGLES,0,3);
  if(gl.isContextLost()||gl.getError()!==gl.NO_ERROR)return;
  return canvas;
 }catch{gpuUnavailable=true;}
}
function cpuLight(source:HTMLCanvasElement,rgb:number[],light:Light){
 const {width:w,height:h}=source,ctx=fit(lit??=surface(),w,h);
 const img=source.getContext('2d')!.getImageData(0,0,w,h);
 const data=img.data,output=ctx.createImageData(w,h),out=output.data;
 const grainX=light.weave?Array.from({length:w},(_,x)=>Math.sin((x+light.offsetX)*1.57)*.033):undefined;
 for(let y=0;y<h;y++){
  const row=y*w,up=Math.max(0,y-1)*w,down=Math.min(h-1,y+1)*w;
  const farUp=Math.max(0,y-3)*w,farDown=Math.min(h-1,y+3)*w;
  const grainY=grainX?Math.sin((y+light.offsetY)*1.57):0;
  for(let x=0;x<w;x++){
   const dx=data[4*(row+Math.min(w-1,x+1))]-data[4*(row+Math.max(0,x-1))];
   const dy=data[4*(down+x)]-data[4*(up+x)];
   const k=4*(row+x);
   if(light.sculpted){
    const farDx=data[4*(row+Math.min(w-1,x+3))]-data[4*(row+Math.max(0,x-3))];
    const farDy=data[4*(farDown+x)]-data[4*(farUp+x)];
    const slope=(dx*light.x+dy*light.y)/255,shoulder=(farDx*light.x+farDy*light.y)/255;
    const diffuse=Math.max(-.40,Math.min(.20,-slope*.52-shoulder*.74+(grainX?grainX[x]*grainY:0)));
    const sheen=Math.min(.26,Math.max(0,-shoulder-.065)*1.3+Math.max(0,-slope-.15)*.40);
    const tint=1+diffuse+(data[k]/255-.43)*light.jitter;
    for(let i=0;i<3;i++){const value=rgb[i]*tint;out[k+i]=value+(255-value)*sheen;}
    out[k+3]=255;
    continue;
   }
   const shade=Math.max(-.44,Math.min(.36,-(dx*light.x+dy*light.y)/255+(grainX?grainX[x]*grainY:0)+(data[4*(row+x)]/255-.48)*light.jitter));
   for(let i=0;i<3;i++)out[k+i]=shade>=0?rgb[i]+(255-rgb[i])*shade:rgb[i]*(1+shade);
   out[k+3]=255;
  }
 }
 ctx.putImageData(output,0,0);
 return ctx.canvas;
}

export function shadeImpasto(mask:CanvasRenderingContext2D,s:Stroke,dabs:StampDab[],box:RasterRegion,heightOnly=false){
 const c=bristleHeight(s,dabs,box),angle=(s.oilLight??-135)*Math.PI/180;
 const sculpted=s.impastoVersion===4,gain=sculpted?1.72:s.impastoVersion===3?1.44:1;
 const light={x:Math.cos(angle)*gain,y:Math.sin(angle)*gain,weave:s.oilCanvas?1:0,jitter:(s.impastoVersion??0)>=2?s.oilJitter??.065:0,offsetX:box.x,offsetY:box.y,sculpted};
 const color=parseInt(s.color.slice(1),16),rgb=[color>>16&255,color>>8&255,color&255];
 const colorLayer=heightOnly?c:typeof window!=='undefined'?gpuLight(c,rgb,light)??cpuLight(c,rgb,light):cpuLight(c,rgb,light);
 mask.globalCompositeOperation='source-in';mask.drawImage(colorLayer,0,0);mask.globalCompositeOperation='source-over';
}
