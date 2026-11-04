import {homography,projectPoint,quadValid,type H} from '../../../engine/perspectiveWarp';
import type {Pt,Quad} from './matrix';
export function projectiveMapping(from:Quad,to:Quad):H|null{return quadValid(to)?homography(from,to):null;}
export function warpPoint(p:Pt,h:H):Pt{return projectPoint(p,h);}
export {quadValid};
