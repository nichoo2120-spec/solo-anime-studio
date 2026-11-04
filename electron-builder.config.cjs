// Windows installer config (electron-builder). Thin packaging layer: it only wraps the normal Vite build in dist/.
// Publish target comes from release.config.json (one place).
const rel = require('./release.config.json');
module.exports = {
  appId: 'com.nicholas.soloanimestudio',
  productName: 'Solo Anime Studio',
  executableName: 'SoloAnimeStudio',
  copyright: 'Nicholas',
  directories: { output: 'release', buildResources: 'build' },
  // Only the built web app + the Electron shell go into the app. Sources/tests stay out.
  files: ['dist/**/*', 'electron/**/*', 'build/icon.png', 'package.json', 'release.config.json',
    '!**/*.map'],
  asar: true,
  publish: [{ provider: 'github', owner: rel.owner, repo: rel.repo, releaseType: 'release' }],
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'build/icon.ico',
    // dash-only name: GitHub turns spaces into dots, so latest.yml must use exactly this name
    artifactName: 'SoloAnimeStudio-Setup-${version}.${ext}',
    verifyUpdateCodeSignature: false, // unsigned app
  },
  nsis: {
    oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true,
    createDesktopShortcut: 'always', createStartMenuShortcut: true, shortcutName: 'Solo Anime Studio',
    installerIcon: 'build/icon.ico', uninstallerIcon: 'build/icon.ico',
    deleteAppDataOnUninstall: false, // projects are kept when uninstalling
    differentialPackage: true,
  },
  linux: { target: ['dir'], icon: 'build/icon.png', category: 'Graphics' },
};
