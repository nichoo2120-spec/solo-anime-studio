import {MAX_STAGE_PIXELS,MAX_STAGE_SIDE,type ArtworkOrigin,type Matrix,type Operation,type Project} from './model';
import {affineH,multiplyH} from '../engine/perspectiveWarp';
import {transformVector} from '../engine/vector';

export type ShotFrame={x:number;y:number;width:number;height:number};
export function shotFrame(project:Pick<Project,'width'|'height'|'shotFrame'>):ShotFrame{
 return project.shotFrame??{x:0,y:0,width:project.width,height:project.height};
}

/** Existing raster pixels keep their original coordinates and dimensions. */
export function openInfiniteWorkspace(project:Project):Project{
 return project.version===6?project:{...project,version:6,shotFrame:shotFrame(project)};
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

/** Replay older pixels at their original dimensions for edge clipping and paint sampling. */
export function artworkAtOrigin(operations:Operation[],bounds:ShotFrame,origin:keyof ArtworkOrigin){
 const translate=offsetArtwork(-bounds.x,-bounds.y);
 return operations.map(op=>({...translate(op),inShot:op.inShot,inPreviousStage:op.inPreviousStage,[origin]:undefined}));
}

/** Add paper around the shot once. Navigation keeps the viewport within this paper. */
export function expandPasteboard(project:Project,viewportWidth:number,viewportHeight:number):Project{
 if(project.version===5)return project;
 const shot=shotFrame(project),{width,height}=project;
 const minimumMargin=project.shotFrame?0:1,minWidth=width+2*minimumMargin,minHeight=height+2*minimumMargin;
 const targetWidth=Math.max(shot.width*3,viewportWidth*4,minWidth),targetHeight=Math.max(shot.height*3,viewportHeight*4,minHeight);
 const budget=Math.min(MAX_STAGE_PIXELS,Math.max(1_048_576,shot.width*shot.height*8,minWidth*minHeight));
 // Scale both dimensions together, while retaining at least the old page on each axis.
 const scale=Math.min(1,MAX_STAGE_SIDE/targetWidth,MAX_STAGE_SIDE/targetHeight,
  Math.sqrt(budget/(targetWidth*targetHeight)),budget/(minWidth*targetHeight),budget/(minHeight*targetWidth));
 const x=Math.max(minimumMargin,Math.floor((targetWidth*scale-width)/2));
 const y=Math.max(minimumMargin,Math.floor((targetHeight*scale-height)/2));
 if(!x&&!y)return {...project,version:5};
 const point=<T extends {x:number;y:number}>(p:T):T=>({...p,x:p.x+x,y:p.y+y});
 const translate=offsetArtwork(x,y),ops=new WeakMap<Operation,Operation>(),lists=new WeakMap<Operation[],Operation[]>();
 const origin=project.shotFrame?'inPreviousStage':'inShot';
 const artwork=(input:Operation[])=>{
  const cached=lists.get(input);
  if(cached)return cached;
  const output=input.map(op=>{
   const existing=ops.get(op);
   if(existing)return existing;
   const moved={...translate(op),inShot:op.inShot,[origin]:true as const};ops.set(op,moved);return moved;
  });
  lists.set(input,output);return output;
 };
 const drawings=(record:Record<string,Operation[]>)=>Object.fromEntries(Object.entries(record).map(([id,items])=>[id,artwork(items)]));
 const {animation,camera,substitutionShelf,cycleShelf,motionPlanning}=project;
 return {
  ...project,version:5,width:width+2*x,height:height+2*y,shotFrame:point(shot),
  previousStage:project.shotFrame?{x,y,width,height}:undefined,
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
