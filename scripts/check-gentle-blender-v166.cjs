// Uses the project's declared TypeScript dev dependency. Optional skia-canvas
// exercises real colour pixels if available; it is NOT a Chrome performance test.
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const {Canvas}=(()=>{try{return require('skia-canvas')}catch{return{}}})();
require.extensions['.ts']=function(mod,file){mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);};
let checks=0;
const ok=(cond,msg)=>{assert(cond,msg);checks++;};
const {newBrushLibrary,restoreBrushLibrary}=require('../src/core/brushes.ts');
const {brushStrokeMetadata}=require('../src/core/paintTips.ts');
const {validateProject,newProject}=require('../src/core/model.ts');
const lib=newBrushLibrary(),blender=lib.presets.find(x=>x.id==='color-blender');
ok(blender.settings.smudgeVersion===3,'new strokes use local blender');
ok(blender.settings.colorNib==='round','new strokes use soft nib');
ok(blender.settings.mixAmount<.5,'new Blender strength starts gentle');
ok(blender.settings.useSelectedColour===0,'selected paint is not injected');
ok(brushStrokeMetadata(blender.settings).smudgeVersion===3,'stroke records new version');
const old=JSON.parse(JSON.stringify(lib));old.presets.find(x=>x.id==='color-blender').settings.smudgeVersion=undefined;
const migrated=restoreBrushLibrary(old).presets.find(x=>x.id==='color-blender');
ok(migrated.settings.smudgeVersion===3,'saved Blender preset upgrades for subsequent strokes only');
const metadata=brushStrokeMetadata(blender.settings),s={...metadata,kind:'stroke',id:'test-v166',tool:'brush',points:[{x:60,y:25,p:1},{x:65,y:60,p:1}],size:50,opacity:.75,color:'#ffffff',pressure:false,response:1,flow:.75};
let project=newProject('Old brushes');const layer=project.layers[0];
const historical={...s,smudgeVersion:undefined};for(const k of ['pickupLen','holdLen','smearStreak','useSelectedColour'])delete historical[k];const v2={...s,smudgeVersion:2};
for(const stroke of [historical,v2,s]){
 const candidate={...project,layers:project.layers.map(l=>l.id===project.activeLayerId?{...l,operations:[stroke]}:l)};
 ok(validateProject(candidate).layers.find(l=>l.id===project.activeLayerId).operations.length===1,'validate old and new stroke versions');
}
const compositor=fs.readFileSync('src/engine/paintCompositing.ts','utf8');
ok(compositor.indexOf('s.smudgeVersion===3')<compositor.indexOf('s.smudgeVersion===2'), 'new path gated before untouched historical path');
ok(!fs.readFileSync('src/engine/gentleBlend.ts','utf8').includes('getImageData('),'no canvas readback in new Blender');
if(Canvas){
 global.document={createElement:()=>new Canvas(1,1)};
 const {applyGentleBlend,resetGentleBlend}=require('../src/engine/gentleBlend.ts');
 const fill=()=>{const c=new Canvas(256,128),ctx=c.getContext('2d');ctx.fillStyle='#f00000';ctx.fillRect(0,0,128,128);ctx.fillStyle='#0000ef';ctx.fillRect(128,0,128,128);return c;};
 const points=Array.from({length:30},(_,i)=>({x:120+Math.sin(i/5)*7,y:5+i*4,p:1,v:.65}));
 const args={...s,id:'v166-pixel',points,size:55};
 const base=fill(),one=fill();applyGentleBlend(one.getContext('2d'),base,args,0,0,{x:0,y:0,width:256,height:128},base);
 const image=one.getContext('2d').getImageData(0,0,256,128).data;
 const pixel=(x,y,d=image)=>Array.from(d.subarray((y*256+x)*4,(y*256+x)*4+4));
 ok(pixel(35,64).join(',')==='240,0,0,255','distant red preserved');
 ok(pixel(225,64).join(',')==='0,0,239,255','distant blue preserved');
 ok(pixel(125,64)[2]>0,'red/blue edge is actually mixed');
 ok(pixel(125,64)[3]===255,'blending preserves alpha');
 resetGentleBlend();const base2=fill(),inc=fill();for(let i=2;i<=points.length;i++)applyGentleBlend(inc.getContext('2d'),base2,{...args,points:points.slice(0,i)},0,0,{x:0,y:0,width:256,height:128},base2);
 const live=inc.getContext('2d').getImageData(0,0,256,128).data;
 ok(Buffer.from(live).equals(Buffer.from(image)),'incremental and final pixels match exactly');
 resetGentleBlend();const zero=fill(),baseZero=fill();applyGentleBlend(zero.getContext('2d'),baseZero,{...args,id:'zero',mixAmount:0},0,0,{x:0,y:0,width:256,height:128},baseZero);
 ok(Buffer.from(zero.getContext('2d').getImageData(0,0,256,128).data).equals(Buffer.from(baseZero.getContext('2d').getImageData(0,0,256,128).data)),'zero mix preserves pixels');
}else console.log('Real-pixel test skipped: optional skia-canvas is not installed (no app dependency added).');
console.log(`v166 gentle Blender checks PASS (${checks})`);
