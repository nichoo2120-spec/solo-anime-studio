import type {Matrix,Operation,Project} from './model';
import {affineH,multiplyH} from '../engine/perspectiveWarp';
import {transformVector} from '../engine/vector';

export type ShotFrame={x:number;y:number;width:number;height:number};
export function shotFrame(project:Pick<Project,'width'|'height'|'shotFrame'>):ShotFrame{
 return project.shotFrame??{x:0,y:0,width:project.width,height:project.height};
}

function offsetArtwork(x:number,y:number){
 const shift:Matrix=[1,0,0,1,x,y],forward=affineH(shift);
 const point=<T extends {x:number;y:number}>(p:T):T=>({...p,x:p.x+x,y:p.y+y});
 const matrix=([a,b,c,d,e,f]:Matrix):Matrix=>[a,b,c,d,e+x-a*x-c*y,f+y-b*x-d*y];
 return (op:Operation):Operation=>{
  switch(op.kind){
   case 'fill':return op;
   case 'image':return point(op);
   case 'vector':return transformVector(op,shift);
   case 'clear':return {...op,polygon:op.polygon.map(point)};
   case 'transform':return {...op,polygon:op.polygon.map(point),matrix:matrix(op.matrix)};
   case 'stroke':{
    if(op.perspective)return {...op,perspective:multiplyH(forward,op.perspective)};
    const [a,b,c,d,e,f]=op.transform??[1,0,0,1,0,0];
    const transform:Matrix=[a,b,c,d,e+x,f+y];
    return {...op,transform:transform.every((value,i)=>value===[1,0,0,1,0,0][i])?undefined:transform};
   }
  }
 };
}

/** Replay older pixels at the original dimensions, including paper grain
 * and paint sampling near the previous canvas edge. */
export function originalShotArtwork(operations:Operation[],frame:ShotFrame){
 const translate=offsetArtwork(-frame.x,-frame.y);
 return operations.map(op=>({...translate(op),inShot:undefined}));
}

/** Expand the drawing surface around the original shot as one document edit. */
export function addDrawingMargins(project:Project):Project{
 if(project.shotFrame)return project;
 const x=Math.max(24,Math.ceil(project.width/8)),y=Math.max(24,Math.ceil(project.height/8));
 const frame={x,y,width:project.width,height:project.height};
 const point=<T extends {x:number;y:number}>(p:T):T=>({...p,x:p.x+x,y:p.y+y});
 const translate=offsetArtwork(x,y),ops=new WeakMap<Operation,Operation>(),lists=new WeakMap<Operation[],Operation[]>();
 const artwork=(input:Operation[])=>{
  const cached=lists.get(input);
  if(cached)return cached;
  const output=input.map(op=>{
   const existing=ops.get(op);
   if(existing)return existing;
   const moved={...translate(op),inShot:true as const};ops.set(op,moved);return moved;
  });
  lists.set(input,output);return output;
 };
 const drawings=(record:Record<string,Operation[]>)=>Object.fromEntries(Object.entries(record).map(([id,items])=>[id,artwork(items)]));
 const {animation,camera,substitutionShelf,cycleShelf,motionPlanning}=project;
 return {
  ...project,version:4,width:project.width+2*x,height:project.height+2*y,shotFrame:frame,
  layers:project.layers.map(layer=>({...layer,operations:artwork(layer.operations)})),
  animation:animation&&{
   ...animation,frames:animation.frames.map(cel=>({...cel,drawings:drawings(cel.drawings)})),
   layerHolds:animation.layerHolds&&Object.fromEntries(Object.entries(animation.layerHolds).map(([id,track])=>[id,{...track,stash:drawings(track.stash)}]))
  },
  camera:camera&&{...camera,keys:camera.keys.map(point)},
  substitutionShelf:substitutionShelf&&{...substitutionShelf,items:substitutionShelf.items.map(item=>({...item,operations:artwork(item.operations)}))},
  cycleShelf:cycleShelf&&{...cycleShelf,items:cycleShelf.items.map(item=>({...item,frames:item.frames.map(artwork)}))},
  motionPlanning:motionPlanning&&{...motionPlanning,arcs:motionPlanning.arcs.map(arc=>({...arc,points:arc.points.map(point)}))}
 };
}
