import {blendTiming} from './blendTiming';
import type {Stroke} from '../core/model';
import {renderBrushBlend} from './brushBlend';
import {strokeRasterBounds} from './paintCompositing';
import {drawStroke} from './renderer';
import type {RasterRegion} from './liveRaster';

export class MixerPreview {
 readonly surface=document.createElement('canvas');
 private readonly mask=document.createElement('canvas');
 region?:RasterRegion;
 revision=0;
 private path?:string;
 presentedSamples=0;

 constructor(source:HTMLCanvasElement){
  this.surface.width=this.mask.width=source.width;
  this.surface.height=this.mask.height=source.height;
  this.surface.getContext('2d')!.drawImage(source,0,0);
 }

 bounds(s:Stroke):RasterRegion|undefined{
  if(this.presentedSamples===s.points.length&&this.path===JSON.stringify(s.points))return;
  const box=strokeRasterBounds(s,this.mask.width,this.mask.height),old=this.region;
  if(!old)return box;
  const x=Math.min(old.x,box.x),y=Math.min(old.y,box.y);
  return {x,y,width:Math.max(old.x+old.width,box.x+box.width)-x,
   height:Math.max(old.y+old.height,box.y+box.height)-y};
 }

 paint(s:Stroke,source:HTMLCanvasElement){
  const path=JSON.stringify(s.points);
  if(path===this.path)return this.surface;
  blendTiming.begin(s.points.length,s.size);
  const start=blendTiming.start();
  const mask=this.mask.getContext('2d')!;
  mask.clearRect(0,0,this.mask.width,this.mask.height);
  drawStroke(mask,s);
  blendTiming.end('mask',start);
  this.region=renderBrushBlend(this.surface.getContext('2d')!,this.mask,s,0,0,
   source.getContext('2d')!,this.region);
  this.revision++;
  this.path=path;
  this.presentedSamples=s.points.length;
  return this.surface;
 }
}
