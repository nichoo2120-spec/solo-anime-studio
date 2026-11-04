// Keep updater state out of the drawing renderer. Paper/project storage is untouched.
function createUpdates({ app, dialog, getWindow, loadUpdater, log = () => {}, later = setTimeout, every = setInterval, defer = setImmediate }) {
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
    checking = Promise.resolve().then(async () => {
      state = 'checking';
      try { return await updater.checkForUpdates(); }
      catch (error) { state = 'error'; throw error; }
      finally { checking = undefined; }
    });
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
      return `Could not check for updates. Your drawing is safe; try again later. ${String(error.message || error).split('\n')[0].slice(0, 160)}`;
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
