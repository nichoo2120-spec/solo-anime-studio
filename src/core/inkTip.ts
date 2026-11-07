export type InkTipControls={inkTipVersion?:1;inkTipShape?:'round'|'oval';inkTipRoundness?:number;inkTipAngle?:number;inkTipFollow?:boolean;inkGrainScale?:number};
export const supportsInkTip=(kind:string|undefined)=>['studio-ink','contour-flow','technical','g-pen','mapping','brush-pen'].includes(kind??'');
/** Opt-in metadata preserves the native nib of every saved unedited brush. */
export function inkTipMetadata(s:InkTipControls&{brushKind?:string}){
 return supportsInkTip(s.brushKind)&&s.inkTipVersion===1?{inkTipVersion:1 as const,inkTipShape:s.inkTipShape??'round',inkTipRoundness:s.inkTipRoundness??.5,inkTipAngle:s.inkTipAngle??0,inkTipFollow:s.inkTipFollow??false,inkGrainScale:s.inkGrainScale??1}:{};
}
export function inkTipGeometry(s:InkTipControls,tangent:number){return {aspect:s.inkTipShape==='oval'?Math.max(.1,Math.min(1,s.inkTipRoundness??.5)):1,rotation:(s.inkTipAngle??0)*Math.PI/180+(s.inkTipFollow?tangent:0)};}

