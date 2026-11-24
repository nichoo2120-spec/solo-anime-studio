/** v0.5.240 Paint/Blend switch for every paint brush (settings + stroke metadata).
 * In Blend mode a brush adds no colour: it blends the colours already on the
 * layer, shaped by that brush's own tip, texture, grain, pressure and spacing.
 * The renderer is engine/brushBlend.ts (built on the Silk Blend tile engine). */
export type BlendSample='layer'|'all';
/** v0.5.242 Blend character per brush family. */
export type BlendStyle='water'|'dry'|'pencil'|'ink'|'air'|'oil'|'marker'|'texture'|'soft';
export const blendStyles:readonly BlendStyle[]=['water','dry','pencil','ink','air','oil','marker','texture','soft'];
export const blendStyleNames:Record<BlendStyle,string>={water:'Watercolor',dry:'Dry brush',pencil:'Pencil',ink:'Ink',air:'Airbrush',oil:'Oil paint',marker:'Marker',texture:'Textured',soft:'Soft paint'};
export const isBlendStyle=(v:unknown):v is BlendStyle=>typeof v==='string'&&(blendStyles as readonly string[]).includes(v);
const INKS=['g-pen','mapping','technical','brush-pen','studio-ink','contour-flow'];
/** Which family a brush blends like (from its kind and tip; custom brushes keep their source's). */
export function blendStyleFor(s:{brushKind?:string;brushTip?:string}):BlendStyle{
 const kind=s.brushKind??'',tip=s.brushTip??'';
 if(tip.startsWith('water-')||tip==='wash'||tip.startsWith('wash-')||kind.startsWith('watercolor'))return 'water';
 if(kind.startsWith('dry-')||kind==='dry'||tip==='chalk')return 'dry';
 if(kind.startsWith('graphite-'))return 'pencil';
 if(INKS.includes(kind))return 'ink';
 if(kind==='coloring-air'||kind==='airbrush'||tip==='color-air')return 'air';
 if(kind==='marker'||tip==='felt')return 'marker';
 if(kind==='coloring-texture'||tip==='color-texture')return 'texture';
 if(kind==='flat'||kind==='coloring-solid'||tip==='bristle'||tip==='flat-bristle'||kind==='paint'&&tip!=='soft-round')return 'oil';
 return 'soft';
}
export type BrushBlendControls={
 brushBlendVersion?:1|2;
 /** v2 (v0.5.242): the brush family's blend character (watercolor, dry, pencil, ink, ...). */
 bbStyle?:BlendStyle;
 /** Blend Amount: how strongly the result replaces the original (like opacity of the blend). */
 bbAmount?:number;
 /** Colour Pickup / Load: how fast the brush picks up the colour under it. */
 bbPickup?:number;
 /** Wetness: soft bleeding / averaging of the picked colours. */
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
 /** Stroke-only: carried colour (clean off), 8x8 RGBA, base64. */
 bbCarry?:string;
 /** Stroke-only: all-layers sample snapshot (opaque PNG) and its document rectangle. */
 bbSamplePng?:string;bbSampleRect?:{x:number;y:number;width:number;height:number};
};
export type BrushBlendSettings=Omit<BrushBlendControls,'brushBlendVersion'|'bbStyle'|'bbCarry'|'bbSamplePng'|'bbSampleRect'>&{bbEnabled?:boolean};
export const blendDefaults:Required<Omit<BrushBlendSettings,'bbEnabled'>>={bbAmount:.85,bbPickup:.5,bbWetness:.4,bbMix:.6,bbFlow:.6,bbStretch:.45,bbSample:'layer',bbClean:true,bbPaintLoad:0,bbPressure:true,bbProtectAlpha:false};
export const blendLimits=[['bbAmount',0,1],['bbPickup',0,1],['bbWetness',0,1],['bbMix',0,1],['bbFlow',0,1],['bbStretch',0,1],['bbPaintLoad',0,1]] as const;
export const blendFlags=['bbClean','bbPressure','bbProtectAlpha'] as const;
export type BlendPresetId='blend-soft'|'blend-smudge'|'blend-wet';
export const blendPresets:{id:BlendPresetId;name:string;values:Partial<BrushBlendSettings>}[]=[
 {id:'blend-soft',name:'Soft blend',values:{bbAmount:.85,bbPickup:.55,bbWetness:.55,bbMix:.7,bbFlow:.55,bbStretch:.35}},
 {id:'blend-smudge',name:'Smudge',values:{bbAmount:1,bbPickup:.2,bbWetness:.15,bbMix:.15,bbFlow:.75,bbStretch:.75}},
 {id:'blend-wet',name:'Wet mix',values:{bbAmount:.9,bbPickup:.45,bbWetness:.9,bbMix:.5,bbFlow:.6,bbStretch:.55}},
];
type Shape={brushKind?:string;brushTip?:string;nativeMixEnabled?:boolean};
/** Every paint brush can blend, except brushes that are already blenders. */
export const canBrushBlend=(s:Shape|undefined)=>!!s&&s.brushKind!=='silk-blend'&&s.brushTip!=='color-blender';
export const isBlendSample=(v:unknown):v is BlendSample=>v==='layer'||v==='all';
const clamp01=(v:unknown,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(1,v)):fallback;
/** Stroke metadata. Only brushes with Blend switched on get these fields, so
 * Paint mode strokes stay byte-identical to v0.5.239. */
export function brushBlendMetadata(s:BrushBlendSettings&Shape):BrushBlendControls{
 if(!s.bbEnabled||!canBrushBlend(s))return {};
 const out:BrushBlendControls={brushBlendVersion:2,bbStyle:blendStyleFor(s)};
 for(const [key] of blendLimits)out[key]=clamp01(s[key],blendDefaults[key]);
 out.bbSample=isBlendSample(s.bbSample)?s.bbSample:'layer';
 for(const key of blendFlags)out[key]=typeof s[key]==='boolean'?s[key]:blendDefaults[key];
 return out;
}
/** Keeps only valid saved blend settings on a brush. */
export function sanitizeBrushBlend(p:Partial<BrushBlendSettings>,result:BrushBlendSettings&Shape,fallback:BrushBlendSettings){
 const keys=['bbEnabled',...blendLimits.map(l=>l[0]),'bbSample',...blendFlags] as const;
 if(!canBrushBlend(result)){for(const k of keys)delete (result as Record<string,unknown>)[k];return;}
 if(typeof p.bbEnabled==='boolean')result.bbEnabled=p.bbEnabled;else if(fallback.bbEnabled===undefined)delete result.bbEnabled;
 for(const [key] of blendLimits){const v=p[key];if(typeof v==='number'&&Number.isFinite(v))result[key]=clamp01(v,blendDefaults[key]);else if(fallback[key]===undefined)delete result[key];}
 if(isBlendSample(p.bbSample))result.bbSample=p.bbSample;else if(fallback.bbSample===undefined)delete result.bbSample;
 for(const key of blendFlags){if(typeof p[key]==='boolean')result[key]=p[key];else if(fallback[key]===undefined)delete result[key];}
}
/** Validation for saved strokes (projects, backups). */
export function validBrushBlendStroke(o:Record<string,unknown>){
 const present=Object.keys(o).some(k=>k==='brushBlendVersion'||k.startsWith('bb'));
 if(!present)return true;
 if(o.brushBlendVersion!==1&&o.brushBlendVersion!==2||o.tool!=='brush')return false;
 if(o.brushBlendVersion===1?o.bbStyle!==undefined:!isBlendStyle(o.bbStyle))return false;
 for(const [key] of blendLimits){const v=o[key];if(v!==undefined&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1))return false;}
 if(o.bbSample!==undefined&&!isBlendSample(o.bbSample))return false;
 for(const key of blendFlags)if(o[key]!==undefined&&typeof o[key]!=='boolean')return false;
 if(o.bbCarry!==undefined&&(typeof o.bbCarry!=='string'||!/^[A-Za-z0-9+/=]{1,400}$/.test(o.bbCarry)))return false;
 if(o.bbSamplePng!==undefined||o.bbSampleRect!==undefined){
  const r=o.bbSampleRect as Record<string,unknown>|undefined;
  if(typeof o.bbSamplePng!=='string'||!o.bbSamplePng.startsWith('data:image/png;base64,')||o.bbSamplePng.length>24_000_000||!r||typeof r!=='object')return false;
  for(const k of ['x','y','width','height'])if(!Number.isInteger(r[k]))return false;
  if((r.width as number)<1||(r.height as number)<1||(r.width as number)*(r.height as number)>16777216)return false;
 }
 for(const k of Object.keys(o))if(k.startsWith('bb')&&!['bbAmount','bbPickup','bbWetness','bbMix','bbFlow','bbStretch','bbSample','bbClean','bbPaintLoad','bbPressure','bbProtectAlpha','bbCarry','bbSamplePng','bbSampleRect','bbStyle'].includes(k))return false;
 return true;
}
