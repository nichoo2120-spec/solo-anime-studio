import {describe,it,expect} from 'vitest';
import {hexRgb,rgbHex,rgbHsv,hsvRgb} from '../src/core/color';
import {newProject,validateProject} from '../src/core/model';
import {ProjectRepository} from '../src/core/persistence';
import 'fake-indexeddb/auto';
describe('color, blend and reference persistence',()=>{
 it('round trips primary and mixed colors through HSV',()=>{for(const hex of ['#ff0000','#00ff00','#0000ff','#778899','#000000','#ffffff','#d98c26']){const rgb=hexRgb(hex),hsv=rgbHsv(rgb);expect(rgbHex(hsvRgb(hsv.h,hsv.s,hsv.v))).toBe(hex);}});
 it('clamps invalid RGB channels instead of corrupting hex',()=>{expect(rgbHex([-5,999,NaN])).toBe('#00ff00');});
 it('retains all blend modes and reference/export settings transactionally',async()=>{for(const blend of ['normal','multiply','screen','overlay','add'] as const){const p=newProject('Blend'),l=p.layers[0];l.blend=blend;l.reference=true;l.exportReference=false;const repo=new ProjectRepository('blend-'+crypto.randomUUID());await repo.save(p);expect((await repo.load(p.id)).project.layers[0]).toEqual(l);}expect(()=>validateProject({...newProject(),layers:[{...newProject().layers[0],blend:'unknown'}]})).toThrow();});
 it('continues reading format 1 and 2 without changing brush samples',()=>{const p=newProject();for(const version of [1,2])expect(validateProject(JSON.parse(JSON.stringify({...p,version})))).toMatchObject({version,layers:p.layers});});
});
