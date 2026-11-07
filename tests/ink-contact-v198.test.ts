import {describe,it,expect} from 'vitest';
import {brushStrokeMetadata} from '../src/core/paintTips';
import type {Stroke} from '../src/core/model';
import {strokeGeometry} from '../src/engine/strokeGeometry';

describe('new ink keeps the live contact through pen-up',()=>{
 for(const brushKind of ['g-pen','mapping','brush-pen']){
  it(`${brushKind} uses the no-refit capture revision from the real metadata factory`,()=>{
   for(const captureZoom of [.25,.74,.83,1,1.21,2])for(const stabilization of [0,.25,1]){
    const stroke:Stroke={...brushStrokeMetadata({brushKind}),id:'contact',kind:'stroke',tool:'brush',brushKind,captureZoom,size:14,opacity:1,color:'#222222',pressure:true,response:1,stabilization,smoothness:65,taperStart:.34,taperEnd:.09,
     points:Array.from({length:160},(_,i)=>({x:100+i*2,y:100+40*Math.sin(i*.1),p:.6+.2*Math.sin(i*.15)}))};
    expect(stroke.liveRefinementVersion).toBe(3);
    const live=strokeGeometry(stroke,'live');
    expect(live).toEqual(strokeGeometry(stroke,'final'));
    expect(live.points.at(-1)).toEqual(stroke.points.at(-1));
    expect(live.points.every((point,i)=>point.p===stroke.points[i].p)).toBe(true);
   }
  });
 }
 it('does not upgrade saved older strokes or unrelated technical pens',()=>{
  expect(brushStrokeMetadata({brushKind:'technical'}).liveRefinementVersion).toBe(2);
  const saved:Stroke={id:'saved',kind:'stroke',tool:'brush',brushKind:'brush-pen',engineVersion:10,liveRefinementVersion:2,size:14,opacity:1,color:'#222222',pressure:false,response:1,stabilization:1,smoothness:0,points:Array.from({length:50},(_,i)=>({x:i*3,y:20,p:1}))};
  expect(strokeGeometry(saved,'live').points.at(-1)!.x).toBeLessThan(saved.points.at(-1)!.x);
  expect(strokeGeometry(saved,'final').points.at(-1)).toEqual(saved.points.at(-1));
  expect(saved.liveRefinementVersion).toBe(2);
 });
});

