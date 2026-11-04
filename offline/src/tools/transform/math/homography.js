import { homography, projectPoint, quadValid } from '../../../engine/perspectiveWarp.js';
export function projectiveMapping(from, to) { return quadValid(to) ? homography(from, to) : null; }
export function warpPoint(p, h) { return projectPoint(p, h); }
export { quadValid };
