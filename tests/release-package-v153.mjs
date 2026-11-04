import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {sourceDigest} from '../build/sourceDigest.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
for(const rel of [
 'build/sourceDigest.mjs','build/sourceDigest.d.mts',
 'scripts/start-studio.mjs','vite.config.ts','index.html',
 'src/engine/dryBristleV2.ts','src/engine/dryBristleV3.ts','src/core/buildInfo.ts',
 'START SOLO ANIME STUDIO.bat'
])await access(resolve(root,rel));
const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
assert.equal(pkg.version,'0.5.153');
const digest=sourceDigest();
assert.match(digest,/^[0-9a-f]{64}$/);
assert.equal(digest,sourceDigest());
for(const rel of ['scripts/start-studio.mjs','vite.config.ts']){
 const source=await readFile(resolve(root,rel),'utf8');
 assert.ok(source.includes('sourceDigest.mjs'),`${rel} must import digest helper`);
}
console.log(`PASS v${pkg.version}: launcher helper, import paths, digest ${digest.slice(0,12)}…`);
