import {uid,validateProject,type Project} from './model';
import {shotFrame} from './shotFrame';

/** Make a separate scene using the source layers above the destination layers. */
export function combineScenes(destination:Project,source:Project):Project {
 if(source.id===destination.id)throw Error('Choose two different scenes.');
 if([source,destination].some(scene=>scene.animation||scene.audio||scene.camera||scene.motionPlanning||scene.substitutionShelf||scene.cycleShelf)){
  throw Error('Combining is available for drawing scenes without animation, audio, camera or motion data.');
 }
 const a=shotFrame(destination),b=shotFrame(source);
 const sameFrame=a.x===b.x&&a.y===b.y&&a.width===b.width&&a.height===b.height;
 const oldA=destination.previousStage,oldB=source.previousStage;
 const samePrevious=JSON.stringify(oldA??null)===JSON.stringify(oldB??null);
 if(!sameFrame||!samePrevious||destination.width!==source.width||destination.height!==source.height){
  throw Error('These scenes use different canvas bounds. Match their canvas and shot sizes before combining.');
 }
 if(source.layers.length+destination.layers.length>100)throw Error('The combined scene would exceed 100 layers.');
 const used=new Set(destination.layers.flatMap(layer=>layer.operations.map(operation=>operation.id)));
 const imported=source.layers.map(layer=>({
  ...layer,id:uid(),
  operations:layer.operations.map(operation=>{
   if(!used.has(operation.id)){used.add(operation.id);return operation;}
   const id=uid();
   used.add(id);
   return operation.kind==='stroke'?{...operation,id,rasterSourceId:operation.rasterSourceId??operation.id}:{...operation,id};
  })
 }));
 return validateProject({
  ...destination,version:Math.max(source.version,destination.version) as Project['version'],
  id:uid(),name:(destination.name+' + '+source.name).slice(0,100),
  createdAt:new Date().toISOString(),layers:[...imported,...destination.layers]
 });
}
