import {describe,it,expect} from 'vitest';
import {paintNibV8Coverage,paintPaperGrain,paintVariationSeed} from '../src/engine/paintNibsV8';
import {stockPresets} from '../src/core/brushes';
import {appendOperation,newProject,validateProject,type Stroke} from '../src/core/model';
import {strokeGeometry} from '../src/engine/strokeGeometry';

describe('Paint renderer v8 brush quality and old artwork compatibility',()=>{
 it('has broken Dry Brush and non-repeating, translucent Watercolor nibs',()=>{
  expect(paintNibV8Coverage('dry-grain',2,0)).toBe(0);
  expect(paintNibV8Coverage('watercolor',2,0)).toBe(0);
  const coverage=Array.from({length:35},(_,i)=>paintNibV8Coverage('dry-grain',0,(i-17)/19,3));
  expect(Math.max(...coverage)-Math.min(...coverage)).toBeGreaterThan(.3);
  expect(paintNibV8Coverage('watercolor',0,0)).toBeGreaterThan(.3);
  expect(paintPaperGrain(150,90,4)).not.toBe(paintPaperGrain(250,90,4));
  expect(paintVariationSeed('stroke-1')).toBe(paintVariationSeed('stroke-1'));
 });
 it('stores and restores v8 strokes while retaining v7 and v6',()=>{
  for(const preset of stockPresets.filter(p=>['dry','airbrush','watercolor'].includes(p.id))){
   const p={...preset.settings,brushTip:'round',id:'test-'+preset.id,kind:'stroke',tool:'brush',pressure:false,points:[{x:20,y:25,p:.12},{x:70,y:49,p:.95}],engineVersion:8} as Stroke;
   for(const version of [6,7,8] as const){const saved={...p,engineVersion:version};expect(()=>validateProject(appendOperation(newProject(),saved))).not.toThrow();expect(strokeGeometry(saved)).toEqual(strokeGeometry(p));}
  }
 });
});
