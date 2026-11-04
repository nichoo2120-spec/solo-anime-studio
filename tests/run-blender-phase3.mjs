import {createServer} from '../node_modules/vite/dist/node/index.js';import {spawn} from 'node:child_process';import path from 'node:path';
const baseline=process.argv.includes('--baseline'),root=baseline?path.resolve('../baseline153/Solo_Anime_Studio_v0_5_153'):process.cwd(),tag=process.env.BLENDER_TAG||(baseline?'v153_recheck':'v154'),port=5540;
const server=await createServer({root,server:{host:'127.0.0.1',port,strictPort:true}});await server.listen();
try{const code=await new Promise((resolve,reject)=>{const c=spawn(process.execPath,['tests/blender_phase3/blend_run.mjs',tag,String(port)],{stdio:'inherit',env:{...process.env,OUT:path.resolve('tests/blender_phase3')}});c.on('error',reject);c.on('exit',resolve);});if(code)process.exitCode=Number(code);}finally{await server.close();}
