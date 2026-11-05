import {describe,expect,it} from 'vitest';
import {cameraAt,cameraMatrix,newSceneCamera} from '../src/animation/sceneCamera';
import {activeLayer,appendOperation,newProject,validateProject,type Operation} from '../src/core/model';
import {addDrawingMargins,originalShotArtwork,shotFrame} from '../src/core/shotFrame';

describe('drawing outside the shot frame',()=>{
 it('keeps existing art, holds and fills in the original shot on reopen',()=>{
  const project=newProject('Shot',640,360),layer=activeLayer(project);
  const operations:Operation[]=[
   {id:'fill',kind:'fill',png:'data:image/png;base64,AAAA',under:true},
   {id:'stroke',kind:'stroke',tool:'brush',points:[{x:82,y:46,p:.8}],size:10,opacity:.8,color:'#804331',pressure:true,response:1}
  ];
  layer.operations=operations;
  const drawings=Object.fromEntries(project.layers.map(l=>[l.id,l.operations]));
  project.animation={
   version:1,activeFrameId:'first',frames:[{id:'first',drawings},{id:'second',drawings,hold:2}],
   layerHolds:{[layer.id]:{held:['second'],stash:{second:operations}}}
  };
  const expanded=addDrawingMargins(project),frame=shotFrame(expanded);
  expect(frame).toEqual({x:80,y:45,width:640,height:360});
  expect([expanded.width,expanded.height]).toEqual([800,450]);
  expect(expanded.animation?.frames[1].hold).toBe(2);
  expect(expanded.animation?.layerHolds?.[layer.id].stash.second).toBe(activeLayer(expanded).operations);
  expect(shotFrame(project)).toEqual({x:0,y:0,width:640,height:360});

  const reopened=validateProject(JSON.parse(JSON.stringify(expanded)));
  expect(JSON.parse(JSON.stringify(originalShotArtwork(activeLayer(reopened).operations,frame)))).toEqual(operations);
  const outside={...operations[1],id:'outside'} as Operation;
  const edited=validateProject(appendOperation(reopened,outside));
  expect(edited.version).toBe(4);
  expect(shotFrame(edited)).toEqual(frame);
  expect(addDrawingMargins(edited)).toBe(edited);
 });

 it('preserves camera framing and parallax after adding margins',()=>{
  const project=newProject('Camera shot',640,360);
  project.camera={...newSceneCamera(),keys:[{frame:1,x:345,y:190,zoom:1.2,rotation:10,ease:'linear'}]};
  const expanded=addDrawingMargins(project),frame=shotFrame(expanded);
  const before=cameraAt(project.camera,1,640,360),after=cameraAt(expanded.camera,1,640,360,frame.x,frame.y);
  expect(after).toEqual({...before,x:before.x+frame.x,y:before.y+frame.y});
  for(const depth of [-.5,0,2]){
   const a=cameraMatrix(before,640,360,depth),b=cameraMatrix(after,640,360,depth,frame.x,frame.y);
   const apply=(m:number[],x:number,y:number)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
   const original=apply(a,280,140),translated=apply(b,280+frame.x,140+frame.y);
   expect(translated[0]).toBeCloseTo(original[0],10);
   expect(translated[1]).toBeCloseTo(original[1],10);
  }
 });
});
