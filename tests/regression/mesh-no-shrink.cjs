const fs=require('fs'),ts=require('typescript');
const file=require('path').resolve(__dirname,'../../src/tools/transform/modes/MeshWarp.ts');const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
if(js.diagnostics?.length) throw new Error(js.diagnostics.map(d=>d.messageText).join(';'));
const mod={exports:{}};new Function('module','exports',js.outputText)(mod,mod.exports);const warp=mod.exports.meshWarp;
function grid(){const cols=6,rows=4,nodes=[];for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++)nodes.push({x:x*100,y:y*100});return {rows,cols,nodes,mode:'custom'};}
function testDrag(grid,index,delta,opts={}){const s={grid,meshFalloff:opts.falloff??50,meshSmooth:opts.smooth??true,meshLockCorners:opts.lock??false};const point=grid.nodes[index];warp(s,{handle:{type:'node',index},grid,point}, {x:point.x+delta.x,y:point.y+delta.y});return s.grid;}
const eq=(a,b)=>a.every((p,i)=>p.x===b[i].x&&p.y===b[i].y);
let g=grid();for(let k=0;k<100;k++)g=testDrag(g,15,{x:0,y:0});if(!eq(g.nodes,grid().nodes))throw Error('Zero movement shrinks mesh');
g=grid();const original=grid();for(let k=0;k<50;k++){g=testDrag(g,15,{x:30,y:20});g=testDrag(g,15,{x:-30,y:-20});}if(!eq(g.nodes,original.nodes))throw Error('Roundtrip drags changed geometry');
g=grid();for(let k=0;k<100;k++)g=testDrag(g,14,{x:12,y:9},{falloff:50,lock:true});for(const i of [0,6,28,34])if(g.nodes[i].x!==original.nodes[i].x||g.nodes[i].y!==original.nodes[i].y)throw Error('Locked corner drifted');
g=testDrag(grid(),15,{x:10,y:20},{falloff:0});for(let i=0;i<g.nodes.length;i++)if(i!==15&&(g.nodes[i].x!==original.nodes[i].x||g.nodes[i].y!==original.nodes[i].y))throw Error('Zero falloff moved neighbors');
console.log('PASS: 100 zero-distance drags preserve grid');console.log('PASS: 50 forward/backward drag cycles preserve grid');console.log('PASS: corners remain fixed when locked');console.log('PASS: zero falloff moves selected point only');
