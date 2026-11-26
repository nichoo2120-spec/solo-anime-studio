import type {BitmapMask} from '../core/bitmapBrush';
import type {BrushShapeControls} from '../core/brushShape';
import type {BrushCursorStyle} from '../core/brushCursor';
import type {Stroke} from '../core/model';
import {defaultColorNib} from '../core/coloring';
import {inkTipGeometry} from '../core/inkTip';
import {isWatercolorTip, brushStrokeMetadata, type PaintTip} from '../core/paintTips';
import {colorNibOutline} from './colorNibs';
import {drawDryBristle} from './dryBristle';
import {drawDryBristleV2} from './dryBristleV2';
import {drawDryBristleV3} from './dryBristleV3';
import {natureCanvas, natureNoise, natureTipAlpha} from './natureTips';
import {strokeGeometry} from './strokeGeometry';
import {mixedCoverage, paintingCoverage} from './paintingTips';
import {TipOutlineCache, tipTransform, type OutlinePoint, type TipMaskSource} from './tipContours';
import {watercolorShapePath} from './watercolorShapes';
import type {BrushSettings} from './StudioEngine';

type Sample = {direction: number; pressure: number; speed: number; az?: number; alt?: number};
type Tip = {mask?: TipMaskSource; path?: () => Path2D; x: number; y: number; angle: number; scatter?: number};
type BrushTip = (sample: Sample) => Tip;
const tau = Math.PI * 2, degrees = Math.PI / 180;
const round: Tip = {x: 1, y: 1, angle: 0};
export const roundBrushCursor: BrushTip = () => round;
let flat: Path2D | undefined;

function sampledMask(key: string, coverage: (u: number, v: number) => number): TipMaskSource {
  return {
    key,
    mask(resolution) {
      const alpha = new Uint8Array(resolution * resolution);
      for (let y = 0; y < resolution; y++) {
        const v = (y + .5) * 2 / resolution - 1;
        for (let x = 0; x < resolution; x++) alpha[y * resolution + x] = Math.round(255 * coverage((x + .5) * 2 / resolution - 1, v));
      }
      return {width: resolution, height: resolution, alpha};
    },
  };
}

function bitmapSource(mask: BitmapMask): TipMaskSource {
  let pixels: string | undefined;
  return {
    key: mask.id,
    mask(resolution) {
      pixels ??= atob(mask.alpha);
      const step = Math.max(1, Math.max(mask.width, mask.height) / resolution);
      const width = Math.max(1, Math.round(mask.width / step)), height = Math.max(1, Math.round(mask.height / step));
      const alpha = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        const top = Math.floor(y * mask.height / height), bottom = Math.floor((y + 1) * mask.height / height);
        for (let x = 0; x < width; x++) {
          const left = Math.floor(x * mask.width / width), right = Math.floor((x + 1) * mask.width / width);
          let sum = 0;
          for (let sy = top; sy < bottom; sy++) {
            const row = sy * mask.width;
            for (let sx = left; sx < right; sx++) sum += pixels.charCodeAt(row + sx);
          }
          alpha[y * width + x] = sum / ((bottom - top) * (right - left));
        }
      }
      return {width, height, alpha};
    },
  };
}

function dryMask(brush: BrushSettings, size: number) {
  const width = size * 2, center = width / 2;
  const surface = natureCanvas(width, width), context = surface.getContext('2d', {willReadFrequently: true})!;
  const stroke: Stroke = {
    ...brush, id: 'brush-cursor-sample', kind: 'stroke', tool: 'brush',
    points: [{x: center, y: center, p: 1, v: .65}],
    dryBristleSeed: 1, size, pressure: false, opacity: 1, flow: 1, color: '#000000',
  };
  const geometry = strokeGeometry(stroke);
  const render = brush.dryBristleVersion === 3 ? drawDryBristleV3
    : brush.dryBristleVersion === 2 ? drawDryBristleV2 : drawDryBristle;
  render(context, stroke, geometry);
  const data = context.getImageData(0, 0, width, width).data;
  const alpha = new Uint8Array(width * width);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  return {width, height: width, scale: 2, alpha};
}

export function brushCursorTip(brush: BrushSettings, eraser: boolean): BrushTip {
  const stamp: ReturnType<typeof brushStrokeMetadata> & BrushShapeControls = brushStrokeMetadata(eraser ? {...brush, bbEnabled: false} : brush, !eraser);
  const n = stamp.nature;
  const shape = (sample: Sample): Tip => {
    const tilt = stamp.tsTilt && sample.az !== undefined;
    const lean = tilt ? 1 + 1.5 * (1 - Math.max(0, Math.min(90, sample.alt ?? 90)) / 90) : 1;
    return {
      x: (stamp.tsScaleX ?? 1) * (stamp.tsFlipX ? -1 : 1) * lean,
      y: (stamp.tsScaleY ?? 1) * (stamp.tsRoundness ?? 1) * (stamp.tsFlipY ? -1 : 1),
      angle: (stamp.tsAngle ?? 0) * degrees + (tilt ? sample.az! * degrees : 0)
        + (stamp.tsFollow ? sample.direction + Math.PI / 2 : n?.follow ? sample.direction : 0),
    };
  };
  if (n) {
    const bitmap = n.bitmap, sources = bitmap?.tips.map(bitmapSource);
    let alpha: ReturnType<typeof natureTipAlpha> | undefined;
    const procedural: TipMaskSource = {key: 'nature:' + n.tip, mask: () => alpha ??= natureTipAlpha(n.tip)};
    const scatter = n.scatter > 0 ? n.scatter * (bitmap && !bitmap.bothAxes ? 1 : Math.SQRT2) : 0;
    return sample => {
      const tip = shape(sample), count = sources?.length ?? 1;
      const select = bitmap?.selection;
      const index = select === 'sequence' ? 0
        : select === 'pressure' ? Math.min(count - 1, Math.floor(sample.pressure * count))
        : select === 'direction' ? Math.floor((sample.direction + tau) % tau / tau * count)
        : select === 'velocity' ? Math.min(count - 1, Math.floor(sample.speed * count))
        : Math.floor(natureNoise(n.seed, 0, 12) * count);
      tip.x *= n.flipX && natureNoise(n.seed, 0, 6) < .5 ? -1 : 1;
      tip.y *= n.flipY && natureNoise(n.seed, 0, 7) < .5 ? -1 : 1;
      tip.mask = sources?.[index] ?? procedural;
      tip.scatter = scatter;
      return tip;
    };
  }
  const paint = (tip: PaintTip, angle: number, variant = 0, hardness = brush.hardness ?? .7, texture = brush.textureStrength ?? 0, shaped = false): BrushTip => {
    const mask = tip === 'soft-round' ? undefined : sampledMask(['paint',tip,hardness,texture,variant].join(':'), (u,v) => paintingCoverage(tip,u,v,hardness,texture,variant,isWatercolorTip(tip)));
    return sample => shaped ? {...shape(sample), mask} : {...round, angle, mask};
  };
  if (!eraser && stamp.stampTip) return paint(stamp.stampTip, 0, 0, stamp.stampHardness, stamp.stampTexture, true);
  if (stamp.inkEdgeVersion === 1 || brush.inkTipVersion === 1) {
    if (brush.inkTipShape !== 'oval') return roundBrushCursor;
    return sample => {
      const ink = inkTipGeometry(brush, sample.direction);
      return {...round, y: ink.aspect, angle: ink.rotation};
    };
  }
  if (brush.dryBristleVersion) {
    const key = 'dry:' + JSON.stringify(Object.entries(brush).filter(([name]) => name.startsWith('dry')).sort(([a], [b]) => a.localeCompare(b)));
    const mask: TipMaskSource = {key, mask: resolution => dryMask(brush, resolution)};
    return sample => ({...round, angle: sample.direction, mask});
  }
  const angle = (brush.tipAngle ?? 0) * degrees;
  if (stamp.coloringEngine === 1) {
    const nib = brush.colorNib ?? defaultColorNib(brush.brushTip);
    if (nib === 'round') return roundBrushCursor;
    const path = () => colorNibOutline(nib);
    return sample => ({...round, path, angle: angle + (brush.colorNibFollow ? sample.direction + Math.PI / 2 : 0)});
  }
  if (brush.watercolorShape) {
    const water = brush.watercolorShape;
    if (water === 'round') return roundBrushCursor;
    return () => ({...round, angle, path: () => watercolorShapePath(water)});
  }
  if (brush.mixTipA && brush.mixTipB) {
    const a = brush.mixTipA, b = brush.mixTipB, blend = brush.mixBlend ?? .5;
    const hardness = brush.hardness ?? .7, texture = brush.textureStrength ?? 0;
    const mask = sampledMask(['mixed',a,b,blend,hardness,texture].join(':'), (u,v) => mixedCoverage(a,b,blend,u,v,hardness,texture));
    return () => ({...round, angle, mask});
  }
  if (brush.brushTip && brush.brushTip !== 'round') return paint(brush.brushTip, angle);
  if (brush.brushKind === 'flat') {
    return () => ({...round, angle: -.55, path: () => {
      if (!flat) {
        flat = new Path2D();
        flat.rect(-.5, -.15, 1, .3);
      }
      return flat;
    }});
  }
  return roundBrushCursor;
}

function outlinePath(contours: OutlinePoint[][]) {
  if (!contours.length) return null;
  const path = new Path2D();
  for (const [first, ...rest] of contours) {
    path.moveTo(first.x, first.y);
    for (const point of rest) path.lineTo(point.x, point.y);
    path.closePath();
  }
  return path;
}
const outlines = new TipOutlineCache(outlinePath);
let unitCircle: Path2D | undefined;
function circlePath() {
  if (!unitCircle) {
    unitCircle = new Path2D();
    unitCircle.arc(0, 0, .5, 0, tau);
  }
  return unitCircle;
}

function doubleStroke(ctx: CanvasRenderingContext2D, path: Path2D) {
  ctx.strokeStyle = '#141414';
  ctx.lineWidth = 2.5;
  ctx.stroke(path);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke(path);
}

export function paintBrushTipCursor(
  ctx: CanvasRenderingContext2D, style: BrushCursorStyle, tip: Tip,
  x: number, y: number, diameter: number, viewRotation: number,
) {
  let radius = 7;
  if (style === 'tip' || style === 'tip-crosshair' || style === 'circle') {
    const model = style === 'circle' ? round : tip;
    const extent = Math.max(Math.abs(model.x), Math.abs(model.y)) * diameter;
    const scatter = (model.scatter ?? 0) * diameter;
    if (diameter > 0) {
      const outline = (model.mask && outlines.get(model.mask, extent)) || model.path?.() || circlePath();
      const path = new Path2D();
      path.addPath(outline, new DOMMatrix(tipTransform(x, y, diameter, model.angle + viewRotation, model.x, model.y)));
      doubleStroke(ctx, path);
      radius = Math.max(radius, extent * .81);
    }
    if (scatter > 0) {
      const area = new Path2D();
      area.arc(x, y, scatter, 0, tau);
      ctx.save();
      ctx.globalAlpha = .38;
      ctx.setLineDash([3, 4]);
      doubleStroke(ctx, area);
      ctx.restore();
      radius = Math.max(radius, scatter);
    }
  }
  if (style === 'crosshair' || style === 'tip-crosshair' || (style === 'tip' || style === 'circle') && (diameter < 4 || diameter >= 128)) {
    const crosshair = new Path2D();
    crosshair.moveTo(x - 5, y);
    crosshair.lineTo(x + 5, y);
    crosshair.moveTo(x, y - 5);
    crosshair.lineTo(x, y + 5);
    doubleStroke(ctx, crosshair);
  } else if (style === 'dot') {
    const dot = new Path2D();
    dot.arc(x, y, 1.5, 0, tau);
    doubleStroke(ctx, dot);
    ctx.fillStyle = '#fff';
    ctx.fill(dot);
  }
  return radius;
}
