import type {ColorNib} from '../core/coloring';
const SIDE=128,profiles=new Map<string,Float32Array>(),tips=new Map<string,HTMLCanvasElement>();
const clamp=(v:number)=>Math.max(0,Math.min(1,v)),ease=(v:number)=>{v=clamp(v);return v*v*(3-2*v);};
/** Opaque grayscale nibs are max-composited. Their analytic contact profile
 * softens coverage, not painted RGB, and overlapping samples cannot darken. */
export function coloringSoftTip(nib:ColorNib,kind:string,hardness:number,level:number){
 const base=[nib,kind,hardness].join(':'),load=Math.round(clamp(level)*64),key=base+':'+load;let tip=tips.get(key);if(tip){tips.delete(key);tips.set(key,tip);return tip;}
 let profile=profiles.get(base);if(!profile){profile=new Float32Array(SIDE*SIDE);const feather=kind==='color-blender'?.15+.4*(1-hardness):kind==='color-solid'?Math.max(.01,.65*(1-hardness)):.08+.58*(1-hardness);
  for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){const u=(x+.5)*2/SIDE-1,v=(y+.5)*2/SIDE-1,r=nib==='round'?Math.hypot(u,v):nib==='oval'?Math.hypot(u,v/.62):nib==='filbert'?(Math.abs(u)**3+Math.abs(v/.42)**3)**(1/3):nib==='chisel'?Math.max(Math.abs(u),Math.abs(v-u*.16)/.32):Math.max(Math.abs(u),Math.abs(v)/.32);profile[y*SIDE+x]=r>=1?0:kind==='color-air'?(Math.exp(-3.4*r*r)-Math.exp(-3.4))/(1-Math.exp(-3.4)):ease((1-r)/feather);}
  profiles.set(base,profile);if(profiles.size>16)profiles.delete(profiles.keys().next().value!);
 }
 tip=document.createElement('canvas');tip.width=tip.height=SIDE;const ctx=tip.getContext('2d')!,image=ctx.createImageData(SIDE,SIDE);for(let i=0;i<profile.length;i++){const j=i*4,a=Math.round(255*profile[i]*load/64);image.data[j]=image.data[j+1]=image.data[j+2]=a;image.data[j+3]=255;}ctx.putImageData(image,0,0);tips.set(key,tip);if(tips.size>128){const oldest=tips.keys().next().value!;tips.get(oldest)!.width=0;tips.delete(oldest);}return tip;
}
