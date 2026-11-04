const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sas-skew-distort-'));
try{
 cp.execFileSync('tsc',['--outDir',tmp,'--target','ES2022','--module','commonjs','--lib','ES2022,DOM','--skipLibCheck','src/tools/transform/SkewDistortDirection.ts','src/tools/transform/modes/Skew.ts','src/tools/transform/modes/Distort.ts'],{cwd:root,stdio:'pipe'});
 const mod=f=>require(path.join(tmp,f+'.js'));
 const {skew}=mod('modes/Skew'),{distort}=mod('modes/Distort'),{deformDirection}=mod('SkewDistortDirection'),{rectQuad}=mod('math/matrix'),{makeGrid}=mod('math/meshWarp');
 const q=rectQuad({x:0,y:0,w:100,h:80});
 const s=()=>({quad:q.map(p=>({...p})),pivot:{x:50,y:40},grid:makeGrid(q,4),mode:'skew',skewAxis:'free',skewSnap:0,skew:0});
 const d=(type,index,point)=>({point,quad:q,pivot:{x:50,y:40},grid:makeGrid(q,4),angle:0,skew:0,index,handle:{type,index}});
 const keys={shift:false,alt:false,ctrl:false};
 let a=s();skew(a,d('edge',0,{x:50,y:0}),{x:70,y:0},keys);assert.equal(a.quad[0].x,20);assert.equal(a.quad[1].x,120);assert.deepEqual(a.quad[2],q[2]);
 a=s();skew(a,d('edge',1,{x:100,y:40}),{x:100,y:60},keys);assert.equal(a.quad[1].y,20);assert.equal(a.quad[2].y,100);assert.deepEqual(a.quad[0],q[0]);
 a=s();skew(a,d('corner',0,{x:0,y:0}),{x:10,y:8},keys);assert.equal(a.quad.length,4);assert.notDeepEqual(a.quad,q);
 a=s();a.skewAxis='horizontal';skew(a,d('edge',1,{x:100,y:40}),{x:100,y:60},keys);assert.deepEqual(a.quad,q,'horizontal mode ignores vertical skew grip');
 a=s();a.skewSnap=15;skew(a,d('edge',0,{x:50,y:0}),{x:64,y:0},keys);assert(Math.abs(a.skew-15)<.001);
 a=s();skew(a,d('inside',0,{x:50,y:40}),{x:70,y:30},keys);assert.equal(a.quad[0].x,20);assert.equal(a.quad[0].y,-10);
 a=s();skew(a,d('pivot',0,{x:50,y:40}),{x:60,y:60},keys);assert.deepEqual(a.pivot,{x:60,y:60});assert.deepEqual(a.quad,q);
 a=s();distort(a,d('corner',1,{x:100,y:0}),{x:112,y:19},keys);assert.deepEqual(a.quad[1],{x:112,y:19});assert.deepEqual(a.quad[0],q[0]);
 a=s();distort(a,d('edge',0,{x:50,y:0}),{x:45,y:11},keys);assert.deepEqual(a.quad[0],{x:-5,y:11});assert.deepEqual(a.quad[1],{x:95,y:11});assert.deepEqual(a.quad[2],q[2]);
 a=s();distort(a,d('inside',0,{x:50,y:40}),{x:56,y:47},keys);assert.deepEqual(a.quad[0],{x:6,y:7});assert.deepEqual(a.pivot,{x:56,y:47});
 a=s();distort(a,d('pivot',0,{x:50,y:40}),{x:47,y:41},keys);assert.deepEqual(a.pivot,{x:47,y:41});assert.deepEqual(a.quad,q);
 let arrow=deformDirection([{x:0,y:0},{x:100,y:20},{x:100,y:100},{x:0,y:80}],{type:'edge',index:0},{x:10,y:0},'skew');assert(arrow.x>.9&&arrow.y>0,'skew arrow follows the slanted edge');
 arrow=deformDirection(q,{type:'corner',index:1},{x:-10,y:-10},'distort');assert(arrow.x<0&&arrow.y<0,'distort arrows follow free corner movement');
 const tool=fs.readFileSync(path.join(root,'src/tools/transform/TransformTool.ts'),'utf8');const bar=fs.readFileSync(path.join(root,'src/tools/transform/TransformOptionsBar.tsx'),'utf8');
 for(const t of ["['free','scale','skew','perspective','distort']","paintDeformArrow","deformDirection", "'skewAxis'","'skewSnap'","modeFns.pivot(s,g,pt,keys)"])assert(tool.includes(t),`missing integration ${t}`);
 assert(bar.includes('StudioSkewIcon')&&bar.includes('StudioDistortIcon')&&bar.includes('Skew mode'));
 console.log('PASS: horizontal/vertical/free skew, angle snap, inside moves, movable pivot; independent corners, edge deform, follow-direction arrows, and UI integration');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
