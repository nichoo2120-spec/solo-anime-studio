import { createCleanFreehandVector, buildInkPressureProfile } from './vector.js';
import { cleanInkCommands, cleanInkPathData, cleanInkLength } from './cleanInkContour.js';
import { TrailingBrush, gestureCorner } from './strokeProcessing.js';
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (x, y) => { const d = Math.hypot(x, y); return d > 1e-9 ? { x: x / d, y: y / d } : { x: 1, y: 0 }; };
/** Freeze short, completed sections. Only a bounded near-pen window is fitted
 * again. Canonical sample order, not RAF timing, determines section boundaries. */
export class StreamingVectorInk {
    style;
    span = 24;
    lookAhead = 16;
    follower;
    consumed = 0;
    source = [];
    pending = [];
    recentRaw = [];
    frozen = [];
    frozenLength = 0;
    startTangent;
    tail;
    tailLength = 0;
    tailPath;
    prefixPath;
    prefixCount = 0;
    dirty = true;
    lastRaw;
    /** Diagnostic counters measure the actual work window, without timing clocks. */
    work = { fittedSections: 0, maxFitSamples: 0, acceptedSamples: 0 };
    constructor(style) {
        this.style = style;
        this.follower = new TrailingBrush(style.stabilization / 100, Math.max(2, Math.min(12, style.width)), 8);
    }
    update(points) {
        this.source = points;
        for (; this.consumed < points.length; this.consumed++) {
            const p = points[this.consumed];
            this.lastRaw = p;
            this.work.acceptedSamples++;
            this.recentRaw.push(p);
            if (this.recentRaw.length > 7)
                this.recentRaw.shift();
            const previous = this.recentRaw.length - 2;
            if (previous >= 1 && gestureCorner(this.recentRaw, previous)) {
                const corner = this.recentRaw[previous];
                this.follower.reset(corner);
                if (this.pending.length)
                    this.pending[this.pending.length - 1] = { ...corner };
            }
            const stable = this.follower.push(p), last = this.pending.at(-1);
            if (last && distance(last, stable) < .05)
                this.pending[this.pending.length - 1] = { ...last, p: stable.p };
            else
                this.pending.push(stable);
            this.dirty = true;
            // Freeze as soon as sufficient real look-ahead exists. This runs per
            // accepted sample so event batching cannot alter saved geometry.
            this.freezeReady();
        }
    }
    section(points, endTangent) {
        this.work.fittedSections++;
        this.work.maxFitSamples = Math.max(this.work.maxFitSamples, points.length);
        return { ...createCleanFreehandVector(this.style.id, points, this.style.width, this.style.color, this.style.pressure, this.style.smoothness, { startTangent: this.startTangent, endTangent }), opacity: this.style.opacity, pressureCurve: this.style.pressureCurve, minWidthPercent: this.style.minWidthPercent, maxWidthPercent: this.style.maxWidthPercent, taperStart: this.style.taperStart, taperEnd: this.style.taperEnd, profileVersion: 6 };
    }
    freezeReady() {
        for (;;) {
            let arc = 0, cut = 0, look = 0;
            for (let i = 1; i < this.pending.length; i++) {
                arc += distance(this.pending[i - 1], this.pending[i]);
                if (!cut && arc >= this.span)
                    cut = i;
                if (cut && i >= cut + 2 && arc >= this.span + this.lookAhead) {
                    look = i;
                    break;
                }
            }
            if (!look)
                return;
            const context = this.pending.slice(0, look + 1), p = context[cut];
            let before = cut - 1, after = cut + 1;
            while (before > 0 && distance(context[before], p) < 6)
                before--;
            while (after < context.length - 1 && distance(context[after], p) < 6)
                after++;
            const a = context[before], b = context[after], incoming = unit(p.x - a.x, p.y - a.y), outgoing = unit(b.x - p.x, b.y - p.y);
            const left = distance(a, p), right = distance(p, b), smooth = unit(incoming.x * right + outgoing.x * left, incoming.y * right + outgoing.y * left);
            const corner = gestureCorner(context, cut), line = this.section(this.pending.slice(0, cut + 1), corner ? incoming : smooth), length = cleanInkLength(line);
            const stable = { ...line, taperEnd: 0, inkOffset: this.frozenLength };
            this.frozen.push({ line: stable, length, offset: this.frozenLength });
            this.frozenLength += length;
            this.startTangent = corner ? outgoing : smooth;
            this.pending = this.pending.slice(cut);
            this.dirty = true;
        }
    }
    prepareTail() {
        if (!this.dirty && this.tail)
            return;
        const points = this.pending.map(p => ({ ...p }));
        // Keep the live endpoint on the latest real contact without replaying the
        // stabilizer or moving its already settled history on every paint frame.
        if (points.length && this.lastRaw)
            points[points.length - 1] = { ...this.lastRaw };
        this.tail = this.section(points.length ? points : [this.lastRaw]);
        this.tailLength = cleanInkLength(this.tail);
        this.tailPath = undefined;
        this.dirty = false;
    }
    path(line) { return new Path2D(cleanInkPathData(line)); }
    render(ctx) {
        this.prepareTail();
        const total = this.frozenLength + this.tailLength, endSpan = (this.style.taperEnd ?? 0) * this.style.width * 4;
        ctx.save();
        ctx.globalAlpha *= this.style.opacity;
        ctx.fillStyle = this.style.color;
        if (typeof Path2D !== 'undefined') {
            this.prefixPath ??= new Path2D();
            while (this.prefixCount < this.frozen.length) {
                const section = this.frozen[this.prefixCount];
                if (section.offset + section.length > total - endSpan)
                    break;
                section.path ??= this.path(section.line);
                this.prefixPath.addPath(section.path);
                this.prefixCount++;
            }
            const path = new Path2D(this.prefixPath);
            for (let i = this.prefixCount; i < this.frozen.length; i++) {
                const section = this.frozen[i];
                path.addPath(this.path({ ...section.line, taperEnd: this.style.taperEnd, inkTotal: total }));
            }
            this.tailPath ??= this.path({ ...this.tail, inkOffset: this.frozenLength, inkTotal: total });
            path.addPath(this.tailPath);
            ctx.fill(path);
        }
        else {
            ctx.beginPath();
            const append = (commands) => { for (const c of commands) {
                if (c.op === 'M')
                    ctx.moveTo(c.p.x, c.p.y);
                else if (c.op === 'C')
                    ctx.bezierCurveTo(c.c1.x, c.c1.y, c.c2.x, c.c2.y, c.p.x, c.p.y);
                else
                    ctx.closePath();
            } };
            for (const section of this.frozen)
                append(cleanInkCommands({ ...section.line, taperEnd: this.style.taperEnd, inkTotal: total }));
            append(cleanInkCommands({ ...this.tail, inkOffset: this.frozenLength, inkTotal: total }));
            ctx.fill();
        }
        ctx.restore();
    }
    snapshot() {
        this.prepareTail();
        const nodes = [], inkSections = [];
        for (const section of [...this.frozen.map(s => s.line), this.tail]) {
            const copy = section.nodes.map(n => ({ ...n, in: { ...n.in }, out: { ...n.out } }));
            if (nodes.length) {
                nodes[nodes.length - 1].out = { ...copy[0].out };
                nodes.push(...copy.slice(1));
            }
            else
                nodes.push(...copy);
            inkSections.push({ end: nodes.length - 1, widthProfile: section.widthProfile });
        }
        return { id: this.style.id, kind: 'vector', nodes, width: this.style.width, opacity: this.style.opacity, color: this.style.color, pressure: this.style.pressure, pressureCurve: this.style.pressureCurve, smoothness: 100, profileVersion: 6, minWidthPercent: this.style.minWidthPercent, maxWidthPercent: this.style.maxWidthPercent, taperStart: this.style.taperStart, taperEnd: this.style.taperEnd, widthProfile: buildInkPressureProfile(this.source), inkSections };
    }
}
