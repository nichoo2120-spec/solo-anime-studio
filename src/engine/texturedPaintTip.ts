import type {PaintTip} from '../core/paintTips';
const SIDE=128,TAU=Math.PI*2,clamp=(n:number)=>Math.max(0,Math.min(1,n));
function hash(x:number,y:number){let h=Math.imul(x+37,374761393)^Math.imul(y+83,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
function noise(x:number,y:number){const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b,s=u*u*(3-2*u),t=v*v*(3-2*v);return (hash(a,b)*(1-s)+hash(a+1,b)*s)*(1-t)+(hash(a,b+1)*(1-s)+hash(a+1,b+1)*s)*t;}
/** Physical tip silhouette and deposition. These are original procedural tips,
 * not Photoshop assets. Irregular bristles and chalk holes belong to the nib. */
export function paintTipCoverage(tip:PaintTip,u:number,v:number,texture:number,variant=0){
 const t=clamp(texture),shift=variant*.37,n=noise(u*17+21+shift,v*23+39),fine=hash(Math.floor(u*64+90),Math.floor(v*64+90));
 if(tip==='flat-bristle'||tip==='bristle'){
  const width=tip==='flat-bristle'?.40:.62,edge=.92-.19*noise(v*13+7+shift,12);
  const body=clamp((edge-Math.abs(u))/.18)*clamp((width-Math.abs(v))/.14);
  const fibers=noise(v*58+38+u*.8,8+shift),tufts=noise(u*8+12,v*27+41+shift);
  const bristles=fibers<.25?.025:fibers<.38?.26:.55+.45*tufts;
  return body*clamp((1-(.55+.45*t))+(.55+.45*t)*bristles)*(fine<.1*t?.1:1);
 }
 if(tip==='chalk'){
  const edge=.88+.12*noise(u*11+15,v*12+19),body=clamp((edge-Math.max(Math.abs(u),Math.abs(v*.98)))/.08);
  const chips=fine<.19+.14*t?.015:fine<.34+.14*t?.3:.58+.42*n;
  return body*chips*(.72+.28*noise(u*7+20,v*9+10));
 }
 if(tip==='felt'){
  const body=clamp(Math.min(.94-Math.abs(u),.39-Math.abs(v),1.02-Math.abs(u*.75+v*.8))/.10);
  return body*(.86+.14*n)*(fine<.09*t?.35:1);
 }
 const r=Math.hypot(u,v),edge=.82+.11*noise(u*6+11,v*6+35)+.07*(n-.5);
 return clamp((edge-r)/.16)*(.84+.12*noise(u*5+19,v*5+13))*(1-t*(fine<.08?.25:.06+.10*n));
}
type Base={coverage:Uint8Array;outline:Path2D;bounds:{x:number;y:number;w:number;h:number}};
type Stamp={canvas:HTMLCanvasElement;x:number;y:number;w:number;h:number};
const bases=new Map<string,Base>(),stamps=new Map<string,Stamp>();
const oriented=new Map<string,{coverage:Uint8Array;x:number;y:number;w:number;h:number}>();
const papers=new Map<string,HTMLCanvasElement>();
/** Canvas-anchored paper erosion is applied once to the completed mask, so
 * dense overlapping dabs cannot fill every grain hole in a chalk stroke. */
export function paintPaperPattern(tip:PaintTip){
 const key=tip==='wash'?'wash':tip==='chalk'?'chalk':'paper',cached=papers.get(key);if(cached)return cached;
 const paper=document.createElement('canvas');paper.width=paper.height=512;const ctx=paper.getContext('2d')!,img=ctx.createImageData(512,512);
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const n=hash(x,y),coarse=hash(x>>2,y>>2),j=(y*512+x)*4;let erosion=n<.21?.68:n<.4?.3:.035+.2*coarse;
  if(key==='wash'){const pool=.12+1.5*noise(x*.025+12,y*.025+43),bloom=.45+.85*noise(x*.085+39,y*.085+18);erosion=1-clamp(pool*bloom*(n<.12?.65:1));}
  else if(key==='chalk')erosion=Math.max(erosion,(1-noise(x*.1+17,y*.1+33))*.6);
  img.data[j]=img.data[j+1]=img.data[j+2]=255;img.data[j+3]=Math.round(255*erosion);
 }ctx.putImageData(img,0,0);papers.set(key,paper);return paper;
}
function base(tip:PaintTip,texture:number,variant=0){
 const key=tip+':'+texture.toFixed(2)+':'+variant;let found=bases.get(key);if(found){bases.delete(key);bases.set(key,found);return {key,...found};}
 const coverage=new Uint8Array(SIDE*SIDE);let minX=SIDE,minY=SIDE,maxX=0,maxY=0;
 for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){const a=Math.round(255*paintTipCoverage(tip,2*(x+.5)/SIDE-1,2*(y+.5)/SIDE-1,texture,variant));coverage[y*SIDE+x]=a;if(a){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
 const outline=new Path2D();for(let i=0;i<80;i++){const a=i/80*TAU,c=Math.cos(a),s=Math.sin(a);let edge=0;for(let r=0;r<=.71;r+=1/SIDE){const x=Math.floor((c*r+.5)*SIDE),y=Math.floor((s*r+.5)*SIDE);if(x>=0&&y>=0&&x<SIDE&&y<SIDE&&coverage[y*SIDE+x]>40)edge=r;}const x=c*edge,y=s*edge;if(i)outline.lineTo(x,y);else outline.moveTo(x,y);}outline.closePath();
 const x=Math.max(0,minX-2),y=Math.max(0,minY-2),bounds={x,y,w:Math.min(SIDE,maxX+3)-x,h:Math.min(SIDE,maxY+3)-y};
 found={coverage,outline,bounds};if(bases.size>=32)bases.delete(bases.keys().next().value!);bases.set(key,found);return {key,...found};
}
export function paintTipOutline(tip:PaintTip,texture:number){return base(tip,texture).outline;}
/** Cached opaque luminance stamps: lighten gives maximum coverage, so pressure
 * opacity does not accumulate with the number of input events or overlapping dabs. */
export function paintTipStamp(tip:PaintTip,texture:number,intensity:number,variant:number,angle=0){
 const b=base(tip,texture,variant),orientedKey=b.key+':'+angle,level=Math.max(0,Math.min(63,Math.round(intensity*63))),key=orientedKey+':'+level;let c=stamps.get(key);if(c){stamps.delete(key);stamps.set(key,c);return c;}
 let shape=oriented.get(orientedKey);
 if(!shape){
  // Rotate coverage once per tip setting, rather than changing the Canvas
  // transform and resampling a rotated image for every dab in a long stroke.
  const co=Math.cos(angle),si=Math.sin(angle),box=b.bounds,corners=[[box.x-SIDE/2,box.y-SIDE/2],[box.x+box.w-SIDE/2,box.y-SIDE/2],[box.x-SIDE/2,box.y+box.h-SIDE/2],[box.x+box.w-SIDE/2,box.y+box.h-SIDE/2]].map(([x,y])=>[x*co-y*si,x*si+y*co]);
  const left=Math.floor(Math.min(...corners.map(p=>p[0]))),top=Math.floor(Math.min(...corners.map(p=>p[1]))),w=Math.ceil(Math.max(...corners.map(p=>p[0])))-left,h=Math.ceil(Math.max(...corners.map(p=>p[1])))-top,coverage=new Uint8Array(w*h),at=(x:number,y:number)=>x<0||y<0||x>=SIDE||y>=SIDE?0:b.coverage[y*SIDE+x];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=left+x+.5,dy=top+y+.5,u=dx*co+dy*si+SIDE/2-.5,v=-dx*si+dy*co+SIDE/2-.5,a=Math.floor(u),d=Math.floor(v),fx=u-a,fy=v-d;coverage[y*w+x]=Math.round((at(a,d)*(1-fx)+at(a+1,d)*fx)*(1-fy)+(at(a,d+1)*(1-fx)+at(a+1,d+1)*fx)*fy);}
  shape={coverage,x:left/SIDE,y:top/SIDE,w,h};if(oriented.size>=32)oriented.delete(oriented.keys().next().value!);oriented.set(orientedKey,shape);
 }
 const canvas=document.createElement('canvas');canvas.width=shape.w;canvas.height=shape.h;const ctx=canvas.getContext('2d',{alpha:false})!,data=ctx.createImageData(shape.w,shape.h);
 for(let i=0;i<shape.coverage.length;i++){const value=Math.round(shape.coverage[i]*level/63),j=i*4;data.data[j]=data.data[j+1]=data.data[j+2]=value;data.data[j+3]=255;}ctx.putImageData(data,0,0);c={canvas,x:shape.x,y:shape.y,w:shape.w/SIDE,h:shape.h/SIDE};
 if(stamps.size>=256){const first=stamps.keys().next().value!,old=stamps.get(first)!;old.canvas.width=old.canvas.height=0;stamps.delete(first);}stamps.set(key,c);return c;
}
