import type {Stroke} from '../core/model';
import {strokeGeometry} from './strokeGeometry';
const finalized=new Map<Stroke,ReturnType<typeof strokeGeometry>>();let samples=0;
/** Mutable live paths never enter this cache. */
export function finalGeometry(stroke:Stroke){if(!Object.isFrozen(stroke))return strokeGeometry(stroke);let g=finalized.get(stroke);if(!g){g=strokeGeometry(stroke);if(stroke.points.length<=100000){finalized.set(stroke,g);samples+=stroke.points.length;while(finalized.size>128||samples>100000){const first=finalized.keys().next().value!;samples-=first.points.length;finalized.delete(first);}}}return g;}
export function strokeSnapshot(stroke:Stroke):Stroke{const copy=structuredClone(stroke);copy.points.forEach(Object.freeze);Object.freeze(copy.points);if(copy.pressureCurve){copy.pressureCurve.forEach(Object.freeze);Object.freeze(copy.pressureCurve);}return Object.freeze(copy);}
