import type {Stroke} from '../core/model';
import {finalGeometry} from './geometryCache';
import {drawStroke} from './renderer';

/** A live prefix uses the same full-resolution Paint raster as a saved stroke. */
export function drawMixerMask(ctx:CanvasRenderingContext2D,s:Stroke,geometry=finalGeometry(s)){
 drawStroke(ctx,s,'final',geometry);
}
