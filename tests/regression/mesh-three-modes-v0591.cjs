const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const vm=require('node:vm');
const matrix=fs.readFileSync('src/tools/transform/math/matrix.ts','utf8');const mesh=fs.readFileSync('src/tools/transform/math/meshWarp.ts','utf8');
const compiled=ts.transpileModule(mesh.replace("import {bilerp,type Pt,type Quad} from './matrix';",'const bilerp=(q,u,v)=>({x:q[0].x*(1-u)*(1-v)+q[1].x*u*(1-v)+q[2].x*u*v+q[3].x*(1-u)*v,y:q[0].y*(1-u)*(1-v)+q[1].y*u*(1-v)+q[2].y*u*v+q[3].y*(1-u)*v});'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const modExports={};vm.runInNewContext(compiled,{exports:modExports,require});const {makeGrid,contourGrid,gridPoint,meshHasFold}=modExports;
const q=[{x:0,y:0},{x:120,y:0},{x:120,y:240},{x:0,y:240}];
for (const n of [3,5,8,12]) {const g=makeGrid(q,n,n);assert.equal(g.nodes.length,(n+1)**2);assert.equal(g.rows,n);assert.equal(g.cols,n);}
const width=120,height=240,data=new Uint8ClampedArray(width*height*4);
for(let y=0;y<height;y++) {const r=y<60?15:y<115?35:y<150?22:12;for(let x=60-r;x<=60+r;x++)data[(y*width+x)*4+3]=255;}
const g=contourGrid(q,data,width,height,5,5);
assert.equal(g.nodes.length,36);
for(let r=0;r<=5;r++){for(let c=1;c<=5;c++){const a=g.nodes[r*6+c-1],b=g.nodes[r*6+c];assert.ok(b.x>a.x,`row ${r} columns must be ordered`);}if(r>0)for(let c=0;c<=5;c++)assert.ok(g.nodes[r*6+c].y>g.nodes[(r-1)*6+c].y);}
assert.ok(!meshHasFold(g),'baseline contour mesh should be valid');
for(let row=0;row<=5;row++)for(let col=0;col<=5;col++){const p=gridPoint(g,col/5,row/5,false),v=g.nodes[row*6+col];assert.ok(Math.hypot(p.x-v.x,p.y-v.y)<.00001,'rest mesh must align with handles');}
const control=fs.readFileSync('src/tools/transform/TransformTool.ts','utf8');assert.match(control,/const count=mode==='uniform'\?3:mode==='triangle'\?8:5/);
const ui=fs.readFileSync('src/tools/transform/TransformOptionsBar.tsx','utf8');for (const label of ['Layer Warp Mesh','Dense Warp Grid','Contour / Shape Mesh']) assert.ok(ui.includes(label));
console.log('PASS: three mode presets, contour node order, rest mapping, fold safety, UI wiring');
