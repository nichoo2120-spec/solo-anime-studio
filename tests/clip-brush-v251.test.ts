import {expect,it} from 'vitest';
import {importBrushFile} from '../src/core/brushImport';
import {sutFixture} from './fixtures/clipBrush';

it('reads a SUT SQLite subtool and decodes real C2F brush material pixels',async()=>{
 const props=await importBrushFile(new File([Uint8Array.from(await sutFixture())],'Roche.sut'),'auto',()=>{});
 expect(props).toHaveLength(1);
 expect(props[0]).toMatchObject({name:'Roche · 山',size:72,tips:[{width:7,height:5}],settings:{spacing:.31}});
 const tip=Buffer.from(props[0].tips[0].alpha,'base64');
 expect([tip[8],tip[9],tip[16]]).toEqual([255,184,219]);
});
