export type OutlinePoint = {x: number; y: number};
export type TipMask = {width: number; height: number; alpha: ArrayLike<number>; scale?: number};

const segments = [
  [], [3, 0], [0, 1], [3, 1], [1, 2], [3, 0, 1, 2], [0, 2], [3, 2],
  [2, 3], [0, 2], [0, 1, 2, 3], [1, 2], [1, 3], [0, 1], [3, 0], [],
];

function simplify(points: OutlinePoint[], tolerance: number) {
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const pending = [[0, points.length - 1]];
  const threshold = tolerance * tolerance;
  while (pending.length) {
    const [first, last] = pending.pop()!;
    const a = points[first], b = points[last], dx = b.x - a.x, dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    let furthest = first, distance = threshold;
    for (let i = first + 1; i < last; i++) {
      const x = points[i].x - a.x, y = points[i].y - a.y;
      const t = length ? Math.max(0, Math.min(1, (x * dx + y * dy) / length)) : 0;
      const error = (x - dx * t) ** 2 + (y - dy * t) ** 2;
      if (error > distance) {
        furthest = i;
        distance = error;
      }
    }
    if (furthest !== first) {
      keep[furthest] = 1;
      pending.push([first, furthest], [furthest, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** March through the alpha field, with a transparent border so edge-touching loops close. */
export function traceTipMask({width, height, alpha, scale = 1}: TipMask, tolerance = .5): OutlinePoint[][] {
  let peak = 0;
  for (let i = 0; i < alpha.length; i++) peak = Math.max(peak, alpha[i]);
  if (!peak) return [];
  const cutoff = Math.min(127.5, peak / 2);
  const stride = width + 1;
  const nodes = new Map<number, {point: OutlinePoint; neighbors: number[]}>();
  const at = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height ? alpha[y * width + x] : 0;
  for (let y = -1; y < height; y++) {
    for (let x = -1; x < width; x++) {
      const a = at(x, y), b = at(x + 1, y), c = at(x + 1, y + 1), d = at(x, y + 1);
      const code = Number(a >= cutoff) + 2 * Number(b >= cutoff) + 4 * Number(c >= cutoff) + 8 * Number(d >= cutoff);
      if (!code || code === 15) continue;
      const centerInside = (a + b + c + d) / 4 >= cutoff;
      const edges = segments[centerInside && (code === 5 || code === 10) ? 15 - code : code];
      const base = ((y + 1) * stride + x + 1) * 2;
      const keys = [base, base + 3, base + stride * 2, base + 1];
      const from = [a, b, d, a], to = [b, c, c, d];
      const node = (edge: number) => {
        const key = keys[edge];
        let item = nodes.get(key);
        if (!item) {
          const t = (cutoff - from[edge]) / (to[edge] - from[edge]);
          const point = {x: x + (edge === 1 ? 1 : edge === 3 ? 0 : t), y: y + (edge === 0 ? 0 : edge === 2 ? 1 : t)};
          item = {point, neighbors: []};
          nodes.set(key, item);
        }
        return item;
      };
      for (let i = 0; i < edges.length; i += 2) {
        const first = edges[i], second = edges[i + 1];
        node(first).neighbors.push(keys[second]);
        node(second).neighbors.push(keys[first]);
      }
    }
  }
  const result: OutlinePoint[][] = [];
  const unit = scale / Math.max(width, height);
  while (nodes.size) {
    const start = nodes.keys().next().value!;
    const points: OutlinePoint[] = [];
    let current = start;
    do {
      const {point, neighbors} = nodes.get(current)!;
      points.push(point);
      nodes.delete(current);
      current = neighbors.find(key => nodes.has(key)) ?? start;
    } while (current !== start);
    const area = Math.abs(points.reduce((sum, p, i) => {
      const next = points[(i + 1) % points.length];
      return sum + p.x * next.y - p.y * next.x;
    }, 0)) / 2;
    if (area < tolerance * tolerance || points.length < 3) continue;
    const simplified = simplify([...points, points[0]], tolerance).slice(0, -1);
    if (simplified.length < 3) continue;
    result.push(simplified.map(({x, y}) => ({x: (x + .5 - width / 2) * unit, y: (y + .5 - height / 2) * unit})));
  }
  return result;
}

export type TipMaskSource = {key: string; mask: (resolution: number) => TipMask};
export class TipOutlineCache<T> {
  private entries = new Map<string, T>();

  constructor(private make: (contours: OutlinePoint[][]) => T) {}

  get(source: TipMaskSource, diameter: number): T {
    const resolution = diameter <= 32 ? 32 : diameter <= 96 ? 64 : diameter <= 256 ? 96 : 128;
    const key = source.key + ':' + resolution;
    const cached = this.entries.get(key);
    if (cached !== undefined) return cached;
    const path = this.make(traceTipMask(source.mask(resolution), resolution <= 64 ? .65 : .5));
    this.entries.set(key, path);
    if (this.entries.size > 96) this.entries.delete(this.entries.keys().next().value!);
    return path;
  }
}

export function tipTransform(x: number, y: number, diameter: number, rotation: number, scaleX: number, scaleY: number): [number, number, number, number, number, number] {
  const c = Math.cos(rotation) * diameter, s = Math.sin(rotation) * diameter;
  return [c * scaleX, s * scaleX, -s * scaleY, c * scaleY, x, y];
}
