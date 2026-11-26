import {createCanvas,loadImage} from '@napi-rs/canvas';
import {zipSync} from 'fflate';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {importBrushFile} from '../src/core/brushImport';
import {procreateArchiveFixture} from './fixtures/brushImport';

const fixture=()=>{
 const c=createCanvas(6,4),ctx=c.getContext('2d');
 ctx.fillStyle='black';ctx.fillRect(0,0,6,4);ctx.fillStyle='white';ctx.fillRect(1,1,3,2);
 return {'Brush.archive':procreateArchiveFixture(),'Shape.png':new Uint8Array(c.toBuffer('image/png')),'Grain.png':new Uint8Array(c.toBuffer('image/png'))};
};
beforeEach(()=>{
 vi.stubGlobal('OffscreenCanvas',function(w:number,h:number){return createCanvas(w,h);});
 vi.stubGlobal('createImageBitmap',async(blob:Blob)=>Object.assign(await loadImage(Buffer.from(await blob.arrayBuffer())),{close(){}}));
});
afterEach(()=>vi.unstubAllGlobals());

it('reads Procreate binary plist settings, a white-on-black shape and its grain',async()=>{
 const pack=zipSync(fixture());
 const brushes=await importBrushFile(new File([pack],'Autumn.brush'),'auto',()=>{});
 expect(brushes).toHaveLength(1);
 expect(brushes[0]).toMatchObject({name:'Feuillage doré',size:41,angle:45,tips:[{width:6,height:4}],grain:{width:6,height:4},settings:{spacing:.28,scatter:.24,count:3,follow:true,scale:.75,grain:.6}});
 const mask=Buffer.from(brushes[0].tips[0].alpha,'base64');
 expect(mask[0]).toBe(0);expect(mask[7]).toBe(255);
});
it('imports a brush set with embedded and directory brushes and skips reset copies',async()=>{
 const brush=zipSync(fixture());
 const pack=zipSync({'A':{...fixture(),'Reset':fixture()},'B.brush':brush});
 const results=await importBrushFile(new File([pack],'Set.brushset'),'auto',()=>{});
 expect(results).toHaveLength(2);
 expect(results.map(b=>b.name)).toEqual(['Feuillage doré','Feuillage doré']);
});
