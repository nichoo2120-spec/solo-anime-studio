const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8').replaceAll('import.meta.url',"'file:///test'").replaceAll('import.meta.env.DEV','false'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {newProject,uid,validateProject}=require('../src/core/model.ts');
const {DocumentStore}=require('../src/core/history.ts');
const {audioPeaks,validateSceneAudio,MAX_AUDIO_BYTES,AUDIO_PEAK_COUNT,secondsAtExposure,exposureAtSeconds}=require('../src/animation/audio.ts');
const {StudioEngine}=require('../src/engine/StudioEngine.ts');
const {addDrawingFrame,selectDrawingFrame,frameList,setDrawingFrameHold,frameExposureStart,syncActiveFrame}=require('../src/animation/timeline.ts');
const {PlaybackOverlay}=require('../src/engine/PlaybackOverlay.ts');
const {timelineDeleteKey}=require('../src/core/keyboardActions.ts');
const {normalizeShortcuts,initialShortcuts}=require('../src/core/shortcuts.ts');
const {documentDirty}=require('../src/core/viewPreferences.ts');
const stroke=(x)=>({id:uid(),kind:'stroke',tool:'brush',color:'#123456',size:4,opacity:1,pressure:false,response:1,points:[{x,y:2,p:1},{x:x+12,y:12,p:1}]});
// Fixed sampling budget, always bounded regardless of audio duration.
let reads=0;const samples=new Float32Array(600000).map((_,i)=>Math.sin(i/25));const buffer={length:samples.length,numberOfChannels:1,getChannelData:()=>{reads++;return samples;}};
const peaks=audioPeaks(buffer);assert.equal(peaks.length,AUDIO_PEAK_COUNT);assert(peaks.every(x=>x>=0&&x<=1));assert.equal(reads,1);
const data='data:audio/mpeg;base64,AAAA';const asset={version:1,name:'line.mp3',mime:'audio/mpeg',data,duration:8,peaks};assert(validateSceneAudio(asset));
assert(!validateSceneAudio({...asset,duration:Infinity}));assert(!validateSceneAudio({...asset,data:'file:///secrets'}));assert(!validateSceneAudio({...asset,peaks:[0,1]}));assert(!validateSceneAudio({...asset,mime:'text/html'}));
let project=newProject('Audio scene',640,360);const original=project;project={...project,audio:asset};assert(documentDirty(project,original));validateProject(JSON.parse(JSON.stringify(project)));
const s=new DocumentStore(original);s.commit(project,'Import audio');assert.equal(s.getSnapshot().audio.name,'line.mp3');s.undo();assert.equal(s.getSnapshot().audio,undefined);s.redo();assert.equal(s.getSnapshot().audio.name,'line.mp3');
// Exposure time 1-based and honors hold on 2s.
assert.equal(secondsAtExposure(1,24),0);assert.equal(secondsAtExposure(25,24),1);assert.equal(exposureAtSeconds(1,24,100),25);assert.equal(exposureAtSeconds(999,24,10),10);
project=setDrawingFrameHold(project,2);project=addDrawingFrame(project);let frames=frameList(project);assert.equal(frameExposureStart(project,1),3);assert.equal(secondsAtExposure(frameExposureStart(project,1),24),2/24);
// Delete selected brush strokes is distinct from frame deletion, and undoable.
let selection=newProject('Selection',640,360);const layerId=selection.activeLayerId;const a=stroke(3),b=stroke(24);
selection={...selection,layers:selection.layers.map(l=>l.id===layerId?{...l,operations:[a,b]}:l)};
const store=new DocumentStore(selection),engine=Object.create(StudioEngine.prototype);
engine.store=store;engine.strokeIds=[a.id];engine.strokeScope='current';engine.selection=[{x:0,y:0,p:1},{x:50,y:0,p:1},{x:50,y:50,p:1},{x:0,y:50,p:1}];engine.clearSelection=()=>{engine.selection=[];engine.strokeIds=[]};engine.notify=()=>{};
engine.deleteSelectedArtwork();assert.deepEqual(store.getSnapshot().layers.find(l=>l.id===layerId).operations.map(o=>o.id),[b.id]);
store.undo();assert.equal(store.getSnapshot().layers.find(l=>l.id===layerId).operations.length,2);
// Traditional L/M lasso safely creates a raster clear polygon and Undo restores artwork.
engine.strokeIds=[];engine.selection=[{x:10,y:10,p:1},{x:75,y:10,p:1},{x:75,y:75,p:1},{x:10,y:75,p:1}];engine.deleteSelectedArtwork();
const operations=store.getSnapshot().layers.find(l=>l.id===layerId).operations;
assert.equal(operations.at(-1).kind,'clear');assert.equal(operations.at(-1).polygon.length,4);
validateProject(JSON.parse(JSON.stringify(store.getSnapshot())));store.undo();assert.deepEqual(store.getSnapshot().layers.find(l=>l.id===layerId).operations.map(o=>o.id),[a.id,b.id]);
// Locked layer: refuse to delete; vector layer: guide artist to Stroke Select.
const before=store.getSnapshot();store.commit({...before,layers:before.layers.map(l=>l.id===layerId?{...l,locked:true}:l)});
let calls=[];engine.notify=msg=>calls.push(msg);engine.selection=[{x:1,y:1,p:1},{x:2,y:1,p:1},{x:2,y:2,p:1}];engine.deleteSelectedArtwork();assert.equal(store.getSnapshot().layers.find(l=>l.id===layerId).operations.length,2);assert(calls.some(m=>m.includes('unlocked')));
for(const key of ['Delete','Backspace'])assert(timelineDeleteKey({key,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false},true));
assert.equal(normalizeShortcuts({audioTrack:'shift+a'}).audioTrack,'shift+a');assert.equal(initialShortcuts['stroke-select'],'s');
// Audio sync methods read only HTMLAudioElement state; cannot write to project or pen path.
const overlay=Object.create(PlaybackOverlay.prototype);const fakeAudio={paused:true,currentTime:0,plays:0,play(){this.plays++;this.paused=false;return Promise.resolve();},pause(){this.paused=true;}};
overlay.project=project;overlay.audio=fakeAudio;overlay.state='playing';overlay.fps=24;overlay.lastAudioCheck=0;overlay.onError=()=>{};
overlay.playAudioFrom(3);assert.equal(fakeAudio.currentTime,2/24);assert.equal(fakeAudio.plays,1);
overlay.syncAudio(25,1000);assert.equal(fakeAudio.currentTime,1);assert.equal(fakeAudio.plays,1);
overlay.pauseAudio();assert.equal(fakeAudio.paused,true);
const app=fs.readFileSync('src/ui/App.tsx','utf8');assert(app.indexOf('timelineDeleteKey(e,frameFocused)')<app.indexOf('engine.current?.deleteSelectedArtwork()'));
assert(app.includes('Delete Selected <kbd>⌫</kbd>'));assert(app.includes('audioTrack'));assert(app.includes('<AudioTrack '));
const css=fs.readFileSync('src/styles.css','utf8');assert(css.includes('.audio-waveform'));
console.log('PASS audio+delete: waveform peaks, project validation/save/undo/redo, hold time mapping, safe stroke/lasso deletion, locked layer guard, focused-frame delete priority, audio playback synchronizer, shortcut + UI.');
