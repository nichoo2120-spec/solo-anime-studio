import {describe,it,expect} from 'vitest';
import {createCleanFreehandVector,vectorCubics,vectorSvg,transformVector} from '../src/engine/vector';
import {cleanInkCommands} from '../src/engine/cleanInkContour';
import {fitCleanInkNodes} from '../src/engine/cleanInkFitting';
import {cubicAt} from '../src/engine/strokeGeometry';
import {VectorController} from '../src/engine/VectorController';
import {DocumentStore} from '../src/core/history';
import {newProject,validateProject,activeLayer} from '../src/core/model';
import {stockPresets} from '../src/core/brushes';

const circle=(count=161)=>Array.from({length:count},(_,i)=>{const t=i/(count-1)*Math.PI*2;return {x:250+100*Math.cos(t),y:200+100*Math.sin(t),p:.6};});
const sample=(nodes:ReturnType<typeof fitCleanInkNodes>)=>vectorCubics({id:'sample',kind:'vector',nodes,width:5,opacity:1,color:'#000000',pressure:false,smoothness:100}).flatMap(c=>Array.from({length:61},(_,i)=>cubicAt(c,i/60)));
const make=(points=circle(),pressure=true)=>createCleanFreehandVector('ink',points,8,'#222222',pressure,65);
function controller(zoom=1){const store=new DocumentStore(newProject()),v=new VectorController(store,()=>stockPresets[4].settings,()=>{},()=>{});v.stabilization=0;return {store,v,draw(points:ReturnType<typeof circle>){v.down(points[0],zoom,true);v.moveSamples(points.slice(1));v.up(points.at(-1)!);return activeLayer(store.getSnapshot()).operations.at(-1)!;}};}

describe('Clean Vector Ink v0.5.112',()=>{
 it.each([9,17,161,1201])('keeps a %i-sample circle round, with a continuous seam tangent',count=>{
  const line=make(circle(count)),flat=sample(line.nodes);
  expect(Math.max(...flat.map(p=>Math.abs(Math.hypot(p.x-250,p.y-200)-100)))).toBeLessThan(count<12?8:2.5);
  const a=line.nodes[0],b=line.nodes.at(-1)!,u={x:a.out.x-a.x,y:a.out.y-a.y},v={x:b.x-b.in.x,y:b.y-b.in.y};
  expect((u.x*v.x+u.y*v.y)/(Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y))).toBeGreaterThan(.99999);
 });
 it('keeps a V corner and the exact endpoints, even at full smoothing',()=>{
  const input=[{x:10,y:10,p:.2},{x:150,y:220,p:.9},{x:290,y:10,p:.2}],nodes=fitCleanInkNodes(input,100);
  expect(nodes[0]).toMatchObject(input[0]);expect(nodes.at(-1)).toMatchObject(input[2]);expect(nodes).toContainEqual(expect.objectContaining(input[1]));
 });
 it('preserves sparse S-curve extrema instead of collapsing the gesture',()=>{
  const path=[{x:50,y:20,p:.5},{x:130,y:70,p:.5},{x:50,y:120,p:.5},{x:-30,y:170,p:.5},{x:50,y:220,p:.5}];
  const flat=sample(fitCleanInkNodes(path,65));expect(Math.max(...flat.map(p=>p.x))).toBeGreaterThan(125);expect(Math.min(...flat.map(p=>p.x))).toBeLessThan(-25);
 });
 it('fits geometry independently of the pen pressure history',()=>{
  const points=circle();expect(make(points).nodes.map(({p,...n})=>n)).toEqual(make(points.map((p,i)=>({...p,p:Math.sin(i)**2}))).nodes.map(({p,...n})=>n));
 });
 it.each([0,65])('removes small hand tremor at smoothness %i without moving the endpoints',smoothness=>{
  const points=Array.from({length:241},(_,i)=>{const t=i/240;return {x:35+t*570,y:100+42*Math.sin(t*Math.PI*4)+.8*Math.sin(t*183),p:.6};}),nodes=fitCleanInkNodes(points,smoothness);
  expect(nodes.length).toBeLessThan(smoothness?18:60);expect(nodes[0]).toMatchObject(points[0]);expect(nodes.at(-1)).toMatchObject(points.at(-1)!);
  const interior=sample(nodes).filter(p=>p.x>60&&p.x<580),error=interior.reduce((s,p)=>s+Math.abs(p.y-(100+42*Math.sin((p.x-35)/570*Math.PI*4))),0)/interior.length;
  expect(error).toBeLessThan(.65);
 });
 it('exports smooth filled cubic contours and keeps low/high/low pressure on a straight path',()=>{
  const points=Array.from({length:121},(_,i)=>({x:20+i*4,y:120,p:.08+.92*Math.sin(i/120*Math.PI)**2})),line=make(points),svg=vectorSvg(line,550,250),commands=cleanInkCommands(line);
  expect(line.nodes.length).toBeLessThanOrEqual(3);expect(svg).toContain('fill="#222222"');expect(svg).not.toMatch(/L\d/);expect(commands.filter(c=>c.op==='C').length).toBeGreaterThan(10);
  const ys=(x:number)=>commands.filter(c=>c.op!=='Z'&&Math.abs(c.p.x-x)<5).map(c=>c.op!=='Z'?c.p.y:0);
  const spread=(x:number)=>Math.max(...ys(x))-Math.min(...ys(x));expect(spread(260)).toBeGreaterThan(spread(40)*2);
 });
 it('produces repeatable geometry at every canvas zoom and for batched/unbatched input',()=>{
  const points=circle(80),a=controller(.25).draw(points),b=controller(8).draw(points);
  expect(a.kind).toBe('vector');expect(b.kind).toBe('vector');if(a.kind!=='vector'||b.kind!=='vector')throw Error('Missing vector');
  expect(a.nodes).toEqual(b.nodes);expect(a.widthProfile).toEqual(b.widthProfile);
  const {v,store}=controller();v.down(points[0],1,true);for(const p of points.slice(1))v.move(p,false);v.up(points.at(-1)!);
  const c=activeLayer(store.getSnapshot()).operations.at(-1)!;expect(c.kind==='vector'&&c.nodes).toEqual(a.nodes);
 });
 it('commits a small pen tap and supports undo/redo plus validated save/reopen',()=>{
  const {v,store}=controller();v.down({x:20,y:40,p:.45},1,true);v.up({x:20,y:40,p:0});
  const doc=store.getSnapshot();expect(activeLayer(doc).operations).toHaveLength(1);expect(validateProject(JSON.parse(JSON.stringify(doc))).layers.some(l=>l.operations.some(o=>o.kind==='vector'&&o.profileVersion===6))).toBe(true);
  store.undo();expect(activeLayer(store.getSnapshot()).operations).toHaveLength(0);store.redo();expect(activeLayer(store.getSnapshot()).operations).toHaveLength(1);
 });
 it('keeps the end of a gesture containing more than 12000 pen samples',()=>{
  const points=Array.from({length:12040},(_,i)=>({x:20+i*.2,y:180+40*Math.sin(i/3000),p:.6})),line=controller().draw(points);
  expect(line.kind==='vector'&&line.nodes.at(-1)!.x).toBe(points.at(-1)!.x);
  expect(line.kind==='vector'&&line.nodes.at(-1)!.y).toBe(points.at(-1)!.y);
 });
 it('keeps contour coordinates finite for reversals, loops, taps, large widths and mirror transforms',()=>{
  for(const points of [circle(17),[{x:20,y:20,p:.05},{x:180,y:20,p:1},{x:20,y:20,p:.1}],[{x:40,y:40,p:.4}]]){
   const line=make(points);for(const v of [line,{...line,width:150,taperStart:.3,taperEnd:.5},transformVector(line,[-1,0,0,1,500,0])]){
    const svg=vectorSvg(v,600,400);expect(svg).not.toMatch(/NaN|Infinity/);expect(cleanInkCommands(v).length).toBeGreaterThan(3);
   }
  }
 });
 it('keeps old renderer versions on their original SVG route',()=>{
  const line=make();for(const version of [1,2,3,4] as const){const svg=vectorSvg({...line,profileVersion:version},600,400);expect(svg).toContain('fill="#222222"');expect(svg).not.toBe(vectorSvg(line,600,400));}
 });
});
