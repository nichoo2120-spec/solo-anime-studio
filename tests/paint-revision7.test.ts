import {describe,it,expect} from 'vitest';
import {paintNibCoverage,paintSpacing,paintStampVariant,quantizeNibIntensity} from '../src/engine/paintNibs';
import {stockPresets} from '../src/core/brushes';
import {appendOperation,newProject,validateProject,type Stroke} from '../src/core/model';
import {strokeGeometry} from '../src/engine/strokeGeometry';

describe('Paint brushes — renderer revision 7',()=>{
 it('has smooth Airbrush falloff, mottled Watercolor, and broken Dry Brush coverage',()=>{
  expect(paintNibCoverage('airbrush',0,0)).toBeGreaterThan(paintNibCoverage('airbrush',.5,0));
  expect(paintNibCoverage('airbrush',.5,0)).toBeGreaterThan(paintNibCoverage('airbrush',.85,0));
  for(const kind of ['airbrush','watercolor','dry-grain'] as const){expect(paintNibCoverage(kind,0,0)).toBeGreaterThan(0);expect(paintNibCoverage(kind,1.2,0)).toBe(0);}
  const fibers=Array.from({length:41},(_,i)=>paintNibCoverage('dry-grain',0,(i-20)/25));
  expect(Math.max(...fibers)-Math.min(...fibers)).toBeGreaterThan(.35);
 });
 it('uses bounded caches and stable nib variation regardless of skipped tiles',()=>{
  expect(quantizeNibIntensity(0)).toBe(0);expect(quantizeNibIntensity(255)).toBe(16);
  for(const size of [4,24,75])for(let i=0;i<120;i++){const spacing=paintSpacing(size);expect(paintStampVariant(i*spacing,spacing)).toBe(i%3);}
 });
 it('preserves saved revision 6 while accepting new revision 7 brush strokes',()=>{
  const points=Array.from({length:20},(_,i)=>({x:30+i*5,y:40+Math.sin(i*.4)*8,p:.3+i/30}));
  for(const preset of stockPresets.filter(p=>['dry','watercolor','airbrush'].includes(p.id))){
   const s={...preset.settings,brushTip:'round',kind:'stroke',id:preset.id,tool:'brush',engineVersion:7,points} as Stroke;
   expect(()=>validateProject(appendOperation(newProject(),s))).not.toThrow();
   expect(strokeGeometry(s)).toEqual(strokeGeometry({...s,engineVersion:6}));
   expect(()=>validateProject(appendOperation(newProject(),{...s,engineVersion:6}))).not.toThrow();
  }
 });
});
