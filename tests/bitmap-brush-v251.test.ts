import {encodeProjectBrushMasks} from '../src/core/brushImport/portableMasks';
import {createHash} from 'node:crypto';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {activePreset,addImportedBrushes,newBrushLibrary,restoreBrushLibrary} from '../src/core/brushes';
import {importBrushFile} from '../src/core/brushImport';
import {importPhotoshop} from '../src/core/brushImport/photoshop';
import {encodeBitmapMask} from '../src/core/brushImport/mask';
import {activeLayer,newProject,validateProject,type Stroke} from '../src/core/model';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {importProject} from '../src/core/persistence';
import {LiveStrokeRaster} from '../src/engine/liveRaster';
import {drawStroke} from '../src/engine/renderer';
import {strokeGeometry} from '../src/engine/strokeGeometry';
import {abrFixture,longBrushName} from './fixtures/brushImport';

const width=370,height=230;
const canvas=(w:number,h:number)=>createCanvas(w,h);
const surface=()=>canvas(width,height).getContext('2d') as unknown as CanvasRenderingContext2D;
const fingerprint=(ctx:CanvasRenderingContext2D)=>createHash('sha256').update(ctx.getImageData(0,0,width,height).data).digest('hex');
beforeEach(()=>{
 vi.stubGlobal('document',{createElement:()=>canvas(1,1)});
 vi.stubGlobal('OffscreenCanvas',function(w:number,h:number){return canvas(w,h);});
 vi.stubGlobal('createImageBitmap',async(blob:Blob)=>Object.assign(await loadImage(Buffer.from(await blob.arrayBuffer())),{close() {}}));
});
afterEach(()=>vi.unstubAllGlobals());

it.each([6,10] as const)('imports Photoshop ABR v%i samples, long Unicode names and dynamics',async(version)=>{
 const result=await importPhotoshop(abrFixture(version));
 expect(result).toHaveLength(1);
 expect(result[0]).toMatchObject({name:longBrushName,size:85,tips:[{width:3,height:2}],settings:{spacing:.34,scatter:.49,count:3,sizeJitter:.27},roundnessJitter:.31,dual:{spacing:.21,count:2,mask:{width:3,height:2}}});
 expect(Array.from(Buffer.from(result[0].tips[0].alpha,'base64'))).toEqual([255,0,130,70,245,0]);
 const library=addImportedBrushes(newBrushLibrary(),'Textures',result);
 expect(activePreset(restoreBrushLibrary(JSON.parse(JSON.stringify(library))))).toMatchObject({name:longBrushName,category:'Imported',pack:'Textures'});
});
it('imports PNG as luminance or alpha and rejects unreadable brush files',async()=>{
 const c=canvas(4,2),ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,4,2);ctx.fillStyle='black';ctx.fillRect(0,0,2,2);
 const file=new File([new Uint8Array(c.toBuffer('image/png'))],'Hand drawn.png',{type:'image/png'});
 const [tip]=await importBrushFile(file,'luminance',()=>{});
 const [alpha]=await importBrushFile(file,'alpha',()=>{});
 expect(tip).toMatchObject({name:'Hand drawn',size:4,tips:[{width:4,height:2}]});
 expect(Array.from(Buffer.from(tip.tips[0].alpha,'base64'))).toEqual([255,255,0,0,255,255,0,0]);
 expect(Buffer.from(alpha.tips[0].alpha,'base64').every(x=>x===255)).toBe(true);
 await expect(importBrushFile(new File(['invalid'],'bad.abr'),'auto',()=>{})).rejects.toThrow(/ABR/);
 await expect(importBrushFile(new File(['invalid'],'bad.jpg'),'auto',()=>{})).rejects.toThrow(/JPEG/);
});
it('makes imported strokes deterministic, portable and pixel-identical to live Paint',async()=>{
 const masks=await Promise.all([
  encodeBitmapMask(Uint8Array.of(0,255,0,180,255,0,0,220,255),3,3),
  encodeBitmapMask(Uint8Array.of(230,255,0,180,0,0,210,0,0),3,3),
 ]);
 const preset=activePreset(addImportedBrushes(newBrushLibrary(),'Test Pack',[{name:'Leaf test',tips:masks,size:70,roundnessJitter:.3,settings:{spacing:.23,rotation:24,scatter:.34},dual:{mask:masks[1],size:50,spacing:.15,count:1,scatter:.2,mode:'multiply'}}]));
 const s:Stroke={...brushStrokeMetadata(preset.settings),id:'imported-stroke',kind:'stroke',tool:'brush',size:70,opacity:1,color:'#163548',pressure:false,response:1,points:Array.from({length:24},(_,i)=>({x:75+i*9,y:100+Math.sin(i*.19)*10,p:.7}))};
 const live=new LiveStrokeRaster(),preview=surface(),final=surface();
 for(const length of [1,6,12,s.points.length]){
  const growing={...s,points:s.points.slice(0,length)};
  live.paint(preview,growing,strokeGeometry(growing));
 }
 drawStroke(final,s);
 expect(fingerprint(preview)).toBe(fingerprint(final));
 expect(final.getImageData(0,0,width,height).data.some((v,i)=>i%4===3&&v>0)).toBe(true);
 const project=newProject('Portable Imported Tip',width,height);activeLayer(project).operations.push(s);
 const backup=encodeProjectBrushMasks(project);
 expect(JSON.parse(backup).brushMasks).toHaveProperty(masks[0].id);
 const reopened=await importProject(new File([backup],'portable.solo.json'));
 const saved=activeLayer(reopened).operations[0] as Stroke;
 const reopenedCanvas=surface();drawStroke(reopenedCanvas,saved);
 expect(fingerprint(reopenedCanvas)).toBe(fingerprint(final));
 const changed=surface();drawStroke(changed,{...saved,nature:{...saved.nature!,seed:saved.nature!.seed+1}});
 expect(fingerprint(changed)).not.toBe(fingerprint(final));
 const corrupted=JSON.parse(JSON.stringify(project));((activeLayer(corrupted).operations[0] as Stroke).nature!.bitmap!.tips[0] as {alpha:string}).alpha='not a mask';
 expect(()=>validateProject(corrupted)).toThrow(/Nature brush/);
});
