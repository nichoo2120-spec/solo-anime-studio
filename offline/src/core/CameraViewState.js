/** Camera readouts subscribe independently of the large drawing/timeline UI.
 * The engine remains authoritative; this store never edits artwork or history. */
export class CameraViewState {
    value = Object.freeze({ x: 0, y: 0, zoom: 1, rotation: 0 });
    listeners = new Set();
    getSnapshot = () => this.value;
    subscribe = (listener) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    publish(view) { if (view.x === this.value.x && view.y === this.value.y && view.zoom === this.value.zoom && view.rotation === this.value.rotation)
        return; this.value = Object.freeze({ ...view }); for (const listener of this.listeners)
        listener(); }
}
