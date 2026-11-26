import type {BitmapBlendMode,BitmapMask,BitmapTipSelection} from '../bitmapBrush';
import type {DualMode} from '../brushShape';
import type {NatureSettings} from '../natureBrush';

export type BrushImportAsset={
 name:string;tips:BitmapMask[];size:number;angle?:number;roundness?:number;
 flipX?:boolean;flipY?:boolean;pressureWidth?:boolean;pressureOpacity?:boolean;pressureMinSize?:number;opacity?:number;flow?:number;settings?:Partial<NatureSettings>;
 grain?:BitmapMask;textureMode?:BitmapBlendMode;roundnessJitter?:number;
 bothAxes?:boolean;countJitter?:number;selection?:BitmapTipSelection;minSize?:number;minRoundness?:number;
 dual?:{mask:BitmapMask;size:number;spacing:number;count:number;scatter:number;mode:DualMode};
};
export type ImportProgress=(current:number,total:number)=>void;
export type AlphaSource='auto'|'luminance'|'alpha';
export const importLimit=50*1024*1024;
export const brushLimit=512;
export const packName=(name:string)=>name.replace(/\.[^.]+$/,'').trim().slice(0,160)||'Brush pack';

export const brushFileExtensions=['abr','png','jpg','jpeg','brush','brushset','sut','bundle','kpp','gbr','gih','myb'] as const;
export const brushAccept=brushFileExtensions.map(ext=>'.'+ext).join(',');
