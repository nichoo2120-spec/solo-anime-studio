/** Fixed canvas/timeline shortcuts. Kept separate from custom letter-key tool bindings. */
export type QuickAction='sizeDown'|'sizeUp'|'previousFrame'|'nextFrame'|'blankFrame'|'duplicateFrame'|'deleteFrame'|'zoomOut'|'zoomIn';
/** Context-scoped Delete/Backspace. A focused timeline cel means delete the selected
 * drawing frame; on canvas the same keys retain existing artwork-delete behavior.
 * On a Mac keyboard running Windows, the Delete/⌫ key commonly sends Backspace.
 */
export function timelineDeleteKey(event:Pick<KeyboardEvent,'key'|'ctrlKey'|'metaKey'|'altKey'|'shiftKey'>,isFrameCellFocused:boolean){
 return isFrameCellFocused&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey&&(event.key==='Delete'||event.key==='Backspace');
}
export type QuickKey=Pick<KeyboardEvent,'key'|'code'|'ctrlKey'|'metaKey'|'altKey'|'shiftKey'>;
export function quickAction(event:QuickKey):QuickAction|null{
 if(event.ctrlKey||event.metaKey||event.altKey)return null;
 if(event.shiftKey)return event.key==='F7'?'deleteFrame':null;
 switch(event.key){
  case '[':return 'sizeDown';
  case ']':return 'sizeUp';
  case 'PageUp':return 'previousFrame';
  case 'PageDown':return 'nextFrame';
  case 'F6':return 'blankFrame';
  case 'F7':return 'duplicateFrame';
  case '-':return 'zoomOut';
  case '=':return 'zoomIn';
 }
 // Bracket key codes support layouts that produce a different key label.
 if(event.code==='BracketLeft')return 'sizeDown';
 if(event.code==='BracketRight')return 'sizeUp';
 return null;
}
/** The drawing size slider goes from 1 to 150 px; vector width starts at 0.5 px. */
export function steppedBrushSize(value:number,direction:-1|1,vector=false){
 const min=vector?.5:1,max=150;
 return Math.round(Math.min(max,Math.max(min,value+direction))*10)/10;
}
export const quickShortcutGuide:[string,string][]= [
 ['Brush/eraser/vector size','[ / ]'],
 ['Previous / next drawing','Page Up / Page Down'],
 ['New blank drawing cel','F6'],
 ['Choose animation layer','Alt + ↑ / Alt + ↓'],
 ['Change only a layer hold','Alt + [ / Alt + ]'],
 ['Copy held cel into new key','Alt + K'],
 ['Make blank key from hold','Alt + Shift + K'],
 ['Duplicate current cel','F7'],
 ['Delete selected cel','Delete / ⌫ after clicking frame; Shift + F7 anywhere'],
 ['Extend / shorten frame hold','Shift + ] / Shift + ['],
 ['Preview previous / next drawing','Hold , / .'],
 ['Toggle onion skin','O'],
 ['Play / pause','Shift + Space'],
 ['Zoom out / in','- / ='],
 ['Temporary canvas pan','Hold Space + drag'],
 ['Undo / redo','Ctrl/⌘ + Z / Ctrl/⌘ + Shift + Z or Y'],
 ['Save project','Ctrl/⌘ + S'],
];
