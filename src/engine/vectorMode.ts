/** Drawing modes are intentionally small: everyday freehand ink, optional
 * straight edges, and editing. Older saved 'curve' modes migrate to the main
 * brush, rather than silently reviving a removed tool. */
export type VectorMode='freehand'|'edit'|'line';
export const normalizeVectorMode=(value:unknown):VectorMode=>
 value==='edit'||value==='line'?value:'freehand';
