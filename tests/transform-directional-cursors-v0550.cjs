const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'sas-cursors-'));
try {
 execFileSync('tsc',['--target','es2022','--module','commonjs','--skipLibCheck','--outDir',out,'src/tools/transform/DirectionalCursors.ts'],{cwd:root,stdio:'pipe'});
 const cursors=require(path.join(out,'DirectionalCursors.js'));
 const samples=[[1,0,'right'],[1,1,'down-right'],[0,1,'down'],[-1,1,'down-left'],[-1,0,'left'],[-1,-1,'up-left'],[0,-1,'up'],[1,-1,'up-right']];
 for(const [x,y,dir] of samples){assert.equal(cursors.compassFromDelta(x,y),dir);const c=cursors.scaleDirectionCursor(dir);assert.match(c,/data:image\/svg\+xml/);assert.ok(c.length<1000);}
 for(let i=0;i<4;i++){assert.ok(cursors.handleCompass('corner',i));assert.ok(cursors.handleCompass('edge',i));}
 assert.match(decodeURIComponent(cursors.smallTargetCursor),/circle/);
 const tool=fs.readFileSync(path.join(root,'src/tools/transform/TransformTool.ts'),'utf8');
 const icons=fs.readFileSync(path.join(root,'src/ui/StudioToolIcons.tsx'),'utf8');
 assert.match(tool,/this\.setCursor\(scaleDirectionCursor\(compassFromDelta\(dx,dy\)\)\)/);
 assert.match(tool,/this\.setCursor\(smallTargetCursor\)/);
 assert.match(tool,/Math\.hypot\(dx,dy\)>=2/);
 assert.match(icons,/Approved #03 TARGET/);
 assert.match(tool,/!\['move','scale','rotate'(?:,'perspective','skew','distort')?\]\.includes\(s\.mode\)/);
 console.log('PASS: v0.5.50 eight Scale directions, small Move Target cursor, drag integration, no duplicate arrows');
} finally {fs.rmSync(out,{recursive:true,force:true});}
