/** Future-facing data contracts only. No animation runtime is implemented in Milestone 1.
 * Drawing IDs identify versioned drawing documents; exposures reference them without
 * moving stroke coordinates or tying rendering to a UI timeline.
 */
export interface FrameExposure {id:string;layerId:string;drawingId:string;startFrame:number;duration:number;}
export interface AnimationScene {version:1;id:string;name:string;fps:number;exposures:FrameExposure[];}
