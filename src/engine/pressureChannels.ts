import type {PressureSettings} from '../core/model';
export type PressureLimits=PressureSettings;
/** Zero/missing release pressure retains contact pressure; unknown pen-down uses
 * a bounded neutral response, never the full-width mouse path. */
export function inputPressure(value:number,previous=.5){return Number.isFinite(value)&&value>0?Math.min(1,value):Number.isFinite(previous)&&previous>0?Math.min(1,previous):.5;}
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export function widthResponse(response:number,s:PressureLimits){if(s.minSize===undefined&&s.maxSize===undefined)return Math.max(.06,response);const min=clamp(s.minSize??.06),max=Math.max(min,clamp(s.maxSize??1));return min+(max-min)*clamp(response);}
export function opacityResponse(response:number,s:PressureLimits){const min=clamp(s.minOpacity??0),max=Math.max(min,clamp(s.maxOpacity??1));return min+(max-min)*clamp(response);}
/** Explicit mouse-speed width channel. Reported pen pressure stays untouched. */
export function velocityWidth(distance:number,milliseconds:number,previous=1){return milliseconds>0?Math.max(.15,Math.min(1,1/(1+Math.max(0,distance)/milliseconds*.65))):previous;}
