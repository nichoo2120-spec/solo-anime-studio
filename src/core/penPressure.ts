import {validCurve} from './brushCurves';
import {readPreference,writePreference} from '../ui/preferences';
import {pressureResponse} from '../engine/strokeGeometry';

export type PenCurve={x:number;y:number}[];
export const penPresets:Record<'Soft'|'Normal'|'Firm',PenCurve>={
 Soft:[{x:0,y:0},{x:.2,y:.52},{x:.55,y:.82},{x:1,y:1}],
 Normal:[{x:0,y:0},{x:.25,y:.4},{x:.65,y:.79},{x:1,y:1}],
 Firm:[{x:0,y:0},{x:.25,y:.25},{x:.65,y:.62},{x:1,y:1}],
};
export type PenSettings={curve:PenCurve;min:number;max:number};
const defaults:PenSettings={curve:penPresets.Normal,min:0,max:1};
let settings=defaults;
export function penSettings(){return settings;}
export function setPenSettings(next:PenSettings){
 settings=next;
 writePreference('global-pen-pressure',next);
}
export function loadPenSettings(){
 const saved=readPreference('global-pen-pressure',defaults);
 if(saved&&validCurve(saved.curve)&&calibratePressure(saved.min,saved.max))settings=saved;
}
export function calibratePressure(min:number,max:number){
 if(!Number.isFinite(min)||!Number.isFinite(max)||min<0||max>1||max-min<.08)return;
 return {min,max};
}
export function mapPenPressure(raw:number, config:PenSettings=settings,previous?:number){
 if(!Number.isFinite(raw)||raw<=0)return previous??.08;
 const input=Math.min(1,Math.max(0,(raw-config.min)/(config.max-config.min)));
 const mapped=.06+.94*pressureResponse(input,config.curve);
 if(previous===undefined||input===1)return mapped;
 const delta=mapped-previous;
 return Math.abs(delta)<.025?previous+delta*.55:mapped;
}
