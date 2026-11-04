/** Phase 2 / Tool 3: non-destructive A/B flipbook preview. Never changes the
 * active drawing, frame data, history, onion-skin preferences, or save format.
 */
import type {Project} from '../core/model';
import {currentFrameIndex,frameList,type DrawingFrame} from './timeline';
export type FlipDirection=-1|1;
export function flipCandidate(project:Project,direction:FlipDirection):DrawingFrame|null {
 const frames=frameList(project),index=currentFrameIndex(project)+direction;
 return index>=0&&index<frames.length?frames[index]:null;
}
/** The preview represents the whole visible drawing, not just the active layer. */
export function flipVisibleLayers(project:Project,frame:DrawingFrame):Project {
 return {...project,animation:undefined,layers:project.layers.filter(l=>l.visible&&!l.reference)
  .map(l=>({...l,operations:frame.drawings[l.id]??[]}))};
}
