const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdates } = require('../electron/updates.cjs');

function fixture({ packaged = true, disabled = false, configured = true } = {}) {
  const updater = new EventEmitter(), timers = [], intervals = [], dialogs = [], installs = [];
  let checks = 0, closes = 0, answer = 1; const delays = [];
  const win = { isDestroyed: () => false, close: () => { closes++; } };
  updater.checkForUpdates = async () => { checks++; updater.emit('update-not-available'); return { updateInfo: { version: '0.5.177' }, isUpdateAvailable: false }; };
  updater.quitAndInstall = (...args) => installs.push(args);
  const updates = createUpdates({ app: { isPackaged: packaged, getVersion: () => '0.5.177' },
    dialog: { showMessageBox: async (_win, options) => { dialogs.push(options); return { response: answer }; } },
    getWindow: () => win, loadUpdater: () => updater, later: (fn, delay) => timers.push({ fn, delay }), every: (fn, delay) => intervals.push({ fn, delay }), defer: fn => fn(), pause: async ms => { delays.push(ms); },
  });
  updates.setup(configured ? { owner: 'nichoo2120-spec', repo: 'solo-anime-studio' } : { owner: 'OWNER' }, disabled);
  return { updater, updates, timers, intervals, dialogs, installs, delays, get checks() { return checks; }, get closes() { return closes; }, choose: value => { answer = value; } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('installed app checks automatically after startup and periodically', async () => {
  const f = fixture();
  assert.equal(f.timers[0].delay, 8000); assert.equal(f.intervals[0].delay, 14400000);
  f.timers[0].fn(); await tick(); assert.equal(f.checks, 1);
  assert.equal(f.updater.autoDownload, true); assert.equal(f.updater.autoInstallOnAppQuit, false);
  assert.equal(f.updater.allowDowngrade, false); assert.equal(f.updater.allowPrerelease, false);
});
test('development, disabled and unconfigured apps never contact release feed', () => {
  for (const options of [{ packaged: false }, { disabled: true }, { configured: false }]) assert.equal(fixture(options).timers.length, 0);
});
test('simultaneous automatic/manual checks share one network request', async () => {
  const f = fixture(); let finish;
  f.updater.checkForUpdates = () => { f.called = (f.called || 0) + 1; return new Promise(resolve => { finish = resolve; }); };
  const a = f.updates.check(), b = f.updates.check();
  await tick(); assert.equal(f.called, 1); finish({ isUpdateAvailable: false }); await Promise.all([a, b]);
});
test('download is not restarted by repeated checks', async () => {
  const f = fixture(); f.updater.emit('update-available', { version: '0.5.178' });
  assert.match(await f.updates.check(), /Downloading update 0.5.178/); assert.equal(f.checks, 0);
});
test('Later keeps work open and does not install on ordinary close', async () => {
  const f = fixture(); f.updater.emit('update-downloaded', { version: '0.5.178' }); await tick();
  assert.equal(f.dialogs.length, 1); assert.equal(f.closes, 0); f.updates.windowClosed();
  assert.equal(f.installs.length, 0); assert.equal(f.updates.isInstalling(), false);
  assert.match(f.dialogs[0].detail, /Save your drawing/);
});
test('automatic periodic checks do not nag after Later', async () => {
  const f = fixture(); f.updater.emit('update-downloaded', { version: '0.5.178' }); await tick();
  await f.updates.check({ automatic: true }); assert.equal(f.dialogs.length, 1);
});
test('manual ready check offers install and waits for actual window closure', async () => {
  const f = fixture(); f.updater.emit('update-downloaded', { version: '0.5.178' }); await tick();
  f.choose(0); await f.updates.check(); assert.equal(f.closes, 1); assert.equal(f.installs.length, 0);
  assert.equal(f.updates.isInstalling(), true); f.updates.windowClosed(); assert.deepEqual(f.installs, [[true, true]]);
});
test('unsaved changes cancelling close cancels installation', async () => {
  const f = fixture(); f.choose(0); f.updater.emit('update-downloaded', { version: '0.5.178' }); await tick();
  f.updates.cancelRestart(); f.updates.windowClosed(); assert.equal(f.installs.length, 0); assert.equal(f.updates.isInstalling(), false);
});
test('errors are recoverable and do not block later checks', async () => {
  const f = fixture(); f.updater.checkForUpdates = async () => { throw Error('offline'); };
  assert.match(await f.updates.check(), /try again later/);
  f.updater.checkForUpdates = async () => ({ isUpdateAvailable: false });
  assert.match(await f.updates.check(), /latest version/);
});
test('download errors permit a fresh check', async () => {
  const f = fixture(); f.updater.emit('update-available', { version: '0.5.178' }); f.updater.emit('error', Error('network disconnected'));
  await f.updates.check(); assert.equal(f.checks, 1);
});
test('multiple ready events cannot stack restart dialogs', async () => {
  const f = fixture(); f.updater.emit('update-downloaded', { version: '0.5.178' }); f.updater.emit('update-downloaded', { version: '0.5.178' });
  await tick(); assert.equal(f.dialogs.length, 1);
});

test('a synchronous updater failure is retryable', async () => {
  const f = fixture(); let calls = 0; f.updater.checkForUpdates = () => { calls++; throw Error('synchronous failure'); };
  await f.updates.check(); await f.updates.check(); assert.equal(calls, 2);
});

test('transient HTTP 504 retries twice then accepts a successful update', async () => {
  const f = fixture(); let attempts = 0;
  f.updater.checkForUpdates = async () => {
    attempts++;
    if(attempts < 3) throw Error('504 Gateway Time-out');
    f.updater.emit('update-available', { version: '0.5.213' });
    return { isUpdateAvailable:true, updateInfo:{version:'0.5.213'} };
  };
  assert.match(await f.updates.check(), /Downloading update 0.5.213/);
  assert.equal(attempts, 3);
  assert.deepEqual(f.delays, [1500, 4000]);
});
test('permanent authentication errors do not retry', async () => {
  const f = fixture(); let attempts = 0;
  f.updater.checkForUpdates = async () => { attempts++; throw Error('401 Unauthorized'); };
  assert.match(await f.updates.check(), /Could not check for updates/);
  assert.equal(attempts, 1);
  assert.deepEqual(f.delays, []);
});
test('exhausted 504 retries give a safe manual update fallback', async () => {
  const f = fixture(); let attempts = 0;
  f.updater.checkForUpdates = async () => { attempts++; throw Error('504 Gateway Timeout'); };
  const message = await f.updates.check();
  assert.equal(attempts, 3);
  assert.match(message, /github.com\/nichoo2120-spec\/solo-anime-studio\/releases\/latest/);
  assert.match(message, /Your drawing is safe/);
});
test('simultaneous requests reuse the same 504 retry sequence', async () => {
  const f = fixture(); let attempts = 0;
  f.updater.checkForUpdates = async () => { attempts++; if(attempts===1)throw Error('504'); return {isUpdateAvailable:false}; };
  const [a,b]=await Promise.all([f.updates.check(),f.updates.check()]);
  assert.equal(attempts,2);
  assert.match(a,/latest version/);
  assert.match(b,/latest version/);
});
