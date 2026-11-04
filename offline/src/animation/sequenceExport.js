import { frameHold, frameList } from './timeline.js';
import { LayerRenderer } from '../engine/renderer.js';
export function sequencePlan(project, uniqueCels = false) {
    const result = [];
    frameList(project).forEach((frame, index) => {
        const count = uniqueCels ? 1 : frameHold(frame);
        for (let n = 0; n < count; n++)
            result.push({ number: result.length + 1, frameId: frame.id, celIndex: index });
    });
    return result;
}
export function sequenceFrameName(index, total) { return `frame_${String(index).padStart(Math.max(4, String(total).length), '0')}.png`; }
export function sequenceSnapshot(project, celIndex) {
    const frame = frameList(project)[celIndex];
    if (!frame)
        throw Error('Missing animation drawing.');
    return { ...project, animation: undefined, layers: project.layers.map(layer => ({ ...layer, operations: frame.drawings[layer.id] ?? [] })) };
}
const encoder = new TextEncoder();
const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++)
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
}
export function crc32(data) { let c = 0xffffffff; for (const byte of data)
    c = table[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
/** Valid PKZIP store-mode archive, CRC-checked, browser-native. */
export function zipStore(entries, byteLimit = 512 * 1024 * 1024) {
    let offset = 0;
    const chunks = [], central = [];
    for (const { name, bytes } of entries) {
        const filename = encoder.encode(name);
        if (!filename.length || filename.length > 65535 || bytes.length > 0xffffffff)
            throw Error('Invalid archive entry.');
        const crc = crc32(bytes), local = new Uint8Array(30 + filename.length), d = new DataView(local.buffer);
        d.setUint32(0, 0x04034b50, true);
        d.setUint16(4, 20, true);
        d.setUint16(6, 0x0800, true);
        d.setUint16(8, 0, true);
        d.setUint32(14, crc, true);
        d.setUint32(18, bytes.length, true);
        d.setUint32(22, bytes.length, true);
        d.setUint16(26, filename.length, true);
        local.set(filename, 30);
        const c = new Uint8Array(46 + filename.length), v = new DataView(c.buffer);
        v.setUint32(0, 0x02014b50, true);
        v.setUint16(4, 20, true);
        v.setUint16(6, 20, true);
        v.setUint16(8, 0x0800, true);
        v.setUint16(10, 0, true);
        v.setUint32(16, crc, true);
        v.setUint32(20, bytes.length, true);
        v.setUint32(24, bytes.length, true);
        v.setUint16(28, filename.length, true);
        v.setUint32(42, offset, true);
        c.set(filename, 46);
        central.push(c);
        chunks.push(local, bytes.slice());
        offset += local.length + bytes.length;
        if (offset > byteLimit)
            throw Error('PNG sequence exceeds the 512 MB ZIP limit. Try smaller dimensions or unique cels.');
    }
    const centralOffset = offset;
    for (const entry of central) {
        chunks.push(new Uint8Array(entry));
        offset += entry.length;
    }
    if (entries.length > 65535 || offset > 0xffffffff)
        throw Error('ZIP archive size exceeds the standard ZIP limit.');
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, entries.length, true);
    e.setUint16(10, entries.length, true);
    e.setUint32(12, offset - centralOffset, true);
    e.setUint32(16, centralOffset, true);
    chunks.push(end);
    return new Blob(chunks, { type: 'application/zip' });
}
function canvasPng(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(async (blob) => {
        if (!blob) {
            reject(Error('The browser could not encode an animation frame.'));
            return;
        }
        try {
            resolve(new Uint8Array(await blob.arrayBuffer()));
        }
        catch (error) {
            reject(error);
        }
    }, 'image/png'));
}
export async function renderSequenceZip(project, settings, onProgress = () => { }, signal) {
    const plan = sequencePlan(project, settings.uniqueCels), frames = frameList(project), renderer = new LayerRenderer(), entries = [], cache = new Map();
    const width = settings.width ?? project.width, height = settings.height ?? project.height;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 16777216)
        throw Error('Invalid sequence export resolution.');
    if (plan.length > 2000)
        throw Error('A sequence may have at most 2,000 exported frames. Shorten the range or export unique cels.');
    try {
        for (let i = 0; i < plan.length; i++) {
            if (signal?.aborted)
                throw new DOMException('Export canceled.', 'AbortError');
            const item = plan[i], frame = frames[item.celIndex];
            const camera = !!settings.throughCamera && !settings.uniqueCels && !!project.camera?.enabled && !!project.camera.keys.length, cacheKey = camera ? frame.id + '@' + item.number : frame.id;
            let png = cache.get(cacheKey);
            if (!png) {
                const snapshot = sequenceSnapshot(project, item.celIndex);
                await renderer.prepare(snapshot);
                png = await canvasPng(camera ? renderer.compositeCamera(snapshot, item.number, settings) : renderer.composite(snapshot, settings));
                if (!camera)
                    cache.set(cacheKey, png);
            }
            entries.push({ name: sequenceFrameName(item.number, plan.length), bytes: png });
            onProgress({ finished: i + 1, total: plan.length, phase: 'Rendering sequence' });
            // Let the browser update progress and handle cancellation between frames.
            if (i % 4 === 3)
                await new Promise(resolve => setTimeout(resolve, 0));
        }
        if (signal?.aborted)
            throw new DOMException('Export canceled.', 'AbortError');
        const manifest = `Solo Anime Studio PNG Sequence\nScene: ${project.name}\nFPS: ${settings.fps}\nResolution: ${width}x${height}\nFrames: ${plan.length}\nMode: ${settings.uniqueCels ? 'unique drawings' : 'full exposures (including holds)'}\nBackground: ${settings.transparent ? 'transparent' : 'opaque white'}\nCamera: ${settings.throughCamera && project.camera?.enabled && project.camera.keys.length ? 'scene camera (' + project.camera.keys.length + ' keys)' : 'off (full page)'}\nFrame number starts at 1.\n`;
        entries.push({ name: 'sequence-info.txt', bytes: encoder.encode(manifest) });
        onProgress({ finished: plan.length, total: plan.length, phase: 'Packing ZIP' });
        return zipStore(entries);
    }
    finally {
        renderer.clear();
        cache.clear();
    }
}
