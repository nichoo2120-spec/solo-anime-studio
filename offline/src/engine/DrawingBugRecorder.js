import { buildInfo } from '../core/buildInfo.js';
/** Engine-owned session. UI subscriptions only fire for explicit session actions,
 * never pointer samples. Data stays bounded and local until explicit export. */
export class DrawingBugRecorder {
    diagnostics;
    performance;
    captureError = (e) => this.event('runtime-error', { message: e.message, filename: e.filename, line: e.lineno, column: e.colno, stack: e.error?.stack });
    captureRejection = (e) => this.event('unhandled-rejection', { reason: String(e.reason), stack: e.reason?.stack });
    session = { id: '', state: 'idle', startedAt: '' };
    listeners = new Set();
    events = [];
    omitted = 0;
    exported = true;
    constructor(diagnostics, performance) {
        this.diagnostics = diagnostics;
        this.performance = performance;
    }
    getSnapshot = () => this.session;
    subscribe = (listener) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    publish(patch) { this.session = { ...this.session, ...patch }; this.listeners.forEach(f => f()); }
    get active() { return this.session.state === 'recording' || this.session.state === 'paused'; }
    get recording() { return this.session.state === 'recording'; }
    get warnOnClose() { return this.active || !this.exported && this.session.state !== 'idle'; }
    start() { if (this.active)
        return; window.addEventListener('error', this.captureError); window.addEventListener('unhandledrejection', this.captureRejection); this.events = []; this.omitted = 0; this.exported = false; this.diagnostics.start({ perEventGeometry: false }); this.performance.start(); this.publish({ id: crypto.randomUUID(), state: 'recording', startedAt: new Date().toISOString(), stoppedAt: undefined }); this.event('recording-start', { build: buildInfo }); }
    pause() { if (!this.recording)
        return; this.event('recording-pause', {}); this.diagnostics.stop(); this.performance.stop(); this.publish({ state: 'paused' }); }
    resume() { if (this.session.state !== 'paused')
        return; this.diagnostics.resume(); this.performance.enabled = true; this.publish({ state: 'recording' }); this.event('recording-resume', {}); }
    stop() { if (!this.active)
        return; window.removeEventListener('error', this.captureError); window.removeEventListener('unhandledrejection', this.captureRejection); this.append('recording-stop', { from: this.session.state }); this.diagnostics.stop(); this.performance.stop(); this.exported = false; this.publish({ state: 'stopped', stoppedAt: new Date().toISOString() }); }
    append(type, data) { this.events.push({ at: performance.now(), type, data }); if (this.events.length > 1000) {
        this.events.shift();
        this.omitted++;
    } this.exported = false; }
    event(type, data) { if (this.recording)
        this.append(type, data); }
    summary() { return { events: this.events.length, omitted: this.omitted, recordings: this.diagnostics.summary().recordings.length }; }
    export() { return { ...this.diagnostics.export(), version: 3, build: buildInfo, timeOrigin: performance.timeOrigin, session: { ...this.session }, events: structuredClone(this.events), omittedEvents: this.omitted, recorderFormat: 1, performance: this.performance.export() }; }
    saved() { this.exported = true; }
}
