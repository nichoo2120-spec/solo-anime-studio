// CHANGES 65: Linux build helper. electron-builder runs the NSIS installer under Wine only to pull the
// uninstaller out of it. This shim does that extraction in pure JS with electron-builder's own
// UninstallerReader (the same code it uses on macOS), so no Wine install is needed.
const path = require('path');
const installer = process.argv[2];
if (!installer || !/\.exe$/i.test(installer)) { console.error('wine shim: only supports uninstaller extraction'); process.exit(1); }
const { UninstallerReader } = require(path.join(__dirname, '..', '..', 'node_modules', 'app-builder-lib', 'out', 'targets', 'nsis', 'nsisUtil.js'));
const out = path.join(path.dirname(installer), `${path.basename(installer, 'exe')}__uninstaller.exe`);
UninstallerReader.exec(installer, out).then(() => process.exit(0), (e) => { console.error('wine shim:', e.message); process.exit(1); });
