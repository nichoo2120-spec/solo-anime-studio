/** v0.5.240 Paint/Blend switch for every paint brush (settings + stroke metadata).
 * In Blend mode a brush adds no colour: it blends the colours already on the
 * layer, shaped by that brush's own tip, texture, grain, pressure and spacing.
 * The renderer is engine/brushBlend.ts (built on the Silk Blend tile engine). */
export type BlendSample='layer'|'all';
/** v0.5.242 Blend character per brush family. */
export type BlendStyle='water'|'dry'|'pencil'|'ink'|'air'|'oil'|'marker'|'texture'|'soft';
/** v0.5.244 blend dynamics, independent of the brush family's material. */
export type BlendMode='soft'|'wet'|'smudge'|'dry';
export const blendModes:readonly BlendMode[]=['soft','wet','smudge','dry'];
export const isBlendMode=(v:unknown):v is BlendMode=>typeof v==='string'&&(blendModes as readonly string[]).includes(v);
export const blendStyles:readonly BlendStyle[]=['water','dry','pencil','ink','air','oil','marker','texture','soft'];
export const blendStyleNames:Record<BlendStyle,string>={water:'Watercolor',dry:'Dry brush',pencil:'Pencil',ink:'Ink',air:'Airbrush',oil:'Oil paint',marker:'Marker',texture:'Textured',soft:'Soft paint'};
export const isBlendStyle=(v:unknown):v is BlendStyle=>typeof v==='string'&&(blendStyles as readonly string[]).includes(v);
export type BrushBlendVersion=1|2|3|4;
export const isBrushBlendVersion=(v:unknown):v is BrushBlendVersion=>v===1||v===2||v===3||v===4;
export const canBlurBlendStyle=(style:BlendStyle)=>style==='air'||style==='soft';

type BlendTip={brushKind?:string;brushTip?:string;textureStrength?:number;tsEnabled?:boolean;dbEnabled?:boolean;dbTip?:string;mixTipA?:string;mixTipB?:string;mixBlend?:number};
const INKS=['g-pen','mapping','technical','brush-pen','studio-ink','contour-flow'];
/** Which family a brush blends like (from its kind and tip; custom brushes keep their source's). */
export function blendStyleFor(s:BlendTip):BlendStyle{
 const kind=s.brushKind??'';
 let tip=s.brushTip??'';
 if(s.mixTipA&&s.mixTipB&&s.mixBlend!==undefined){
  if(s.mixTipA!==s.mixTipB&&s.mixBlend>.01&&s.mixBlend<.99)return 'texture';
  tip=s.mixBlend>=.99?s.mixTipB:s.mixTipA;
 }
 if(tip.startsWith('water-')||tip==='wash'||tip.startsWith('wash-')||kind.startsWith('watercolor'))return 'water';
 if(kind.startsWith('graphite-')||/(pencil|crayon|charcoal)/i.test(kind))return 'pencil';
 if(kind.startsWith('dry-')||kind==='dry'||tip==='chalk')return 'dry';
 if(INKS.includes(kind)||/^(ink|pen)(-|$)/i.test(kind))return 'ink';
 if(kind==='marker'||tip==='felt')return 'marker';
 if(kind==='coloring-texture'||tip==='color-texture'||s.tsEnabled||s.dbEnabled&&s.dbTip)return 'texture';
 if(kind==='coloring-air'||kind==='airbrush'||tip==='color-air')return 'air';
 if(kind==='flat'||kind==='coloring-solid'||tip==='bristle'||tip==='flat-bristle')return 'oil';
 if((s.textureStrength??0)<=0&&(tip==='soft-round'||tip==='color-soft'||kind==='coloring-soft'))return 'soft';
 return 'texture';
}
/** Each family starts with the blend dynamics that suit its usual medium. */
function defaultBlendMode(style:BlendStyle):BlendMode{
 return style==='water'?'wet':style==='dry'?'dry':canBlurBlendStyle(style)?'soft':'smudge';
}
export const defaultBlendModeFor=(s:BlendTip)=>defaultBlendMode(blendStyleFor(s));
export type BrushBlendControls={
 brushBlendVersion?:BrushBlendVersion;
 /** v2 (v0.5.242): the brush family's blend character (watercolor, dry, pencil, ink, ...). */
 bbStyle?:BlendStyle;
 /** v3 (v0.5.244): blend dynamics, independent of bbStyle. */
 bbMode?:BlendMode;
 /** Blend Amount: how strongly the result replaces the original (like opacity of the blend). */
 bbAmount?:number;
 /** Colour Pickup / Load: how fast the brush picks up the colour under it. */
 bbPickup?:number;
 /** Wetness: moisture for the family, including spread for watercolor and blur for soft brushes. */
 bbWetness?:number;
 /** Mix: canvas colour (1) versus carried brush colour (0) in what is laid down. */
 bbMix?:number;
 /** Flow: how quickly the blend builds up with each dab. */
 bbFlow?:number;
 /** Stretch / drag length: how far colour is dragged before the brush runs dry (1 = never). */
 bbStretch?:number;
 /** Sample from the current layer or from all visible layers. */
 bbSample?:BlendSample;
 /** Clean brush after each stroke (true) or keep the colour it finished with. */
 bbClean?:boolean;
 /** Paint load: optional amount of the brush colour mixed in (0 = pure blending). */
 bbPaintLoad?:number;
 /** Pen pressure changes the blend amount. */
 bbPressure?:boolean;
 /** Keep transparent pixels transparent (protect alpha). */
 bbProtectAlpha?:boolean;
 /** v3: controls how long picked-up pigment remains on the nib. */
 bbColorCarry?:number;
 /** v3: softness of the blend's internal color field. */
 bbSoftness?:number;
 /** v3: strength of the brush family's grain during blending. */
 bbTextureKeep?:number;
 /** v3: added stroke stabilization, captured on pen-down. */
 bbSmoothing?:number;
 /** v3: subtle darkening at the outer blend edge; zero by default. */
 bbEdgeDarkness?:number;
 /** Stroke-only: carried colour (clean off), 8x8 RGBA, base64. */
 bbCarry?:string;
 /** Stroke-only: all-layers sample snapshot (opaque PNG) and its document rectangle. */
 bbSamplePng?:string;bbSampleRect?:{x:number;y:number;width:number;height:number};
};
export type BrushBlendSettings=Omit<BrushBlendControls,'brushBlendVersion'|'bbStyle'|'bbCarry'|'bbSamplePng'|'bbSampleRect'>&{bbEnabled?:boolean};
export const blendDefaults:Required<Omit<BrushBlendSettings,'bbEnabled'>>={bbMode:'soft',bbAmount:.85,bbPickup:.5,bbWetness:.4,bbMix:.6,bbFlow:.6,bbStretch:.45,bbSample:'layer',bbClean:true,bbPaintLoad:0,bbPressure:true,bbProtectAlpha:false,bbColorCarry:.65,bbSoftness:.5,bbTextureKeep:0,bbSmoothing:0,bbEdgeDarkness:0};
/** The values exposed for a family become its defaults only when a brush has no custom value saved. */
export function blendDefaultsFor(s:BlendTip&{stabilization?:number;edgeDarkness?:number}):typeof blendDefaults{
 const style=blendStyleFor(s),mode=defaultBlendMode(style);
 return {...blendDefaults,bbMode:mode,bbColorCarry:style==='pencil'?.35:mode==='smudge'?.78:mode==='wet'?.58:.48,bbSoftness:mode==='soft'?.78:mode==='wet'?.68:mode==='dry'?.18:.38,bbTextureKeep:style==='dry'?.85:style==='water'?.62:style==='pencil'?.8:style==='texture'?.62:style==='oil'?.72:.08,bbSmoothing:Math.max(0,Math.min(1,s.stabilization??0)),bbEdgeDarkness:style==='water'&&s.edgeDarkness===1?1:0};
}
export function brushBlendSettingsFor(s:Partial<BrushBlendSettings>&BlendTip&{stabilization?:number;edgeDarkness?:number}):typeof blendDefaults{
 const base=blendDefaultsFor(s),out={...base};
 for(const [key] of blendLimits){const v=s[key];if(typeof v==='number'&&Number.isFinite(v))out[key]=clamp01(v,base[key]);}
 if(isBlendMode(s.bbMode))out.bbMode=s.bbMode;
 if(isBlendSample(s.bbSample))out.bbSample=s.bbSample;
 for(const key of blendFlags)if(typeof s[key]==='boolean')out[key]=s[key] as never;
 return out;
}
export const blendLimits=[['bbAmount',0,1],['bbPickup',0,1],['bbWetness',0,1],['bbMix',0,1],['bbFlow',0,1],['bbStretch',0,1],['bbPaintLoad',0,1],['bbColorCarry',0,1],['bbSoftness',0,1],['bbTextureKeep',0,1],['bbSmoothing',0,1],['bbEdgeDarkness',0,1]] as const;
export const blendFlags=['bbClean','bbPressure','bbProtectAlpha'] as const;
export type BlendPresetId='blend-soft'|'blend-smudge'|'blend-wet'|'blend-dry';
export const blendPresets:{id:BlendPresetId;name:string;values:Partial<BrushBlendSettings>}[]=[
 {id:'blend-soft',name:'Soft blend',values:{bbMode:'soft',bbAmount:.85,bbPickup:.55,bbWetness:.55,bbMix:.7,bbFlow:.55,bbStretch:.35,bbColorCarry:.55,bbSoftness:.85,bbTextureKeep:.12}},
 {id:'blend-wet',name:'Wet blend',values:{bbMode:'wet',bbAmount:.9,bbPickup:.45,bbWetness:.9,bbMix:.5,bbFlow:.6,bbStretch:.55,bbColorCarry:.64,bbSoftness:.72,bbTextureKeep:.45}},
 {id:'blend-dry',name:'Dry blend',values:{bbMode:'dry',bbAmount:.9,bbPickup:.38,bbWetness:.16,bbMix:.35,bbFlow:.68,bbStretch:.65,bbColorCarry:.42,bbSoftness:.18,bbTextureKeep:.85}},
 {id:'blend-smudge',name:'Smudge blend',values:{bbMode:'smudge',bbAmount:1,bbPickup:.2,bbWetness:.15,bbMix:.15,bbFlow:.75,bbStretch:.75,bbColorCarry:.88,bbSoftness:.3,bbTextureKeep:.2}},
];
type Shape=BlendTip&{stabilization?:number;edgeDarkness?:number};
/** Every paint brush can blend, except brushes that are already blenders. */
export const canBrushBlend=(s:Shape|undefined)=>!!s&&s.brushKind!=='silk-blend'&&s.brushTip!=='color-blender';
export const isBlendSample=(v:unknown):v is BlendSample=>v==='layer'||v==='all';
const clamp01=(v:unknown,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(1,v)):fallback;
/** Stroke metadata. Only brushes with Blend switched on get these fields, so
 * Paint mode strokes stay byte-identical to v0.5.239. */
export function brushBlendMetadata(s:BrushBlendSettings&Shape):BrushBlendControls{
 if(!s.bbEnabled||!canBrushBlend(s))return {};
 const defaults=blendDefaultsFor(s),out:BrushBlendControls={brushBlendVersion:4,bbStyle:blendStyleFor(s),bbMode:isBlendMode(s.bbMode)?s.bbMode:defaults.bbMode};
 for(const [key] of blendLimits)out[key]=clamp01(s[key],defaults[key]);
 out.bbSample=isBlendSample(s.bbSample)?s.bbSample:'layer';
 for(const key of blendFlags)out[key]=typeof s[key]==='boolean'?s[key]:blendDefaults[key];
 return out;
}
/** Keeps only valid saved blend settings on a brush. */
export function sanitizeBrushBlend(p:Partial<BrushBlendSettings>,result:BrushBlendSettings&Shape,fallback:BrushBlendSettings){
 const keys=['bbEnabled','bbMode',...blendLimits.map(l=>l[0]),'bbSample',...blendFlags] as const;
 if(!canBrushBlend(result)){for(const k of keys)delete (result as Record<string,unknown>)[k];return;}
 if(typeof p.bbEnabled==='boolean')result.bbEnabled=p.bbEnabled;else if(fallback.bbEnabled===undefined)delete result.bbEnabled;
 for(const [key] of blendLimits){const v=p[key];if(typeof v==='number'&&Number.isFinite(v))result[key]=clamp01(v,blendDefaults[key]);else if(fallback[key]===undefined)delete result[key];}
 if(isBlendMode(p.bbMode))result.bbMode=p.bbMode;else if(fallback.bbMode===undefined)delete result.bbMode;
 if(isBlendSample(p.bbSample))result.bbSample=p.bbSample;else if(fallback.bbSample===undefined)delete result.bbSample;
 for(const key of blendFlags){if(typeof p[key]==='boolean')result[key]=p[key];else if(fallback[key]===undefined)delete result[key];}
}
/** Validation for saved strokes (projects, backups). */
export function validBrushBlendStroke(o:Record<string,unknown>){
 const present=Object.keys(o).some(k=>k==='brushBlendVersion'||k.startsWith('bb'));
 if(!present)return true;
 if(!isBrushBlendVersion(o.brushBlendVersion)||o.tool!=='brush')return false;
 if(o.brushBlendVersion===1?o.bbStyle!==undefined:!isBlendStyle(o.bbStyle))return false;
 for(const [key] of blendLimits){const v=o[key];if(v!==undefined&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1))return false;}
 const hasDynamics=o.brushBlendVersion>=3;
 if(hasDynamics?!isBlendMode(o.bbMode):o.bbMode!==undefined)return false;
 if(!hasDynamics&&['bbColorCarry','bbSoftness','bbTextureKeep','bbSmoothing','bbEdgeDarkness'].some(k=>o[k]!==undefined))return false;
 if(o.bbSample!==undefined&&!isBlendSample(o.bbSample))return false;
 for(const key of blendFlags)if(o[key]!==undefined&&typeof o[key]!=='boolean')return false;
 if(o.bbCarry!==undefined&&(typeof o.bbCarry!=='string'||!/^[A-Za-z0-9+/=]{1,400}$/.test(o.bbCarry)))return false;
 if(o.bbSamplePng!==undefined||o.bbSampleRect!==undefined){
  const r=o.bbSampleRect as Record<string,unknown>|undefined;
  if(typeof o.bbSamplePng!=='string'||!o.bbSamplePng.startsWith('data:image/png;base64,')||o.bbSamplePng.length>24_000_000||!r||typeof r!=='object')return false;
  for(const k of ['x','y','width','height'])if(!Number.isInteger(r[k]))return false;
  if((r.width as number)<1||(r.height as number)<1||(r.width as number)*(r.height as number)>16777216)return false;
 }
 for(const k of Object.keys(o))if(k.startsWith('bb')&&!['bbAmount','bbPickup','bbWetness','bbMix','bbFlow','bbStretch','bbSample','bbClean','bbPaintLoad','bbPressure','bbProtectAlpha','bbCarry','bbSamplePng','bbSampleRect','bbStyle','bbMode','bbColorCarry','bbSoftness','bbTextureKeep','bbSmoothing','bbEdgeDarkness'].includes(k))return false;
 return true;
}
