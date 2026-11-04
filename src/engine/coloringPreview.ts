import type {Stroke} from '../core/model';
import {drawModernStroke} from './brushRaster';
import {compositePaintStroke} from './paintCompositing';
/** Blender previews operate on existing paint, just like the drawing canvas. */
export function coloringPreview(ctx:CanvasRenderingContext2D,s:Stroke){
 if(s.brushTip!=='color-blender'){drawModernStroke(ctx,s);return;}
 const c=document.createElement('canvas');c.width=ctx.canvas.width;c.height=ctx.canvas.height;const mask=c.getContext('2d')!;drawModernStroke(mask,s);ctx.save();ctx.fillStyle='#2479d2';ctx.fillRect(0,0,c.width*.5,c.height);ctx.fillStyle='#9559c7';ctx.fillRect(c.width*.5,0,c.width*.5,c.height);ctx.restore();compositePaintStroke(ctx,c,s);
}
