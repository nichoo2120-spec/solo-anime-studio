export const oilCategory='Oil / Impasto' as const;
export type ImpastoControls={
 impastoVersion?:1|2;
 oilJitter?:number;
 oilDepth?:number;
 oilLight?:number;
 oilBristles?:number;
 oilSoftness?:number;
 oilPickup?:number;
 oilCanvas?:boolean;
 oilTip?:'sketch'|'filbert'|'bristle'|'flat'|'highlight';
};
export const oilTips=['sketch','filbert','bristle','flat','highlight'] as const;
export function impastoMetadata(s:ImpastoControls):ImpastoControls{
 if((s.impastoVersion!==1&&s.impastoVersion!==2)||!s.oilTip||!oilTips.includes(s.oilTip))return {};
 const limit=(n:number|undefined,fallback:number,min=0,max=1)=>Number.isFinite(n)?Math.min(max,Math.max(min,n!)):fallback;
 return {impastoVersion:s.impastoVersion,...(s.impastoVersion===2?{oilJitter:limit(s.oilJitter,.065)}:{}),oilTip:s.oilTip,oilDepth:limit(s.oilDepth,.65),oilLight:limit(s.oilLight,-135,-180,180),
  oilBristles:limit(s.oilBristles,.75),oilSoftness:limit(s.oilSoftness,.2),oilPickup:limit(s.oilPickup,.08),oilCanvas:!!s.oilCanvas};
}
