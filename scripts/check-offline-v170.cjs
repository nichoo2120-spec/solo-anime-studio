'use strict';
const {strict:assert}=require('node:assert');
const {spawn}=require('node:child_process');
const {createServer}=require('node:net');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),offline=path.join(root,'offline');
function availablePort(){return new Promise(resolve=>{const socket=createServer();socket.listen(0,'127.0.0.1',()=>{const port=socket.address().port;socket.close(()=>resolve(port));});});}
async function main(){
 const paths=['index.html','src/main.js','src/ui/App.js','src/core/brushes.js','src/ui/BrushStudio.js','src/ui/RadialToolbar.js','src/engine/liveBlend.worker.js','src/core/autosave.worker.js','vendor.js','react.js','jsx-runtime.js','styles.css'];
 for(const file of paths)assert.ok(fs.existsSync(path.join(offline,file)),'Missing '+file);
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
 assert.equal(pkg.version,'0.5.170');
 assert.ok(fs.readFileSync(path.join(offline,'src/core/buildInfo.js'),'utf8').includes('0.5.170'));
 assert.ok(fs.readFileSync(path.join(offline,'src/ui/BrushStudio.js'),'utf8').includes('brush-mode-tabs'));
 assert.ok(fs.readFileSync(path.join(offline,'src/ui/RadialToolbar.js'),'utf8').includes('Switch to Mix mode'));
 assert.ok(!fs.existsSync(path.join(root,'node_modules')),'Offline start must not need node_modules');
 const port=await availablePort(),child=spawn(process.execPath,[path.join(root,'scripts/launch-offline.mjs'),'--no-open'],{cwd:root,env:{...process.env,SOLO_STUDIO_PORT:String(port)},stdio:['ignore','pipe','pipe']});
 const messages=[];child.stdout.on('data',chunk=>messages.push(chunk.toString()));child.stderr.on('data',chunk=>messages.push(chunk.toString()));
 try{
  let ready=false;
  for(let i=0;i<80;i++){if(child.exitCode!==null)throw Error('Server exited early: '+messages.join(''));if(messages.join('').includes('READY')){ready=true;break;}await new Promise(r=>setTimeout(r,50));}
  assert.ok(ready,'Offline server did not start');
  let count=0;
  for(const file of paths){const response=await fetch(`http://127.0.0.1:${port}/${file}`);assert.equal(response.status,200,file);assert.ok((await response.arrayBuffer()).byteLength>0);count++;}
  const bad=await fetch(`http://127.0.0.1:${port}/missing.js`);assert.equal(bad.status,404);
  console.log('OFFLINE START PASS: '+count+' checked assets, no npm install/build, missing assets return 404.');
 }finally{child.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
