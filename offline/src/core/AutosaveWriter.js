import { repository, compactProjectAudio } from './persistence.js';
/** Immutable snapshots cross once; validation, IDB cloning and retention stay off the UI thread. */
export class AutosaveWriter {
    worker;
    serial = 0;
    pending = new Map();
    fail(error) { for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(error);
    } this.pending.clear(); this.worker?.terminate(); this.worker = undefined; }
    async save(project) {
        // On import/save once, put the large asset in IDB; send ONLY metadata to autosave worker.
        await repository.ensureAudioAsset(project);
        const compact = compactProjectAudio(project);
        return new Promise((resolve, reject) => {
            try {
                if (!this.worker) {
                    this.worker = new Worker(new URL('./autosave.worker.js', import.meta.url), { type: 'module' });
                    this.worker.onmessage = e => { const pending = this.pending.get(e.data.requestId); if (!pending)
                        return; this.pending.delete(e.data.requestId); clearTimeout(pending.timer); if (e.data.error)
                        pending.reject(Error(e.data.error));
                    else
                        pending.resolve({ id: pending.project.id, project: pending.project, kind: 'autosave', savedAt: e.data.savedAt }); };
                    this.worker.onerror = () => this.fail(Error('Autosave worker failed. The previous saved project remains available.'));
                }
                const requestId = ++this.serial;
                // A stalled IndexedDB upgrade/worker previously left the UI on 'Saving…'
                // indefinitely, and prevented subsequent autosave attempts. Fail visibly.
                const timer = setTimeout(() => { if (this.pending.has(requestId))
                    this.fail(Error('Autosave timed out. Close other Studio tabs, then retry saving.')); }, 30000);
                this.pending.set(requestId, { project, resolve, reject, timer });
                this.worker.postMessage({ requestId, project: compact });
            }
            catch (e) {
                this.fail(Error('Autosave could not start: ' + String(e)));
                reject(e);
            }
        });
    }
    dispose() { this.fail(Error('Studio closed before autosave completed.')); }
}
