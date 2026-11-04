/**
 * Tiny, prebuilt SVG pointers. Changing cursor direction is a CSS style update,
 * not a React render, canvas repaint, or document operation. Both SVGs have
 * a centred hotspot, so the pen nib never moves when the graphic changes.
 */
export type Compass = 'right'|'down-right'|'down'|'down-left'|'left'|'up-left'|'up'|'up-right';
const directions: readonly Compass[] = ['right','down-right','down','down-left','left','up-left','up','up-right'];
const cursor = (content: string, fallback: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><g transform="translate(1 1)" fill="none" stroke="#3fe0f0" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">${content}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 13 13, ${fallback}`;
};
/** Option 03 TARGET — four slender arrows, centre dot, separated circular arcs. */
export const smallTargetCursor = cursor(
  '<path stroke="#73e8f4" stroke-width="1.05" d="M7 3.5A10 10 0 0 1 10 2.1M14 2.1A10 10 0 0 1 17 3.5M20.5 7A10 10 0 0 1 21.9 10M21.9 14A10 10 0 0 1 20.5 17M17 20.5A10 10 0 0 1 14 21.9M10 21.9A10 10 0 0 1 7 20.5M3.5 17A10 10 0 0 1 2.1 14M2.1 10A10 10 0 0 1 3.5 7"/>' +
  '<path d="M12 8.7V4.3m0 0-2.1 2.1M12 4.3l2.1 2.1M12 15.3v4.4m0 0-2.1-2.1m2.1 2.1 2.1-2.1M8.7 12H4.3m0 0 2.1-2.1M4.3 12l2.1 2.1M15.3 12h4.4m0 0-2.1-2.1m2.1 2.1-2.1 2.1"/>' +
  '<circle cx="12" cy="12" r="1.4" fill="#97fcff" stroke="none"/>',
  'move',
);
const thinScaleCursor = (degrees: number): string => cursor(
  `<g transform="rotate(${degrees} 12 12)"><path d="M5.1 12H19.2m0 0-4.5-4.5m4.5 4.5-4.5 4.5"/></g>`,
  'crosshair',
);
/** Cached once at module load. No SVG encoding/allocation during pointer movement. */
const scaleCursors: Record<Compass,string> = Object.fromEntries(
  directions.map((name,i) => [name,thinScaleCursor(i*45)]),
) as Record<Compass,string>;
export const scaleDirectionCursor = (direction: Compass):string => scaleCursors[direction];
/** Eight-way angle buckets, with diagonals in the four 45-degree sectors. */
export const compassFromDelta = (dx:number,dy:number):Compass => directions[(Math.round(Math.atan2(dy,dx)*4/Math.PI)+8)%8];
/** Corner order TL, TR, BR, BL; edge order T, R, B, L. */
export const handleCompass = (type:'corner'|'edge',index:number):Compass =>
  type==='corner' ? (['up-left','up-right','down-right','down-left'] as const)[index%4]
  : (['up','right','down','left'] as const)[index%4];

/** Approved orbit/pivot rotation cursor, pre-built clockwise and anticlockwise.
 * The larger ring + angle readout is canvas-only; the pen cursor stays compact.
 */
const rotationCursorSvg=(counterClockwise:boolean):string=>cursor(
  `<g transform="${counterClockwise?'translate(24 0) scale(-1 1)':''}"><path stroke="#85f5fa" stroke-width="1.15" d="M6.1 15.9A8.8 8.8 0 0 1 17.9 5.8M18.3 8.3A8.8 8.8 0 0 1 6.4 18.3"/><path stroke="#adffff" stroke-width="1.05" d="m17.9 5.8-4.4-.4m4.4.4-1.3 4M6.4 18.3l4.4.3m-4.4-.3 1.3-4"/><circle cx="12" cy="12" r="2.25" stroke="#83e9f0" stroke-width="1"/><circle cx="12" cy="12" r=".75" fill="#bcffff" stroke="none"/></g>`,
  'crosshair',
);
export const rotationCursors={clockwise:rotationCursorSvg(false),counterClockwise:rotationCursorSvg(true)} as const;

/** Box-free mesh cursor: a tiny four-way point manipulator, UI cyan on transparency. */
export const meshPointCursor=cursor('<path d="M12 3.2v6.2m0-6.2-2.1 2.1M12 3.2l2.1 2.1M12 20.8v-6.2m0 6.2-2.1-2.1m2.1 2.1 2.1-2.1M3.2 12h6.2m-6.2 0 2.1-2.1M3.2 12l2.1 2.1M20.8 12h-6.2m6.2 0-2.1-2.1m2.1 2.1-2.1 2.1"/><circle cx="12" cy="12" r="1.75" fill="#91e9ee" stroke="none"/>','crosshair');

/** Transparent, slim UI-teal cursors for Flip. No blue bounding boxes. */
export const flipHorizontalCursor=cursor('<path d="M4 12h16M4 12l5-5M4 12l5 5M20 12l-5-5M20 12l-5 5"/><path stroke="#7cebf0" stroke-width="1" d="M12 4v16"/>','crosshair');
export const flipVerticalCursor=cursor('<path d="M12 4v16M12 4L7 9M12 4l5 5M12 20l-5-5M12 20l5-5"/><path stroke="#7cebf0" stroke-width="1" d="M4 12h16"/>','crosshair');
export const flipPivotCursor=cursor('<path d="M12 3v6m0 6v6M3 12h6m6 0h6"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="#8df8fc" stroke="none"/>','crosshair');
