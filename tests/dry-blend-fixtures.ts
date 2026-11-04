import {stockPresets} from '../src/core/brushes';
import {brushStrokeMetadata,watercolorSeedFor} from '../src/core/paintTips';
import {watercolorVelocity} from '../src/engine/watercolorPigment';
import type {Stroke} from '../src/core/model';
export const WIDTH=900,HEIGHT=260;
export type Shape='straight'|'sine'|'zigzag'|'short'|'long';
export type Pressure='none'|'light'|'heavy'|'bell';
export type Speed='slow'|'fast';
export const backgrounds={white:'#ffffff',tan:'#d9c7a1',blue:'#1d4ed8'};
export function pathFor(shape:Shape){
 if(shape==='zigzag')return Array.from({length:7},(_,i)=>({x:100+i*100,y:i===0||i===6?130:130+(i%2?45:-45)}));
 const start=shape==='long'?60:100,end=shape==='short'?180:shape==='long'?840:shape==='straight'?580:700;
 const count=shape==='sine'?601:2;return Array.from({length:count},(_,i)=>{const t=i/(count-1);return {x:start+(end-start)*t,y:130+(shape==='sine'?45*Math.sin(t*Math.PI*2):0)};});
}
export function sampledEvents(shape:Shape,speed:Speed,pressure:Pressure){
 const path=pathFor(shape),arc=[0];for(let i=1;i<path.length;i++)arc.push(arc[i-1]+Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y));
 const total=arc.at(-1)!,step=(speed==='slow'?.25:3)*8,events=[];let k=1;
 for(let d=0;d<total+step;d+=step){d=Math.min(d,total);while(k<path.length-1&&arc[k]<d)k++;const a=path[k-1],b=path[k],t=(d-arc[k-1])/(arc[k]-arc[k-1]||1),f=d/total;
  events.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,pressure:pressure==='light'?.25:pressure==='heavy'?.95:pressure==='bell'?.15+.85*Math.sin(f*Math.PI):1,timeStamp:events.length*8});if(d===total)break;
 }return events;
}
/** Match StudioEngine capture at zoom 1. Only existing coloring/watercolor paths
 * receive the persisted normalized velocity channel. Legacy Dry receives none. */
export function fixtureStroke(presetId:string,shape:Shape,speed:Speed,pressure:Pressure,size:number,patch:Partial<Stroke>={}){
 const preset=stockPresets.find(p=>p.id===presetId);if(!preset)throw Error('Unknown test preset '+presetId);const s=preset.settings,events=sampledEvents(shape,speed,pressure),identity=['dry-blend',presetId,shape,pressure,size].join('-'),meta=brushStrokeMetadata(s);let velocity=.65;
 const points=events.map((e,i)=>{const p:{x:number;y:number;p:number;v?:number}={x:e.x,y:e.y,p:e.pressure};if((meta.dryBristleVersion===1||meta.dryBristleVersion===2||meta.dryBristleVersion===3)||meta.coloringEngine===1||meta.watercolorMaterialVersion===2||meta.watercolorEngine===1){if(i)velocity=watercolorVelocity(Math.hypot(e.x-events[i-1].x,e.y-events[i-1].y),e.timeStamp-events[i-1].timeStamp,velocity);p.v=velocity;}return p;});
 const stroke:Stroke={...s,...meta,id:identity,kind:'stroke',tool:'brush',color:'#000000',size,pressure:pressure!=='none',captureZoom:1,velocityTaper:false,points,...patch};if(meta.coloringEngine===1)stroke.colorSeed=watercolorSeedFor(identity);return {stroke,events,path:pathFor(shape)};
}
export function solidScene(){
 const settings=stockPresets.find(p=>p.id==='color-solid')!.settings;return [225,675].map((x,i)=>({...settings,...brushStrokeMetadata(settings),id:'blender-base-'+i,kind:'stroke' as const,tool:'brush' as const,color:i?'#1d4ed8':'#d62828',size:450,opacity:1,flow:1,pressure:false,colorNib:'flat' as const,tipAngle:0,colorNibFollow:false,points:[{x,y:-100,p:1},{x,y:360,p:1}]}));
}
export function blenderFixture(name:string){
 const reverse=name==='right-to-left',speed=name==='fast'?'fast':'slow',pressure=name==='light'?'light':name==='heavy'?'heavy':'none',size=name==='size-30'?30:70,base=fixtureStroke('color-blender','straight',speed,pressure,size),distance=540,step=(speed==='slow'?.25:3)*8;let v=.65;const points=[];
 for(let d=0;d<distance+step;d+=step){d=Math.min(d,distance);const t=d/distance,x=reverse?720-d:180+d,y=150+(name==='curve'?30*Math.sin(t*Math.PI*2):0),p=pressure==='light'?.25:pressure==='heavy'?.95:1;if(points.length)v=watercolorVelocity(Math.hypot(x-points.at(-1)!.x,y-points.at(-1)!.y),8,v);points.push({x,y,p,v});if(d===distance)break;}
 return {stroke:{...base.stroke,id:'dry-blend-golden-blender',colorSeed:watercolorSeedFor('dry-blend-golden-blender'),points},events:points.map((p,i)=>({...p,timeStamp:i*8})),path:points,reverse};
}
