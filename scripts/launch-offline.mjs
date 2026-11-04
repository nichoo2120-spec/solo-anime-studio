/** Offline fast launcher (v0.5.176): serves the prebuilt, optimised Studio app.
 * No npm install, Vite, TypeScript or internet required to open the app.
 * v0.5.176 speed-up: the offline folder is now the normal production build (one
 * minified app file instead of ~190 separate modules). Files are sent compressed,
 * and hashed files in /assets are cached by the browser, so later launches load
 * them from the browser cache (including its compiled-code cache).
 */
import {createServer} from 'node:http';
import {existsSync,statSync,readFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=resolve(fileURLToPath(new URL('../offline/',import.meta.url)));
const VERSION='0.5.176';
// Validate the app before reporting READY: index.html and every file it references.
function validateOfflineApp(){
 const index=resolve(root,'index.html');
 if(!existsSync(index))throw new Error('Offline application is incomplete: missing index.html');
 const html=readFileSync(index,'utf8'),refs=[...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map(m=>m[1]);
 const scripts=refs.filter(r=>r.endsWith('.js'));
 if(!scripts.length)throw new Error('index.html loads no application script');
 for(const ref of refs){const target=resolve(root,'.'+ref);if(!target.startsWith(root+sep)||!existsSync(target))throw new Error('Missing browser file '+ref);}
 // Every relative asset a script names (workers, chunks) must exist too.
 let checked=refs.length;
 for(const ref of scripts){const code=readFileSync(resolve(root,'.'+ref),'utf8');for(const m of code.matchAll(/["'`](\/?assets\/[\w.-]+\.(?:js|css|wasm|png|woff2?))["'`]/g)){const target=resolve(root,m[1].replace(/^\//,''));if(!existsSync(target))throw new Error('Missing browser file '+m[1]+' named in '+ref);checked++;}}
 return checked;
}
try{const files=validateOfflineApp();console.log('Verified '+files+' application files.');}
catch(error){console.error('Offline application cannot open:',error.message);process.exit(2);}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.ttf':'font/ttf','.wasm':'application/wasm'};
const compressible=new Set(['.html','.js','.css','.json','.svg','.ttf','.wasm']);
const noOpen=process.argv.includes('--no-open')||process.env.SOLO_STUDIO_NO_OPEN==='1';
// Small in-memory cache: file bytes, gzip copy and ETag, refreshed if the file changes.
const memo=new Map();
function load(file,st){
 const hit=memo.get(file);if(hit&&hit.mtime===st.mtimeMs&&hit.size===st.size)return hit;
 const body=readFileSync(file),ext=extname(file),entry={mtime:st.mtimeMs,size:st.size,body,gz:compressible.has(ext)&&body.length>1024?gzipSync(body,{level:6}):null,etag:'"'+createHash('sha1').update(body).digest('hex').slice(0,20)+'"'};
 memo.set(file,entry);return entry;
}
const server=createServer((request,response)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(request.url??'/', 'http://127.0.0.1').pathname);}catch{response.writeHead(400).end('Bad path');return;}
 const file=resolve(root,`./${pathname.replace(/^\/+/, '')||'index.html'}`);
 if(file!==root&&!file.startsWith(root+sep)){response.writeHead(403).end('Forbidden');return;}
 let st;try{st=statSync(file);}catch{response.writeHead(404).end('Not found');return;}
 if(!st.isFile()){response.writeHead(404).end('Not found');return;}
 let entry;try{entry=load(file,st);}catch{response.writeHead(500).end('Read error');return;}
 // Hashed build files never change content under the same name: cache them for a year.
 // index.html and other files are revalidated (cheap 304 when unchanged), so a new
 // version is picked up immediately.
 const hashed=/^\/assets\/.+-[\w-]{8,}\.\w+$/.test(pathname);
 const headers={'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':hashed?'public, max-age=31536000, immutable':'no-cache','ETag':entry.etag,'X-Content-Type-Options':'nosniff','Vary':'Accept-Encoding'};
 if(request.headers['if-none-match']===entry.etag){response.writeHead(304,headers).end();return;}
 const gzip=entry.gz&&/\bgzip\b/.test(request.headers['accept-encoding']??'');
 if(gzip)headers['Content-Encoding']='gzip';
 const body=gzip?entry.gz:entry.body;headers['Content-Length']=body.length;
 response.writeHead(200,headers);response.end(request.method==='HEAD'?undefined:body);
});
function openBrowser(url){
 try{
  if(process.platform==='win32')spawn('cmd.exe',['/d','/c','start','""',url],{stdio:'ignore',detached:true,windowsHide:true}).unref();
  else if(process.platform==='darwin')spawn('open',[url],{stdio:'ignore',detached:true}).unref();
  else if(process.env.DISPLAY||process.env.WAYLAND_DISPLAY)spawn('xdg-open',[url],{stdio:'ignore',detached:true}).unref();
 }catch(err){console.error('Open the address above manually:',err?.message??err);}
}
// Keep the exact same origin on every launch: IndexedDB and local project
// backups belong to this origin. Never silently move them to another port.
const port=Math.max(1024,Math.min(65000,Number(process.env.SOLO_STUDIO_PORT)||5211));
server.once('error',error=>{
 if(error.code==='EADDRINUSE'){
  console.error(`Port ${port} is already in use. Close the older Solo Anime Studio window/server and start this version again.`);
  console.error('The address stays unchanged so your existing local projects are not hidden on another port.');
 }else console.error('Cannot start Studio server:',error.message);
 process.exitCode=1;
});
server.listen(port,'127.0.0.1',()=>{
 const url=`http://127.0.0.1:${port}/`;
 console.log('\nSOLO ANIME STUDIO v'+VERSION+' — READY');
 console.log('Optimised offline build, no installation or build required.');
 console.log('Open: '+url);
 console.log('Keep this window open while using Studio.\n');
 if(!noOpen)openBrowser(url);
});
