import type {Point,Stroke} from '../core/model';
import type {RasterRegion} from './liveRaster';
import {pressureResponse} from './strokeGeometry';
import {widthResponse} from './pressureChannels';
import {projectPoint} from './perspectiveWarp';

export type MixMaterial='watercolor'|'airbrush'|'dry'|'soft'|'solid';
/** Version 3 classification belongs to the saved renderer contract. */
export function mixMaterial(s:Pick<Stroke,'brushKind'|'brushTip'|'watercolorEngine'|'watercolorVersion'|'dryBristleVersion'|'textureStrength'>):MixMaterial{
 if(s.watercolorEngine===1||s.watercolorVersion!==undefined||s.brushKind==='watercolor'||s.brushKind==='watercolor-new')return 'watercolor';
 if(s.brushTip==='color-air'||s.brushKind==='airbrush'||s.brushKind==='coloring-air')return 'airbrush';
 if(s.dryBristleVersion||s.brushKind?.startsWith('graphite-')||s.brushKind==='dry-round'||['chalk','bristle','flat-bristle','color-texture'].includes(s.brushTip??''))return 'dry';
 if(['soft-round','color-soft','color-air'].includes(s.brushTip??'')||s.brushKind==='eraser-soft')return 'soft';
 return 'solid';
}
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const make=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const seedOf=(id:string)=>{let n=2166136261;for(let i=0;i<id.length;i++)n=Math.imul(n^id.charCodeAt(i),16777619);return (n>>>0)/4294967296;};
type State={id:string;signature:string;source:HTMLCanvasElement;material:MixMaterial;field:HTMLCanvasElement;touch:HTMLCanvasElement;pick:HTMLCanvasElement;incoming:HTMLCanvasElement;reservoir:HTMLCanvasElement;dab:HTMLCanvasElement;footprint:HTMLCanvasElement;raw:HTMLCanvasElement;blend:HTMLCanvasElement;grain:HTMLCanvasElement;pool:HTMLCanvasElement;count:number;last?:Point;until:number;step:number;travel:number;loaded:boolean;seed:number};
const states=new WeakMap<HTMLCanvasElement,State>(),pools=new WeakSet<HTMLCanvasElement>();
let effect:HTMLCanvasElement|undefined,cut:HTMLCanvasElement|undefined,coverage:HTMLCanvasElement|undefined;
const surfaces=(s:State)=>[s.field,s.touch,s.pick,s.incoming,s.reservoir,s.dab,s.footprint,s.raw,s.blend,s.grain,s.pool];
export function resetMaterialMix(target:HTMLCanvasElement,reuse=false){const s=states.get(target);if(reuse){pools.add(target);if(s)s.id='';}else{pools.delete(target);if(s)for(const c of surfaces(s))c.width=c.height=0;states.delete(target);}}

/** Material-specific pigment transport. All filtering and deposition stay on
 * Canvas surfaces: there are no per-contact pixel reads or timer-driven changes.
 * Colour and touched coverage are stored separately, conserving a uniform wash. */
export function applyMaterialMix(ctx:CanvasRenderingContext2D,mask:HTMLCanvasElement,s:Stroke,sourceX:number,sourceY:number,dirty?:RasterRegion,base?:HTMLCanvasElement){
 const amount=clamp(s.nativeMixAmount??.58)*clamp(s.opacity);if(!amount||s.flow===0||!s.points.length)return;
 const source=base??ctx.canvas,width=ctx.canvas.width,height=ctx.canvas.height,material=mixMaterial(s),signature=JSON.stringify({...s,points:undefined,mixStops:undefined}),reuse=pools.has(ctx.canvas);
 let g=base||reuse?states.get(ctx.canvas):undefined;const previous=g&&s.points[g.count-1];
 if(!g||g.id!==s.id||g.signature!==signature||g.source!==source||g.count>s.points.length||g.last&&(!previous||previous.x!==g.last.x||previous.y!==g.last.y||previous.p!==g.last.p)){
  const n=material==='airbrush'?1:material==='dry'?24:material==='watercolor'?12:material==='soft'?6:32,h=material==='dry'?1:n,pad=material==='watercolor'?2:0;
  const fit=(old:HTMLCanvasElement|undefined,w:number,h:number)=>{if(!reuse||!old)return make(w,h);if(old.width!==w)old.width=w;if(old.height!==h)old.height=h;old.getContext('2d')!.reset();return old;};
  g={id:s.id,signature,source,material,field:fit(g?.field,width,height),touch:fit(g?.touch,width,height),pick:fit(g?.pick,material==='dry'?64:n+pad*2,material==='dry'?64:h+pad*2),incoming:fit(g?.incoming,n,h),reservoir:fit(g?.reservoir,n,h),dab:fit(g?.dab,64,64),footprint:fit(g?.footprint,64,64),raw:fit(g?.raw,n,h),blend:fit(g?.blend,n,h),grain:fit(g?.grain,64,64),pool:fit(g?.pool,64,64),count:0,until:0,step:0,travel:0,loaded:false,seed:seedOf(s.id)};
  if(material==='watercolor'){const gc=g.grain.getContext('2d')!;gc.fillStyle='rgba(255,255,255,.25)';gc.fillRect(0,0,64,64);for(let i=0;i<18;i++){const x=((g.seed*17+i*.6180339)%1)*64,y=((g.seed*31+i*.4142135)%1)*64,r=5+(i%5)*2,gradient=gc.createRadialGradient(x,y,0,x,y,r);gradient.addColorStop(0,'rgba(255,255,255,.6)');gradient.addColorStop(1,'rgba(255,255,255,0)');gc.fillStyle=gradient;gc.fillRect(x-r,y-r,r*2,r*2);}const pc=g.pool.getContext('2d')!,edge=pc.createRadialGradient(32,32,16,32,32,31);edge.addColorStop(0,'rgba(0,0,0,0)');edge.addColorStop(.55,'rgba(0,0,0,0)');edge.addColorStop(.84,'rgba(0,0,0,.32)');edge.addColorStop(1,'rgba(0,0,0,0)');pc.fillStyle=edge;pc.fillRect(0,0,64,64);}
  if(base||reuse)states.set(ctx.canvas,g);
 }
 const field=g.field.getContext('2d')!,touch=g.touch.getContext('2d')!,pick=g.pick.getContext('2d')!,incoming=g.incoming.getContext('2d')!,reservoir=g.reservoir.getContext('2d')!,dab=g.dab.getContext('2d')!,foot=g.footprint.getContext('2d')!,N=g.incoming.width,H=g.incoming.height;
 const wet=clamp(s.waterAmount??.5),dryness=clamp(s.dryness??0),load=clamp(s.nativeMixPaintLoad??0),reach=clamp(s.nativeMixRadius??.5),water=material==='watercolor',dry=material==='dry',air=material==='airbrush';
 const nib=(p:Point)=>{const pressure=s.pressure?pressureResponse(clamp(p.p)**s.response,s.pressureCurve):1;return {pressure,width:s.pressure&&s.pressureWidth!==false?widthResponse(pressure,s):1};};
 const stepAt=(p:Point)=>Math.max(.5,Math.min(water?40:air?24:16,s.size*nib(p).width*(water?.22:air?.16:dry?.12:.1)));
 const affineScale=s.transform?Math.max(Math.hypot(s.transform[0],s.transform[1]),Math.hypot(s.transform[2],s.transform[3])):1;
 const map=(p:Point)=>s.perspective?projectPoint(p,s.perspective):s.transform?{x:s.transform[0]*p.x+s.transform[2]*p.y+s.transform[4],y:s.transform[1]*p.x+s.transform[3]*p.y+s.transform[5]}:p;
 const deposit=(raw:Point,travel:number,heading:number)=>{
  const p=map(raw),contact=nib(raw);let scale=affineScale;
  if(s.perspective){const q=map({...raw,x:raw.x+1}),r=map({...raw,y:raw.y+1});scale=Math.max(Math.hypot(q.x-p.x,q.y-p.y),Math.hypot(r.x-p.x,r.y-p.y));}
  const span=Math.max(3,Math.min(Math.max(width,height)*2,s.size*scale*contact.width*(water?1.35:air?1.8:dry?1.8:1.3)+8)),angle=dry?heading+Math.PI/2+(s.tipAngle??0)*Math.PI/180:0,phase=g!.seed*Math.PI*2+g!.travel/Math.max(1,s.size*.65);
  pick.resetTransform();pick.clearRect(0,0,g!.pick.width,g!.pick.height);incoming.clearRect(0,0,N,H);
  if(dry){
   // Each bristle keeps its own pigment. Compression is along the hairs only;
   // adjacent hairs never pass through a shared blur or average colour.
   // Keep each hair's pickup local along the stroke path. Sampling the whole
   // nib length here averages several painted marks into a soft smear and
   // makes a dry bristle act wetter than its actual textured stamp.
   pick.save();pick.translate(32,32);pick.rotate(-angle);pick.scale(64/span,64/(span*.12));pick.drawImage(source,-p.x,-p.y);pick.restore();incoming.imageSmoothingEnabled=true;incoming.drawImage(g!.pick,0,0,64,64,0,0,N,1);
  }else if(water){
   const spread=(.2+wet*clamp(s.wetDiffusion??.65)*1.35)*(1-dryness*.75),drift=wet*(1-dryness)*.3,dx=Math.sin(phase)*drift,dy=Math.cos(phase*.73)*drift,extra=span*2/N;
   pick.imageSmoothingQuality='high';pick.drawImage(source,p.x-span/2-extra,p.y-span/2-extra,span+extra*2,span+extra*2,0,0,N+4,H+4);
   // A two-dimensional, locally advected pigment front. Water controls exchange
   // between neighbours; dry paper arrests it. The padded pick clamps no alpha.
   incoming.save();incoming.globalCompositeOperation='lighter';
   for(const [x,y,a]of [[dx,dy,.5],[dx-spread,dy,.125],[dx+spread,dy,.125],[dx,dy-spread,.125],[dx,dy+spread,.125]]){incoming.globalAlpha=a;incoming.drawImage(g!.pick,2+x,2+y,N,H,0,0,N,H); }incoming.restore();
   // Local capillary pockets exchange pigment at different rates. Blending the
   // undiffused and diffused fields keeps constant paint unchanged while colour
   // boundaries develop granular, uneven wet fronts instead of a uniform blur.
   const raw=g!.raw.getContext('2d')!,blend=g!.blend.getContext('2d')!;raw.clearRect(0,0,N,H);raw.drawImage(g!.pick,2+dx,2+dy,N,H,0,0,N,H);blend.clearRect(0,0,N,H);blend.drawImage(raw.canvas,0,0);blend.globalCompositeOperation='destination-out';blend.drawImage(g!.grain,0,0,64,64,0,0,N,H);blend.globalCompositeOperation='source-over';incoming.globalCompositeOperation='destination-in';incoming.drawImage(g!.grain,0,0,64,64,0,0,N,H);incoming.globalCompositeOperation='lighter';incoming.drawImage(blend.canvas,0,0);incoming.globalCompositeOperation='source-over';
  }else{incoming.imageSmoothingQuality='high';incoming.drawImage(source,p.x-span/2,p.y-span/2,span,span,0,0,N,H);}
  if(load){incoming.save();incoming.globalCompositeOperation='destination-out';incoming.globalAlpha=load;incoming.fillRect(0,0,N,H);incoming.globalCompositeOperation='lighter';incoming.fillStyle=s.color;incoming.fillRect(0,0,N,H);incoming.restore();}
  const hold=s.size*(water?.3+.65*wet+.2*reach:air?.045+.045*reach:dry?.08+.2*clamp(s.dryLoad??.8)+.12*reach:material==='soft'?.13+.18*reach:.07+.12*reach),rate=g!.loaded?1-Math.exp(-travel/Math.max(1,hold)*(.35+.65*contact.pressure)):1;
  reservoir.save();reservoir.globalCompositeOperation='destination-out';reservoir.globalAlpha=rate;reservoir.fillRect(0,0,N,H);reservoir.globalCompositeOperation='lighter';reservoir.drawImage(g!.incoming,0,0);reservoir.restore();g!.loaded=true;
  foot.resetTransform();foot.clearRect(0,0,64,64);
  const feather=foot.createRadialGradient(32,32,air?0:water?7:dry?22:27,32,32,32);feather.addColorStop(0,'white');feather.addColorStop(1,'rgba(255,255,255,0)');
  foot.save();if(water){foot.beginPath();for(let i=0;i<32;i++){const a=i/32*Math.PI*2,r=29*(1+wet*(1-dryness)*(.045*Math.sin(a*3+phase)+.025*Math.sin(a*5-phase)));const x=32+Math.cos(a)*r,y=32+Math.sin(a)*r;i?foot.lineTo(x,y):foot.moveTo(x,y);}foot.closePath();foot.clip();}foot.fillStyle=feather;foot.fillRect(0,0,64,64);foot.restore();
  if(dry){const tooth=clamp(s.dryTooth??s.textureStrength??.6),noise=(i:number)=>{const n=Math.sin((g!.seed*10000+i*12.9898)*78.233)*43758.5453;return n-Math.floor(n);};for(let lane=0;lane<22;lane++){const x=lane*64/22+(noise(lane)-.5)*1.7,width=.25+noise(lane+31)*(.55+tooth*1.25);let y=noise(lane+71)*5;while(y<64){const length=2+noise(lane*17+Math.floor(y)+101)*(4+tooth*11),gap=noise(lane*23+Math.floor(y)+211);if(gap<.14+tooth*.48)foot.clearRect(x,y,width,length);y+=length+1+noise(lane*29+Math.floor(y)+307)*5;}}}
  dab.clearRect(0,0,64,64);dab.imageSmoothingEnabled=!dry;dab.drawImage(g!.reservoir,0,0,N,H,0,0,64,64);dab.globalCompositeOperation='destination-in';dab.drawImage(g!.footprint,0,0);dab.globalCompositeOperation='source-over';if(water){dab.globalCompositeOperation='source-atop';dab.globalAlpha=clamp(s.pigmentBuildup??.4)*wet*(1-dryness)*.16;dab.drawImage(g!.pool,0,0);dab.globalAlpha=1;dab.globalCompositeOperation='source-over';}
  for(const out of [field,touch]){out.save();out.translate(p.x,p.y);out.rotate(angle);if(out===field){out.globalCompositeOperation='destination-out';out.drawImage(g!.footprint,-span/2,-span/2,span,span);out.globalCompositeOperation='lighter';out.drawImage(g!.dab,-span/2,-span/2,span,span);}else{out.globalCompositeOperation='source-over';out.drawImage(g!.footprint,-span/2,-span/2,span,span);}out.restore();}
  g!.travel+=travel;
 };
 for(let i=g.count;i<s.points.length;i++){const b=s.points[i],a=i?s.points[i-1]:b;if(!i){deposit(b,0,0);g.until=g.step=stepAt(b);continue;}const length=Math.hypot(b.x-a.x,b.y-a.y);let d=g.until;while(length>0&&d<=length+1e-8){const t=Math.min(1,d/length),p={...b,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,p:a.p+(b.p-a.p)*t};const aa=map(a),bb=map(b);deposit(p,g.step,Math.atan2(bb.y-aa.y,bb.x-aa.x));g.step=stepAt(p);d+=g.step;}g.until=d-length;}
 g.count=s.points.length;g.last={...s.points.at(-1)!};
 const r=dirty??{x:0,y:0,width,height},x=Math.max(0,Math.floor(r.x)),y=Math.max(0,Math.floor(r.y)),w=Math.min(width,Math.ceil(r.x+r.width))-x,h=Math.min(height,Math.ceil(r.y+r.height))-y;if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return;
 effect??=make(1,1);cut??=make(1,1);coverage??=make(1,1);for(const c of [effect,cut,coverage]){if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;}
 const cc=coverage.getContext('2d')!;cc.clearRect(0,0,w,h);cc.globalCompositeOperation='source-over';
 // Wet pigment opacity is not a second mixing-strength slider. Calibrate its
 // transparent native mask while retaining its exact grain, holes and outline.
 const gain=water?Math.min(4,1.1/Math.max(.25,(s.flow??1)*(s.pigmentAmount??.8))):1;
 for(let i=0;i<Math.ceil(gain);i++){cc.globalAlpha=Math.min(1,gain-i);cc.drawImage(mask,sourceX-x,sourceY-y);}cc.globalAlpha=1;cc.globalCompositeOperation='source-over';
 const ec=effect.getContext('2d')!,kc=cut.getContext('2d')!;for(const [out,source]of [[ec,g.field],[kc,g.touch]] as const){out.clearRect(0,0,w,h);out.drawImage(source,x,y,w,h,0,0,w,h);out.globalCompositeOperation='destination-in';out.drawImage(coverage,0,0);out.globalCompositeOperation='source-over';}
 ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;if(base){ctx.clearRect(x,y,w,h);ctx.drawImage(base,x,y,w,h,x,y,w,h);}ctx.globalAlpha=amount;ctx.globalCompositeOperation='destination-out';ctx.drawImage(cut,x,y);ctx.globalCompositeOperation='lighter';ctx.drawImage(effect,x,y);ctx.restore();
}

