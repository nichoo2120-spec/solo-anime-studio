/** The coalesced list is chronological. Some providers omit the dispatch sample.
 * Keep its order and append the terminal sample, never replace a buffered tail. */
export function pointerBatch(event, includeTerminal = true, observe) {
    let samples = [];
    try {
        samples = event.getCoalescedEvents?.() ?? [];
    }
    catch { /* Some synthetic/older providers expose an unusable method. */ }
    observe?.(samples.length);
    if (!includeTerminal)
        return samples;
    const last = samples.at(-1);
    return last && last.pointerId === event.pointerId && last.clientX === event.clientX && last.clientY === event.clientY && last.pressure === event.pressure ? samples : [...samples, event];
}
export function appendPath(points, point, minDistance = 0) { const last = points.at(-1); if (!last || Math.hypot(point.x - last.x, point.y - last.y) > minDistance || point.p !== last.p)
    points.push(point); }
/** One ordered, deduplicated capture stream for brush and selection. Coordinates
 * remain raw here; brush fitting never changes the lasso boundary. */
export class PointerPath {
    id;
    started;
    first;
    gestureId;
    seen = new Set();
    samples = [];
    replaying = false;
    received = 1;
    coalesced = 0;
    duplicates = 0;
    rejected = 0;
    get count() { return this.samples.length; }
    get stats() { return { eventsReceived: this.received, coalescedCandidates: this.coalesced, acceptedSamples: this.count, duplicateEvents: this.duplicates, rejectedSamples: this.rejected }; }
    records(limit = 4096) { return this.samples.slice(0, limit).map(e => ({ type: e.type, pointerId: e.pointerId, pointerType: e.pointerType, timeStamp: e.timeStamp, clientX: e.clientX, clientY: e.clientY, pressure: e.pressure, buttons: e.buttons, button: e.button })); }
    onBatch;
    constructor(id, started, first, gestureId = '') {
        this.id = id;
        this.started = started;
        this.first = first;
        this.gestureId = gestureId;
        this.accept(first);
        this.samples.push(first);
    }
    accept(e) { const key = [e.timeStamp, e.clientX, e.clientY, e.pressure].join(':'); if (this.seen.has(key))
        return false; this.seen.add(key); return true; }
    batch(e, terminal = true) {
        this.received++;
        const candidates = pointerBatch(e, terminal, n => { this.coalesced += n; }), added = candidates.filter(s => { const valid = s.pointerId === this.id && Number.isFinite(s.clientX) && Number.isFinite(s.clientY) && s.timeStamp >= this.started; if (!valid)
            this.rejected++; return valid; }).filter(s => { const valid = this.accept(s); if (!valid)
            this.duplicates++; return valid; }).sort((a, b) => a.timeStamp - b.timeStamp);
        this.replaying = !!added.length && added[0].timeStamp < this.samples.at(-1).timeStamp;
        this.samples.push(...added);
        this.onBatch?.(e, candidates, this.replaying);
        // Normal dispatch appends in O(batch size). Unusual overlapping/out-of-order
        // provider batches replay only this gesture in chronological order.
        if (this.replaying) {
            this.samples.sort((a, b) => a.timeStamp - b.timeStamp);
            return this.samples.slice(1);
        }
        return added;
    }
}
