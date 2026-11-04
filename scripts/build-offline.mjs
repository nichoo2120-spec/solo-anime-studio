/** v0.5.176: builds the offline app that START SOLO ANIME STUDIO.bat opens.
 * Before v0.5.176 the offline folder held ~190 separate, unminified modules that the
 * browser fetched one by one (and re-downloaded on every launch). Now the offline
 * folder is the normal optimised production build: one minified app file, workers
 * and fonts, with hashed file names so the browser can cache them between launches.
 * offline/src + vendor shims are NOT loaded by the app; they are kept for older module checks.
 * Run after `npm run build` (uses dist/). The startup splash is added to index.html.
 */
import {execFileSync} from 'node:child_process';
import {cpSync,rmSync,readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=resolve(root,'dist'),out=resolve(root,'offline');
if(!existsSync(resolve(dist,'index.html')))throw new Error('Run npm run build first (dist/index.html missing).');
const version=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')).version;
// Replace the served app files. The vendor shims (vendor.js, react.js, ...) and src/
// stay: they are the per-module copy used only by older checks, regenerated below.
for(const name of ['index.html','assets','fonts','studio-build.json','styles.css','src'])rmSync(resolve(out,name),{recursive:true,force:true});
cpSync(dist,out,{recursive:true});
execFileSync(process.execPath,[resolve(root,'scripts/build-offline-modules.cjs')],{stdio:'inherit'});
const splash=`<div id="startup-status" style="position:fixed;inset:0;z-index:1000;background:#11171b;color:#dce8e9;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font:15px Segoe UI,sans-serif">Opening Solo Anime Studio v${version}...</div>`;
const guard=`<script>
(function(){
 var status=document.getElementById('startup-status'),root=document.getElementById('root');
 var obs=new MutationObserver(function(){if(root.childNodes.length){status.remove();obs.disconnect();}});
 obs.observe(root,{childList:true});
 window.addEventListener('error',function(event){if(root.childNodes.length)return;status.textContent='Studio failed to load: '+(event.message||'A required app module could not be opened. Please send a screenshot of this page.');},true);
 window.setTimeout(function(){if(!root.childNodes.length&&status.textContent.indexOf('failed')<0)status.textContent='Studio did not finish loading. Check the black launcher window for errors. If it says READY, send a screenshot of this browser page.';},12000);
})();
</script>`;
let html=readFileSync(resolve(out,'index.html'),'utf8');
if(!html.includes('<div id="root"></div>'))throw new Error('dist/index.html has no root element');
html=html.replace('<body>','<body>'+splash).replace('<div id="root"></div>','<div id="root"></div>'+guard);
writeFileSync(resolve(out,'index.html'),html);
console.log(`Offline app v${version} written: ${readdirSync(resolve(out,'assets')).length} asset files.`);
