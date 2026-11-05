import {describe,expect,it} from 'vitest';
import {cameraAt,cameraMatrix,newSceneCamera} from '../src/animation/sceneCamera';
import {activeLayer,appendOperation,MAX_STAGE_PIXELS,MAX_STAGE_SIDE,newProject,validateProject,type Operation,type Project} from '../src/core/model';
import {coverView,toProject} from '../src/core/geometry';
import {DocumentStore} from '../src/core/history';
import {artworkAtOrigin,expandPasteboard,shotFrame} from '../src/core/shotFrame';

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
  const expanded=expandPasteboard(project,800,450),frame=shotFrame(expanded);
  expect(frame).toEqual({x:(expanded.width-640)/2,y:(expanded.height-360)/2,width:640,height:360});
  expect(expanded.width).toBeGreaterThan(1600);
  expect(expanded.height).toBeGreaterThan(900);
  expect(expanded.animation?.frames[1].hold).toBe(2);
  expect(expanded.animation?.layerHolds?.[layer.id].stash.second).toBe(activeLayer(expanded).operations);
  expect(shotFrame(project)).toEqual({x:0,y:0,width:640,height:360});

  const reopened=validateProject(JSON.parse(JSON.stringify(expanded)));
  expect(JSON.parse(JSON.stringify(artworkAtOrigin(activeLayer(reopened).operations,frame,'inShot')))).toEqual(operations);
  const outside={...operations[1],id:'outside'} as Operation;
  const store=new DocumentStore(reopened);
  store.commit(appendOperation(reopened,outside));
  const edited=validateProject(store.getSnapshot());
  expect(edited.version).toBe(5);
  expect(shotFrame(edited)).toEqual(frame);
  expect(expandPasteboard(edited,1440,900)).toBe(edited);
 });

 it('preserves camera framing and parallax after adding margins',()=>{
  const project=newProject('Camera shot',640,360);
  project.camera={...newSceneCamera(),keys:[{frame:1,x:345,y:190,zoom:1.2,rotation:10,ease:'linear'}]};
  const expanded=expandPasteboard(project,800,450),frame=shotFrame(expanded);
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

 it('retains both bitmap origins and existing outside artwork in a v0.5.182 project',()=>{
  const project:Project={...newProject('Margin artwork',640,360),version:4,width:800,height:450,
   shotFrame:{x:80,y:45,width:640,height:360}};
  const layer=activeLayer(project);
  layer.operations=[
   {id:'shot fill',kind:'fill',png:'data:image/png;base64,AAAA',inShot:true},
   {id:'stage fill',kind:'fill',png:'data:image/png;base64,BBBB'},
   {id:'edge image',kind:'image',png:'data:image/png;base64,CCCC',x:2,y:5,width:16,height:16}
  ];
  validateProject(project);
  const expanded=validateProject(expandPasteboard(project,800,450)),previous=expanded.previousStage!;
  expect(previous).toEqual({x:(expanded.width-800)/2,y:(expanded.height-450)/2,width:800,height:450});
  expect(shotFrame(expanded)).toEqual({x:80+previous.x,y:45+previous.y,width:640,height:360});
  expect(activeLayer(expanded).operations.every(op=>op.inPreviousStage)).toBe(true);
  expect(JSON.parse(JSON.stringify(artworkAtOrigin(activeLayer(expanded).operations,previous,'inPreviousStage')))).toEqual(layer.operations);
 });

 it('covers all four drawing corners during zoom, pan, rotation and resize within the pixel limit',()=>{
  const project=validateProject(expandPasteboard(newProject(),1490,915));
  expect(project.width*project.height).toBeLessThanOrEqual(MAX_STAGE_PIXELS);
  expect(Math.max(project.width,project.height)).toBeLessThanOrEqual(MAX_STAGE_SIDE);
  for(const [width,height] of [[1490,915],[1800,1050],[900,1100]]){
   for(const rotation of [0,Math.PI/8,Math.PI/2]){
    const view=coverView({x:12000,y:-5000,zoom:.25,rotation},width,height,project.width,project.height);
    for(const x of [0,width])for(const y of [0,height]){
     const point=toProject({x,y},view);
     expect(point.x).toBeGreaterThan(0);
     expect(point.x).toBeLessThan(project.width);
     expect(point.y).toBeGreaterThan(0);
     expect(point.y).toBeLessThan(project.height);
    }
   }
  }
  validateProject(expandPasteboard(newProject('Maximum shot',4096,2048),10240,512));
 });
});
