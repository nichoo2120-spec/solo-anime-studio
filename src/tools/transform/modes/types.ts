import type {Pt,Quad} from '../math/matrix';
import type {Grid,GridMode} from '../math/meshWarp';
export type Mode='free'|'move'|'scale'|'rotate'|'perspective'|'skew'|'distort'|'mesh'|'flip'|'pivot';
export type Handle={type:'inside'|'corner'|'edge'|'rotate'|'pivot'|'node'|'pin';index:number};
export type Session={quad:Quad;initial:Quad;pivot:Pt;grid:Grid;initialGrid:Grid;mode:Mode;angle:number;skew:number;lock:boolean;perspectiveGrid?:boolean;perspectiveSnap?:number;skewAxis?:'free'|'horizontal'|'vertical';skewSnap?:number;meshFalloff?:number;meshShowGrid?:boolean;meshShowPoints?:boolean;meshSmooth?:boolean;meshPointSize?:number;meshLockCorners?:boolean;meshLockBorder?:boolean;meshPinRadius?:number;meshPinBehavior?:'local'|'neighbor';meshMode?:Extract<GridMode,'uniform'|'adaptive'|'triangle'>;meshScope?:'artwork'|'layer'};
export type Gesture={point:Pt;quad:Quad;grid:Grid;pivot:Pt;angle:number;skew:number;index:number;handle:Handle};
export type PointerModifiers={shift:boolean;alt:boolean;ctrl:boolean};
export type ModeFunction=(session:Session,start:Gesture,point:Pt,keys:PointerModifiers)=>void;
