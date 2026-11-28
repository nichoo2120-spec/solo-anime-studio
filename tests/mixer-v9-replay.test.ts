import {createHash} from 'node:crypto';
import {it,vi,expect} from 'vitest';
import {createCanvas,Path2D} from '@napi-rs/canvas';
import {drawStroke} from '../src/engine/renderer';
import {renderBrushBlend} from '../src/engine/brushBlend';
import {brushStrokeMetadata} from '../src/core/paintTips';
import {stockPresets} from '../src/core/brushes';
import type {Stroke} from '../src/core/model';

it('replays saved version 9 brush pixels',()=>{
 vi.stubGlobal('document',{createElement:()=>createCanvas(1,1)});
 vi.stubGlobal('Path2D',Path2D);
 try {
  const hash=createHash('sha256');
  for(const preset of stockPresets.filter(p=>p.category!=='Eraser'&&!p.settings.impastoVersion)){
   const settings={...preset.settings,bbEnabled:true};
   const s:Stroke={...settings,...brushStrokeMetadata(settings,true),brushBlendVersion:9,kind:'stroke',
    tool:'brush',id:'historical-seed',size:96,color:'#212a6e',opacity:.8,pressure:true,
    points:[{x:59,y:62,p:.25},{x:94,y:66,p:.35},{x:138,y:51,p:.58}]};
   const mask=createCanvas(208,136).getContext('2d') as unknown as CanvasRenderingContext2D;
   const ctx=createCanvas(208,136).getContext('2d') as unknown as CanvasRenderingContext2D;
   ctx.fillStyle='#da2511';ctx.fillRect(0,0,208,136);ctx.fillStyle='#109530';ctx.fillRect(0,0,82,136);
   drawStroke(mask,s);renderBrushBlend(ctx,mask.canvas,s);
   hash.update(ctx.getImageData(0,0,208,136).data);
  }
  // Reference pixels from main at 946b91a, before version 10.
  expect(hash.digest('hex')).toBe('87eafe74156ebe4fba9d28f821f8c94c688f5e63b23dd99dbf0b06439ba1bcb3');
 }finally{vi.unstubAllGlobals();}
});
