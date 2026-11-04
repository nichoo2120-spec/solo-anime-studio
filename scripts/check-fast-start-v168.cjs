const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sas-launch-v168-'));
try{
 const app=path.join(dir,'Solo_Anime_Studio_v0_5_168');
 fs.mkdirSync(path.join(app,'scripts'),{recursive:true});
 fs.copyFileSync(path.join(root,'scripts','fast-start.mjs'),path.join(app,'scripts','fast-start.mjs'));
 for(const name of ['vite/bin/vite.js','@vitejs/plugin-react/package.json','react/package.json','react-dom/package.json']){
  const f=path.join(app,'node_modules',name);
  fs.mkdirSync(path.dirname(f),{recursive:true});
  fs.writeFileSync(f,name.endsWith('.js')?'console.log("MOCK STUDIO READY")':'{}');
 }
 const run=()=>spawnSync(process.execPath,[path.join(app,'scripts','fast-start.mjs')],{cwd:app,encoding:'utf8',timeout:10000});
 const first=run();
 assert.equal(first.status,0,first.stderr);
 assert.match(first.stdout,/skipping the slow TypeScript and production rebuild/);
 assert.match(first.stdout,/MOCK STUDIO READY/);
 const sibling=path.join(dir,'Solo_Anime_Studio_v0_5_165');fs.mkdirSync(sibling);
 fs.renameSync(path.join(app,'node_modules'),path.join(sibling,'node_modules'));
 const reused=run();
 assert.equal(reused.status,0,reused.stderr);
 assert.match(reused.stdout,/Reusing dependencies/);
 assert.match(reused.stdout,/MOCK STUDIO READY/);
 console.log('v168 fast-start checks PASS: installed dependencies and adjacent folder reuse.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
