# Desktop automatic update delivery — v0.5.178

The installed v0.5.177 Electron application already checks the public GitHub feed eight seconds after opening. The latest published release was v0.5.177, so another installed copy of that version correctly reported no update. A source-code edit or source ZIP is not an installer release.

This revision changes desktop update delivery only. It does **not** include the earlier, unpublished brush-performance/Mix candidate, and makes no claim that brush lag has been repaired. The drawing engines, project schema, fixed `app://soloanimestudio` origin, application ID and user-data directory are preserved.

## User flow

1. Open the installed Solo Anime Studio application.
2. Its startup check detects a newer complete release and downloads it in the background.
3. The native Update ready dialog offers **Install and restart** or **Later**.
4. Save the drawing before installing. If closing is blocked by unsaved changes, choosing Stay cancels installation.
5. Later leaves the update ready without automatically installing on an ordinary quit. Ctrl+Shift+U can offer installation again.

Older browser/ZIP launches do not acquire Electron's native updater automatically. The existing v177 installer downloads v178 using its own existing updater; v178's improved Later behavior applies after that upgrade.

## Release pipeline

`.github/workflows/desktop-update.yml` runs Windows unit tests, updater/release regression checks, the production build, NSIS packaging, exact installer/checksum verification, and a smoke launch of the actual packaged executable. Pull requests only build/test. A successful main-branch run may publish a higher stable package version using GitHub Actions' short-lived repository token. No token is embedded in the application and no personal token is required.

`scripts/release-desktop.cjs` verifies `latest.yml` against the exact executable bytes and size, requires the blockmap, prevents downgrades and preserves published versions. It uploads all assets to a hidden draft and publishes only after all uploads have been confirmed. A failed upload leaves the old public feed available.

## Changed files

- `electron/updates.cjs`: isolated automatic update state, coalesced network checks, recoverable errors, explicit installation and deferred prompts.
- `electron/main.cjs`: integrates the updater with the existing window close/unsaved-work flow.
- `.github/workflows/desktop-update.yml`: Windows verification and complete release publication.
- `scripts/release-desktop.cjs`: checksum and atomic publication checks.
- `tests/desktop-update.test.cjs`, `tests/desktop-release.test.cjs`: updater behavior and failed/incomplete release checks.
- `tests/desktop-smoke.mjs`: actual Windows packaged application launch, renderer canvas, version, fixed origin, update IPC and packaged GitHub configuration.
- `package.json`, `package-lock.json`, `src/core/buildInfo.ts`: version and desktop test command.
- `tests/revision-ledger-v174.cjs`, `tests/fixtures/performance-v178-revisions.json`: explicit version/package hash-chain additions; historical expectations are preserved.
- `README.md` and this note: current user and release instructions.

## Verification and limits

Local checks and the Windows workflow results must be assessed separately. A successful local Node test or Vite build does not establish that a Windows installer works. The Windows job records `desktop-smoke.json` and a screenshot from the actual packaged app, with live updates disabled during that smoke test. This validates packaging/startup, not a complete real-PC v177-to-v178 install cycle. The actual published GitHub assets/feed are checked separately after publication.

No physical Wacom or user's Windows computer is controlled by these tests. Offline/network failures defer updates and do not change drawings. Application signing remains as previously configured. The old manually invoked `publish_release.sh` remains a separate legacy path; normal release delivery now uses the verified workflow.
