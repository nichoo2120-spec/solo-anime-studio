/** Local, read-only light-table guides. Pins never enter document history or exports. */
import type {Project} from '../core/model';
import {frameList} from './timeline';
export type LightTablePin={frameId:string;opacity:number;dx:number;dy:number;scale:number;angle:number;tint:'original'|'teal'|'red'};
export const MAX_LIGHT_TABLE_PINS=5;
const bounded=(value:unknown,min:number,max:number,defaultValue:number)=>typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):defaultValue;
export function sanitizeLightTablePins(project:Project,raw:unknown):LightTablePin[]{
 if(!Array.isArray(raw))return [];
 const ids=new Set(frameList(project).map(frame=>frame.id)),seen=new Set<string>(),pins:LightTablePin[]=[];
 for(const item of raw){
  if(!item||typeof item.frameId!=='string'||!ids.has(item.frameId)||seen.has(item.frameId))continue;
  seen.add(item.frameId);
  pins.push({frameId:item.frameId,opacity:bounded(item.opacity,0,100,38),dx:bounded(item.dx,-4096,4096,0),dy:bounded(item.dy,-4096,4096,0),scale:bounded(item.scale,.25,4,1),angle:bounded(item.angle,-180,180,0),tint:['original','teal','red'].includes(item.tint)?item.tint:'original'});
  if(pins.length>=MAX_LIGHT_TABLE_PINS)break;
 }
 return pins;
}
export function toggleLightTablePin(project:Project,previous:LightTablePin[],frameId:string):LightTablePin[]{
 const pins=sanitizeLightTablePins(project,previous);
 if(pins.some(pin=>pin.frameId===frameId))return pins.filter(pin=>pin.frameId!==frameId);
 if(pins.length>=MAX_LIGHT_TABLE_PINS)return pins;
 return [...pins,{frameId,opacity:38,dx:0,dy:0,scale:1,angle:0,tint:'original'}];
}
