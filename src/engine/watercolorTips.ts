import type {PaintTip} from '../core/paintTips';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{v=clamp(v);return v*v*(3-2*v);};
/** A loaded watercolor brush has a fairly even belly and a short feathered
 * boundary. The old soft radial airbrush profile made the whole mark fuzzy. */
export function watercolorCoverage(tip:PaintTip,u:number,v:number,hardness:number){
 let distance:number;
 if(tip==='wash-flat')distance=(Math.abs(u/.94)**8+Math.abs(v/.48)**8)**.125;
 else if(tip==='wash-dagger'){
  const t=clamp((u+.94)/1.88),width=.04+.58*(1-t)**.8,center=.12*u+.08;
  distance=Math.max(Math.abs(u)/.94,Math.abs(v-center)/width);
 }else if(tip==='wash-cats-tongue')distance=Math.abs(u/.96)**1.35+(v/.57)**2;
 else distance=Math.hypot(u,v)/.94;
 const feather=.025+.09*(1-clamp(hardness));
 return smooth((1-distance)/feather);
}
