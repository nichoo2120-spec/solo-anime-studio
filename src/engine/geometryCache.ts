import type {Stroke} from '../core/model';
import {strokeGeometry} from './strokeGeometry';
const finalized=new Map<Stroke,ReturnType<typeof strokeGeometry>>();let samples=0;
/** Mutable live paths never enter this cache. */
export function finalGeometry(stroke:Stroke){if(!Object.isFrozen(stroke))return strokeGeometry(stroke);let g=finalized.get(stroke);if(!g){g=strokeGeometry(stroke);if(stroke.points.length<=100000){finalized.set(stroke,g);samples+=stroke.points.length;while(finalized.size>128||samples>100000){const first=finalized.keys().next().value!;samples-=first.points.length;finalized.delete(first);}}}return g;}
export function strokeSnapshot(stroke:Stroke):Stroke{
 const bitmap=stroke.nature?.bitmap,dual=stroke.dbBitmap;
 let copy:Stroke;
 if(bitmap||dual){
  // Validated masks are immutable and shared across strokes. Cloning their
  // payload here would invalidate the tip cache just as pen-up arrives.
  copy=structuredClone({...stroke,...(bitmap?{nature:{...stroke.nature!,bitmap:undefined}}:{}),dbBitmap:undefined});
  if(bitmap)copy.nature={...copy.nature!,bitmap:Object.freeze({...bitmap,tips:Object.freeze([...bitmap.tips])})};
  if(dual)copy.dbBitmap=dual;
 }else copy=structuredClone(stroke);
 copy.points.forEach(Object.freeze);Object.freeze(copy.points);
 if(copy.pressureCurve){copy.pressureCurve.forEach(Object.freeze);Object.freeze(copy.pressureCurve);}
 return Object.freeze(copy);
}
