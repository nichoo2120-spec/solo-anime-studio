import {createServer,preview} from 'vite';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {sourceDigest} from '../build/sourceDigest.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));process.chdir(root);
try{
 const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 console.log(`\nSolo Anime Studio ${version}\nKeep this window open while drawing.\n`);
 const port=Number(process.env.SOLO_STUDIO_PORT??5211),options={host:'127.0.0.1',port:Number.isInteger(port)&&port>0&&port<65536?port:5211,strictPort:false,open:process.env.SOLO_STUDIO_NO_OPEN!=='1'};
 // Normal drawing uses the optimized release runtime. Explicit developer mode
 // remains available, and edited sources can never silently serve an old build.
 if(process.env.SOLO_STUDIO_DEV==='1'){const server=await createServer({root,server:options});await server.listen();server.printUrls();}
 else{
  let manifest;try{manifest=JSON.parse(await readFile(new URL('../dist/studio-build.json',import.meta.url),'utf8'));}catch{}
  if(manifest?.version!==version||manifest?.sourceDigest!==sourceDigest()){
   console.log('Preparing this version of the drawing app…');
   for(const args of [['node_modules/typescript/bin/tsc','-b'],['node_modules/vite/bin/vite.js','build']])await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:root,stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Build failed. Please keep this window open to review the error.')));});
  }
  const server=await preview({root,preview:options});server.printUrls();
 }
}catch(error){console.error('Could not start this copy of Solo Anime Studio:',error);process.exitCode=1;}
