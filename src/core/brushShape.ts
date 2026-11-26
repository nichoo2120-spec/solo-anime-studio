import {validBitmapMask,type BitmapMask} from './bitmapBrush';
/** v0.5.241 Tip shape (stretch / squeeze, like Photoshop Brush Tip Shape) and
 * Dual Brush (merge a second brush's tip and texture into the first).
 *
 * When either is switched on, the brush is drawn by the stamp engine
 * (engine/stampBrush.ts): the brush's own tip and texture are stamped along the
 * line with the chosen shape, and the second tip (Dual Brush) is combined with
 * it by a blend mode. Only strokes drawn with these switched on carry the new
 * fields (`stampVersion:1`), so every old drawing stays byte-identical. */
import {isNatureTip,type NatureTip} from './natureBrush';
import type {PaintTip} from './paintTips';
export type DualMode='multiply'|'darken'|'overlay'|'subtract'|'lighten'|'screen'|'height';
export const dualModes:{id:DualMode;name:string;hint:string}[]=[
 {id:'multiply',name:'Multiply',hint:'Paint only where both tips touch.'},
 {id:'darken',name:'Darken',hint:'Keeps the thinner of the two tips at each point.'},
 {id:'overlay',name:'Overlay',hint:'The second tip adds contrast to the first.'},
 {id:'subtract',name:'Subtract',hint:'The second tip cuts holes in the first.'},
 {id:'lighten',name:'Lighten',hint:'Keeps the fuller of the two tips at each point.'},
 {id:'screen',name:'Screen',hint:'Both tips add up softly.'},
 {id:'height',name:'Height',hint:'The second tip acts like paper height: strong pressure fills it in.'},
];
/** Tips the stamp engine can draw (the painting tip set). */
export const stampTips:{id:PaintTip;name:string}[]=[
 {id:'soft-round',name:'Soft round'},{id:'bristle',name:'Bristle'},{id:'flat-bristle',name:'Flat bristles'},{id:'chalk',name:'Chalk grain'},{id:'felt',name:'Chisel felt'},{id:'wash',name:'Watercolour edge'},
];
export const isStampTip=(v:unknown):v is PaintTip=>stampTips.some(t=>t.id===v);
export const isDualMode=(v:unknown):v is DualMode=>dualModes.some(m=>m.id===v);
export type BrushShapeControls={
 stampVersion?:1;
 /** Main tip drawn by the stamp engine, derived from the brush when the stroke starts. */
 stampTip?:PaintTip;stampHardness?:number;stampTexture?:number;
 tsRoundness?:number;tsAngle?:number;tsScaleX?:number;tsScaleY?:number;tsFlipX?:boolean;tsFlipY?:boolean;tsFollow?:boolean;tsTilt?:boolean;
 dbTip?:PaintTip;dbNatureTip?:NatureTip;dbBitmap?:BitmapMask;dbHardness?:number;dbTexture?:number;dbMode?:DualMode;dbScale?:number;dbSpacing?:number;dbScatter?:number;dbCount?:number;dbAmount?:number;
};
export type BrushShapeSettings=Omit<BrushShapeControls,'stampVersion'|'stampTip'|'stampHardness'|'stampTexture'|'dbTip'|'dbHardness'|'dbTexture'>&{tsEnabled?:boolean;dbEnabled?:boolean;/** Second brush, by preset id, plus its resolved tip. */dbBrushId?:string;dbBrushName?:string;dbTip?:PaintTip;dbHardness?:number;dbTexture?:number};
export const shapeDefaults={tsRoundness:1,tsAngle:0,tsScaleX:1,tsScaleY:1,tsFlipX:false,tsFlipY:false,tsFollow:false,tsTilt:false,dbMode:'multiply' as DualMode,dbScale:.45,dbSpacing:.25,dbScatter:.3,dbCount:1,dbAmount:1};
export const shapeLimits=[['tsRoundness',.05,1],['tsAngle',-180,180],['tsScaleX',.1,3],['tsScaleY',.1,3],['dbScale',.1,3],['dbSpacing',.02,2],['dbScatter',0,2],['dbCount',1,5],['dbAmount',0,1]] as const;
export const shapeFlags=['tsFlipX','tsFlipY','tsFollow','tsTilt'] as const;
type Brushish={brushKind?:string;brushTip?:string;hardness?:number;textureStrength?:number};
/** Brushes that are already blenders keep their own engine. */
export const canShapeBrush=(s:Brushish|undefined)=>!!s&&s.brushKind!=='silk-blend'&&s.brushTip!=='color-blender';
const num=(v:unknown,min:number,max:number,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
/** The tip and texture that represent a brush in the stamp engine. */
export function brushStampTip(s:Brushish):{tip:PaintTip;hardness:number;texture:number}{
 const kind=s.brushKind??'',tip=s.brushTip;
 const texture=num(s.textureStrength,0,1,0);
 if(isStampTip(tip))return {tip,hardness:num(s.hardness,0,1,.7),texture};
 if(tip==='felt'||kind==='marker')return {tip:'felt',hardness:num(s.hardness,0,1,.85),texture};
 if(tip==='flat-bristle'||kind==='flat')return {tip:'flat-bristle',hardness:num(s.hardness,0,1,.8),texture};
 if(kind.startsWith('graphite-')||kind.startsWith('dry')||tip==='chalk')return {tip:'chalk',hardness:.85,texture:Math.max(texture,.6)};
 if(kind.startsWith('watercolor')||String(tip??'').startsWith('wa'))return {tip:'wash',hardness:.35,texture};
 if(kind==='airbrush'||tip==='color-air')return {tip:'soft-round',hardness:0,texture};
 if(tip==='color-soft')return {tip:'soft-round',hardness:.4,texture};
 // Inks, solid colouring and plain round brushes: a hard round tip.
 return {tip:'soft-round',hardness:num(s.hardness,0,1,1),texture};
}
/** Stroke metadata (empty unless Tip shape or Dual Brush is on). */
export function brushShapeMetadata(s:BrushShapeSettings&Brushish):BrushShapeControls{
 const shape=!!s.tsEnabled,dual=!!s.dbEnabled&&isStampTip(s.dbTip);
 if(!(shape||dual)||!canShapeBrush(s))return {};
 const main=brushStampTip(s),out:BrushShapeControls={stampVersion:1,stampTip:main.tip,stampHardness:main.hardness,stampTexture:main.texture};
 if(shape){
  out.tsRoundness=num(s.tsRoundness,.05,1,1);out.tsAngle=num(s.tsAngle,-180,180,0);out.tsScaleX=num(s.tsScaleX,.1,3,1);out.tsScaleY=num(s.tsScaleY,.1,3,1);
  for(const k of shapeFlags)out[k]=s[k]===true;
 }
 if(dual){
  if(isNatureTip(s.dbNatureTip))out.dbNatureTip=s.dbNatureTip;
  if(validBitmapMask(s.dbBitmap))out.dbBitmap=s.dbBitmap;
  out.dbTip=s.dbTip;out.dbHardness=num(s.dbHardness,0,1,.7);out.dbTexture=num(s.dbTexture,0,1,0);out.dbMode=isDualMode(s.dbMode)?s.dbMode:'multiply';
  out.dbScale=num(s.dbScale,.1,3,shapeDefaults.dbScale);out.dbSpacing=num(s.dbSpacing,.02,2,shapeDefaults.dbSpacing);out.dbScatter=num(s.dbScatter,0,2,shapeDefaults.dbScatter);out.dbCount=Math.round(num(s.dbCount,1,5,1));out.dbAmount=num(s.dbAmount,0,1,1);
 }
 return out;
}
const settingKeys=['tsEnabled','dbEnabled','dbBrushId','dbBrushName','dbNatureTip','dbBitmap','dbTip','dbHardness','dbTexture','dbMode',...shapeLimits.map(l=>l[0]),...shapeFlags] as const;
/** Keep only valid saved shape settings on a brush. */
export function sanitizeBrushShape(p:Partial<BrushShapeSettings>,result:BrushShapeSettings&Brushish,fallback:BrushShapeSettings){
 const r=result as Record<string,unknown>,f=fallback as Record<string,unknown>,src=p as Record<string,unknown>;
 if(!canShapeBrush(result)){for(const k of settingKeys)delete r[k];return;}
 const keep=(k:string,ok:boolean,value:unknown)=>{if(ok)r[k]=value;else if(f[k]===undefined)delete r[k];};
 keep('tsEnabled',typeof src.tsEnabled==='boolean',src.tsEnabled);keep('dbEnabled',typeof src.dbEnabled==='boolean',src.dbEnabled);
 keep('dbBrushId',typeof src.dbBrushId==='string'&&src.dbBrushId.length<=80,src.dbBrushId);
 keep('dbBrushName',typeof src.dbBrushName==='string'&&src.dbBrushName.length<=60,src.dbBrushName);
 keep('dbNatureTip',isNatureTip(src.dbNatureTip),src.dbNatureTip);
 if('dbBitmap' in src&&src.dbBitmap===undefined)delete r.dbBitmap;
 else keep('dbBitmap',validBitmapMask(src.dbBitmap),src.dbBitmap);
 keep('dbTip',isStampTip(src.dbTip),src.dbTip);keep('dbMode',isDualMode(src.dbMode),src.dbMode);
 for(const [k,min,max] of [...shapeLimits,['dbHardness',0,1],['dbTexture',0,1]] as const){const v=src[k];keep(k,typeof v==='number'&&Number.isFinite(v),typeof v==='number'?Math.max(min,Math.min(max,v)):undefined);}
 for(const k of shapeFlags)keep(k,typeof src[k]==='boolean',src[k]);
}
const strokeKeys=new Set(['stampVersion','stampTip','stampHardness','stampTexture','tsRoundness','tsAngle','tsScaleX','tsScaleY','tsFlipX','tsFlipY','tsFollow','tsTilt','dbNatureTip','dbBitmap','dbTip','dbHardness','dbTexture','dbMode','dbScale','dbSpacing','dbScatter','dbCount','dbAmount']);
/** Validation for saved strokes. */
export function validBrushShapeStroke(o:Record<string,unknown>){
 const present=Object.keys(o).filter(k=>strokeKeys.has(k)||/^(ts|db)[A-Z]/.test(k));if(!present.length)return true;
 if(o.stampVersion!==1||o.tool!=='brush'||!isStampTip(o.stampTip))return false;
 for(const k of present)if(!strokeKeys.has(k))return false;
 for(const [k,min,max] of [...shapeLimits,['stampHardness',0,1],['stampTexture',0,1],['dbHardness',0,1],['dbTexture',0,1]] as const){const v=o[k];if(v!==undefined&&(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max))return false;}
 for(const k of shapeFlags)if(o[k]!==undefined&&typeof o[k]!=='boolean')return false;
 if(o.dbBitmap!==undefined&&(!validBitmapMask(o.dbBitmap)||!o.dbTip))return false;
 if(o.dbNatureTip!==undefined&&(!isNatureTip(o.dbNatureTip)||!o.dbTip))return false;
 if(o.dbTip!==undefined&&!isStampTip(o.dbTip))return false;if(o.dbMode!==undefined&&!isDualMode(o.dbMode))return false;
 if(o.dbCount!==undefined&&!Number.isInteger(o.dbCount))return false;
 return true;
}
/** Optional per-point pen tilt (azimuth in degrees, altitude 0..90), recorded only for Tilt strokes. */
export const validTilt=(p:Record<string,unknown>)=>(p.az===undefined||typeof p.az==='number'&&Number.isFinite(p.az)&&p.az>=-180&&p.az<=180)&&(p.alt===undefined||typeof p.alt==='number'&&Number.isFinite(p.alt)&&p.alt>=0&&p.alt<=90);
