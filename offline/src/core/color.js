export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
export function hexRgb(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
export function rgbHex(rgb) { return '#' + rgb.map(n => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0')).join(''); }
export function rgbHsv(rgb) { const [r, g, b] = rgb.map(v => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; let h = !d ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max }; }
export function hsvRgb(h, s, v) { h = (h % 360 + 360) % 360; s = clamp(s); v = clamp(v); const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return rgb.map(n => Math.round((n + m) * 255)); }
export const validHex = (s) => typeof s === 'string' && /^#[\da-f]{6}$/i.test(s);
