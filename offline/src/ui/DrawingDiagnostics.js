import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "../../jsx-runtime.js";
import { useEffect, useRef, useState } from '../../react.js';
import { buildInfo } from '../core/buildInfo.js';
import { downloadBlob } from '../core/persistence.js';
import { diagnosticTrace, replayTrace } from '../engine/diagnosticReplay.js';
export function DrawingDiagnostics({ engine, close, notify }) {
    const [state, setState] = useState(() => engine.current?.diagnosticSnapshot()), [selected, setSelected] = useState(''), [imported, setImported] = useState(), [result, setResult] = useState(), [source, setSource] = useState([]), [running, setRunning] = useState(false), file = useRef(null), cancel = useRef(false);
    useEffect(() => { const refresh = () => setState(engine.current?.diagnosticSnapshot()); refresh(); const timer = setInterval(refresh, 250), outside = (e) => { const target = e.target; if (target.getAttribute?.('aria-label') === 'Drawing canvas')
        return; const button = target.closest?.('button'); engine.current?.diagnostics.outsideCanvas(`Pointerdown outside canvas: ${button?.getAttribute('aria-label') ?? button?.getAttribute('title') ?? target.tagName}`); }; document.addEventListener('pointerdown', outside, true); return () => { clearInterval(timer); document.removeEventListener('pointerdown', outside, true); cancel.current = true; if (!engine.current?.recorder.active) {
        engine.current?.diagnostics.stop();
        engine.current?.performance.stop();
    } }; }, [engine]);
    const trace = () => selected === 'imported' ? imported : engine.current?.diagnostics.trace(selected || undefined);
    const json = () => JSON.stringify(engine.current?.diagnostics.export(), null, 2);
    async function replay() { const t = trace(); if (!t) {
        notify('Record a completed stroke or import a diagnostic record first.');
        return;
    } cancel.current = false; setRunning(true); setResult(undefined); try {
        setSource(t.source ?? t.selection ?? []);
        setResult(await replayTrace(t, 100, () => cancel.current));
    }
    catch (e) {
        notify('Replay failed: ' + String(e));
    }
    finally {
        setRunning(false);
    } }
    const count = state?.capture ?? state?.trace?.audit, metric = (v) => v === undefined ? '—' : v.toFixed(2) + ' ms', points = result?.geometry?.points ?? [], all = [...source, ...points], minX = all.length ? Math.min(...all.map(p => p.x)) : 0, minY = all.length ? Math.min(...all.map(p => p.y)) : 0, w = all.length ? Math.max(1, Math.max(...all.map(p => p.x)) - minX) : 1, h = all.length ? Math.max(1, Math.max(...all.map(p => p.y)) - minY) : 1;
    const path = result?.geometry?.cubics.map((c, i) => `${i ? '' : `M${c.a.x} ${c.a.y}`}C${c.c1.x} ${c.c1.y} ${c.c2.x} ${c.c2.y} ${c.b.x} ${c.b.y}`).join(' ');
    return _jsxs("section", { className: "drawing-diagnostics", "aria-label": "Drawing Diagnostics", children: [_jsxs("div", { className: "diagnostic-heading", children: [_jsx("strong", { children: "DRAWING DIAGNOSTICS" }), _jsx("button", { onClick: close, "aria-label": "Close diagnostics", children: "\u00D7" })] }), _jsx("p", { className: "hint", children: "Developer tools \u00B7 local only \u00B7 hidden until opened. Use Help \u2192 Drawing Bug Recorder for recording across panels. Normal drawing records no diagnostic traces." }), _jsxs("p", { className: "diagnostic-build", children: ["Build ", buildInfo.version, " \u00B7 renderer ", buildInfo.renderer, " \u00B7 ", buildInfo.mode, _jsx("br", {}), _jsx("code", { children: buildInfo.sourceDigest })] }), _jsxs("div", { className: "studio-preset-actions", children: [_jsx("button", { onClick: () => { if (engine.current?.recorder.active) {
                            notify('The Drawing Bug Recorder session is already active.');
                            return;
                        } engine.current?.diagnostics.start({ perEventGeometry: false }); engine.current?.performance.start(); setSelected(''); setImported(undefined); setResult(undefined); }, children: "Record input" }), _jsx("button", { onClick: () => { if (engine.current?.recorder.active)
                            engine.current.recorder.stop();
                        else {
                            engine.current?.diagnostics.stop();
                            engine.current?.performance.stop();
                        } }, children: "Stop recording" })] }), _jsx("dl", { className: "diagnostic-metrics", children: Object.entries({ 'Recording': state?.enabled ? 'On' : 'Off', 'Active tool': state?.tool ?? '—', 'Active preset': state?.preset.name ?? '—', 'Preset ID': state?.preset.id ?? '—', 'Input device': state?.device ?? '—', 'Active pointer ID': state?.pointerId ?? 'none', 'Events received': count?.eventsReceived ?? 0, 'Raw accepted samples': count?.acceptedSamples ?? 0, 'Coalesced samples': count?.coalescedCandidates ?? 0, 'Redundant event records': count?.duplicateEvents ?? 0, 'Rejected samples': count?.rejectedSamples ?? 0, 'Source points': state?.rawSamples ?? 0, 'Geometry samples': state?.geometrySamples ?? 0, 'Curve segments': state?.segments ?? 0, 'Brush size': state?.brush.size ?? 0, 'Opacity': state?.brush.opacity ?? 0, 'Pressure': state?.pressure?.toFixed(3) ?? '—', 'Smoothness': state?.brush.smoothness ?? 0, 'Stabilization': Math.round((state?.brush.stabilization ?? 0) * 100) + '%', 'Live raster time': metric(state?.trace?.liveRenderMs), 'Final processing time': metric(state?.trace?.finalProcessingMs), 'Status': state?.trace?.status ?? 'No gesture', 'End reason': state?.trace?.reason ?? '—' }).map(([label, value]) => _jsxs("div", { children: [_jsx("dt", { children: label }), _jsx("dd", { "data-diagnostic": label, children: value })] }, label)) }), state?.trace?.audit && _jsxs("p", { role: "status", className: "hint", children: ["Sample audit: ", state.trace.audit.samplesLost === null ? 'inconclusive / derived or truncated record' : state.trace.audit.samplesLost ? 'MISMATCH — investigate collection/finalization' : 'all accepted samples accounted for', " \u00B7 ", state.trace.audit.geometricDuplicates, " redundant geometry samples."] }), state?.trace?.notes.map((n, i) => _jsx("p", { className: "hint", children: n }, i)), state?.outside.length ? _jsxs("details", { children: [_jsx("summary", { children: "Recent non-canvas presses" }), state.outside.map((n, i) => _jsx("p", { className: "hint", children: n }, i))] }) : null, _jsxs("label", { className: "studio-select", children: ["Recording", _jsxs("select", { "aria-label": "Diagnostic recording", value: selected, onChange: e => setSelected(e.target.value), children: [_jsx("option", { value: "", children: "Latest completed gesture" }), state?.recordings.map(r => _jsx("option", { value: r.id, children: r.label }, r.id)), imported && _jsx("option", { value: "imported", children: "Imported recording" })] })] }), _jsxs("div", { className: "studio-preset-actions", children: [_jsx("button", { onClick: () => downloadBlob(new Blob([json()], { type: 'application/json' }), 'solo-diagnostics-' + buildInfo.version + '.json'), children: "Save diagnostic JSON" }), _jsx("button", { onClick: () => { void navigator.clipboard.writeText(json()).then(() => notify('Diagnostic JSON copied.')).catch(() => notify('Clipboard unavailable. Use Save diagnostic JSON.')); }, children: "Copy diagnostic JSON" })] }), _jsx("input", { hidden: true, ref: file, type: "file", accept: ".json,application/json", "aria-label": "Import diagnostic JSON", onChange: async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f)
                    return; try {
                    if (f.size > 8 * 1024 * 1024)
                        throw Error('Diagnostic file exceeds 8 MB.');
                    const data = JSON.parse(await f.text()), t = diagnosticTrace(Array.isArray(data.traces) ? data.traces.at(-1) : data);
                    setImported(t);
                    setSelected('imported');
                    setResult(undefined);
                }
                catch (error) {
                    notify('Diagnostic import failed: ' + String(error));
                } } }), _jsx("button", { className: "full-width", onClick: () => file.current?.click(), children: "Import diagnostic JSON\u2026" }), _jsx("button", { className: "full-width accent-button", disabled: running || !(state?.recordings.length || imported), onClick: () => void replay(), children: "Replay production geometry \u00D7100" }), running && _jsx("button", { className: "full-width", onClick: () => { cancel.current = true; }, children: "Cancel replay" }), result && _jsxs(_Fragment, { children: [_jsxs("p", { className: "hint", role: "status", children: [result.completed, "/100 ", result.identical ? 'identical replays' : 'replays completed', " \u00B7 checksum ", result.checksum, " \u00B7 ", result.totalMs.toFixed(2), " ms processing. ", result.sourceSamples, " source samples. Replay does not change artwork."] }), result.audit && _jsxs("p", { className: "hint", children: ["Recorded sample accounting: ", result.audit.samplesLost === false ? 'complete' : result.audit.samplesLost === true ? 'mismatch' : 'inconclusive', "."] }), _jsxs("svg", { className: "diagnostic-preview", role: "img", "aria-label": "Raw versus replayed geometry", viewBox: `${minX - 4} ${minY - 4} ${w + 8} ${h + 8}`, children: [_jsx("polyline", { points: source.map(p => `${p.x},${p.y}`).join(' '), fill: "none", stroke: "#ec9c82", strokeWidth: Math.max(w, h) / 170, vectorEffect: "non-scaling-stroke" }), path ? _jsx("path", { d: path, fill: "none", stroke: "#55d9c4", strokeWidth: "1.5", vectorEffect: "non-scaling-stroke" }) : _jsx("polyline", { points: points.map(p => `${p.x},${p.y}`).join(' '), fill: "none", stroke: "#55d9c4", strokeWidth: "1.5", vectorEffect: "non-scaling-stroke" })] }), _jsx("p", { className: "hint", children: "Orange: available raw path \u00B7 teal: replay. Uncaptured motion cannot be inferred reliably." })] })] });
}
