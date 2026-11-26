/** A portable, immutable stamp mask. Alpha is row-major, one byte per pixel. */
export type BitmapMask=Readonly<{id:string;width:number;height:number;alpha:string}>;
export const bitmapMaxSide=512;
export const bitmapMaxTips=32;
export const importedCategory='Imported' as const;
export const bitmapBlendModes=['multiply','darken','subtract','overlay'] as const;
export type BitmapBlendMode=typeof bitmapBlendModes[number];
export type BitmapTipSelection='random'|'sequence'|'pressure'|'direction'|'velocity';
export const bitmapSelections=['random','sequence','pressure','direction','velocity'] as const;
export type BitmapDynamics={
 version:1;tips:readonly BitmapMask[];grain?:BitmapMask;roundnessJitter:number;
 textureMode:BitmapBlendMode;bothAxes:boolean;countJitter:number;
 selection?:BitmapTipSelection;minSize?:number;minRoundness?:number;
};
const checkedMasks=new WeakSet<object>();
export function validBitmapMask(raw:unknown):raw is BitmapMask {
 if(!raw||typeof raw!=='object')return false;
 if(checkedMasks.has(raw))return true;
 const {id,width,height,alpha}=raw as BitmapMask;
 if(typeof id!=='string'||!/^mask-[0-9a-f]{64}$/.test(id)||
    !Number.isInteger(width)||width<1||width>bitmapMaxSide||
    !Number.isInteger(height)||height<1||height>bitmapMaxSide||
    typeof alpha!=='string'||alpha.length!==Math.ceil(width*height/3)*4||
    !/^[a-zA-Z0-9+/]*={0,2}$/.test(alpha)||
    alpha.length/4*3-(alpha.endsWith('==')?2:alpha.endsWith('=')?1:0)!==width*height)return false;
 Object.freeze(raw);checkedMasks.add(raw);return true;
}
const unit=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1;
export function validBitmapDynamics(raw:unknown):raw is BitmapDynamics{
 if(!raw||typeof raw!=='object')return false;
 const b=raw as BitmapDynamics;
 return b.version===1&&Array.isArray(b.tips)&&b.tips.length>=1&&b.tips.length<=bitmapMaxTips&&b.tips.every(validBitmapMask)&&
  (b.grain===undefined||validBitmapMask(b.grain))&&unit(b.roundnessJitter)&&unit(b.countJitter)&&typeof b.bothAxes==='boolean'&&
  bitmapBlendModes.includes(b.textureMode)&&(b.selection===undefined||bitmapSelections.includes(b.selection))&&
  (b.minSize===undefined||unit(b.minSize))&&(b.minRoundness===undefined||unit(b.minRoundness));
}
