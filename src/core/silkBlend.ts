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
export type SilkBlendControls={silkBlendVersion?:1|2;silkMode?:SilkMode;silkStrength?:number;silkPickup?:number;silkWetness?:number;silkTexture?:number};
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
const clamp01=(v:unknown,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(1,v)):fallback;
/** Stroke metadata. Only Silk Blend brushes get any of these fields, so every
 * other brush keeps byte-identical strokes and pixels. */
export function silkStrokeMetadata(s:SilkBlendControls&{brushKind?:string}):SilkBlendControls{
 if(!isSilkBrush(s))return {};
 return {silkBlendVersion:2,silkMode:isSilkMode(s.silkMode)?s.silkMode:'soft',silkStrength:clamp01(s.silkStrength,.55),silkPickup:clamp01(s.silkPickup,.7),silkWetness:clamp01(s.silkWetness,.35),silkTexture:clamp01(s.silkTexture,0)};
}
/** Keeps only valid saved Silk settings. Non-Silk brushes never receive them. */
export function sanitizeSilk(p:Partial<SilkBlendControls>,result:SilkBlendControls&{brushKind?:string},fallback:SilkBlendControls&{brushKind?:string}){
 if(!isSilkBrush(result)&&!isSilkBrush(fallback)){for(const key of ['silkMode','silkStrength','silkPickup','silkWetness','silkTexture'] as const)delete result[key];delete result.silkBlendVersion;return;}
 result.silkMode=isSilkMode(p.silkMode)?p.silkMode:isSilkMode(fallback.silkMode)?fallback.silkMode:'soft';
 for(const [key] of silkLimits)result[key]=clamp01(p[key],fallback[key]??.5);
 delete result.silkBlendVersion;
}
