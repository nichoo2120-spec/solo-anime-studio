// Keep updater state out of the drawing renderer. Paper/project storage is untouched.
/** Retry temporary gateway/network errors, not configuration, auth or invalid feed errors. */
function isTransientUpdateError(error) {
  const status = error?.statusCode ?? error?.status;
  if ([408, 429, 500, 502, 503, 504].includes(status)) return true;
  const message = String(error?.message || error);
  return /(?:^|[^\d])(?:408|429|500|502|503|504)(?!\d)|ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENOTFOUND|ERR_NETWORK|gateway timeout|network timeout|temporarily unavailable/i.test(message);
}

function createUpdates({ app, dialog, getWindow, loadUpdater, log = () => {}, later = setTimeout, every = setInterval, defer = setImmediate, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  let updater, state = 'idle', version = '', checking, prompt, installing = false;
  let configured = false;

  async function askRestart() {
    const win = getWindow();
    if (prompt || !win || win.isDestroyed() || state !== 'ready') return;
    prompt = (async () => {
      const answer = await dialog.showMessageBox(win, {
        type: 'info', buttons: ['Install and restart', 'Later'], defaultId: 1, cancelId: 1,
        title: 'Update ready', message: `Solo Anime Studio ${version} is ready to install.`,
        detail: 'Save your drawing before installing. Choose Later to keep working; the update will wait for you.',
      });
      if (answer.response === 0 && !win.isDestroyed()) { installing = true; win.close(); }
    })().catch(error => log('update prompt failed', error)).finally(() => { prompt = undefined; });
    return prompt;
  }

  function runCheck() {
    if (checking) return checking;
    // Coalesce automatic and manual requests, and retry only transient server
    // failures. Never launch parallel electron-updater download/check sessions.
    checking = Promise.resolve().then(async () => {
      state = 'checking';
      for (let attempt = 0; attempt < 3; attempt++) {
        try { return await updater.checkForUpdates(); }
        catch (error) {
          if (attempt === 2 || !isTransientUpdateError(error)) {
            state = 'error';
            throw error;
          }
          log('update check temporarily unavailable; retrying', error);
          await pause(attempt === 0 ? 1500 : 4000);
          state = 'checking';
        }
      }
    }).finally(() => { checking = undefined; });
    return checking;
  }

  async function check({ automatic = false } = {}) {
    if (!updater) return `Version ${app.getVersion()}. ${!configured ? 'The update server is not set up yet.' : app.isPackaged ? 'Updates are turned off.' : 'Updates work only in the installed app.'}`;
    if (state === 'ready') { if (!automatic) await askRestart(); return `Update ${version} is ready to install.`; }
    if (state === 'downloading') return `Downloading update ${version} in the background...`;
    try {
      const result = await runCheck();
      if (state === 'ready') return `Update ${version} is ready to install.`;
      if (state === 'downloading' || result?.isUpdateAvailable === true || result?.downloadPromise) return `Update ${version || result.updateInfo?.version} found. It is downloading in the background; you will be asked to install and restart.`;
      return `You have the latest version (${app.getVersion()}).`;
    } catch (error) {
      log('check failed', error);
      const detail = String(error.message || error).split('\n')[0].slice(0, 100);
      const fallback = isTransientUpdateError(error)
        ? ' The update server is temporarily unavailable. You can install the latest release from github.com/nichoo2120-spec/solo-anime-studio/releases/latest without uninstalling.'
        : '';
      return `Could not check for updates. Your drawing is safe; try again later. ${detail}${fallback}`;
    }
  }

  function setup(release, disabled = false) {
    configured = !!release.owner && release.owner !== 'OWNER' && !!release.repo;
    log(`app ${app.getVersion()} packaged=${app.isPackaged} configured=${configured}`);
    if (!app.isPackaged || disabled || !configured || updater) return;
    try {
      updater = loadUpdater();
      updater.logger = { info: m => log('info', m), warn: m => log('warn', m), error: m => log('error', m), debug: () => {} };
      updater.autoDownload = true;
      // Installation always follows the artist's explicit choice, including after Later.
      updater.autoInstallOnAppQuit = false;
      updater.allowDowngrade = false;
      updater.allowPrerelease = false;
      updater.on('update-available', info => { state = 'downloading'; version = info.version; });
      updater.on('update-not-available', () => { state = 'none'; });
      updater.on('update-downloaded', info => { state = 'ready'; version = info.version; void askRestart(); });
      updater.on('error', error => { state = 'error'; log('error', error); });
      later(() => { void check({ automatic: true }); }, 8000);
      every(() => { void check({ automatic: true }); }, 4 * 3600 * 1000);
    } catch (error) { updater = undefined; state = 'error'; log('init failed', error); }
  }

  return {
    setup, check, isInstalling: () => installing && state === 'ready',
    cancelRestart() { installing = false; },
    windowClosed() {
      if (installing && updater && state === 'ready') {
        log(`quitAndInstall ${version}`);
        defer(() => updater.quitAndInstall(true, true));
      }
    },
  };
}

module.exports = { createUpdates };
