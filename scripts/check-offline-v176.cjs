'use strict';
// v0.5.176: the offline folder is the optimised production build. Checks it opens
// with no npm install/build, is the current version, contains every tool panel,
// and that the launcher sends compressed, cacheable files.
const {strict:assert}=require('node:assert');
const {spawn}=require('node:child_process');
const {createServer}=require('node:net');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),offline=path.join(root,'offline');
function availablePort(){return new Promise(resolve=>{const socket=createServer();socket.listen(0,'127.0.0.1',()=>{const port=socket.address().port;socket.close(()=>resolve(port));});});}
async function main(){
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
 assert.equal(pkg.version,'0.5.176');
 const html=fs.readFileSync(path.join(offline,'index.html'),'utf8');
 assert.ok(html.includes('id="startup-status"')&&html.includes('v0.5.176'),'Startup splash must name v0.5.176');
 const assets=fs.readdirSync(path.join(offline,'assets')),app=assets.filter(f=>/^index-.*\.js$/.test(f));
 assert.equal(app.length,1,'One application bundle');
 const code=fs.readFileSync(path.join(offline,'assets',app[0]),'utf8');
 for(const marker of ['0.5.176','brush-mode-tabs','Switch to Mix mode','scene-camera-overlay'])assert.ok(code.includes(marker),'Bundle missing '+marker);
 for(const w of ['autosave.worker','liveBlend.worker','pencilFinal.worker','fill.worker','inkDisplay.worker','rasterScene.worker'])assert.ok(assets.some(f=>f.startsWith(w+'-')),'Missing '+w);
 assert.ok(assets.some(f=>/^index-.*\.css$/.test(f)),'Missing stylesheet');
 assert.ok(!html.includes('/src/main.js'),'The app must load the optimised bundle, not the per-module copy');
 const port=await availablePort(),child=spawn(process.execPath,[path.join(root,'scripts/launch-offline.mjs'),'--no-open'],{cwd:root,env:{...process.env,SOLO_STUDIO_PORT:String(port)},stdio:['ignore','pipe','pipe']});
 const messages=[];child.stdout.on('data',c=>messages.push(c.toString()));child.stderr.on('data',c=>messages.push(c.toString()));
 try{
  let ready=false;
  for(let i=0;i<80;i++){if(child.exitCode!==null)throw Error('Server exited early: '+messages.join(''));if(messages.join('').includes('READY')){ready=true;break;}await new Promise(r=>setTimeout(r,50));}
  assert.ok(ready,'Offline server did not start');
  assert.ok(messages.join('').includes('v0.5.176'));
  const base=`http://127.0.0.1:${port}`;
  const index=await fetch(base+'/');assert.equal(index.status,200);assert.match(index.headers.get('cache-control'),/no-cache/);
  let count=1;
  for(const f of assets){const r=await fetch(`${base}/assets/${f}`);assert.equal(r.status,200,f);assert.ok((await r.arrayBuffer()).byteLength>0);assert.match(r.headers.get('cache-control'),/immutable/,f);count++;}
  const js=await fetch(`${base}/assets/${app[0]}`);assert.equal(js.headers.get('content-encoding'),'gzip');assert.match(js.headers.get('content-type'),/javascript/);
  const again=await fetch(`${base}/assets/${app[0]}`,{headers:{'if-none-match':js.headers.get('etag')}});assert.equal(again.status,304);
  const bad=await fetch(base+'/missing.js');assert.equal(bad.status,404);
  const escape=await fetch(base+'/..%2fpackage.json');assert.ok(escape.status===403||escape.status===404);
  console.log('OFFLINE START v176 PASS: '+count+' files served, gzip + browser cache, no npm install/build.');
 }finally{child.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
