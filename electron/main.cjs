// Solo Anime Studio desktop shell (Electron). Thin layer around the normal Vite build in dist/.
// - Serves dist/ from ONE fixed origin (app://soloanimestudio) so IndexedDB/localStorage projects
//   stay in the same place across restarts and updates (stored in %APPDATA%\Solo Anime Studio).
// - Auto-update from GitHub Releases (electron-updater); owner/repo come from release.config.json.
const { app, BrowserWindow, protocol, net, ipcMain, shell, session, Menu, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const SCHEME = 'app';
const HOST = 'soloanimestudio';
const ORIGIN = `${SCHEME}://${HOST}`;
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } }]);

const distDir = path.join(__dirname, '..', 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.txt': 'text/plain', '.md': 'text/plain' };

function registerAppProtocol() {
  protocol.handle(SCHEME, async (req) => {
    const u = new URL(req.url);
    const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(distDir, rel));
    if (!file.startsWith(distDir)) return new Response('forbidden', { status: 403 });
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return new Response('not found', { status: 404 });
    const headers = { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': String(fs.statSync(file).size) };
    if (req.method === 'HEAD') return new Response(null, { status: 200, headers });
    const r = await net.fetch(pathToFileURL(file).toString());
    return new Response(r.body, { status: 200, headers });
  });
}

let win = null;
let updater = null;
let upState = 'idle';
let upVersion = '';
let installAfterClose = false;
let relCfg = { owner: 'OWNER' };
try { relCfg = require('../release.config.json'); } catch {}
const updatesConfigured = () => relCfg.owner && relCfg.owner !== 'OWNER';

let logFile = null;
function ulog(...a) {
  try {
    if (!logFile) { const dir = path.join(app.getPath('userData'), 'logs'); fs.mkdirSync(dir, { recursive: true }); logFile = path.join(dir, 'updater.log'); try { if (fs.statSync(logFile).size > 1e6) fs.renameSync(logFile, logFile + '.old'); } catch {} }
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${a.map((x) => (x instanceof Error ? x.stack || x.message : typeof x === 'string' ? x : JSON.stringify(x))).join(' ')}\n`);
  } catch {}
}

async function askRestart(version) {
  if (!win || win.isDestroyed()) return;
  const r = await dialog.showMessageBox(win, { type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0, cancelId: 1, title: 'Update ready',
    message: `Solo Anime Studio ${version} is ready.`, detail: 'Save your work, then click "Restart now". If you click "Later", the update is installed the next time you close the app.' });
  if (r.response === 0) { installAfterClose = true; win.close(); } // the page can still ask about unsaved changes
}

function setupUpdater() {
  ulog(`app ${app.getVersion()} packaged=${app.isPackaged} configured=${updatesConfigured()}`);
  if (!app.isPackaged || process.env.SAS_NO_UPDATE || !updatesConfigured()) return;
  try {
    updater = require('electron-updater').autoUpdater;
    updater.logger = { info: (m) => ulog('info', m), warn: (m) => ulog('warn', m), error: (m) => ulog('error', m), debug: () => {} };
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.allowDowngrade = false;
    updater.on('update-available', (i) => { upState = 'downloading'; upVersion = i.version; });
    updater.on('update-not-available', () => { upState = 'none'; });
    updater.on('update-downloaded', (i) => { upState = 'ready'; upVersion = i.version; askRestart(i.version); });
    updater.on('error', (e) => { upState = 'error'; ulog('error', e); });
    const check = () => { if (upState === 'ready' || upState === 'downloading') return; updater.checkForUpdates().catch((e) => ulog('check failed', e)); };
    setTimeout(check, 8000);
    setInterval(check, 4 * 3600 * 1000);
  } catch (e) { ulog('init failed', e); }
}

async function manualCheck() {
  if (!updater) return `Version ${app.getVersion()}. ${!updatesConfigured() ? 'The update server is not set up yet.' : app.isPackaged ? 'Updates are turned off.' : 'Updates work only in the installed app.'}`;
  if (upState === 'ready') { askRestart(upVersion); return `Update ${upVersion} is ready.`; }
  if (upState === 'downloading') return `Downloading update ${upVersion} in the background...`;
  try {
    const r = await updater.checkForUpdates();
    const v = r && r.updateInfo && r.updateInfo.version;
    if (v && v !== app.getVersion() && r.isUpdateAvailable !== false) return `Update ${v} found. It is downloading in the background; you will be asked to restart.`;
    return `You have the latest version (${app.getVersion()}).`;
  } catch (e) { return `Could not check for updates: ${String((e && e.message) || e).split('\n')[0].slice(0, 160)}`; }
}
ipcMain.on('sas-version', (e) => { e.returnValue = app.getVersion(); });
ipcMain.handle('sas-check-updates', () => manualCheck());

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 950, minWidth: 1000, minHeight: 650, backgroundColor: '#11181d', title: 'Solo Anime Studio',
    icon: path.join(__dirname, '..', 'build', 'icon.png'), show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null); // no menu bar: the app has its own menus (and Alt stays free for tools)
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.on('page-title-updated', (e) => { e.preventDefault(); win.setTitle(`Solo Anime Studio ${app.getVersion()}`); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    // the floating tool wheel opens an empty popup and draws into it -> allow that
    if (!url || url === 'about:blank') return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: '#11181d', icon: path.join(__dirname, '..', 'build', 'icon.png') } };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(`${ORIGIN}/`)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  // The page blocks closing while there are unsaved changes (beforeunload). Ask like a browser would.
  win.webContents.on('will-prevent-unload', (e) => {
    const c = dialog.showMessageBoxSync(win, { type: 'warning', buttons: ['Stay', 'Close anyway'], defaultId: 0, cancelId: 0, title: 'Unsaved changes',
      message: 'You have unsaved changes.', detail: 'Click "Stay" and save (Ctrl+S) first, or "Close anyway" to lose the latest changes.' });
    if (c === 1) e.preventDefault(); else installAfterClose = false;
  });
  // Ctrl+Shift+U = check for updates (no menu bar, so a key is used); F12 = dev tools only when not packaged
  win.webContents.on('before-input-event', async (e, input) => {
    if (input.type === 'keyDown' && input.control && input.shift && !input.alt && input.key.toLowerCase() === 'u') {
      e.preventDefault();
      const msg = await manualCheck();
      dialog.showMessageBox(win, { type: 'info', title: 'Updates', message: msg });
    }
  });
  win.on('closed', () => {
    win = null;
    if (installAfterClose && updater && upState === 'ready') { ulog(`quitAndInstall ${upVersion}`); setImmediate(() => updater.quitAndInstall(true, true)); }
  });
  win.loadURL(`${ORIGIN}/index.html`);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    registerAppProtocol();
    session.defaultSession.on('will-download', (_e, item) => { if (process.env.SAS_DOWNLOAD_DIR) item.setSavePath(path.join(process.env.SAS_DOWNLOAD_DIR, item.getFilename())); });
    session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(['clipboard-read', 'clipboard-sanitized-write', 'fullscreen', 'persistent-storage', 'pointerLock'].includes(perm)));
    createWindow();
    setupUpdater();
  });
  app.on('window-all-closed', () => { if (!(installAfterClose && upState === 'ready')) app.quit(); });
}
