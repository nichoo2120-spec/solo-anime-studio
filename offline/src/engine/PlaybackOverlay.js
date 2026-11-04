import { currentFrameIndex, frameExposureStart, frameList } from '../animation/timeline.js';
import { exposurePlan, positionAtElapsed, playbackFps } from '../animation/playback.js';
import { secondsAtExposure } from '../animation/audio.js';
import { flipVisibleLayers } from '../animation/flipbook.js';
import { LayerRenderer } from './renderer.js';
const initialView = { x: 0, y: 0, zoom: 1, rotation: 0 };
export class PlaybackOverlay {
    parent;
    onUpdate;
    onError;
    surface;
    observer;
    view = initialView;
    project;
    state = 'stopped';
    cache = new Map();
    generation = 0;
    renderedFrameId = '';
    width = 1;
    height = 1;
    dpr = 1;
    fps = 24;
    loop = true;
    exposure = 1;
    celIndex = 0;
    clockStart = 0;
    startExposure = 1;
    frameRequest = 0;
    lastUiUpdate = 0;
    renderQueue = Promise.resolve();
    disposed = false;
    maxCached;
    plan;
    planDirty = false;
    audio = null;
    lastAudioCheck = 0;
    /** Audio is strictly read-only; the waveform is cached in project metadata. */
    attachAudio(element) { this.audio?.pause(); this.audio = element; }
    pauseAudio() { this.audio?.pause(); }
    playAudioFrom(exposure) {
        const a = this.audio;
        if (!a || !this.project.audio)
            return;
        const seconds = secondsAtExposure(exposure, this.fps);
        if (seconds >= this.project.audio.duration) {
            a.pause();
            return;
        }
        try {
            a.currentTime = seconds;
        }
        catch { /* metadata may still be loading */ }
        void a.play().catch(() => this.onError('Audio preview was blocked by the browser. Click Play again to allow sound.'));
    }
    syncAudio(exposure, now) {
        const a = this.audio;
        if (!a || !this.project.audio || now - this.lastAudioCheck < 180)
            return;
        this.lastAudioCheck = now;
        const seconds = secondsAtExposure(exposure, this.fps);
        if (seconds >= this.project.audio.duration) {
            a.pause();
            return;
        }
        if (Math.abs(a.currentTime - seconds) > .12) {
            try {
                a.currentTime = seconds;
            }
            catch { /* file not ready */ }
        }
        if (a.paused && this.state === 'playing')
            void a.play().catch(() => { });
    }
    constructor(parent, project, onUpdate, onError = () => { }) {
        this.parent = parent;
        this.onUpdate = onUpdate;
        this.onError = onError;
        this.project = project;
        this.plan = exposurePlan(project);
        // ~48 MB at 1080p; bounded at smaller/larger resolutions too.
        this.maxCached = Math.max(2, Math.min(8, Math.floor(12_000_000 / (project.width * project.height))));
        this.surface = document.createElement('canvas');
        this.surface.className = 'animation-playback-overlay';
        this.surface.setAttribute('aria-hidden', 'true');
        this.parent.appendChild(this.surface);
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(this.parent);
        this.resize();
    }
    get active() { return this.state !== 'stopped'; }
    get running() { return this.state === 'playing' || this.state === 'preparing' || this.state === 'buffering'; }
    get snapshot() { return { state: this.state, exposure: this.exposure, celIndex: this.celIndex }; }
    emit(force = false) { const now = performance.now(); if (force || now - this.lastUiUpdate >= 100) {
        this.lastUiUpdate = now;
        this.onUpdate(this.snapshot);
    } }
    configure(fps, loop) {
        const next = playbackFps(fps);
        this.loop = loop;
        if (this.fps !== next && this.state === 'playing') {
            const position = positionAtElapsed(this.plan, this.startExposure, performance.now() - this.clockStart, this.fps, this.loop);
            this.startExposure = position.exposure;
            this.clockStart = performance.now();
        }
        this.fps = next;
    }
    update(project) {
        if (project === this.project)
            return;
        // A pen commit updates the Project object, but while playback is stopped
        // there is no playback cache to invalidate. Rebuilding the exposure plan and
        // clearing canvases on EVERY brush stroke caused avoidable main-thread work.
        // Keep the newest project and rebuild only when the user actually presses Play.
        if (this.state === 'stopped') {
            this.project = project;
            this.planDirty = true;
            return;
        }
        // Edits during playback or pause still stop playback immediately and safely.
        this.stop();
        this.project = project;
        this.plan = exposurePlan(project);
        this.planDirty = false;
        this.maxCached = Math.max(2, Math.min(8, Math.floor(12_000_000 / (project.width * project.height))));
        this.maxSizeChanged();
    }
    /** Refresh the finished motion-path edit without restarting from frame one.
     * Cached cels are rebuilt only on pen release; playback resumes at the same
     * exposure after the revised current cel has been rendered. */
    refreshMotionEdit(project) {
        if (this.state === 'stopped') {
            this.project = project;
            this.planDirty = true;
            return;
        }
        const wasPlaying = this.running;
        if (this.state === 'playing') {
            const position = positionAtElapsed(this.plan, this.startExposure, performance.now() - this.clockStart, this.fps, this.loop);
            this.exposure = position.exposure;
            this.celIndex = position.celIndex;
        }
        this.generation++;
        cancelAnimationFrame(this.frameRequest);
        this.pauseAudio();
        this.project = project;
        this.plan = exposurePlan(project);
        this.planDirty = false;
        this.maxSizeChanged();
        const generation = this.generation, frame = frameList(this.project)[this.celIndex];
        if (!frame) {
            this.stop();
            return;
        }
        this.state = 'buffering';
        this.emit(true);
        void this.ensure(frame, generation).then(ok => {
            if (!ok || this.disposed || generation !== this.generation)
                return;
            this.paint();
            if (wasPlaying) {
                this.state = 'playing';
                this.startExposure = this.exposure;
                this.clockStart = performance.now();
                this.playAudioFrom(this.exposure);
                this.prefetch(generation);
                this.frameRequest = requestAnimationFrame(this.tick);
            }
            else
                this.state = 'paused';
            this.emit(true);
        });
    }
    maxSizeChanged() { for (const entry of this.cache.values())
        entry.picture.width = 0; this.cache.clear(); this.renderedFrameId = ''; }
    setView(view) { this.view = view; if (this.active)
        this.paint(); }
    resize() {
        if (this.disposed)
            return;
        const rect = this.parent.getBoundingClientRect();
        const width = Math.max(1, rect.width), height = Math.max(1, rect.height), dpr = window.devicePixelRatio || 1;
        if (width === this.width && height === this.height && dpr === this.dpr)
            return;
        this.width = width;
        this.height = height;
        this.dpr = dpr;
        this.surface.width = Math.max(1, Math.round(width * dpr));
        this.surface.height = Math.max(1, Math.round(height * dpr));
        if (this.active)
            this.paint();
    }
    async play() {
        if (this.disposed || this.running)
            return;
        if (this.planDirty) {
            this.plan = exposurePlan(this.project);
            this.maxCached = Math.max(2, Math.min(8, Math.floor(12_000_000 / (this.project.width * this.project.height))));
            this.planDirty = false;
        }
        const continuing = this.state === 'paused';
        if (!continuing) {
            this.exposure = frameExposureStart(this.project, currentFrameIndex(this.project));
            this.celIndex = currentFrameIndex(this.project);
        }
        this.startExposure = this.exposure;
        this.state = 'preparing';
        this.generation++;
        const generation = this.generation;
        this.emit(true);
        const frame = frameList(this.project)[this.celIndex];
        if (!await this.ensure(frame, generation) || generation !== this.generation || this.state !== 'preparing') {
            if (generation === this.generation && this.state === 'preparing')
                this.stop();
            return;
        }
        // Warm a few nearby cels before starting the animation clock. The cache is
        // memory-limited, so large canvases prepare fewer cels.
        const frames = frameList(this.project), warm = Math.min(this.maxCached, frames.length, 3);
        for (let n = 1; n < warm; n++) {
            const index = this.celIndex + n;
            if (index >= frames.length && !this.loop)
                break;
            if (!await this.ensure(frames[index % frames.length], generation) || generation !== this.generation || this.state !== 'preparing') {
                if (generation === this.generation && this.state === 'preparing')
                    this.stop();
                return;
            }
        }
        this.state = 'playing';
        this.clockStart = performance.now();
        this.playAudioFrom(this.exposure);
        this.paint();
        this.emit(true);
        this.prefetch(generation);
        this.frameRequest = requestAnimationFrame(this.tick);
    }
    pause() {
        if (!this.running)
            return;
        if (this.state === 'playing') {
            const pos = positionAtElapsed(this.plan, this.startExposure, performance.now() - this.clockStart, this.fps, this.loop);
            this.exposure = pos.exposure;
            this.celIndex = pos.celIndex;
        }
        cancelAnimationFrame(this.frameRequest);
        this.generation++;
        this.state = 'paused';
        this.pauseAudio();
        this.paint();
        this.emit(true);
    }
    stop() {
        if (this.state === 'stopped')
            return;
        this.generation++;
        cancelAnimationFrame(this.frameRequest);
        this.state = 'stopped';
        this.pauseAudio();
        this.clear();
        this.maxSizeChanged();
        this.emit(true);
    }
    tick = (now) => {
        if (this.disposed || this.state !== 'playing')
            return;
        const position = positionAtElapsed(this.plan, this.startExposure, now - this.clockStart, this.fps, this.loop);
        if (position.exposure !== this.exposure || position.celIndex !== this.celIndex) {
            this.exposure = position.exposure;
            this.celIndex = position.celIndex;
            const frame = frameList(this.project)[this.celIndex];
            if (!this.cache.has(frame.id)) {
                this.state = 'buffering';
                this.pauseAudio();
                const generation = this.generation, start = performance.now();
                this.emit(true);
                void this.ensure(frame, generation).then(ok => {
                    if (!ok || this.disposed || generation !== this.generation || this.state !== 'buffering')
                        return;
                    // The playback clock pauses while an unprepared cel is rasterized.
                    this.clockStart += performance.now() - start;
                    this.state = 'playing';
                    this.playAudioFrom(this.exposure);
                    this.paint();
                    this.emit(true);
                    this.prefetch(generation);
                    this.frameRequest = requestAnimationFrame(this.tick);
                });
                return;
            }
            this.paint();
            this.emit();
            this.prefetch(this.generation);
        }
        this.syncAudio(position.exposure, now);
        if (position.ended) {
            this.pause();
            return;
        }
        this.frameRequest = requestAnimationFrame(this.tick);
    };
    async ensure(frame, generation) {
        const existing = this.cache.get(frame.id);
        if (existing?.frame === frame) {
            this.cache.delete(frame.id);
            this.cache.set(frame.id, existing);
            return true;
        }
        const job = async () => {
            if (this.disposed || generation !== this.generation)
                return false;
            if (this.cache.get(frame.id)?.frame === frame)
                return true;
            // Yield so clicking Pause/Stop remains responsive during preparation.
            await new Promise(resolve => setTimeout(resolve, 0));
            if (this.disposed || generation !== this.generation)
                return false;
            const renderer = new LayerRenderer();
            try {
                const snapshot = flipVisibleLayers(this.project, frame);
                await renderer.prepare(snapshot);
                if (this.disposed || generation !== this.generation)
                    return false;
                const picture = renderer.composite(snapshot, { transparent: true, includeReferences: false });
                if (this.disposed || generation !== this.generation) {
                    picture.width = 0;
                    return false;
                }
                const previous = this.cache.get(frame.id);
                if (previous)
                    previous.picture.width = 0;
                this.cache.delete(frame.id);
                this.cache.set(frame.id, { frame, picture });
                while (this.cache.size > this.maxCached) {
                    const [oldId, entry] = this.cache.entries().next().value;
                    if (oldId === frame.id)
                        break;
                    this.cache.delete(oldId);
                    entry.picture.width = 0;
                }
                return true;
            }
            catch (error) {
                console.warn('Animation playback frame could not be rendered:', error);
                this.onError('Could not preview an animation frame. Your drawings have not changed.');
                return false;
            }
            finally {
                renderer.clear();
            }
        };
        const promise = this.renderQueue.then(job, job);
        this.renderQueue = promise.then(() => { }, () => { });
        return promise;
    }
    prefetch(generation) {
        if (this.disposed || generation !== this.generation || this.state !== 'playing')
            return;
        const frames = frameList(this.project), i = (this.celIndex + 1) % frames.length, frame = frames[i];
        if (frames.length <= 1 || !this.loop && this.celIndex === frames.length - 1 || this.cache.get(frame.id)?.frame === frame)
            return;
        // Prepare only one future cel at a time, then wait until the next cel is shown.
        // Avoid precomputing 240 full-size pictures and exhausting the artist's RAM.
        void this.ensure(frame, generation);
    }
    clear() { const ctx = this.surface.getContext('2d'); if (!ctx)
        return; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.surface.width, this.surface.height); }
    paint() {
        if (!this.active)
            return;
        const frame = frameList(this.project)[this.celIndex], cached = this.cache.get(frame.id);
        if (!cached || cached.frame !== frame)
            return; // Leave the previous image visible while buffering.
        const ctx = this.surface.getContext('2d');
        if (!ctx)
            return;
        this.clear();
        ctx.save();
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.translate(this.view.x, this.view.y);
        ctx.rotate(this.view.rotation);
        ctx.scale(this.view.zoom, this.view.zoom);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, this.project.width, this.project.height);
        ctx.beginPath();
        ctx.rect(0, 0, this.project.width, this.project.height);
        ctx.clip();
        ctx.drawImage(cached.picture, 0, 0);
        ctx.restore();
        this.renderedFrameId = frame.id;
    }
    dispose() { this.stop(); this.disposed = true; this.observer.disconnect(); this.surface.remove(); }
}
