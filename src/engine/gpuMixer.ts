import {blendPressureFactor,effectiveBlendStyle} from '../core/brushBlend';
import type {Stroke,Point} from '../core/model';
import {widthResponse} from './pressureChannels';
import {pressureResponse} from './strokeGeometry';
import {fullVertex,ownerVertex,ownerFragment,reservoirFragment,shadeFragment} from './gpuMixerShaders';

export type BlendEngine='Auto'|'GPU'|'CPU';
const key='solo.blendEngine';
export const preference=():BlendEngine=>{
 try{const v=localStorage.getItem(key);if(v==='GPU'||v==='CPU')return v;}catch{}
 return 'Auto';
};
export function selectEngine(v:BlendEngine){try{localStorage.setItem(key,v);}catch{}}
const status={active:'CPU',adapter:'',detail:''};
export const blendStatus=()=>status;
function publish(active:string,detail=''){
 const changed=status.active!==active||status.detail!==detail;
 Object.assign(status,{active,detail});
 if(typeof window!=='undefined'){
  Object.assign(window,{soloBlendStatus:status});
  if((process.env.NODE_ENV !== 'production'))Object.assign(window,{soloMixerLossTest:loseMixerContextForTest});
  if(changed)window.dispatchEvent(new Event('solo-blend-status'));
 }
}
export const markCpuMixer=(why:string)=>publish('CPU',why);
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const linear=(x:number)=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
function contacts(s:Stroke,path:readonly Point[],gx:number,gy:number,pitch:number,carried:boolean){
 const spacing=Math.max(.5,s.size*Math.max(.025,Math.min(.15,s.tipSpacing??.08)));
 const style=effectiveBlendStyle(s.bbStyle??'soft',s.bbRenderStyle);
 const wet=clamp((s.bbWetness??.5)*(style==='dry'||s.bbMode==='dry'?.7:style==='water'?1.08:1));
 const capacity=s.bbCapacity??.45,drag=s.bbStretch??.5,tail=s.bbTaper??.12,fade=Math.max(1,s.size*(.3+capacity*5));
 let total=0;for(let i=1;i<path.length;i++)total+=Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y);
 const out=new Float32Array((Math.ceil(total/spacing)+2)*12);
 const centers=new Float64Array(out.length/6);
 let start=0,segment=1,count=0;
 for(let distance=0;;distance=Math.min(total,distance+spacing)){
  let a=path[segment-1],b=path[segment]??a,length=Math.hypot(b.x-a.x,b.y-a.y);
  while(segment<path.length-1&&start+length<distance){start+=length;a=b;b=path[++segment];length=Math.hypot(b.x-a.x,b.y-a.y);}
  const t=length?clamp((distance-start)/length):0,p=a.p+(b.p-a.p)*t,contact=Math.sqrt(clamp(p/.4));
  const width=s.pressure&&s.pressureWidth!==false?widthResponse(pressureResponse(clamp(p)**s.response,s.pressureCurve),s):1;
  const strength=s.pressure&&s.bbPressure?blendPressureFactor(p/.4,s.bbMinPressure??.7,s.bbPressureCurve??'linear'):1;
  const moisture=wet*(s.pressure&&s.bbPressureWet?contact:1),mix=(s.bbMix??.5)*(s.pressure&&s.bbPressureMix?contact:1);
  const refill=1-Math.exp(-spacing*(s.bbPickup??.5)*moisture/Math.max(1,s.size*(.18+drag+.35*(s.bbColorCarry??.6))));
  const entry=total&&tail?Math.min(1,(distance+s.size*.15)/(s.size*(.15+tail))):1;
  const exit=total&&tail?Math.min(1,(total-distance+s.size*.15)/(s.size*(.15+tail))):1;
  const depletion=Math.exp(-distance/fade);
  const cx=(a.x+(b.x-a.x)*t-gx)/pitch-.5,cy=(a.y+(b.y-a.y)*t-gy)/pitch-.5;
  centers.set([cx,cy],2*count);
  out.set([cx,cy,Math.max(1,s.size*.5*width/pitch),strength,
   length?(b.x-a.x)/length:1,length?(b.y-a.y)/length:0,distance,moisture,
   mix,distance?refill:carried?Math.max(refill,moisture*.5):1,(1-moisture*(1-capacity)*(1-depletion))*entry*exit,(s.bbPaintLoad??0)*depletion*(1-mix)],12*count++);
  if(distance>=total)break;
 }
 return {data:out.subarray(0,count*12),centers};
}

// At a shared endpoint the CPU compares a double score to its previous
// Float32 value. Equal-depth fragments alone cannot reproduce that tie.
function endpointTies(centers:Float64Array,count:number,w:number,h:number,reach:number){
 const correction=new Float32Array(w*h),scores=new Float32Array(w*h).fill(-1);
 const winners=new Int32Array(w*h);
 for(let i=0;i<count;i++){
  const k=2*i,j=Math.max(0,k-2),cx=centers[k],cy=centers[k+1],ax=centers[j],ay=centers[j+1];
  const dx=cx-ax,dy=cy-ay,span=dx*dx+dy*dy||1;
  const x0=Math.max(0,Math.floor(Math.min(cx,ax)-reach)),x1=Math.min(w-1,Math.ceil(Math.max(cx,ax)+reach));
  const y0=Math.max(0,Math.floor(Math.min(cy,ay)-reach)),y1=Math.min(h-1,Math.ceil(Math.max(cy,ay)+reach));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const f=clamp(((x-ax)*dx+(y-ay)*dy)/span),ex=x-ax-dx*f,ey=y-ay-dy*f;
   const score=1-(ex*ex+ey*ey)/(reach*reach),pixel=y*w+x,old=scores[pixel];
   if(score<0||score<old-.000002)continue;
   if(score>old){scores[pixel]=score;winners[pixel]=i;}
   correction[pixel]=Math.abs(score-old)<.000002?winners[pixel]+1:0;
  }
 }
 return correction;
}
class MixerGL{
 readonly gl:WebGL2RenderingContext;
 private readonly programs:WebGLProgram[]=[];
 private readonly locations=new Map<WebGLProgram,Map<string,WebGLUniformLocation|null>>();
 private readonly textures:WebGLTexture[]=[];
 private fb:WebGLFramebuffer;
 private depth:WebGLRenderbuffer;
 private half:boolean;
 private capacity=0;
 private limit:number;
 private width=0;
 private height=0;
 private previous=new Float32Array(0);
 constructor(readonly canvas:HTMLCanvasElement){
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:true,powerPreference:'high-performance',depth:false,stencil:false});
  if(!gl)throw Error('WebGL2 unavailable');
  this.gl=gl;this.limit=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),2*gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS));const info=gl.getExtension('WEBGL_debug_renderer_info');
  status.adapter=String(gl.getParameter(info?info.UNMASKED_RENDERER_WEBGL:gl.RENDERER));
  this.half=!!gl.getExtension('EXT_color_buffer_float');
  this.fb=gl.createFramebuffer()!;this.depth=gl.createRenderbuffer()!;
  for(const [vert,frag] of [[ownerVertex,ownerFragment],[fullVertex,reservoirFragment],[fullVertex,shadeFragment]]){
   const program=gl.createProgram()!;
   for(const [type,code] of [[gl.VERTEX_SHADER,vert],[gl.FRAGMENT_SHADER,frag]] as const){
    const shader=gl.createShader(type)!;gl.shaderSource(shader,code);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader)??'Shader failed');
    gl.attachShader(program,shader);gl.deleteShader(shader);
   }
   gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)??'Link failed');
   this.programs.push(program);this.locations.set(program,new Map());
  }
  for(let i=0;i<8;i++){
   this.textures.push(gl.createTexture()!);this.bind(i,i);
   const target=i>=4&&i<=6?gl.TEXTURE_2D_ARRAY:gl.TEXTURE_2D;
   gl.texParameteri(target,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(target,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
   gl.texParameteri(target,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(target,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  }
  this.bind(6,6);gl.texImage3D(gl.TEXTURE_2D_ARRAY,0,gl.RGBA8,1,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.disable(gl.DITHER);
 }
 private bind(unit:number,id:number){
  const gl=this.gl,target=unit>=4&&unit<=6?gl.TEXTURE_2D_ARRAY:gl.TEXTURE_2D;
  gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(target,this.textures[id]);
 }
 render(input:HTMLCanvasElement,s:Stroke,path:readonly Point[],gx:number,gy:number,pitch:number,extent:number,w:number,h:number,carry?:Float32Array){
  const gl=this.gl;if(gl.isContextLost())throw Error('WebGL context lost');
  const {data,centers}=contacts(s,path,gx,gy,pitch,!!carry),count=data.length/12;
  if(count>this.limit)return false;
  const samplerNames=['dabs','base','carry','owners','evenTank','oddTank'];
  const unit=(i:number)=>this.bind(i,i);
  const resized=count>this.capacity;
  if(resized){
   this.capacity=Math.min(this.limit,2**Math.ceil(Math.log2(Math.max(8,count))));unit(0);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,3,this.capacity,0,gl.RGBA,gl.FLOAT,null);
   const layers=Math.ceil(this.capacity/2);
   for(const i of [4,5]){unit(i);gl.texImage3D(gl.TEXTURE_2D_ARRAY,0,this.half?gl.RGBA16F:gl.RGBA8,48,24,layers,0,gl.RGBA,this.half?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);}
   this.previous=new Float32Array(0);
  }
  unit(0);let skip=0;while(skip<Math.min(this.previous.length,data.length)&&this.previous[skip]===data[skip])skip++;
  const first=Math.floor(skip/12);
  if(first<count)gl.texSubImage2D(gl.TEXTURE_2D,0,0,first,3,count-first,gl.RGBA,gl.FLOAT,data.subarray(first*12));
  this.previous=data;
  unit(7);gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,w,h,0,gl.RED,gl.FLOAT,endpointTies(centers,count,w,h,Math.max(1,extent/pitch)*1.45+2));
  unit(1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,input);
  const carrySide=carry?Math.round(Math.sqrt(carry.length/4)):0;
  unit(2);const carried=new Float32Array(carry?.length??4);
  if(carry)for(let i=0;i<carry.length;i+=4){
   const a=carry[i+3]/255;for(let c=0;c<3;c++)carried[i+c]=linear(Math.min(255,Math.round(carry[i+c]/(a||1)))/255)*a;
   carried[i+3]=a;
  }
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,carrySide||1,carrySide||1,0,gl.RGBA,gl.FLOAT,carried);
  if(w!==this.width||h!==this.height){
   this.width=this.canvas.width=w;this.height=this.canvas.height=h;unit(3);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
   gl.bindRenderbuffer(gl.RENDERBUFFER,this.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h);
  }
  const rgb=parseInt(s.color.slice(1),16);
  const use=(index:number)=>{
   const program=this.programs[index];gl.useProgram(program);
   const map=this.locations.get(program)!;
   const u=(n:string)=>{if(!map.has(n))map.set(n,gl.getUniformLocation(program,n));return map.get(n)!;};
   samplerNames.forEach((n,i)=>gl.uniform1i(u(n),i));gl.uniform1i(u('tieMap'),7);
   gl.uniform2i(u('grid'),w,h);gl.uniform1f(u('pitch'),pitch);gl.uniform1f(u('reach'),Math.max(1,extent/pitch)*1.45+2);
   gl.uniform1f(u('flow'),s.bbFlow??.6);gl.uniform1f(u('drag'),s.bbStretch??.5);gl.uniform1f(u('textureKeep'),s.bbTextureKeep??.5);
   gl.uniform1f(u('edgeDark'),s.bbEdgeDarkness??0);gl.uniform1f(u('carrySize'),carrySide);
   gl.uniform1i(u('wash'),Number(s.watercolorBlendVersion===1));gl.uniform1i(u('solid'),Number(!!s.bbSolidLoad));
   gl.uniform1i(u('packedTank'),Number(!this.half));gl.uniform3f(u('loaded'),linear((rgb>>>16&255)/255),linear((rgb>>>8&255)/255),linear((rgb&255)/255));
   return u;
  };
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.textures[3],0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,this.depth);
  gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  use(0);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,count);gl.disable(gl.DEPTH_TEST);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,null);
  const loc=use(1)('ordinal');gl.viewport(0,0,48,24);
  for(let i=0;i<count;i++){
   const dst=4+(i%2);this.bind(dst,6);unit(dst===4?5:4);
   gl.framebufferTextureLayer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,this.textures[dst],0,i>>1);
   if(resized&&i===0&&gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Reservoir framebuffer unavailable');
   gl.uniform1i(loc,i);gl.drawArrays(gl.TRIANGLES,0,3);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);unit(4);unit(5);gl.viewport(0,0,w,h);use(2);gl.drawArrays(gl.TRIANGLES,0,3);
  if((resized&&gl.getError()!==gl.NO_ERROR)||gl.isContextLost())throw Error('GPU draw unavailable');
  return true;
 }
}

let renderer:MixerGL|undefined,failed=false;
function getRenderer(){
 if(!renderer){
  const c=document.createElement('canvas');
  c.addEventListener('webglcontextlost',e=>{e.preventDefault();failed=true;publish('CPU','context lost');});
  c.addEventListener('webglcontextrestored',()=>{renderer=undefined;failed=false;});
  renderer=new MixerGL(c);
 }
 return renderer;
}
let warmPending=false;
export function warmMixer(){
 if(renderer||failed||warmPending||typeof window==='undefined'||preference()==='CPU')return;
 warmPending=true;
 const warm=()=>{
  warmPending=false;
  if(failed||preference()==='CPU')return;
  try{getRenderer();}catch(e){failed=true;publish('CPU',String(e));}
 };
 if(window.requestIdleCallback)window.requestIdleCallback(warm,{timeout:150});
 else window.setTimeout(warm,0);
}
export function gpuField(input:HTMLCanvasElement,s:Stroke,path:readonly Point[],gx:number,gy:number,pitch:number,extent:number,w:number,h:number,carry?:Float32Array){
 if(s.brushBlendVersion!==11||typeof window==='undefined')return;
 if(preference()==='CPU'){publish('CPU');return;}
 if(failed)return;
 try{
  const mixer=getRenderer();
  if(mixer.render(input,s,path,gx,gy,pitch,extent,w,h,carry)){publish('GPU');return mixer.canvas;}
  publish('CPU','reservoir exceeds texture capacity');
 }catch(e){failed=true;console.warn('WebGL mixer fallback',e);publish('CPU',String(e));}
}
export function loseMixerContextForTest(){if((process.env.NODE_ENV !== 'production'))return renderer?.gl.getExtension('WEBGL_lose_context');}

