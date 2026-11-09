// Regression: a real brush remains selectable after every subsequent transform.
// Run: node tests/stroke-reselection-v212.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require.extensions['.ts']=(mod,filename)=>mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {hitStroke,transformedStroke,projectiveStroke,boundsOf}=require('../src/engine/strokeSelection.ts');
const {homography,projectPoint}=require('../src/engine/perspectiveWarp.ts');
const stroke={kind:'stroke',id:'same-brush',tool:'brush',size:6,opacity:1,color:'#123456',pressure:true,response:1,engineVersion:10,brushKind:'studio-ink',points:[{x:20,y:20,p:.25},{x:60,y:20,p:.75},{x:100,y:20,p:.5}]};
const layer=op=>({operations:[op]});
const expectPick=(op,point)=>assert.equal(hitStroke(layer(op),point,1)?.id,'same-brush','Brush must be re-selectable');
expectPick(stroke,{x:60,y:20});
let moved=transformedStroke(stroke,[1,0,0,1,25,15]);
assert.equal(moved.rasterTransformVersion,1,'Transformed brush must retain the exact raster pipeline');
assert.equal(moved.rasterSourceId,stroke.id,'Original brush seed must be stable');
expectPick(moved,{x:85,y:35});
moved=transformedStroke(moved,[1,0,0,1,15,15]);
expectPick(moved,{x:100,y:50});
assert.equal(moved.rasterSourceId,stroke.id,'Repeated transforms must keep the same original pigment');
moved=transformedStroke(moved,[2,0,0,2,-100,-50]);
expectPick(moved,{x:100,y:50});
expectPick(moved,{x:100,y:56}); // transformed brush radius, not a 0px hit
let thin=transformedStroke(stroke,[.3,0,0,.3,50,40]);
expectPick(thin,{x:68,y:46});
const from=[{x:0,y:0},{x:120,y:0},{x:120,y:80},{x:0,y:80}];
const to=[{x:0,y:0},{x:220,y:0},{x:165,y:100},{x:0,y:80}];
const h=homography(from,to);assert(h);
let warped=projectiveStroke(stroke,h);
expectPick(warped,projectPoint({x:60,y:20},h));
const b=boundsOf([warped]);assert(b&&b.w>100);
warped=projectiveStroke(warped,[1,0,15,0,1,20,0,0,1]);
expectPick(warped,projectPoint(projectPoint({x:60,y:20},h),[1,0,15,0,1,20,0,0,1]));
const tool=fs.readFileSync(path.join(__dirname,'../src/tools/transform/TransformTool.ts'),'utf8');
assert(tool.includes('editableBrushSelection&&!meshWarp'),'Selected brush must not become unselectable PNG after projective transforms');
assert(tool.includes('transformedStroke(op,affine)'),'Affine transforms must retain the original brush raster');
console.log('PASS: repeated brush selection after move, scale, projective warp; preserved original brush raster and editable strokes');
