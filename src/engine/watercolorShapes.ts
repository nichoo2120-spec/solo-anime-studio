import type {Stroke,WatercolorShape} from '../core/model';
export const watercolorShapes=[{id:'round',name:'Round'},{id:'filbert',name:'Filbert'},{id:'angular',name:'Angular'},{id:'liner',name:'Liner'},{id:'mop',name:'Mop'}] as const;
const circle=Array.from({length:32},(_,i)=>({x:Math.cos(i*Math.PI/16),y:Math.sin(i*Math.PI/16)}));
const angular=[{x:-.32,y:-.88},{x:.20,y:-1},{x:.35,y:.88},{x:-.20,y:1}];
export function defaultWatercolorShape(tip:Stroke['brushTip']):WatercolorShape{return tip==='water-flat'||tip==='water-gradient'?'angular':tip==='water-wet'?'mop':'round';}
/** Coordinates are in brush radii. Shape and material style are independent. */
export function watercolorFootprint(shape:WatercolorShape){return shape==='angular'?angular:shape==='filbert'?circle.map(p=>({x:p.x*.48,y:p.y})):shape==='mop'?circle.map(p=>({x:p.x*.74,y:p.y*1.1})):circle;}
export function watercolorShapePath(shape:WatercolorShape){let path=paths.get(shape);if(!path){path=new Path2D();const points=watercolorFootprint(shape),k=shape==='liner'?.1:.5;points.forEach((p,i)=>i?path!.lineTo(p.x*k,p.y*k):path!.moveTo(p.x*k,p.y*k));path.closePath();paths.set(shape,path);}return path;}
const paths=new Map<WatercolorShape,Path2D>();
