export const oilCategory='Oil / Impasto' as const;
export type ImpastoControls={
 impastoVersion?:1|2|3|4|5;
 oilJitter?:number;
 oilDepth?:number;
 oilLight?:number;
 oilBristles?:number;
 oilSoftness?:number;
 oilPickup?:number;
 oilPressureLoad?:boolean;
 oilMinLoad?:number;
 oilMaxLoad?:number;
 oilCanvas?:boolean;
 oilTip?:'sketch'|'filbert'|'bristle'|'flat'|'highlight';
};
export function oilUsesPressureLoad(s:ImpastoControls&{pressure?:boolean}){
 return s.impastoVersion===5&&s.pressure===true&&s.oilPressureLoad!==false;
}
export function oilPaintLoad(s:ImpastoControls,pressure:number){
 const t=Math.max(0,Math.min(1,(pressure-.50)/.41));
 const min=s.oilMinLoad??0,max=s.oilMaxLoad??1;
 return min+(max-min)*t*t*(3-2*t);
}
export const oilTips=['sketch','filbert','bristle','flat','highlight'] as const;
export function impastoMetadata(s:ImpastoControls):ImpastoControls{
 if((s.impastoVersion!==1&&s.impastoVersion!==2&&s.impastoVersion!==3&&s.impastoVersion!==4&&s.impastoVersion!==5)||!s.oilTip||!oilTips.includes(s.oilTip))return {};
 const limit=(n:number|undefined,fallback:number,min=0,max=1)=>Number.isFinite(n)?Math.min(max,Math.max(min,n!)):fallback;
 const minLoad=limit(s.oilMinLoad,0),maxLoad=limit(s.oilMaxLoad,1,minLoad);
 return {...(s.impastoVersion===5?{oilPressureLoad:s.oilPressureLoad!==false,oilMinLoad:minLoad,oilMaxLoad:maxLoad}:{}),impastoVersion:s.impastoVersion,...(s.impastoVersion>=2?{oilJitter:limit(s.oilJitter,.065)}:{}),oilTip:s.oilTip,oilDepth:limit(s.oilDepth,.65),oilLight:limit(s.oilLight,-135,-180,180),
  oilBristles:limit(s.oilBristles,.75),oilSoftness:limit(s.oilSoftness,.2),oilPickup:limit(s.oilPickup,.08),oilCanvas:!!s.oilCanvas};
}
