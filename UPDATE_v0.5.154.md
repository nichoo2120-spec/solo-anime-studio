# Solo Anime Studio v0.5.154 — Blender v2, Phase 3A–3C

The new version adds a wet paint reservoir with longer carry, pressure/speed response and fine bristles. It also activates the existing **Mix tips** panel. Work stopped after 3C. Classic Blender, all dry-brush revisions and the v153 workspace layout remain unchanged.

The supplied Smudge Bristle acceptance script passes **14/14 targets**. All three new presets pass the separate 160-move test. There was **one 46.5 ms Wet Mix outlier in the companion 126-event benchmark**; this remains a limitation, even though its p95 is below 3 ms. This release is not a guarantee of zero stutter on every computer.

## Root cause and repair

In the active v153 Blender-v3 path, the 24×24 load was repeatedly replaced by colour from the already-smudged working surface, with a pickup time constant of only size × .28. High per-dab deposition accelerated that replacement. This produced short carry and repeated blotches. That historical renderer was inspected and left intact for saved strokes.

The new `WetSmudgeGesture` is used only with **smudgeVersion: 2 + coloringEngine: 1 + color-blender**. A stroke without that tag follows the original dispatch, including classic revisions 1/2/3.

- A 32×32 premultiplied RGBA reservoir travels in brush-contact coordinates. A separate 0–1 mass field controls how much paint is left.
- Pickup samples the pre-stroke base and the prior working result, before deposition, with premultiplied weights .12 / .88. Transparent RGB cannot contaminate the load.
- Pickup, mass decay and deposition follow travelled distance. Pressure raises deposition and carry; faster movement lowers deposition and raises hold. Recorded velocity is used, with no clock or frame-count dependence.
- The persisted `colorSeed` drives coherent fine bristle lanes, varying uptake and low-amplitude arc-dependent pigment variation. No random stamp rotation, uncontrolled randomness or full-canvas blur is used.
- Blender Soft has a feathered round contact and lateral capillary colour exchange within the reservoir. It does not blur the whole canvas. Flat, filbert and fan selections use their physical contact shapes.
- State checkpoints occur every four settled dabs. A short footprint-sized undo journal restores revised tails and smoothing changes; older revisions replay from the base. Temporary canvases and retained checkpoints are released on reset.
- Opacity interpolates the completed result against the base once, in premultiplied colour. Preserve transparency retains the destination alpha. Existing affine/projective contact mapping is reused.

This is a paint-carry approximation, not a full fluid or spectral-pigment simulation.

## Presets and controls

No preset was removed. Classic **Blender** (`color-blender`) has exactly its v153 defaults. The three additions sit directly after it in the existing **Paint → Coloring** family, preserving the v153 category layout.

| New preset | Nib | Mix | Pickup length | Hold | Streaks | Add colour |
|---|---|---:|---:|---:|---:|---:|
| Smudge Bristle | Bristle | .75 | .9 | 3.5 | .50 | 0 |
| Blender Soft | Round | .85 | .9 | 4.5 | .15 | 0 |
| Wet Mix | Bristle | .75 | .9 | 3.5 | .50 | .25 |

The small **Mix / Hold / Streaks / Add colour** block appears only on these versioned presets. Hold is measured in brush-size multiples. Mix controls pickup; Streaks changes lane variation; Add colour introduces the selected colour into already-loaded pigment. These are smudge brushes and do not paint onto a completely empty layer.

The separate existing **Mix tips** panel is a physical nib mixer for generic Paint brushes. It now carries `mixTipA`, `mixTipB`, and `mixBlend` into new strokes when A differs from B and `.01 < Blend < .99`. Endpoints use Tip A or B alone. Changing a tip initializes the other displayed tip and the blend, so selecting a dropdown immediately has an effect. Restoring stock/custom presets and validating saved strokes keep the fields. Presets without explicit mix settings keep their original appearance. The existing `mixedNib` implementation is unchanged.

## Final before/after measurements

These values use the supplied, unchanged `blender_metrics.py`. The baseline column is the supplied v153 data; the after column is the final Smudge Bristle run. Pixels are canvas pixels, size 70 unless stated.

| Measurement | v153 supplied | v154 Smudge Bristle | Requirement | Result |
|---|---:|---:|---:|---|
| Carry into blue | 66 px / .94× | 296 px / 4.23× | ≥3× | PASS |
| Red share at +40 | .239 | .819 | ≥.35 | PASS |
| Red share at +100 | .021 | .653 | ≥.20 | PASS |
| Red share at +200 | 0 | .418 | >0 and decreasing | PASS |
| Half-life | 30 px | 181 px | ≥105 px | PASS |
| Edge 10–90 width | 60 px | 28 px | ≥12 px | PASS |
| Repeat autocorrelation | .518 | .222 | ≤.35 | PASS |
| Outside straight-stroke changes | 0 | 0 | 0 | PASS |
| Size 30 carry | .93× | 7.27× | ≥3× | PASS |
| Size 130 carry | 1.02× | 2.47× | ≥1.6× | PASS |
| Red patch dragged over white | 100 px | 569 px | ≥140 px | PASS |
| Empty-layer changed pixels | 0 | 0 | 0 | PASS |
| Heavy-minus-light carry | 22 px | 214 px | ≥40 px | PASS |
| Slow/fast red-share difference | .008 | .076 | ≥.05 | PASS |
| Size-130 event p95 | 3.27 ms | 2.17 ms | ≤3 ms | PASS |

The +200 check is additional to the 14 script targets. Bristle shares .819 → .653 → .418 decrease naturally.

| Preset at size 70 | Carry | Edge 10–90 | Streak std | Repeat score | Half-life |
|---|---:|---:|---:|---:|---:|
| Smudge Bristle | 4.23× | 28 px | .0230 | .222 | 181 px |
| Blender Soft | 4.07× | 31 px | .0196 | .439 | 121 px |
| Wet Mix, selected red | 4.46× | 26 px | .0197 | .213 | 289 px |

Soft satisfies the requested distinction: **31 > 28** edge width and **.0196 < .0230** streak variation. Only Smudge Bristle is subject to all TARGETS. Soft's other numbers are reported rather than treated as Smudge Bristle passes. Selected red is deliberately added in the Wet Mix image, so that brush does not fade like an un-replenished load.

The curve case follows a sine and legitimately leaves the metric script's fixed horizontal band. Its `off_stroke_changed_px` and band-based autocorrelation are not a geometric outside-stroke mask for curves; the acceptance zero-change check is the straight `rb_mid` case. Curve continuity was inspected in the rendered images.

## Performance

Environment: local Chromium 133, software canvas (`--disable-gpu`), 1400×500 base, identical rendering conditions. No build or unit-test jobs ran alongside the timed benchmarks. Supplied benchmark: three 126-event gestures per size, full base copy and readback included. Values are **mean / p95 / maximum ms**; p95 is averaged across the three repeats as in the supplied script.

| Preset | Size 70 | Size 130 |
|---|---|---|
| v153 supplied | 1.83 / 4.23 / 13.5 | 1.66 / 3.27 / 4.9 |
| v153 rerun | 1.68 / 3.07 / 7.1 | 1.56 / 2.93 / 4.6 |
| Smudge Bristle | 1.31 / 2.00 / 8.7 | 1.40 / 2.17 / 6.2 |
| Blender Soft | 1.48 / 2.30 / 8.1 | 1.61 / 2.43 / 8.6 |
| Wet Mix | 1.58 / 2.67 / 7.5 | 1.73 / 2.70 / 46.5 |

The extra test uses **160 moves × 3 gestures × 3 presets = 1,440 events** at size 130, with the same full-base-copy/readback method. p95 is averaged per preset, as above.

| Preset | p95 ms | Maximum ms | Events >16 ms |
|---|---:|---:|---:|
| smudge-bristle | 2.67 | 8.60 | 0 |
| blender-soft | 2.87 | 7.50 | 0 |
| wet-mix | 2.90 | 10.00 | 0 |

All three pass this required 160-move gate. The separate Wet Mix 46.5 ms outlier was not removed from `data/v154_wet/perf.json`; its cause was not established. Browser scheduling or collection is a possibility, not a measured diagnosis. Occasional latency remains possible, especially on slower machines. Individual repeat p95 values can exceed 3 ms even when the supplied method's three-repeat p95 average passes; raw timings are included.

## Stop checks and verification

The work ran in order: **3A → 3B → 3C**. 3A passed all 14 targets, TypeScript and 347 unit tests before presets were added. 3B passed all 14 targets, the Soft distinction, TypeScript, 354 unit tests, 59 regression scripts, production build and compatibility checks before 3C began. Final checks:

| Check | Result |
|---|---|
| `npx tsc -b` | PASS |
| `npx vitest run` | 360/360 tests, 69 files PASS |
| `npm run -s test:regression` | 59/59 scripts PASS |
| `npx vite build --emptyOutDir` | PASS; source digest matches served production build |
| Supplied Smudge Bristle metrics | 14/14 PASS |
| Independent live/final, reload, seeds, alpha, controls and transforms | 64/64 checks PASS |
| Three Blender revisions + three dry v153 frozen outputs | 6/6 byte-identical, including valid saved-project reload |
| Historical old-brush goldens | 520/520 byte-identical |
| Saved v147 dry outputs | 12/12 byte-identical |
| Saved dry v1/v2 fixtures | 24/24 + 24/24 byte-identical |
| Blend 0/50/100 actual Canvas rendering | Three original-tip cases differ as expected; reload hash identical |
| Built-app UI | New controls, captured pressure/velocity, classic without new tag, mirror, paired undo/redo, project/preset reload PASS |
| Workspace layout | 12 visible tools in Draw/Animate at 1024×600, 1280×720, 1920×1080; 12 shortcuts; Edit/Animation menu access PASS |
| Tool wheel | Park, expand/collapse and drag PASS at all three sizes |
| Protected old engine / layout / frozen inputs | 15 SHA-256 guards PASS |

Live/final cases cover all three new presets at sizes 30/70/130, straight/curved paths, changing pressure, 63% opacity over transparency and a revised end taper. The maximum channel difference is 0, with 100.0% identical pixels, exceeding the ≤1 / ≥99.9% gate. Repeated renders and validated project reloads have identical hashes. Five different seeds per preset produce five distinct outputs. Zero opacity/flow, empty layers and preserved alpha also pass.

The existing build chunk-size warning remains. The UI digest check caught an obsolete local preview entry file during verification; a build into an empty output directory fixed it, and the production UI check was repeated against the matching source digest. No generated `dist` is included in the release.

## Images inspected

All comparison pixels come from the actual renderer, not generated artwork or an edited mockup:

- `blender_v154.png`: the required final montage made with `tests/blender_phase3/montage.py`.
- `blender_v154_comparison.png`: supplied classic baseline beside final Smudge Bristle, sizes 70/130 and pigment dragged over white.
- `blender_v154_presets.png`: Bristle, Soft and Wet Mix, curves and white-paper carry.
- `blender_v154_dynamics.png`: light/heavy pressure and slow/fast movement.
- `tests/blender_phase3/data/v154*`: all individual rendered cases, raw benchmark records and metrics.
- `tests/blender_phase3/ref_blender_target.jpg`: supplied visual target.

Visual inspection confirms much longer, finer continuous colour carry, a softer and less streaked Soft variant, flowing curved carry and longer pigment trails over white. This is a procedural approximation of the reference, not an exact scanned-brush match.

The input bundle did not contain its referenced `exp/h.html`; the local test harness was supplied with the actual app renderer. The independent v153 rerun reproduces **10/11 supplied output images pixel-identically**. The sine case has a maximum 4-level channel difference due to reconstructed path sampling. The original supplied baseline images/metrics and script are retained unchanged; comparison images use those originals. The separate frozen six-stroke test uses identical captured geometry before/after and passes byte-for-byte.

## Modified source files and line ranges

Ranges refer to the final v154 source. Shared changes are limited to version routing, additive metadata/validation and preset/UI plumbing; old renderer bodies and painting nib generation are untouched.

| File | Lines | Change |
|---|---|---|
| `README.md` | 1–2 | Current-release pointer and test/report location. |
| `package.json` | 4 | Version 0.5.154. |
| `src/core/brushes.ts` | 1, 4, 29–31, 60, 69, 86 | Three additive presets; sanitized reservoir controls; custom-preset restoration; retained physical-tip mix settings. |
| `src/core/buildInfo.ts` | 2 | Release 154 / renderer 40 identity. |
| `src/core/coloring.ts` | 1, 5 | Additive typed smudge controls. |
| `src/core/model.ts` | 1, 3, 19, 79, 88–89 | Typed saved fields and version/range validation for smudge and nib mixes. |
| `src/core/paintTips.ts` | 1, 25–36, 45–48 | Versioned capture metadata; valid interior nib blends; single-tip endpoints. |
| `src/core/smudge.ts` | 1–10 (new) | New defaults, bounds and explicit-version metadata gate. |
| `src/engine/paintCompositing.ts` | 1, 21 | Version-2 dispatch before the unchanged classic choice. |
| `src/engine/wetSmudge.ts` | 1–131 (new) | New travelling reservoir, pressure/speed dynamics, seeded bristles, incremental checkpoints and compositing. |
| `src/ui/BrushStudio.tsx` | 5, 17, 21–22, 35, 39–41 | Four sliders for new Blender presets, preserve Soft round nib, activate existing Mix tips handlers. |

New tests and support files:

- `tests/wet-smudge-v154.test.ts`, `tests/tip-mix-v154.test.ts`; adjusted `tests/coloring-core.test.ts` only to keep its original-five assertion scoped to the original presets.
- `tests/blender-v154-legacy.mjs`, `tests/blender-v154-properties.mjs`, `tests/blender-v154-performance.mjs`, `tests/blender-v154-tipmix.mjs`, `tests/blender-v154-ui.mjs`, `tests/blender-v154-layout.mjs`.
- `tests/regression/blender-v154.cjs` and three new frozen fixture JSON files.
- `tests/run-blender-phase3.mjs`, `exp/h.html`, `exp/h.ts`, `tests/blender_phase3/`. Supplied files are also retained in `supplied/`; environment paths, preset selection and montage labels are adapted only in the working harness copies. Acceptance thresholds are unchanged.
- `validation/v154-*`: checks, hashes, measurements and logs. Internal UI screenshots are not delivery images.

`bristleSmudge.ts`, `colorSmudge.ts`, `colorBlend.ts`, all three `dryBristle` modules, `dryTooth.ts`, `paintingTips.ts`, `App.tsx`, `styles.css`, `RadialToolbar.tsx` and `icons.tsx` retain their protected baseline bytes.

## Reproduce

Install dependencies with the project's existing package manager. Playwright Chromium must be installed for browser tests, or set `CHROMIUM_PATH` to an installed compatible executable. Python metrics require NumPy and Pillow.

```sh
npx tsc -b
npx vitest run
npm run -s test:regression
npx vite build --emptyOutDir
node tests/blender-v154-legacy.mjs
node tests/blender-v154-properties.mjs
node tests/dry-v148-goldens.mjs
node tests/dry-v153-compatibility.mjs
node tests/blender-v154-tipmix.mjs
node tests/blender-v154-ui.mjs
node tests/blender-v154-layout.mjs
```

Run timed checks alone:

```sh
BLENDER_PRESET=smudge-bristle node tests/run-blender-phase3.mjs
python3 tests/blender_phase3/blender_metrics.py tests/blender_phase3/data/v154 --check
BLENDER_PRESET=blender-soft BLENDER_TAG=v154_soft node tests/run-blender-phase3.mjs
python3 tests/blender_phase3/blender_metrics.py tests/blender_phase3/data/v154_soft
node tests/blender-v154-performance.mjs
python3 tests/blender_phase3/montage.py tests/blender_phase3/data/v154 blender_v154.png
```

The optional `--baseline` runner needs the extracted v153 sibling. Frozen compatibility checks do not need an old source tree. The supplied original test copies use their original environment-specific paths; use the working harness files above.

## Remaining limits and preservation

- Physical Wacom hardware, low-end PCs and other browsers were not available. Pressure was exercised with synthetic pen events and persisted pressure/velocity data.
- Pixel identity is guaranteed by these checks under identical rendering conditions, not across different browser canvas implementations.
- One Wet Mix benchmark spike remains recorded as described above. No universal no-lag claim is made.
- This reservoir model does not simulate drying over wall-clock time or physically subtract every picked-up pigment particle from the source layer. It gives controlled wet carry and compositing.
- The smaller fixed-band repeat scores outside the acceptance case can reflect smooth falloff, curvature and pressure, rather than independently establishing stamp repetition. Full raw metrics are retained; no additional scores are called passes.
- Prior dry-brush reference matching and maximum-size latency limitations are outside Phase 3 and were not altered.

The v153 archive is preserved (SHA-256 `de98626a4242797d4bbd95f59d4b3fb764adf0d8817bf6b646d461e8d567acf8`). The delivered ZIP contains the full v154 project, source, tests, fixtures, render comparisons and this report, without `node_modules` or `dist`. No phase after 3C was started.
