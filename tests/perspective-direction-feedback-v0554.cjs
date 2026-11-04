/* Run: node tests/perspective-direction-feedback-v0554.cjs */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('module');
const ts=require('typescript');
const root=path.resolve(__dirname,'../src/tools/transform');
function load(file){const full=path.join(root,file+'.ts');const m=new Module(full,module);m.filename=full;m.paths=module.paths;
 m._compile(ts.transpileModule(fs.readFileSync(full,'utf8'),{fileName:full,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,full);return m.exports;}
const {perspectiveArrowDirection:dir}=load('PerspectiveDirection');
const quad=[{x:0,y:10},{x:135,y:26},{x:145,y:145},{x:-16,y:100}];
const near=(a,b,tol=.002)=>Math.hypot(a.x-b.x,a.y-b.y)<tol;
const normalize=p=>{let n=Math.hypot(p.x,p.y);return {x:p.x/n,y:p.y/n}};
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const side=normalize({x:quad[2].x-quad[1].x,y:quad[2].y-quad[1].y});
// The upper-right corner is skewed: horizontal/vertical cursors are WRONG.
const corner={type:'corner',index:1},edge={type:'edge',index:1};
const a=dir(quad,corner,{x:-40,y:-2});
assert(a&&a.x<-.95&&a.y<0,'top-right -> left arrow follows the upward-slanted top edge');
const b=dir(quad,corner,{x:10,y:50});
assert(b&&b.x>0&&b.y>.9,'corner -> down arrow follows the slanted right-hand edge');
const c=dir(quad,corner,{x:18,y:-24});
assert(c&&c.y<0&&c.x>0,'corner -> outward/depth diagonal follows local perspective');
const s=dir(quad,edge,{x:3,y:34});
assert(near(s,side),'side arrow must follow diagonal edge, not screen vertical');
const reversed=dir(quad,edge,{x:-3,y:-34});
assert(near(reversed,{x:-side.x,y:-side.y}),'reversing pen direction reverses side arrow');
const mid=dir(quad,{type:'inside',index:0},{x:-20,y:24});
assert(mid&&Math.abs(mid.x)>0&&Math.abs(mid.y)>0,'centre direction follows the projected plane axes');
assert.equal(dir(quad,corner,{x:0,y:0}),null,'no arrow before movement');
assert.equal(dir(quad,{type:'node',index:0},{x:10,y:10}),null,'no change to unrelated modes');
const src=fs.readFileSync(path.join(root,'TransformTool.ts'),'utf8');
for(const phrase of ['perspectiveArrowDirection','paintPerspectiveArrow','this.perspectiveArrow=null','mode===\'perspective\''])assert(src.includes(phrase),'TransformTool missing '+phrase);
assert(src.includes('!this.perspectiveArrow&&this.activeGestureType()'), 'old giant flat-direction arrow must be suppressed during perspective feedback');
console.log('PASS: projected corner edge diagonal + side + centre feedback, reversing direction, stationary/no unrelated feedback, and overlay wiring');
