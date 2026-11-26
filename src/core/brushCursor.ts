export const brushCursorStyles = [
  ['tip', 'Tip outline'],
  ['circle', 'Circle'],
  ['crosshair', 'Crosshair'],
  ['tip-crosshair', 'Tip outline + crosshair'],
  ['dot', 'Dot'],
] as const;

export type BrushCursorStyle = typeof brushCursorStyles[number][0];

export function brushCursorStyle(value: unknown): BrushCursorStyle {
  return brushCursorStyles.find(([id]) => id === value)?.[0] ?? 'tip';
}
