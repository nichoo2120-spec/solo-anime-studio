import {natureSettings,naturePresets,type NatureSettings,type NatureTip} from '../core/natureBrush';

const pixels=112, colors=8;
export function natureCanvas(w:number,h:number):HTMLCanvasElement{
 const canvas=typeof OffscreenCanvas==='function'
  ?new OffscreenCanvas(w,h) as unknown as HTMLCanvasElement
  :document.createElement('canvas');
 if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
 return canvas;
}
export function natureNoise(seed:number,index:number,channel:number){
 let n=seed^Math.imul(index+1,0x9e3779b1)^Math.imul(channel+1,0x85ebca77);
 n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
 return ((n^(n>>>16))>>>0)/4294967296;
}
type TipContext=CanvasRenderingContext2D;
const gray=(v:number)=>`rgb(${v},${v},${v})`;
function ellipse(c:TipContext,x:number,y:number,rx:number,ry:number,shade:number,angle=0){
 c.fillStyle=gray(shade);c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fill();
}
function polygon(c:TipContext,shade:number,...xy:number[]){
 c.fillStyle=gray(shade);c.beginPath();c.moveTo(xy[0],xy[1]);
 for(let i=2;i<xy.length;i+=2)c.lineTo(xy[i],xy[i+1]);
 c.closePath();c.fill();
}
function blade(c:TipContext,x:number,y:number,w:number,h:number,bend:number,shade:number){
 c.fillStyle=gray(shade);c.beginPath();c.moveTo(x-w,y);
 c.quadraticCurveTo(x-w*.35,y-h*.69,x+bend,y-h);
 c.quadraticCurveTo(x+bend*.65+w*.45,y-h*.6,x+w,y);c.fill();
}
function leaf(c:TipContext,x:number,y:number,w:number,h:number,angle:number,round:boolean,shade:number){
 c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=gray(shade);c.beginPath();c.moveTo(-w*.96,0);
 if(round)c.bezierCurveTo(-w*.68,-h*1.15,w*.92,-h,w,0);
 else c.quadraticCurveTo(-w*.05,-h,w,0);
 c.quadraticCurveTo(w*.04,h,-w*.96,0);c.fill();
 c.beginPath();c.moveTo(-w*.87,0);c.quadraticCurveTo(w*.03,h*.14,w*.59,-h*.09);
 c.lineWidth=Math.min(.017,h*.14);c.strokeStyle=gray(Math.max(62,shade-70));c.stroke();c.restore();
}
function rock(c:TipContext,x:number,y:number,w:number,h:number,shade:number,cliff=false){
 c.save();c.translate(x,y);c.scale(w,h);
 polygon(c,shade,.04,.63,.18,.24,.43,.06,.78,.14,.96,.40,.91,.76,.67,.96,.24,.89);
 polygon(c,Math.min(255,shade+39),.18,.24,.43,.06,.78,.14,.58,.38,.34,.51,.04,.63);
 polygon(c,Math.max(45,shade-72),.58,.38,.78,.14,.96,.40,.91,.76,.67,.96,.57,.70);
 c.lineWidth=cliff?.032:.018;c.strokeStyle=gray(shade-85);
 c.beginPath();c.moveTo(.51,.18);c.lineTo(.49,.39);c.lineTo(.68,.51);c.lineTo(.55,.71);c.lineTo(.58,.86);c.moveTo(.68,.51);c.lineTo(.82,.48);c.stroke();
 c.restore();
}
function fog(c:TipContext,x:number,y:number,rx:number,ry:number,shade:number){
 c.save();c.translate(x,y);c.scale(rx,ry);
 const shadeRamp=c.createRadialGradient(0,-.14,.09,0,0,1);
 shadeRamp.addColorStop(0,gray(shade));shadeRamp.addColorStop(.48,`rgba(${shade},${shade},${shade},.87)`);shadeRamp.addColorStop(1,'transparent');
 c.fillStyle=shadeRamp;c.beginPath();c.arc(0,0,1,0,Math.PI*2);c.fill();c.restore();
}
function swell(c:TipContext,x:number,y:number,w:number,h:number,shade:number,width:number){
 c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+w*.21,y-h,x+w*.46,y+h,x+w*.68,y-h*.28);c.quadraticCurveTo(x+w*.89,y-h*.8,x+w,y-h*.16);
 c.lineCap='round';c.lineWidth=width;c.strokeStyle=gray(shade);c.stroke();
}
function sparkle(c:TipContext,x:number,y:number,w:number,h:number,shade:number){
 polygon(c,shade,x-w,y,x-w*.17,y-h*.19,x,y-h,x+w*.17,y-h*.19,x+w,y,x+w*.17,y+h*.19,x,y+h,x-w*.17,y+h*.19);
}

const atlas=new Map<NatureTip,ImageData>();
function generate(tip:NatureTip){
 const surface=natureCanvas(pixels,pixels),c=surface.getContext('2d',{willReadFrequently:true})!;
 c.scale(pixels,pixels);
 const index=naturePresets.findIndex(([id])=>id===tip);
 const random=(i:number,k:number)=>natureNoise(7241+index,i,k);
 if(tip.startsWith('grass')){
  const tall=tip==='grass-tall',edge=tip==='grass-edge',count=edge?14:tall?8:10;
  if(edge)ellipse(c,.5,.54,.46,.047,158);
  for(let i=0;i<count;i++){
   const x=.11+i/(count-1)*.78,y=.53+random(i,1)*.065;
   blade(c,x,y,tall?.016:.024,(tall?.27:edge?.07:.11)+random(i,2)*(tall?.22:.16),(random(i,3)-.5)*(tall?.34:.22),145+Math.floor(random(i,4)*110));
  }
 }else if(tip.startsWith('leaves')||tip==='foliage-clump'){
  if(tip==='leaves-round')leaf(c,.5,.51,.38,.35,-.31,true,244);
  if(tip==='leaves-pointed')leaf(c,.5,.52,.45,.29,-.68,false,243);
  if(tip==='leaves-falling'){
   leaf(c,.39,.34,.30,.25,.55,false,245);leaf(c,.68,.68,.24,.22,-.52,true,187);
  }
  if(tip==='foliage-clump'){
   ellipse(c,.50,.55,.36,.31,117);
   for(let i=0;i<24;i++){
    const angle=i*2.399963,r=.34*Math.sqrt((i+.5)/24),x=.5+Math.cos(angle)*r,y=.49+Math.sin(angle)*r*.89;
    leaf(c,x,y,.13+random(i,4)*.065,.10+random(i,5)*.08,angle,i%2===0,Math.round(132+(1-y)*96+random(i,1)*34));
   }
  }
 }else if(tip.startsWith('rock')){
  if(tip==='rock-surface')rock(c,.06,.09,.88,.81,210);
  if(tip==='rock-pebbles')for(let i=0;i<8;i++)rock(c,.07+i%3*.28+random(i,1)*.06,.11+Math.floor(i/3)*.25+random(i,2)*.06,.15+random(i,3)*.19,.14+random(i,4)*.14,171+Math.floor(random(i,5)*62));
  if(tip==='rock-cliff'){
   rock(c,.11,.05,.37,.91,190,true);rock(c,.37,.13,.46,.84,211,true);rock(c,.67,.04,.24,.89,175,true);
  }
 }else if(tip.startsWith('cloud')){
  if(tip==='cloud-soft'){
   fog(c,.32,.55,.29,.27,240);fog(c,.55,.43,.31,.34,254);fog(c,.72,.58,.25,.23,231);fog(c,.49,.64,.39,.2,221);
  }
  if(tip==='cloud-cumulus'){
   fog(c,.50,.64,.43,.29,222);
   const fade=c.createLinearGradient(0,.15,0,.77);fade.addColorStop(0,'white');fade.addColorStop(.63,gray(238));fade.addColorStop(1,'transparent');
   c.fillStyle=fade;c.beginPath();c.moveTo(.09,.57);c.bezierCurveTo(.06,.44,.20,.36,.31,.40);c.bezierCurveTo(.32,.19,.48,.09,.60,.19);c.bezierCurveTo(.66,.21,.71,.29,.72,.37);c.bezierCurveTo(.89,.34,.96,.49,.90,.59);c.bezierCurveTo(.78,.81,.20,.77,.09,.57);c.fill();
  }
  if(tip==='cloud-streak'){
   fog(c,.53,.43,.47,.073,246);fog(c,.39,.54,.36,.065,233);fog(c,.65,.62,.29,.037,250);
  }
  if(tip==='cloud-highlight'){
   c.beginPath();c.moveTo(.07,.63);c.quadraticCurveTo(.09,.43,.3,.46);c.bezierCurveTo(.33,.19,.58,.14,.69,.39);c.quadraticCurveTo(.86,.33,.93,.58);
   c.strokeStyle=gray(248);c.lineWidth=.048;c.lineCap='round';c.stroke();
   fog(c,.44,.38,.34,.14,217);
  }
 }else if(tip==='water-foam'){
  for(let i=0;i<6;i++){
   swell(c,.06+random(i,3)*.26,.25+i*.10,.23+random(i,4)*.40,.08,215+Math.floor(random(i,6)*39),.016+random(i,5)*.023);
   ellipse(c,.14+random(i,7)*.79,.24+i*.106,.012+random(i,8)*.012,.012,246);
  }
 }else if(tip==='water-ripples'){
  for(let i=0;i<4;i++){
   c.beginPath();c.ellipse(.48,.50,.13+i*.108,.037+i*.058,0,.04+i*.40,Math.PI*1.49+i*.19);c.strokeStyle=gray(252-i*33);c.lineWidth=.018+i*.003;c.stroke();
  }
 }else if(tip==='water-sparkle'){
  sparkle(c,.53,.44,.26,.28,255);
  for(let i=0;i<9;i++)sparkle(c,.12+random(i,3)*.76,.15+random(i,4)*.70,.017+random(i,5)*.06,.02+random(i,6)*.068,197+Math.floor(random(i,2)*58));
 }else if(tip==='water-crest'){
  c.fillStyle=gray(178);c.beginPath();c.moveTo(.06,.69);c.bezierCurveTo(.34,.72,.35,.12,.73,.21);c.bezierCurveTo(.94,.27,.90,.46,.68,.42);c.bezierCurveTo(.55,.38,.56,.62,.92,.65);c.quadraticCurveTo(.54,.85,.06,.69);c.fill();
  c.beginPath();c.moveTo(.14,.66);c.bezierCurveTo(.35,.62,.38,.21,.68,.22);c.quadraticCurveTo(.89,.23,.81,.38);c.strokeStyle='#fff';c.lineWidth=.052;c.lineCap='round';c.stroke();
  for(let i=0;i<7;i++)ellipse(c,.59+random(i,1)*.30,.09+random(i,2)*.13,.012,.014,248);
 }
 return c.getImageData(0,0,pixels,pixels);
}
function base(tip:NatureTip){
 let image=atlas.get(tip);
 if(!image){image=generate(tip);atlas.set(tip,image);}
 return image;
}
export function warmNatureTip(tip:NatureTip){base(tip);}

const paletteCache=new Map<string,HTMLCanvasElement>();
const unit=(v:number)=>Math.max(0,Math.min(1,v));
function colorChannels(rgb:number,turn:number,sat:number,light:number){
 const r=(rgb>>>16)/255,g=(rgb>>>8&255)/255,b=(rgb&255)/255,high=Math.max(r,g,b),low=Math.min(r,g,b),spread=high-low,l=(high+low)/2;
 const h=spread===0?0:(high===r?(g-b)/spread:high===g?2+(b-r)/spread:4+(r-g)/spread)/6;
 const s=spread?spread/(1-Math.abs(2*l-1)):0,lum=unit(l+light),chroma=(1-Math.abs(2*lum-1))*unit(s*(1+sat));
 const channel=(o:number)=>{const k=(o+(h+turn+1)*12)%12;return (lum-(chroma/2)*Math.max(-1,Math.min(k-3,9-k,1)))*255;};
 return [channel(0),channel(8),channel(4)];
}
export const natureTipPixels=pixels;
export const naturePaletteSize=colors;
/** Cache normalized stamp images. A dab reuses one atlas cell, and Canvas
 * changes its scale and rotation with a bucketed affine matrix. */
export function naturePalette(data:NatureSettings,color:string){
 const key=[data.tip,color,data.mix?data.second:'',data.hue,data.saturation,data.brightness,data.grain,data.scale].join('|');
 const cached=paletteCache.get(key);if(cached){paletteCache.delete(key);paletteCache.set(key,cached);return cached;}
 const surface=natureCanvas(pixels*colors,pixels),context=surface.getContext('2d')!,source=base(data.tip).data;
 const main=parseInt(color.slice(1),16),second=parseInt(data.second.slice(1),16),image=context.createImageData(pixels,pixels),dest=image.data;
 for(let j=0;j<colors;j++){
  const turn=(natureNoise(122,j,1)*2-1)*data.hue/100,sat=(natureNoise(122,j,2)*2-1)*data.saturation/100,light=(natureNoise(122,j,3)*2-1)*data.brightness/200;
  const tint=data.mix?natureNoise(122,j,0)*.72:0,a=colorChannels(main,turn,sat,light),b=colorChannels(second,turn,sat,light);
  const r=a[0]+(b[0]-a[0])*tint,g=a[1]+(b[1]-a[1])*tint,blue=a[2]+(b[2]-a[2])*tint;
  for(let y=0,i=0;y<pixels;y++)for(let x=0;x<pixels;x++,i+=4){
   const grain=natureNoise(402,Math.floor(x/data.scale)+Math.floor(y/data.scale)*461,j%2);
   const shade=source[i]/255*(1-data.grain*grain*.35);
   dest[i]=r*shade;dest[i+1]=g*shade;dest[i+2]=blue*shade;
   dest[i+3]=source[i+3]*(1-data.grain*Math.max(0,grain-.46)*1.35);
  }
  context.putImageData(image,j*pixels,0);
 }
 paletteCache.set(key,surface);
 while(paletteCache.size>36){
  // Evict the map entry only. A live stroke may still own this canvas.
  paletteCache.delete(paletteCache.keys().next().value!);
 }
 return surface;
}

export function secondaryNatureAtlas(tip:NatureTip,grain:number){
 return naturePalette({...natureSettings(tip),mix:false,hue:0,saturation:0,brightness:0,grain},'#ffffff');
}
