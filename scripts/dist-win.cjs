// `npm run dist:win` -> release/SoloAnimeStudio-Setup-<version>.exe + .blockmap + latest.yml
// Works on Windows directly. On Linux/macOS it uses scripts/wine-shim so no Wine is needed.
const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.join(__dirname, '..');
const run = (cmd, env = {}) => execSync(cmd, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
run('npm run build'); // tsc -b && vite build -> dist/
const out = path.join(root, 'release');
if (fs.existsSync(out)) for (const f of fs.readdirSync(out)) if (/\.(exe|blockmap)$|^latest\.yml$/.test(f)) fs.rmSync(path.join(out, f));
const env = {};
if (process.platform !== 'win32') { env.PATH = path.join(root, 'scripts', 'wine-shim') + path.delimiter + process.env.PATH; env.USE_SYSTEM_WINE = 'true'; }
run('npx electron-builder --config electron-builder.config.cjs --win --x64 --publish never', env);
const v = require('../package.json').version;
console.log(`\nDone: release/SoloAnimeStudio-Setup-${v}.exe (+ .blockmap, latest.yml)`);
