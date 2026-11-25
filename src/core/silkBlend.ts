import type {BrushBlendSettings} from './brushBlend';

/** v0.5.238 Silk Blend: a brand-new blending brush (not the removed Mix brush).
 * Settings and stroke metadata only. The renderer lives in engine/silkBlend.ts. */
export type SilkMode='soft'|'wet'|'smudge'|'dry';
export const silkModes:{id:SilkMode;name:string;hint:string}[]=[
 {id:'soft',name:'Soft',hint:'Gentle, airbrush-like blending into a smooth gradient.'},
 {id:'wet',name:'Wet',hint:'Watercolour: colours bleed softly into each other, with darker wet edges.'},
 {id:'smudge',name:'Smudge',hint:'Pulls colour along the stroke and fades out as you go.'},
 {id:'dry',name:'Dry',hint:'Rough, broken blend with paper grain and bristle streaks.'},
];
export const isSilkMode=(v:unknown):v is SilkMode=>v==='soft'||v==='wet'||v==='smudge'||v==='dry';
export type SilkBlendControls={silkBlendVersion?:1|2;silkMode?:SilkMode;silkStrength?:number;silkPickup?:number;silkWetness?:number;silkTexture?:number;edgeDarkness?:number};
export const silkLimits=[['silkStrength',0,1],['silkPickup',0,1],['silkWetness',0,1],['silkTexture',0,1]] as const;
export const SILK_BRUSH_ID='silk-blend';
export const SILK_BRUSH_KIND='silk-blend';
export type SilkPresetId='silk-soft'|'silk-wet'|'silk-dry';
/** Preset values for the in-panel Silk Soft / Silk Wet / Silk Dry buttons.
 * Size and colour are kept when a preset is applied. */
export const silkPresets:{id:SilkPresetId;name:string;values:{silkMode:SilkMode;silkStrength:number;silkPickup:number;silkWetness:number;silkTexture:number;opacity:number;tipSpacing:number;stabilization:number}}[]=[
 {id:'silk-soft',name:'Silk Soft',values:{silkMode:'soft',silkStrength:.55,silkPickup:.7,silkWetness:.35,silkTexture:0,opacity:1,tipSpacing:.08,stabilization:.12}},
 {id:'silk-wet',name:'Silk Wet',values:{silkMode:'wet',silkStrength:.7,silkPickup:.45,silkWetness:.75,silkTexture:0,opacity:1,tipSpacing:.07,stabilization:.12}},
 {id:'silk-dry',name:'Silk Dry',values:{silkMode:'dry',silkStrength:.75,silkPickup:.5,silkWetness:.2,silkTexture:.65,opacity:1,tipSpacing:.06,stabilization:.08}},
];
export const isSilkBrush=(s:{brushKind?:string}|undefined)=>s?.brushKind===SILK_BRUSH_KIND;
type SilkStyleSettings=Pick<BrushBlendSettings,'bbEnabled'|'bbRenderStyle'>&{brushKind?:string};
export const isSilkBlendActive=(s:SilkStyleSettings)=>(
 (s.bbEnabled??isSilkBrush(s))&&(s.bbRenderStyle??(isSilkBrush(s)?'silk':'auto'))==='silk'
);
const clamp01=(v:unknown,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(1,v)):fallback;
/** Silk still serializes the original engine descriptor for replay. */
export function silkStrokeMetadata(s:SilkBlendControls&SilkStyleSettings):SilkBlendControls{
 if(!isSilkBlendActive(s))return {};
 return {silkBlendVersion:2,silkMode:isSilkMode(s.silkMode)?s.silkMode:'soft',silkStrength:clamp01(s.silkStrength,.55),silkPickup:clamp01(s.silkPickup,.7),silkWetness:clamp01(s.silkWetness,.35),silkTexture:clamp01(s.silkTexture,0),...(s.silkMode==='wet'?{edgeDarkness:0}:{})};
}
/** Keep a brush's Silk controls when the artist switches to another style. */
export function sanitizeSilk(p:Partial<SilkBlendControls>,result:SilkBlendControls&SilkStyleSettings,fallback:SilkBlendControls){
 delete result.silkBlendVersion;
 if(result.bbRenderStyle!=='silk'&&!isSilkBrush(result)&&p.silkMode===undefined&&!silkLimits.some(([key])=>p[key]!==undefined))return;
 result.silkMode=isSilkMode(p.silkMode)?p.silkMode:isSilkMode(fallback.silkMode)?fallback.silkMode:'soft';
 for(const [key] of silkLimits)result[key]=clamp01(p[key],fallback[key]??silkPresets[0].values[key]);
}
