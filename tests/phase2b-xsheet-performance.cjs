const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {newProject}=require('../src/core/model.ts');const {addDrawingFrame,frameList,selectDrawingFrame,syncActiveFrame,setDrawingFrameHoldById}=require('../src/animation/timeline.ts');const {sameXsheetPresentation,buildXsheetIndex,xsheetVisibleRange,xsheetRows}=require('../src/animation/xsheet.ts');
let p=newProject('Xsheet lag check',720,480);p=addDrawingFrame(p);const frames=frameList(p);p=selectDrawingFrame(p,frames[1].id);let omitted=0,repaints=0;
for(let i=0;i<100;i++){
 const layer=p.layers[0];const nextOps=[...layer.operations,{kind:'stroke',id:'ink'+i,points:[],size:2,color:'#000',opacity:1}];
 const next=syncActiveFrame({...p,layers:p.layers.map(l=>l.id===layer.id?{...l,operations:nextOps}:l)});
 if(sameXsheetPresentation(p,next))omitted++;else repaints++;
 p=next;
}
assert.equal(repaints,1,'Only first empty-to-drawn event updates Xsheet; 99 follow-up strokes must be skipped');assert.equal(omitted,99);
let next=setDrawingFrameHoldById(p,frames[1].id,2);assert.equal(sameXsheetPresentation(p,next),false,'Timing must invalidate Xsheet');
next=selectDrawingFrame(p,frames[0].id);assert.equal(sameXsheetPresentation(p,next),false,'Selection must invalidate Xsheet');
const index=buildXsheetIndex(p),window=xsheetVisibleRange(index.total,0,320);assert(xsheetRows(index,window.first,window.last).length<=28);
console.log('PASS Xsheet frame input performance gate: 99/100 pen commits skipped Xsheet re-render; first-art, timing, selection invalidate; bounded virtual DOM. Browser/Wacom not measured.');
