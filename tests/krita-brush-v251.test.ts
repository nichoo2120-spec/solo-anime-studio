import {createCanvas,loadImage} from '@napi-rs/canvas';
import {zlibSync,zipSync} from 'fflate';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {importBrushFile} from '../src/core/brushImport';

const png=()=>{
 const c=createCanvas(7,5),ctx=c.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(1,1,4,2);return c.toBuffer('image/png');
};
function pngWithPreset(xml:string){
 const source=png(),data=Buffer.concat([Buffer.from('preset\0\0','binary'),zlibSync(Buffer.from(xml))]);
 const chunk=Buffer.alloc(12+data.length);chunk.writeUInt32BE(data.length);chunk.write('zTXt',4);chunk.set(data,8);
 let crc=0xffffffff;
 for(const byte of chunk.subarray(4,-4)){
  crc^=byte;
  for(let bit=0;bit<8;bit++)crc=crc>>>1^(crc&1?0xedb88320:0);
 }
 chunk.writeUInt32BE((crc^0xffffffff)>>>0,chunk.length-4);
 return Buffer.concat([source.subarray(0,-12),chunk,source.subarray(-12)]);
}
beforeEach(()=>{
 vi.stubGlobal('OffscreenCanvas',function(w:number,h:number){return createCanvas(w,h);});
 vi.stubGlobal('createImageBitmap',async(data:Blob)=>Object.assign(await loadImage(Buffer.from(await data.arrayBuffer())),{close(){}}));
});
afterEach(()=>vi.unstubAllGlobals());

it('reads a Krita KPP embedded image and the compressed preset XML',async()=>{
 const xml='<Preset paintopid="paintbrush" name="Écorce &amp; sel"><param name="brush_definition"><![CDATA[<Brush type="png_brush" filename="leaf.png" scale="2" spacing=".39"/>]]></param><resources><resource filename="leaf.png">'+png().toString('base64')+'</resource></resources></Preset>';
 const pack=pngWithPreset(xml);
 const brushes=await importBrushFile(new File([Uint8Array.from(pack)],'Tip.kpp'),'auto',()=>{});
 expect(brushes).toHaveLength(1);
 expect(brushes[0]).toMatchObject({name:'Écorce & sel',size:14,tips:[{width:7,height:5}],settings:{spacing:.39}});
});
it('resolves a real tip from the brushes folder of a Krita bundle',async()=>{
 const pack=zipSync({
  'mimetype':new Uint8Array(Buffer.from('application/x-krita-resourcebundle')),
  'paintoppresets/leaf.kpp':pngWithPreset('<Preset paintopid="paintbrush" name="Alder"><param name="brush_definition"><![CDATA[<Brush filename="Alder.png" spacing=".28"/>]]></param></Preset>'),
  'brushes/Alder.png':png(),
 });
 const brushes=await importBrushFile(new File([pack],'Wetlands.bundle'),'auto',()=>{});
 expect(brushes).toHaveLength(1);
 expect(brushes[0]).toMatchObject({name:'Alder',size:7,tips:[{width:7,height:5}],settings:{spacing:.28}});
});
