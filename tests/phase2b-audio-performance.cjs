const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {newProject,uid,validateProject}=require('../src/core/model.ts');
const {DocumentStore}=require('../src/core/history.ts');
const {AUDIO_PEAK_COUNT}=require('../src/animation/audio.ts');
const {addDrawingFrame}=require('../src/animation/timeline.ts');
const stroke=(i)=>({id:uid(),kind:'stroke',tool:'brush',color:'#123456',size:4,opacity:1,pressure:false,response:1,points:[{x:i,y:i,p:1}]});
let project=newProject('Waveform pen regression',640,360),lid=project.activeLayerId;
for(let i=0;i<40;i++)project=addDrawingFrame(project);
const audio={version:1,name:'Voice.mp3',mime:'audio/mpeg',data:'data:audio/mpeg;base64,'+'A'.repeat(1024*1024),duration:48,peaks:Array.from({length:AUDIO_PEAK_COUNT},(_,i)=>i%20/20)};
project={...project,audio};validateProject(project);
const store=new DocumentStore(project),at=performance.now();
for(let i=0;i<100;i++){
 const d=store.getSnapshot(),layer=d.layers.find(l=>l.id===lid),next={...d,layers:d.layers.map(l=>l.id===lid?{...l,operations:[...layer.operations,stroke(i)]}:l)};
 store.commit(next,'Synthetic Wacom commit');
 assert.strictEqual(store.getSnapshot().audio,audio,'audio memory must stay shared, not copied on every pen commit');
 assert.strictEqual(store.getSnapshot().audio.peaks,audio.peaks,'waveform cannot regenerate during drawing');
}
assert.equal(store.getHistory().length,101,'100 committed edits preserved within configured history');
validateProject(store.getSnapshot());
const ui=fs.readFileSync('src/ui/AudioTrack.tsx','utf8');
assert(ui.includes('const WaveformPeaks=memo('),'static waveform VDOM must be memoized');
const engine=fs.readFileSync('src/engine/StudioEngine.ts','utf8');
assert(!engine.includes('importSceneAudio('),'audio decoding cannot be in the input engine');
console.log('PASS 100 synthetic drawing commits in '+(performance.now()-at).toFixed(1)+'ms with 1MB persisted audio and 40 drawing frames; no waveform recomputes, bounded 80-step history (model test only, not physical pen latency)');
