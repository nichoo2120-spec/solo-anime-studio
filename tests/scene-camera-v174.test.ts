import {describe,it,expect} from 'vitest';
import {cameraAt,cameraMatrix,cameraFrame,easeValue,newSceneCamera,setCameraKey,deleteCameraKey,validateSceneCamera,pruneCameraDepth} from '../src/animation/sceneCamera';
describe('v174 scene camera',()=>{
 it('home camera is identity (export pixels unchanged)',()=>{expect(cameraMatrix(cameraAt(undefined,1,1920,1080),1920,1080)).toEqual([1,0,0,1,0,0]);});
 it('interpolates keys with easing and holds',()=>{
  let c=newSceneCamera();c=setCameraKey(c,{frame:1,x:960,y:540,zoom:1,rotation:0,ease:'linear'});c=setCameraKey(c,{frame:11,x:1060,y:540,zoom:2,rotation:10,ease:'linear'});
  const m=cameraAt(c,6,1920,1080);expect(m.x).toBeCloseTo(1010);expect(m.zoom).toBeCloseTo(Math.SQRT2);expect(m.rotation).toBeCloseTo(5);
  expect(cameraAt(c,0,1920,1080).x).toBe(960);expect(cameraAt(c,99,1920,1080).x).toBe(1060);
  c=setCameraKey(c,{...c.keys[0],ease:'hold'});expect(cameraAt(c,10,1920,1080).x).toBe(960);
  expect(easeValue('ease-in-out',.5)).toBeCloseTo(.5);expect(easeValue('ease-in',.5)).toBeCloseTo(.25);
  expect(deleteCameraKey(c,1).keys.length).toBe(1);
 });
 it('camera centre maps to output centre; depth gives parallax',()=>{
  const st={x:1200,y:600,zoom:2,rotation:30},m=cameraMatrix(st,1920,1080,0),ap=(p:{x:number;y:number},m:number[])=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
  const o=ap({x:1200,y:600},m);expect(o.x).toBeCloseTo(960);expect(o.y).toBeCloseTo(540);
  const far=cameraMatrix({x:1160,y:540,zoom:1,rotation:0},1920,1080,1);expect(far[4]).toBeCloseTo(-100);
  const near=cameraMatrix({x:1160,y:540,zoom:1,rotation:0},1920,1080,0);expect(near[4]).toBeCloseTo(-200);
  const f=cameraFrame(st,1920,1080).map(p=>ap(p,m));expect(f[0].x).toBeCloseTo(0);expect(f[2].y).toBeCloseTo(1080);
 });
 it('validates saved data and prunes deleted layers',()=>{
  const c={...newSceneCamera(),depth:{a:1,b:2}};expect(validateSceneCamera(c)).toBe(true);
  expect(validateSceneCamera({...c,keys:[{frame:0,x:0,y:0,zoom:1,rotation:0,ease:'linear'}]})).toBe(false);
  expect(validateSceneCamera({...c,depth:{a:NaN}})).toBe(false);
  expect(Object.keys(pruneCameraDepth(c,new Set(['a'])).depth)).toEqual(['a']);
 });
});
