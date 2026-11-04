import {describe,it,expect} from 'vitest';
import {quickAction,steppedBrushSize} from '../src/core/keyboardActions';
import {initialShortcuts,normalizeShortcuts,shortcutValid} from '../src/core/shortcuts';
const key=(name:string,override:Record<string,unknown>={})=>({key:name,code:'',shiftKey:false,ctrlKey:false,altKey:false,metaKey:false,...override}) as KeyboardEvent;
describe('Phase 2 keyboard shortcuts',()=>{
 it('uses bare brackets only for brush size',()=>{
  expect(quickAction(key('['))).toBe('sizeDown');expect(quickAction(key(']'))).toBe('sizeUp');
  expect(quickAction(key('{',{code:'BracketLeft',shiftKey:true}))).toBeNull();
  expect(quickAction(key('}',{code:'BracketRight',shiftKey:true}))).toBeNull();
  expect(quickAction(key('[',{ctrlKey:true}))).toBeNull();
 });
 it('separates frame navigation, creation and duplication from size',()=>{
  expect(quickAction(key('PageUp'))).toBe('previousFrame');expect(quickAction(key('PageDown'))).toBe('nextFrame');
  expect(quickAction(key('F6'))).toBe('blankFrame');expect(quickAction(key('F7'))).toBe('duplicateFrame');
  expect(quickAction(key('F7',{shiftKey:true}))).toBe('deleteFrame');
 });
 it('preserves zoom and existing letter tool shortcuts',()=>{
  expect(quickAction(key('-'))).toBe('zoomOut');expect(quickAction(key('='))).toBe('zoomIn');
  for(const letter of ['b','e','n','g','v','o','p'])expect(quickAction(key(letter))).toBeNull();
 });
 it('bounds brush sizes and does not introduce floating precision errors',()=>{
  expect(steppedBrushSize(1,-1)).toBe(1);expect(steppedBrushSize(150,1)).toBe(150);
  expect(steppedBrushSize(6.2,1)).toBe(7.2);expect(steppedBrushSize(.5,-1,true)).toBe(.5);
 });
 it('reserves O for onion skin and retains unique tool assignments',()=>{
  expect(shortcutValid('o','brush',initialShortcuts)).toBe(false);
  expect(normalizeShortcuts({...initialShortcuts,brush:'o'}).brush).not.toBe('o');
  const all=Object.values(normalizeShortcuts(initialShortcuts));expect(new Set(all).size).toBe(all.length);
 });
});
