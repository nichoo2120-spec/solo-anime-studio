# Robin's lag test harness (for Codex)
Node + Playwright (Chromium) scripts used to measure Solo Anime Studio lag.
- lib.mjs: shared helpers (launch app, set DPR, CPU throttle, draw strokes, collect frame times, long tasks, getImageData counts, pen-up and undo time)
- matrix.mjs: runs every brush at size 30 and 150 (DPR 1/2, 1280x720 / 2048x1152, CPU 1x/4x)
- prof.mjs / undoprof.mjs: CPU profiles of drawing and undo
- dirty.mjs: measures how much canvas area is cleared per frame
- proj/: the test projects (281-stroke busy scene, 10-layer scene)
- runall.sh / runrep.sh: run everything (3 repeats)
Targets are in codex_fix_prompt.md. Paths inside scripts may point to /workspace/...; change them to your app folder.
