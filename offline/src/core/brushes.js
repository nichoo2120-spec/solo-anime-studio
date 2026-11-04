import { smudgeMetadata, smudgeLimits } from './smudge.js';
import { dryControlLimits } from './dryBrush.js';
import { isColoringTip, isColorNib, coloringNibs, defaultColorNib } from './coloring.js';
import { isPaintTip, isWatercolorTip, isMixTip, canMixTips } from './paintTips.js';
import { linearPressure } from '../engine/strokeGeometry.js';
const common = { size: 4, opacity: .85, color: '#30343a', stabilization: .25, smoothness: 25, pressure: true, pressureWidth: true, pressureOpacity: false, response: 1, pressureCurve: linearPressure, taperStart: 0, taperEnd: 0, tolerance: 24, textureStrength: .12 };
function preset(id, name, category, patch, family) { const defaults = { ...common, brushKind: id, ...patch }; return { id, name, category, family, defaults, settings: { ...defaults } }; }
/** Retired library entry; its renderer and custom saved variants stay supported. */
export const legacyAirbrushPreset = preset('airbrush', 'Airbrush', 'Paint', { brushTip: 'soft-round', tipAngle: 0, tipSpacing: .08, flow: .08, hardness: 0, pressureFlow: true, size: 65, opacity: .3, textureStrength: 0, pressureOpacity: true, pressureWidth: false }, 'media');
export const retiredBlendPresetIds = ['color-blender', 'smudge-bristle', 'blender-soft', 'wet-mix'];
export const isRetiredBlendPresetId = (id) => retiredBlendPresetIds.includes(id);
export const stockPresets = [
    preset('hb', 'HB Pencil', 'Pencil', { brushKind: 'graphite-hb', opacity: .78, size: 4, textureStrength: .66, pressureOpacity: true }),
    preset('2b', '2B Pencil', 'Pencil', { brushKind: 'graphite-2b', size: 6, opacity: .76, textureStrength: .82, response: .85, pressureOpacity: true }),
    preset('mechanical', 'Mechanical Pencil', 'Pencil', { brushKind: 'graphite-mechanical', size: 2, opacity: .9, textureStrength: .4, stabilization: .15, pressureOpacity: true }),
    preset('blue', 'Blue Animation Pencil', 'Pencil', { brushKind: 'graphite-blue', color: '#649bd1', size: 4, opacity: .68, textureStrength: .62, pressureOpacity: true }),
    preset('g-pen', 'G-Pen', 'Ink', { size: 7, opacity: 1, response: .7, taperStart: .025, taperEnd: .09, textureStrength: 0 }),
    preset('mapping', 'Mapping Pen', 'Ink', { size: 4, opacity: 1, response: 1.6, taperStart: .04, taperEnd: .13, textureStrength: 0 }),
    preset('technical', 'Technical Pen', 'Ink', { size: 4, opacity: 1, pressureWidth: false, textureStrength: 0, smoothness: 40 }),
    preset('brush-pen', 'Brush Pen', 'Ink', { size: 14, opacity: 1, response: .65, taperStart: .06, taperEnd: .15, textureStrength: 0 }),
    preset('color-solid', 'Solid Paint', 'Paint', { brushKind: 'coloring-solid', brushTip: 'color-solid', coloringEngine: 1, colorNib: 'chisel', colorNibFollow: false, tipAngle: -25, size: 45, opacity: 1, flow: 1, hardness: 1, pressureFlow: false, pressureWidth: true, minSize: .08, textureStrength: 0, stabilization: .08, smoothness: 18 }, 'coloring'),
    preset('color-soft', 'Soft Paint', 'Paint', { brushKind: 'coloring-soft', brushTip: 'color-soft', coloringEngine: 1, colorNib: 'filbert', colorNibFollow: false, tipAngle: -20, size: 65, opacity: 1, flow: .8, hardness: .4, pressureFlow: true, pressureWidth: true, minSize: .15, textureStrength: 0, stabilization: .08, smoothness: 18 }, 'coloring'),
    preset('color-air', 'Airbrush', 'Paint', { brushKind: 'coloring-air', brushTip: 'color-air', coloringEngine: 1, colorNib: 'oval', colorNibFollow: false, tipAngle: -15, size: 90, opacity: 1, flow: .55, hardness: 0, pressureFlow: true, pressureWidth: true, minSize: .25, textureStrength: 0, stabilization: .06, smoothness: 18 }, 'coloring'),
    preset('color-texture', 'Textured Paint', 'Paint', { brushKind: 'coloring-texture', brushTip: 'color-texture', coloringEngine: 1, coloringAppearanceVersion: 3, colorNib: 'bristle', colorNibFollow: true, tipAngle: 0, size: 60, opacity: 1, flow: .95, hardness: .85, pressureFlow: false, pressureWidth: true, minSize: .1, textureStrength: .7, stabilization: .08, smoothness: 18 }, 'coloring'),
    preset('color-blender', 'Blender', 'Paint', { brushKind: 'coloring-blender', brushTip: 'color-blender', coloringEngine: 1, coloringAppearanceVersion: 3, smudgeVersion: 3, blendPreserveAlpha: true, colorNib: 'round', colorNibFollow: true, tipAngle: 0, size: 60, opacity: .75, flow: .75, hardness: .25, pressureFlow: false, pressureWidth: true, minSize: .2, textureStrength: 0, mixColors: false, mixAmount: .44, pickupLen: .9, holdLen: .5, smearStreak: 0, useSelectedColour: 0, stabilization: .08, smoothness: 18 }, 'coloring'),
    preset('smudge-bristle', 'Smudge Bristle', 'Paint', { brushKind: 'coloring-blender', brushTip: 'color-blender', coloringEngine: 1, coloringAppearanceVersion: 3, smudgeVersion: 2, blendPreserveAlpha: false, colorNib: 'bristle', colorNibFollow: true, tipAngle: 0, size: 60, opacity: 1, flow: .85, hardness: .8, pressureFlow: false, pressureWidth: true, minSize: .2, textureStrength: .55, mixColors: false, mixAmount: .75, pickupLen: .9, holdLen: 3.5, smearStreak: .5, useSelectedColour: 0, stabilization: .08, smoothness: 18 }, 'coloring'),
    preset('blender-soft', 'Blender Soft', 'Paint', { brushKind: 'coloring-blender', brushTip: 'color-blender', coloringEngine: 1, coloringAppearanceVersion: 3, smudgeVersion: 2, blendPreserveAlpha: false, colorNib: 'round', colorNibFollow: true, tipAngle: 0, size: 65, opacity: 1, flow: .8, hardness: .2, pressureFlow: false, pressureWidth: true, minSize: .2, textureStrength: .15, mixColors: false, mixAmount: .85, pickupLen: .9, holdLen: 4.5, smearStreak: .15, useSelectedColour: 0, stabilization: .08, smoothness: 18 }, 'coloring'),
    preset('wet-mix', 'Wet Mix', 'Paint', { brushKind: 'coloring-blender', brushTip: 'color-blender', coloringEngine: 1, coloringAppearanceVersion: 3, smudgeVersion: 2, blendPreserveAlpha: false, colorNib: 'bristle', colorNibFollow: true, tipAngle: 0, size: 60, opacity: 1, flow: .85, hardness: .8, pressureFlow: false, pressureWidth: true, minSize: .2, textureStrength: .55, mixColors: false, mixAmount: .75, pickupLen: .9, holdLen: 3.5, smearStreak: .5, useSelectedColour: .25, stabilization: .08, smoothness: 18 }, 'coloring'),
    preset('soft-paint', 'Soft Paint', 'Paint', { brushKind: 'paint', brushTip: 'soft-round', tipAngle: 0, tipSpacing: .06, size: 65, opacity: 1, flow: .18, hardness: 0, textureStrength: 0, pressureFlow: true, pressureWidth: false, pressureOpacity: false, stabilization: .08, smoothness: 18 }, 'paint'),
    preset('marker', 'Soft Marker', 'Paint', { brushTip: 'felt', tipAngle: -35, tipSpacing: .06, flow: .75, hardness: .85, pressureFlow: true, size: 28, opacity: .45, textureStrength: 0, pressureOpacity: true }, 'media'),
    preset('flat', 'Flat Brush', 'Paint', { brushTip: 'flat-bristle', tipAngle: -30, tipSpacing: .05, flow: .7, hardness: .8, pressureFlow: true, minSize: .25, size: 22, opacity: .95, textureStrength: 0, response: .8 }, 'paint'),
    preset('paint', 'Simple Paint Brush', 'Paint', { brushTip: 'bristle', tipAngle: 0, tipSpacing: .05, flow: .6, hardness: .7, pressureFlow: true, minSize: .2, size: 20, opacity: .9, textureStrength: .18 }, 'paint'),
    preset('dry', 'Dry Brush (old)', 'Paint', { brushTip: 'chalk', tipAngle: -12, tipSpacing: .08, flow: .5, hardness: .8, pressureFlow: true, minSize: .2, brushKind: 'dry-round', size: 38, opacity: .88, textureStrength: .98 }, 'media'),
    preset('dry-ink-bristle', 'Dry Ink Brush', 'Paint', { brushKind: 'dry-bristle', brushTip: 'chalk', dryBristleVersion: 3, dryMaterial: 'ink', taperEnd: .12, size: 90, color: '#000000', opacity: 1, flow: 1, pressureFlow: false, pressureWidth: true, minSize: .2, textureStrength: 0, tipAngle: 0, stabilization: .08, smoothness: 18, dryLoad: .97, dryDepletion: 15, drySpeedDry: 2.6, dryLag: .55, dryClumps: 16, dryClumpAmp: .30, dryFray: .09, dryHair: .35, dryFlecks: 1.8, dryLift: .8, dryTooth: .9, dryToothScale: 2.2, dryBlur: .7, dryWash: .15 }, 'media'),
    preset('dry-paint', 'Dry Paint Brush', 'Paint', { brushKind: 'dry-bristle', brushTip: 'chalk', dryBristleVersion: 3, dryMaterial: 'paint', taperEnd: .15, size: 70, opacity: 1, flow: 1, pressureFlow: false, pressureWidth: true, minSize: .2, textureStrength: 0, tipAngle: 0, stabilization: .08, smoothness: 18, dryLoad: .85, dryDepletion: 6, drySpeedDry: 2, dryLag: .45, dryClumps: 10, dryClumpAmp: .22, dryFray: .14, dryHair: .20, dryFlecks: 1, dryLift: 1, dryTooth: .6, dryToothScale: 3, dryBlur: .5, dryWash: .25 }, 'paint'),
    preset('water-smooth', 'Smooth Watercolor', 'Paint', { brushKind: 'watercolor-new', watercolorAppearanceVersion: 1, brushTip: 'water-smooth', watercolorShape: 'round', watercolorMode: 'even', size: 85, opacity: .85, flow: .65, pressureFlow: true, pressureWidth: true, minSize: .08, textureStrength: .2, stabilization: .1, smoothness: 18, pigmentAmount: .76, waterAmount: .38, edgeSoftness: .18, dryness: .03, pigmentBuildup: .4 }, 'watercolor'),
    preset('water-rough', 'Rough Watercolor', 'Paint', { brushKind: 'watercolor-new', watercolorAppearanceVersion: 1, brushTip: 'water-rough', watercolorShape: 'round', watercolorMode: 'even', size: 85, opacity: .82, flow: .65, pressureFlow: true, pressureWidth: true, minSize: .08, textureStrength: .4, stabilization: .1, smoothness: 18, pigmentAmount: .76, waterAmount: .23, edgeSoftness: .12, dryness: .72, pigmentBuildup: .45 }, 'watercolor'),
    preset('water-wet', 'Soft Wet Watercolor', 'Paint', { brushKind: 'watercolor-new', watercolorAppearanceVersion: 1, brushTip: 'water-wet', watercolorShape: 'mop', watercolorMode: 'wet', size: 85, opacity: .8, flow: .7, pressureFlow: true, pressureWidth: true, minSize: .1, textureStrength: .18, stabilization: .1, smoothness: 18, pigmentAmount: .78, waterAmount: .85, edgeSoftness: .75, dryness: 0, pigmentBuildup: .4, wetDiffusion: .75, edgeBleeding: .7, mixColors: true, mixAmount: .6 }, 'watercolor'),
    preset('water-flat', 'Flat Watercolor', 'Paint', { brushKind: 'watercolor-new', watercolorAppearanceVersion: 1, brushTip: 'water-flat', watercolorShape: 'angular', watercolorMode: 'even', size: 85, opacity: .88, flow: .75, pressureFlow: true, pressureWidth: true, minSize: .1, textureStrength: .23, stabilization: .1, smoothness: 18, pigmentAmount: .84, waterAmount: .28, edgeSoftness: .12, dryness: .08, pigmentBuildup: .5, tipAngle: 0 }, 'watercolor'),
    preset('water-gradient', 'Gradient Watercolor', 'Paint', { brushKind: 'watercolor-new', watercolorAppearanceVersion: 1, brushTip: 'water-gradient', watercolorShape: 'angular', watercolorMode: 'even', size: 85, opacity: .88, flow: .75, pressureFlow: true, pressureWidth: true, minSize: .1, textureStrength: .23, stabilization: .1, smoothness: 18, pigmentAmount: .92, waterAmount: .4, edgeSoftness: .17, dryness: .08, pigmentBuildup: .4, pigmentDepletion: .9, pigmentReload: false, tipAngle: 0 }, 'watercolor'),
    preset('eraser-hard', 'Hard Eraser', 'Eraser', { size: 24, opacity: 1, textureStrength: 0, smoothness: 0 }),
    preset('eraser-soft', 'Soft Eraser', 'Eraser', { size: 45, opacity: .6, textureStrength: 0, smoothness: 0 }),
];
const watercolorSettings = (s) => s?.brushKind === 'watercolor' || typeof s?.brushTip === 'string' && isWatercolorTip(s.brushTip) || s?.watercolorStyle !== undefined;
/** Retired preset identities stay retired even if their cached settings changed. */
const retiredWatercolorPreset = (p) => !!p && (typeof p.id === 'string' && /^watercolor(?:-|$)/.test(p.id) || watercolorSettings(p.settings) || watercolorSettings(p.defaults));
export function newBrushLibrary() { return { brushId: 'hb', eraserId: 'eraser-hard', mode: 'paint', presets: stockPresets.map(p => ({ ...p, defaults: { ...p.defaults }, settings: { ...p.settings } })) }; }
export function sanitizeBrush(value, fallback) {
    if (!value || typeof value !== 'object')
        return { ...fallback };
    const p = value, result = { ...fallback };
    for (const [key, min, max] of [['size', .1, 500], ['opacity', 0, 1], ['stabilization', 0, 1], ['smoothness', 0, 100], ['response', .2, 3], ['taperStart', 0, 1], ['taperEnd', 0, 1], ['minSize', 0, 1], ['maxSize', 0, 1], ['minOpacity', 0, 1], ['maxOpacity', 0, 1], ['textureStrength', 0, 1], ['tolerance', 0, 255], ['tipAngle', -180, 180], ['tipSpacing', .02, .5], ['flow', 0, 1], ['hardness', 0, 1], ['mixAmount', 0, 1], ['mixPickupLen', .2, 4], ['mixHoldLen', .5, 12], ['mixStreak', 0, 1], ['mixPaintLoad', 0, 1], ['pigmentPooling', 0, 1], ['pigmentAmount', 0, 1], ['waterAmount', 0, 1], ['edgeSoftness', 0, 1], ['dryness', 0, 1], ['pigmentBuildup', 0, 1], ['pigmentDepletion', 0, 1], ['wetDiffusion', 0, 1], ['edgeBleeding', 0, 1]]) {
        const n = p[key];
        if (typeof n === 'number' && Number.isFinite(n))
            result[key] = Math.max(min, Math.min(max, n));
    }
    // Retired watercolor settings cannot re-enable a removed tip on a stock brush.
    delete result.watercolorStyle;
    delete result.pigmentPooling;
    if (isPaintTip(p.brushTip) && !isWatercolorTip(p.brushTip))
        result.brushTip = p.brushTip;
    for (const key of ['pressure', 'pressureWidth', 'pressureOpacity', 'pressureFlow', 'velocityTaper', 'mixColors', 'pigmentReload'])
        if (typeof p[key] === 'boolean')
            result[key] = p[key];
    if (isColoringTip(result.brushTip)) {
        result.coloringEngine = 1;
        if (result.brushTip === 'color-texture' || result.brushTip === 'color-blender')
            result.coloringAppearanceVersion = 3;
        else
            delete result.coloringAppearanceVersion;
        result.colorNib = isColorNib(p.colorNib) && coloringNibs(result.brushTip).includes(p.colorNib) ? p.colorNib : result.colorNib && coloringNibs(result.brushTip).includes(result.colorNib) ? result.colorNib : defaultColorNib(result.brushTip);
        if (typeof p.colorNibFollow === 'boolean')
            result.colorNibFollow = p.colorNibFollow;
    }
    else {
        delete result.blendPreserveAlpha;
        delete result.coloringAppearanceVersion;
        delete result.coloringEngine;
        delete result.colorNib;
        delete result.colorNibFollow;
        delete result.colorSeed;
    }
    if (result.brushTip === 'color-blender') {
        if (typeof p.blendPreserveAlpha === 'boolean')
            result.blendPreserveAlpha = p.blendPreserveAlpha;
    }
    else
        delete result.blendPreserveAlpha;
    if (result.brushTip === 'color-blender' && (fallback.smudgeVersion === 2 || fallback.smudgeVersion === 3))
        Object.assign(result, smudgeMetadata({ ...result, ...p, smudgeVersion: fallback.smudgeVersion, brushTip: 'color-blender' }));
    else {
        delete result.smudgeVersion;
        for (const [key] of smudgeLimits)
            if (key !== 'mixAmount')
                delete result[key];
    }
    if (p.watercolorAppearanceVersion === 1)
        result.watercolorAppearanceVersion = 1;
    if (['round', 'filbert', 'angular', 'liner', 'mop'].includes(p.watercolorShape ?? ''))
        result.watercolorShape = p.watercolorShape;
    if (['wet', 'glaze', 'even'].includes(p.watercolorMode ?? ''))
        result.watercolorMode = p.watercolorMode;
    if (typeof p.color === 'string' && /^#[\da-f]{6}$/i.test(p.color))
        result.color = p.color;
    if (typeof p.brushKind === 'string' && [...stockPresets, legacyAirbrushPreset].some(s => s.id === p.brushKind || s.settings.brushKind === p.brushKind))
        result.brushKind = p.brushKind;
    if (fallback.dryBristleVersion === 1 || fallback.dryBristleVersion === 2 || fallback.dryBristleVersion === 3) {
        result.dryBristleVersion = fallback.dryBristleVersion;
        if (fallback.dryBristleVersion === 2 || fallback.dryBristleVersion === 3)
            result.dryMaterial = p.dryMaterial === 'ink' || p.dryMaterial === 'paint' ? p.dryMaterial : fallback.dryMaterial;
        else
            delete result.dryMaterial;
        for (const [key, min, max] of dryControlLimits) {
            const v = p[key];
            if (typeof v === 'number' && Number.isFinite(v))
                result[key] = Math.max(min, Math.min(max, v));
        }
        if (Number.isInteger(p.dryBristleSeed) && p.dryBristleSeed >= 0 && p.dryBristleSeed <= 4294967295)
            result.dryBristleSeed = p.dryBristleSeed;
    }
    else {
        delete result.dryMaterial;
        delete result.dryBristleVersion;
        delete result.dryBristleSeed;
        for (const [key] of dryControlLimits)
            delete result[key];
    }
    const c = p.pressureCurve;
    if (Array.isArray(c) && c.length === 5 && c.every((n, i) => n && n.x === i / 4 && Number.isFinite(n.y) && n.y >= 0 && n.y <= 1 && (i === 0 || n.y >= c[i - 1].y)))
        result.pressureCurve = c.map(n => ({ ...n }));
    if ((result.minSize ?? 0) > (result.maxSize ?? 1))
        result.minSize = result.maxSize;
    if ((result.minOpacity ?? 0) > (result.maxOpacity ?? 1))
        result.minOpacity = result.maxOpacity;
    if (canMixTips(result.brushTip) && !result.dryBristleVersion) {
        for (const key of ['mixTipA', 'mixTipB'])
            if (isMixTip(p[key]))
                result[key] = p[key];
        if (typeof p.mixBlend === 'number' && Number.isFinite(p.mixBlend))
            result.mixBlend = Math.max(0, Math.min(1, p.mixBlend));
    }
    else {
        delete result.mixTipA;
        delete result.mixTipB;
        delete result.mixBlend;
    }
    return result;
}
export function restoreBrushLibrary(value) {
    const fresh = newBrushLibrary();
    if (!value || typeof value !== 'object')
        return fresh;
    const old = value;
    if (Array.isArray(old.presets)) {
        fresh.presets = fresh.presets.map(stock => {
            const saved = old.presets.find(p => p.id === stock.id);
            if (!saved)
                return stock;
            const settings = sanitizeBrush(saved.settings, stock.defaults);
            if (stock.defaults.dryBristleVersion === 3 && saved.defaults?.dryBristleVersion === 1 && saved.settings.opacity === saved.defaults.opacity)
                settings.opacity = stock.defaults.opacity;
            if (stock.id === 'color-blender' && saved.settings?.smudgeVersion !== 3) {
                // Old Blender STROKES keep their old unversioned renderer. Only the brush
                // selected for the NEXT stroke is moved to the gentle local Blender.
                settings.smudgeVersion = 3;
                settings.colorNib = 'round';
                settings.blendPreserveAlpha = true;
                settings.mixAmount = .44;
                settings.holdLen = .5;
                settings.smearStreak = 0;
                settings.useSelectedColour = 0;
                if (saved.settings?.opacity === saved.defaults?.opacity)
                    settings.opacity = stock.defaults.opacity;
                if (saved.settings?.flow === saved.defaults?.flow)
                    settings.flow = stock.defaults.flow;
            }
            if (stock.defaults.coloringAppearanceVersion === 3 && saved.defaults?.coloringAppearanceVersion !== 3)
                for (const key of ['flow', 'pressureFlow', 'hardness', 'textureStrength', 'colorNib', 'colorNibFollow'])
                    if (saved.settings?.[key] === saved.defaults?.[key])
                        settings[key] = stock.defaults[key];
            // Upgrade the default Dry Brush for new strokes only. Saved strokes retain
            // the old 'dry' rasterizer and will not change when their project is reopened.
            if (stock.id === 'dry' && ['dry', 'dry-grain'].includes(settings.brushKind ?? ''))
                settings.brushKind = 'dry-round';
            // Brush presets saved before Patch 5 keep customized sizes/opacity, but
            // receive the new drawing media engine when the original stock preset is selected.
            const graphite = { hb: 'graphite-hb', '2b': 'graphite-2b', mechanical: 'graphite-mechanical', blue: 'graphite-blue' };
            if (graphite[stock.id] && settings.brushKind === stock.id)
                settings.brushKind = graphite[stock.id];
            return { ...stock, settings };
        });
        for (const custom of old.presets.slice(0, 100))
            if (custom?.custom && !retiredWatercolorPreset(custom) && typeof custom.id === 'string' && !fresh.presets.some(p => p.id === custom.id) && typeof custom.name === 'string' && ['Pencil', 'Ink', 'Paint', 'Eraser'].includes(custom.category)) {
                let fallback = [...stockPresets, legacyAirbrushPreset].find(p => p.settings.brushKind === custom.settings?.brushKind)?.settings ?? common;
                if (custom.settings?.smudgeVersion === 2 && custom.settings?.brushTip === 'color-blender')
                    fallback = stockPresets.find(p => p.id === 'smudge-bristle').settings;
                if ((custom.settings?.dryBristleVersion === 1 || custom.settings?.dryBristleVersion === 2) && fallback.dryBristleVersion === 3)
                    fallback = { ...fallback, dryBristleVersion: custom.settings.dryBristleVersion, dryMaterial: custom.settings.dryBristleVersion === 1 ? undefined : custom.settings.dryMaterial };
                fresh.presets.push({ ...custom, name: custom.name.slice(0, 60), defaults: { ...sanitizeBrush(custom.defaults, fallback), brushTip: isPaintTip(custom.defaults?.brushTip) ? custom.defaults.brushTip : 'round' }, settings: { ...sanitizeBrush(custom.settings, fallback), brushTip: isPaintTip(custom.settings?.brushTip) ? custom.settings.brushTip : 'round' } });
            }
    }
    if (old.brushId === 'airbrush') {
        fresh.brushId = 'color-air';
        const saved = old.presets?.find(p => p.id === 'airbrush'), target = fresh.presets.find(p => p.id === 'color-air');
        if (saved) {
            const migrated = sanitizeBrush(saved.settings, legacyAirbrushPreset.defaults);
            target.settings = { ...target.settings, size: migrated.size, color: migrated.color };
        }
    }
    else if (fresh.presets.some(p => p.id === old.brushId && p.category !== 'Eraser'))
        fresh.brushId = old.brushId;
    else if (typeof old.brushId === 'string' && /^watercolor(?:-|$)/.test(old.brushId) || Array.isArray(old.presets) && old.presets.some(p => p?.id === old.brushId && retiredWatercolorPreset(p)))
        fresh.brushId = 'soft-paint';
    if (typeof old.mode === 'string' && ['paint', 'mix'].includes(old.mode))
        fresh.mode = old.mode;
    if (isRetiredBlendPresetId(fresh.brushId)) {
        fresh.mode = 'mix';
        fresh.brushId = fresh.brushId === 'wet-mix' ? 'water-wet' : fresh.brushId === 'smudge-bristle' ? 'color-texture' : 'color-soft';
    }
    if (fresh.presets.some(p => p.id === old.eraserId && p.category === 'Eraser'))
        fresh.eraserId = old.eraserId;
    return fresh;
}
export function activePreset(library, eraser = false) { return library.presets.find(p => p.id === (eraser ? library.eraserId : library.brushId)); }
export function updatePreset(library, id, settings) { return { ...library, presets: library.presets.map(p => p.id === id ? { ...p, settings: sanitizeBrush(settings, p.defaults) } : p) }; }
export function brushList(library, category, family) {
    return library.presets.filter(p => p.category === category && (!family || p.family === family) && !isRetiredBlendPresetId(p.id));
}
export const brushSupportsMix = (preset) => preset.category !== 'Eraser';
function inferredMixNib(settings) {
    if (isColoringTip(settings.brushTip))
        return settings.colorNib ?? defaultColorNib(settings.brushTip);
    if (settings.brushTip === 'flat-bristle')
        return 'flat';
    if (settings.brushTip === 'felt')
        return 'chisel';
    if (settings.brushTip === 'soft-round')
        return 'round';
    if (settings.brushTip === 'chalk')
        return 'fan';
    if (settings.brushTip === 'water-flat' || settings.watercolorShape === 'angular')
        return 'flat';
    if (settings.brushTip === 'water-gradient' || settings.watercolorShape === 'liner')
        return 'rake';
    if (settings.brushTip === 'water-wet' || settings.watercolorShape === 'mop')
        return 'filbert';
    if (settings.brushTip?.startsWith('water-'))
        return 'filbert';
    if (settings.brushKind?.startsWith('graphite-'))
        return 'fan';
    if (settings.brushKind === 'dry-bristle' || settings.brushTip === 'bristle')
        return 'bristle';
    return 'filbert';
}
function inferMixDefaults(settings) {
    const watercolor = !!settings.brushTip?.startsWith('water-');
    const dry = settings.dryBristleVersion === 1 || settings.dryBristleVersion === 2 || settings.dryBristleVersion === 3 || settings.brushTip === 'chalk';
    const soft = settings.brushTip === 'soft-round' || settings.brushTip === 'color-soft' || settings.brushTip === 'color-air' || settings.brushKind === 'airbrush';
    const flat = settings.brushTip === 'flat-bristle' || settings.brushTip === 'felt' || settings.brushTip === 'color-solid' || settings.brushTip === 'water-flat';
    const smudgeVersion = soft ? 3 : 2;
    return {
        smudgeVersion,
        mixAmount: settings.mixAmount ?? (watercolor ? .72 : soft ? .48 : dry ? .68 : flat ? .62 : .58),
        pickupLen: settings.mixPickupLen ?? (watercolor ? 1.4 : dry ? .85 : 1),
        holdLen: settings.mixHoldLen ?? (watercolor ? 5.5 : dry ? 2.2 : flat ? 1.9 : soft ? 1.2 : 2.6),
        smearStreak: settings.mixStreak ?? (watercolor ? .12 : dry ? .44 : flat ? .18 : soft ? .05 : .22),
        useSelectedColour: settings.mixPaintLoad ?? 0,
        blendPreserveAlpha: soft,
        colorNib: inferredMixNib(settings),
        colorNibFollow: settings.colorNibFollow ?? !soft,
    };
}
/** Mix changes only the compositing operation. The normal brush's renderer,
 * nib, pressure, grain, dry gaps, watercolor edge and hashes stay identical.
 * v167 converted the entire brush to color-blender: that is intentionally gone.
 */
export function mixifiedBrushSettings(settings) {
    return { ...settings, nativeMixEnabled: true, mixColors: false };
}
export function activeInputPreset(library, eraser = false) {
    const preset = activePreset(library, eraser);
    if (eraser || library.mode !== 'mix' || !brushSupportsMix(preset))
        return preset;
    return { ...preset, name: preset.name + ' · Mix', settings: mixifiedBrushSettings(preset.settings) };
}
