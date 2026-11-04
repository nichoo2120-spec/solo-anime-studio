import {it,expect} from 'vitest';
import {CameraViewState} from '../src/core/CameraViewState';
it('retains a stable snapshot for unchanged camera values',()=>{const camera=new CameraViewState(),v=camera.getSnapshot();let calls=0;camera.subscribe(()=>calls++);camera.publish({...v});expect(camera.getSnapshot()).toBe(v);expect(calls).toBe(0);});
it('publishes an owned snapshot and removes retired subscribers',()=>{const camera=new CameraViewState();let calls=0;const off=camera.subscribe(()=>calls++),v={x:10,y:20,zoom:2,rotation:.4};camera.publish(v);v.zoom=4;expect(camera.getSnapshot().zoom).toBe(2);expect(calls).toBe(1);off();camera.publish({...v});expect(calls).toBe(1);});
