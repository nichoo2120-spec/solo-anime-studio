import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Run the actual Windows executable built by CI, with live updates disabled.
const { spawn } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const { chromium } = require('playwright');
async function main() {
  const pkg = require('../package.json'), release = require('../release.config.json');
  const config = require('js-yaml').load(fs.readFileSync('release/win-unpacked/resources/app-update.yml', 'utf8'));
  if (config.provider !== 'github' || config.owner !== release.owner || config.repo !== release.repo) throw Error('Packaged updater points at the wrong feed');
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sas-desktop-smoke-'));
  const child = spawn(path.resolve('release/win-unpacked/SoloAnimeStudio.exe'), ['--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`], { env: { ...process.env, SAS_NO_UPDATE: '1' }, stdio: 'ignore' });
  let browser;
  try {
    let endpoint;
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw Error(`Desktop exited before startup: ${child.exitCode}`);
      try { endpoint = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!endpoint) throw Error('Desktop did not start');
    browser = await chromium.connectOverCDP(endpoint.webSocketDebuggerUrl);
    const context = browser.contexts()[0]; let page;
    while (Date.now() < deadline) { page = context.pages().find(p => p.url().startsWith('app://soloanimestudio/')); if (page) break; await new Promise(resolve => setTimeout(resolve, 100)); }
    if (!page) throw Error('App origin was not loaded');
    await page.waitForFunction(expected => window.soloDesktop?.version === expected && document.querySelector('canvas'), pkg.version, { timeout: 60000 });
    const report = await page.evaluate(async () => ({ origin: location.origin, version: window.soloDesktop.version, canvasCount: document.querySelectorAll('canvas').length, updateBridge: await window.soloDesktop.checkForUpdates() }));
    if (!report.updateBridge.includes('turned off')) throw Error('Update IPC failed');
    fs.mkdirSync('validation', { recursive: true }); fs.writeFileSync('validation/desktop-smoke.json', JSON.stringify({ ...report, packagedFeed: config, passed: true }, null, 2));
    await page.screenshot({ path: 'validation/desktop-smoke.png' }); console.log(report);
  } finally {
    if (browser) await browser.close();
    if (process.platform === 'win32' && child.pid) require('node:child_process').spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F']);
    else child.kill();
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
