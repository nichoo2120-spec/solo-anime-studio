/* Run: node tests/perspective-controls-v0553.cjs */
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sas-perspective-'));
try {
 cp.execFileSync('tsc',['--outDir',tmp,'--target','ES2022','--module','commonjs','--lib','ES2022,DOM','--skipLibCheck','src/tools/transform/modes/Perspective.ts','src/tools/transform/modes/FreeTransform.ts'],{cwd:root,stdio:'pipe'});
 const load=f=>require(path.join(tmp,'tools','transform','modes',f+'.js'));
 const {perspective}=load('Perspective'),{freeTransform}=load('FreeTransform');
 const {rectQuad}=require(path.join(tmp,'tools','transform','math','matrix.js'));
 const {makeGrid}=require(path.join(tmp,'tools','transform','math','meshWarp.js'));
 const keys={ctrl:false,alt:false,shift:false};
 const q=rectQuad({x:0,y:0,w:100,h:80});
 const start=(type,index,point)=>({point,quad:q,pivot:{x:50,y:40},grid:makeGrid(q,4),angle:0,skew:0,index,handle:{type,index}});
 const session=()=>({quad:q.map(p=>({...p})),initial:q,pivot:{x:50,y:40},grid:makeGrid(q,4),initialGrid:makeGrid(q,4),mode:'perspective',angle:0,skew:0,lock:false,perspectiveGrid:true,perspectiveSnap:0});
 let s=session();perspective(s,start('corner',1,{x:100,y:0}),{x:120,y:6},keys);
 assert.deepEqual(s.quad[1],{x:120,y:6});assert.deepEqual(s.quad[3],q[3],'dragging a perspective corner must not silently move opposite corner');
 s=session();perspective(s,start('inside',0,{x:50,y:40}),{x:65,y:35},keys);
 assert.deepEqual(s.quad[0],{x:15,y:-5});assert.deepEqual(s.pivot,{x:65,y:35},'centre drag translates pivot');
 s=session();perspective(s,start('edge',0,{x:50,y:0}),{x:70,y:0},keys);
 assert.deepEqual(s.quad[0],{x:20,y:0});assert.deepEqual(s.quad[1],{x:120,y:0});assert.deepEqual(s.quad[2],q[2],'top edge skew should move its endpoints only');
 s=session();perspective(s,start('corner',0,{x:0,y:0}),{x:5,y:5},{...keys,shift:true});
 assert.deepEqual(s.quad[2],{x:95,y:75},'Shift+corner mirrored keystone');
 s=session();s.perspectiveSnap=45;perspective(s,start('corner',1,{x:100,y:0}),{x:120,y:3},keys);
 assert(Math.abs(s.quad[1].y)<1e-8,'45° snap should constrain shallow drag horizontal');
 s=session();perspective(s,start('corner',0,{x:0,y:0}),{x:150,y:100},keys);
 assert.deepEqual(s.quad,q,'invalid inverted quad must be rejected');
 s=session();s.mode='free';freeTransform(s,start('corner',1,{x:100,y:0}),{x:120,y:8},{...keys,ctrl:true,shift:true});
 assert.deepEqual(s.quad[1],{x:120,y:8},'Free Transform ctrl+shift+corner enters Perspective');
 const src=fs.readFileSync(path.join(root,'src/tools/transform/TransformTool.ts'),'utf8');
 for(const snippet of ['paintPerspectiveGrid','insideQuad(pt,q)',"'perspectiveGrid'","'perspectiveSnap'","'perspective'"])assert(src.includes(snippet));
 const options=fs.readFileSync(path.join(root,'src/tools/transform/TransformOptionsBar.tsx'),'utf8');assert(options.includes('Angle snap')&&options.includes('Show grid'));
 console.log('PASS: corner, side skew, center move, symmetric keystone, angle snap, fold prevention, Free Transform and live grid wiring');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
