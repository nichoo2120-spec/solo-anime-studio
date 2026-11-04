const fs=require('fs'),path=require('path'),ts=require('typescript');
function load(f){const source=fs.readFileSync(f,'utf8');const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const mod={exports:{}};new Function('require','module','exports',compiled)((id)=>load(path.resolve(path.dirname(f),id+'.ts')),mod,mod.exports);return mod.exports;}
const {contourGrid,gridPoint,meshHasFold,cloneGrid}=load(path.resolve('src/tools/transform/math/meshWarp.ts'));
const W=128,H=160,bytes=new Uint8ClampedArray(W*H*4);
// Head, torso, arms and leg-like regions of a humanoid silhouette.
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const head=y<40&&Math.pow((x-64)/21,2)+Math.pow((y-20)/19,2)<1;const torso=y>=40&&y<102&&x>=48&&x<=80;const arms=y>=45&&y<97&&x>=(48-(y-45)*.7)&&x<=(80+(y-45)*.7);const legs=y>=102&&((x>=47&&x<=61)||(x>=69&&x<=82));if(head||torso||arms||legs)bytes[(y*W+x)*4+3]=255;}
const quad=[{x:100,y:200},{x:228,y:200},{x:228,y:360},{x:100,y:360}];
const grid=contourGrid(quad,bytes,W,H,5,4);
if(!grid.sourceNodes||grid.sourceNodes.length!==grid.nodes.length)throw Error('missing preserved source lattice');
if(meshHasFold(grid))throw Error('undeformed contour mesh already folded');
for(let i=0;i<grid.nodes.length;i++)if(Math.hypot(grid.nodes[i].x-grid.sourceNodes[i].x,grid.nodes[i].y-grid.sourceNodes[i].y)>1e-8)throw Error('initial artwork will move before drag');
for(let i=0;i<=30;i++)for(let j=0;j<=30;j++){const u=i/30,v=j/30;const source=gridPoint({...grid,nodes:grid.sourceNodes,pins:undefined},u,v,false),dest=gridPoint(grid,u,v,false);if(Math.hypot(source.x-dest.x,source.y-dest.y)>1e-6)throw Error('unmoved artwork mapping changed');}
const center=grid.nodes[2].x,left=grid.nodes[0].x,right=grid.nodes[4].x;if(left<100||right>228||right-left>=W-5)throw Error('head row not contour-aware');
const cloned=cloneGrid(grid);if(!cloned.sourceNodes||cloned.sourceNodes.length!==grid.sourceNodes.length)throw Error('contour state lost on drag/undo');
console.log('PASS: contour envelope follows varying character silhouette');console.log('PASS: source/destination mapping is identity at rest');console.log('PASS: initial mesh has no folds');console.log('PASS: contour source lattice retained through clone/undo');
