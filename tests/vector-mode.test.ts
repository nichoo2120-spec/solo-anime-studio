import {describe,it,expect} from 'vitest';
import {normalizeVectorMode} from '../src/engine/vectorMode';
describe('Everyday FlowCurve vector brush',()=>{
 it('always migrates discontinued curve modes to freehand ink',()=>{
  expect(normalizeVectorMode('curve')).toBe('freehand');
  expect(normalizeVectorMode(undefined)).toBe('freehand');
  expect(normalizeVectorMode('garbled')).toBe('freehand');
 });
 it('keeps essential straight-line and edit modes',()=>{
  expect(normalizeVectorMode('freehand')).toBe('freehand');
  expect(normalizeVectorMode('line')).toBe('line');
  expect(normalizeVectorMode('edit')).toBe('edit');
 });
});
