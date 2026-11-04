let token = 0, canvas;
self.onmessage = (event) => {
    const message = event.data;
    try {
        if (message.kind === 'begin') {
            token = message.token;
            canvas = new OffscreenCanvas(message.width, message.height);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            return;
        }
        if (message.kind === 'layer') {
            try {
                if (message.token === token && canvas) {
                    const ctx = canvas.getContext('2d');
                    ctx.globalAlpha = message.opacity;
                    ctx.globalCompositeOperation = message.blend === 'add' ? 'lighter' : message.blend && message.blend !== 'normal' ? message.blend : 'source-over';
                    ctx.drawImage(message.bitmap, 0, 0);
                }
            }
            finally {
                message.bitmap.close();
            }
            self.postMessage({ kind: 'layer', token: message.token });
            return;
        }
        if (message.token === token && canvas) {
            const width = canvas.width, height = canvas.height, bitmap = canvas.transferToImageBitmap(), levels = [{ bitmap, factor: 1 }];
            canvas = undefined;
            for (const factor of [2, 4]) {
                if (width / factor < 64 || height / factor < 64)
                    break;
                const mip = new OffscreenCanvas(Math.ceil(width / factor), Math.ceil(height / factor)), ctx = mip.getContext('2d');
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(bitmap, 0, 0, width / factor, height / factor);
                levels.push({ bitmap: mip.transferToImageBitmap(), factor });
            }
            self.postMessage({ kind: 'finish', token, levels }, levels.map(level => level.bitmap));
        }
    }
    catch (error) {
        if (message.kind === 'layer')
            message.bitmap.close();
        canvas = undefined;
        self.postMessage({ kind: 'error', token: message.token, error: String(error) });
    }
};
export {};
