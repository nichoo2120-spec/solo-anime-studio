import {describe,it,expect} from 'vitest';
import {rejectCanvasContact,endsCanvasCaptureOnControl,type PenContact} from '../src/engine/penContact';
const contact=(pointerType:string,isPrimary:boolean,button=0,pointerId=32):PenContact=>({pointerType,isPrimary,button,pointerId});
describe('Wacom non-primary pen regression',()=>{
 it('accepts recorded non-primary Wacom tip when no active canvas pointer',()=>{
  expect(rejectCanvasContact(contact('pen',false),undefined,false)).toBeUndefined();
 });
 it('does not admit a second pen while another pointer draws',()=>{
  expect(rejectCanvasContact(contact('pen',false),27,false)).toBe('secondary-pen-while-active');
 });
 it('does not promote secondary touch, mouse or pen barrel to drawing',()=>{
  expect(rejectCanvasContact(contact('touch',false),undefined,false)).toBe('secondary-pointer');
  expect(rejectCanvasContact(contact('mouse',false),undefined,false)).toBe('secondary-pointer');
  expect(rejectCanvasContact(contact('pen',false,1),undefined,false)).toBe('secondary-pointer');
 });
 it('preserves busy and unsupported-button protections',()=>{
  expect(rejectCanvasContact(contact('pen',false),undefined,true)).toBe('busy');
  expect(rejectCanvasContact(contact('pen',true,5),undefined,false)).toBe('unsupported-button');
 });
 it('recognizes non-primary pen tip as a control interaction',()=>{
  expect(endsCanvasCaptureOnControl(contact('pen',false))).toBe(true);
  expect(endsCanvasCaptureOnControl(contact('touch',false))).toBe(false);
 });
});
