import { buildInfo } from '../core/buildInfo.js';
import { finalGeometry } from './geometryCache.js';
export const eventRecord = (e) => ({ type: e.type, pointerId: e.pointerId, pointerType: e.pointerType, timeStamp: e.timeStamp, clientX: e.clientX, clientY: e.clientY, pressure: e.pressure, buttons: e.buttons, button: e.button, tiltX: e.tiltX, tiltY: e.tiltY });
/** Opt-in and bounded. Panel recording fits geometry per frame; exhaustive
 * console recording remains available for intermediate-tip regression traces. */
export class StrokeDiagnostics {
    enabled = false;
    perEventGeometry = true;
    active;
    traces = [];
    samples = 0;
    outside = [];
    begin(gestureId, tool, view, rect, settings, event, preset) { if (!this.enabled)
        return; this.active = { gestureId, tool, build: { ...buildInfo }, preset: preset && { ...preset }, device: event.pointerType, pointerId: event.pointerId, view: { ...view }, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, settings: structuredClone(settings), events: [], status: 'collecting', notes: [] }; this.samples = 0; this.record(event, [event], false); }
    record(event, candidates, replay) { if (!this.active)
        return; const remaining = 4096 - this.samples; if (remaining <= 0) {
        this.active.truncated = true;
        return;
    } const samples = candidates.slice(0, remaining).map(eventRecord); this.samples += samples.length; this.active.events.push({ dispatch: eventRecord(event), samples, replay }); if (samples.length < candidates.length)
        this.active.truncated = true; }
    observeLive(point) { const event = this.active?.events.at(-1); if (event && point)
        event.liveTip = { ...point }; }
    note(text) { if (this.active && this.active.notes.length < 12)
        this.active.notes.push(text); }
    outsideCanvas(target) { if (!this.enabled)
        return; this.outside.push(target); if (this.outside.length > 8)
        this.outside.shift(); }
    timing(kind, ms) { if (this.active)
        this.active[kind] = ms; }
    finish(reason, stroke, selection, extra) { if (!this.active)
        return; const trace = this.active; this.active = undefined; trace.reason = reason; trace.status = reason === 'discarded' ? 'cancelled' : stroke ? 'pending commit' : selection && selection.length >= 3 ? 'selection ready' : 'no artwork'; if (stroke) {
        trace.settings = structuredClone({ ...stroke, points: undefined });
        trace.source = structuredClone(stroke.points.slice(0, 20000));
        if (stroke.points.length <= 20000)
            trace.geometry = structuredClone(finalGeometry(stroke));
        else
            trace.truncated = true;
    } if (selection)
        trace.selection = structuredClone(selection.slice(0, 20000)); if (extra) {
        trace.audit = { ...extra.audit };
        trace.captured = extra.captured;
        if (trace.captured.length < trace.audit.acceptedSamples)
            trace.truncated = true;
        if (trace.truncated)
            trace.audit.samplesLost = null;
    } if ((trace.source?.length ?? trace.selection?.length ?? 0) < 3)
        trace.notes.push('Fewer than three project samples: an unobserved curve cannot be reconstructed.'); this.traces.push(trace); while (this.traces.length > 20 || this.traces.reduce((n, t) => n + (t.source?.length ?? t.selection?.length ?? 0), 0) > 100000)
        this.traces.shift(); }
    committed(id, accepted) { const t = this.traces.find(t => t.gestureId === id); if (t)
        t.status = accepted ? 'committed' : 'cancelled: target changed'; }
    summary() { const t = this.active ?? this.traces.at(-1); return { enabled: this.enabled, active: !!this.active, trace: t ? { gestureId: t.gestureId, preset: t.preset, tool: t.tool, device: t.device, pointerId: t.pointerId, status: t.status, reason: t.reason, audit: t.audit, sourceSamples: t.source?.length ?? t.selection?.length, geometrySamples: t.geometry?.points.length, segments: t.geometry?.cubics.length, liveRenderMs: t.liveRenderMs, finalProcessingMs: t.finalProcessingMs, notes: [...t.notes], truncated: t.truncated } : null, outside: [...this.outside], recordings: this.traces.map(t => ({ id: t.gestureId, label: `${t.tool} · ${t.preset?.name ?? t.device} · ${t.status}` })) }; }
    start(options) { this.clear(); this.enabled = true; this.perEventGeometry = options?.perEventGeometry ?? true; }
    resume() { this.enabled = true; this.perEventGeometry = false; }
    stop() { this.enabled = false; if (this.active) {
        this.active.truncated = true;
        this.finish('recording stopped');
    } }
    clear() { this.traces = []; this.active = undefined; this.outside = []; }
    trace(id) { const t = id ? this.traces.find(t => t.gestureId === id) : this.traces.at(-1); return t && structuredClone(t); }
    export() { return structuredClone({ version: 2, build: buildInfo, traces: this.traces, active: this.active }); }
}
