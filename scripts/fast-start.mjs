/** Solo Anime Studio — quick local source launcher.
 * Unlike the release launcher this does NOT compile the entire application
 * before it opens. Vite serves the current source and opens the browser only
 * after its HTTP server is ready. Requires a one-time npm dependency install.
 */
import {spawn,spawnSync} from 'node:child_process';
import {existsSync,readdirSync,symlinkSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const isWin=process.platform==='win32';
const deps=join(root,'node_modules');
const required=['vite/bin/vite.js','@vitejs/plugin-react/package.json','react/package.json','react-dom/package.json'];
const ready=()=>required.every(x=>existsSync(join(deps,x)));

function findReusableDependencies(){
 const parent=dirname(root);
 for(const sibling of readdirSync(parent,{withFileTypes:true})){
  if(!sibling.isDirectory()||!/^Solo_Anime_Studio_v0_5_\d+$/i.test(sibling.name)||sibling.name===root.split(/[\\/]/).at(-1))continue;
  const candidate=join(parent,sibling.name,'node_modules');
  if(required.every(x=>existsSync(join(candidate,x))))return candidate;
 }
 return null;
}
function exitMessage(message){
 console.error('\n'+message+'\n');
 console.error('The software did not open. This is a setup error, not a frozen drawing canvas.');
 console.error('Please send the terminal error text if the problem persists.');
 process.exitCode=1;
}
async function run(cmd,args,opts={}){
 return new Promise((finish)=>{
  let completed=false;
  const child=spawn(cmd,args,{cwd:root,stdio:'inherit',shell:opts.shell??false,env:opts.env??process.env});
  const complete=(code,error)=>{if(completed)return;completed=true;clearTimeout(timer);finish({code,error});};
  child.once('error',error=>complete(1,error));
  child.once('exit',code=>complete(code??1));
  const timer=opts.timeout?setTimeout(()=>{
   console.error('\nInstallation has stopped responding. Ending it rather than waiting indefinitely.');
   if(isWin)spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});
   else child.kill('SIGTERM');
   complete(124,Error('Dependency setup timed out'));
  },opts.timeout):null;
 });
}

console.log('\n=========================================');
console.log(' SOLO ANIME STUDIO — FAST START');
console.log('=========================================');
console.log('Project: '+root);
if(!ready()){
 if(!existsSync(deps)){
  const reusable=findReusableDependencies();
  if(reusable){
   try{symlinkSync(reusable,deps,isWin?'junction':'dir');console.log('Reusing dependencies from '+reusable);}catch(e){console.log('Could not reuse existing dependencies: '+e.message);}
  }
 }
 if(!ready()){
  console.log('\nONE-TIME SETUP: required packages are not installed.');
  console.log('Installing dependencies now. This needs an internet connection.');
  console.log('Any network/install error will be displayed here (not an endless wait).\n');
  const env={...process.env,npm_config_audit:'false',npm_config_fund:'false',npm_config_fetch_retries:'1',npm_config_fetch_timeout:'12000',npm_config_fetch_retry_mintimeout:'1000',npm_config_fetch_retry_maxtimeout:'3000'};
  const result=await run(isWin?'npm.cmd':'npm',['install','--prefer-offline','--no-audit','--no-fund','--progress=false'],{shell:isWin,timeout:120000,env});
  if(result.code!==0||!ready()){
   exitMessage('Dependency setup failed. Check your internet connection, then run this launcher again.');
  }
 }
}
if(!process.exitCode){
 console.log('\nOpening the current source directly — skipping the slow TypeScript and production rebuild.');
 console.log('Your browser will open once the local server is ready.');
 console.log('Keep this terminal window open while drawing.\n');
 const result=await run(process.execPath,[join(deps,'vite','bin','vite.js'),'--host','127.0.0.1','--port','5211','--open']);
 if(result.code!==0)exitMessage('The local drawing server could not start.');
}
