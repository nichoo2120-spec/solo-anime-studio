/* Run with: node tests/transform_commit_scale_regression.cjs
 * Runtime checks of production TransformTool and Scale mode without external npm packages.
 */
const fs=require('fs'), path=require('path'), assert=require('node:assert/strict');
const Module=require('module');
const ts=require('typescript');
const root=path.resolve(__dirname,'../src');
let draws=0, backDraws=0, overlayDraws=0;
const callbacks=[];
let canvasCount=0;
class FakeContext {
 constructor(canvas){this.canvas=canvas; this.calls=[];}
 drawImage(...v){this.calls.push('drawImage');draws++;if(this.canvas.role==='background')backDraws++;if(this.canvas.role==='overlay')overlayDraws++;}
 getImageData(x,y,w,h){return {data:new Uint8ClampedArray(w*h*4),width:w,height:h};}
 getTransform(){return {a:1,b:0,c:0,d:1,e:0,f:0};}
 setLineDash(){}
 measureText(){return {width:40};}
}
for(const fn of ['setTransform','clearRect','fillRect','save','restore','translate','rotate','scale','beginPath','rect','clip','strokeRect','stroke','fill','moveTo','lineTo','closePath','transform','arc','fillText'])FakeContext.prototype[fn]=function(){};
class FakeCanvas{
 constructor(w=200,h=100,role='cache'){this.width=w;this.height=h;this.role=role;this.style={};this.ctx=new FakeContext(this);}
 getContext(){return this.ctx;}
 getBoundingClientRect(){return {left:0,top:0,width:200,height:100};}
 toDataURL(){return 'data:image/png;base64,dGVzdC0'+(++canvasCount);}
}
global.window={devicePixelRatio:1};global.document={createElement:()=>new FakeCanvas()};
global.requestAnimationFrame=(callback)=>{callbacks.push(callback);return callbacks.length};
global.cancelAnimationFrame=()=>{};
const mocked={
 'core/model':{uid:()=>String(++canvasCount)},
 'engine/renderer':{makeCanvas:(w,h)=>new FakeCanvas(w,h),context:c=>c.getContext('2d'),blendOperation:()=> 'source-over',LayerRenderer:class{get(){return new FakeCanvas()}clear(){}async prepare(){} }},
 'engine/strokeSelection':{boundsOf:()=>null,selectable:()=>[],projectiveStroke:o=>o,polyline:()=>[]},
 'engine/vector':{projectiveVector:o=>o},
 'animation/timeline':{isLayerHeld:()=>false},
 'tools/transform/math/homography':{projectiveMapping:()=>[1,0,0,0,1,0,0,0,1],warpPoint:(p)=>p,quadValid:()=>true},
 'tools/transform/DirectionalCursors':{smallTargetCursor:'move',scaleDirectionCursor:()=> 'scale',compassFromDelta:()=> 'N',handleCompass:()=> 'N',rotationCursors:{clockwise:'clockwise',counterClockwise:'counter'}},
};
const loaded=new Map();
function load(file){file=path.resolve(file).replace(/\.ts$/,'');
 let key=path.relative(root,file).replace(/\\/g,'/');if(mocked[key])return mocked[key];
 if(loaded.has(file))return loaded.get(file).exports;
 let f=file+'.ts'; if(!fs.existsSync(f))f=path.join(file,'index.ts');
 const code=fs.readFileSync(f,'utf8');
 const transpiled=ts.transpileModule(code,{fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const m=new Module(f,module);m.filename=f;m.paths=module.paths;loaded.set(file,m);
 m.require=(id)=>id.startsWith('.')?load(path.resolve(path.dirname(f),id)):require(id);
 m._compile(transpiled,f);return m.exports;
}
const {TransformTool}=load(path.join(root,'tools/transform/TransformTool'));
const {scale}=load(path.join(root,'tools/transform/modes/Scale'));
const {makeGrid}=load(path.join(root,'tools/transform/math/meshWarp'));
const {rectQuad}=load(path.join(root,'tools/transform/math/matrix'));
let registered=new Set(['data:old']), shouldDecodeFail=false;
const documentModel={width:200,height:100,activeLayerId:'ink',settings:{guides:false},layers:[{id:'ink',kind:'raster',locked:false,visible:true,reference:false,opacity:1,blend:'normal',operations:[{id:'fill1',kind:'fill',png:'data:old'}]}]};
let snapshot=documentModel, history=[];
const engine={recorder:{event(){}},selection:[],strokeIds:[],view:{x:0,y:0,zoom:1,rotation:0},
 store:{getSnapshot:()=>snapshot,commit:(next)=>{for(const l of next.layers){for(const op of l.operations){if(op.kind==='image')assert(registered.has(op.png),'BUG: image committed before being decoded');}}history.push(snapshot);snapshot=next;}},
 renderer:{get:()=>new FakeCanvas(),async prepare(p){if(shouldDecodeFail)throw Error('decode failed');for(const l of p.layers){for(const op of l.operations){if(op.kind==='image')registered.add(op.png);}}}},
 clearSelection(){}
};
const makeTool=()=>new TransformTool(engine,new FakeCanvas(200,100,'overlay'),new FakeCanvas(200,100,'background'),{x:0,y:0,zoom:1,rotation:0},{frameIds:[],layerIds:[]});
async function test(){
 const t=makeTool();assert.equal(backDraws,1,'background should initially draw once');
 // The Perspective controller must route different handles correctly (old bug:
 // the centre and sides fell through to the corner handler).
 t.setMode('perspective');
 assert.equal(t.hit({x:0,y:0}).type,'corner');
 assert.equal(t.hit({x:100,y:0}).type,'edge');
 assert.equal(t.hit({x:100,y:50}).type,'inside');
 assert.equal(t.hit({x:220,y:110}),null,'dragging outside perspective quad must not move artwork');
 t.setMode('free');
 t.nudge(10,0);let cb=callbacks.splice(0);cb.forEach(fn=>fn());assert.equal(backDraws,1,'background must not be repainted on every pointer move');
 t.setView({x:4,y:0,zoom:1.1,rotation:0});cb=callbacks.splice(0);cb.forEach(fn=>fn());assert.equal(backDraws,2,'view changes must repaint the stationary background');
 const result=await t.commit();assert.equal(result.changed,1);assert.equal(history.length,1);
 assert.equal(snapshot.layers[0].operations.at(-1).kind,'image');
 assert(registered.has(snapshot.layers[0].operations.at(-1).png));
 snapshot=history.pop();shouldDecodeFail=true;
 const fail=makeTool();fail.nudge(10,0);const state=snapshot;const rejected=await fail.commit();
 assert.match(rejected.error,/could not prepare/i);assert.equal(snapshot,state,'failed decode must never damage history');shouldDecodeFail=false;fail.destroy();
 const q=rectQuad({x:0,y:0,w:100,h:50});
 const makeSession=()=>({quad:q.map(p=>({...p})),initial:q,pivot:{x:50,y:25},grid:makeGrid(q,4),initialGrid:makeGrid(q,4),mode:'scale',angle:0,skew:0,lock:false});
 const anchorGesture={quad:q,grid:makeGrid(q,4),pivot:{x:50,y:25},angle:0,skew:0,handle:{type:'corner',index:0},point:{x:0,y:0},index:0};
 for(const pointer of [{x:-10,y:0},{x:-9,y:-3},{x:-8,y:-4},{x:-7,y:-5}]){
  const s=makeSession();scale(s,anchorGesture,pointer,{shift:true,alt:false,ctrl:false});
  const xScale=(s.quad[1].x-s.quad[0].x)/100,yScale=(s.quad[3].y-s.quad[0].y)/50;
  assert(Math.abs(xScale-yScale)<1e-6,'Shift must constrain X and Y equally');
 }
 const stable=makeSession();scale(stable,anchorGesture,{x:-8,y:-4},{shift:true,alt:false,ctrl:false});
 assert(Math.abs(stable.quad[2].x-100)<1e-7,'opposite corner stays anchored without Alt');
 const center=makeSession();scale(center,anchorGesture,{x:-10,y:-10},{shift:true,alt:true,ctrl:false});
 assert(Math.abs((center.quad[0].x+center.quad[2].x)/2-50)<1e-7,'Alt must scale around center');
 console.log('PASS: PNG decoded before commit; failed decode leaves original unchanged; background cached across drags; Shift proportional scaling stable; Alt centers scaling');
}
test().catch(e=>{console.error(e);process.exitCode=1;});
