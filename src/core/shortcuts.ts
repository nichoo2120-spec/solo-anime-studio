import type {Tool} from './model';
export type ShortcutCommand=Tool|'pencil'|'resetRotation'|'fit'|'lightTable'|'pinLightTable'|'xsheet'|'substitutionShelf'|'reuseShelf'|'linkCel'|'unlinkCel'|'openProjects'|'audioTrack'|'motionPlanning'|'batchTransform';
export const initialShortcuts:Record<ShortcutCommand,string>={brush:'b',eraser:'e',lasso:'l',rectangle:'m',transform:'v','stroke-select':'s',fill:'g',hand:'h',pencil:'p',zoom:'z',rotate:'r',eyedropper:'i',vector:'n',resetRotation:'shift+r',fit:'f',lightTable:'shift+l',pinLightTable:'shift+p',xsheet:'shift+x',substitutionShelf:'shift+u',reuseShelf:'shift+c',linkCel:'ctrl+alt+l',unlinkCel:'ctrl+alt+u',openProjects:'ctrl+alt+o',audioTrack:'shift+a',motionPlanning:'shift+m',batchTransform:'shift+t'};
export const commandLabels:Partial<Record<ShortcutCommand,string>>={'stroke-select':'Select drawn strokes',pencil:'Select Pencil',zoom:'Zoom tool',rotate:'Rotate Canvas tool',eyedropper:'Eyedropper',resetRotation:'Reset rotation',fit:'Fit canvas',lightTable:'Toggle advanced light table',pinLightTable:'Pin / unpin current drawing',xsheet:'Switch Timeline / Xsheet',substitutionShelf:'Open drawing substitutions shelf',reuseShelf:'Open linked drawings and cycles',linkCel:'Link drawing to selected destination frame',unlinkCel:'Unlink current drawing',openProjects:'Open local projects / project cleanup',audioTrack:'Show / hide animation audio waveform',motionPlanning:'Open timing notes and motion arcs',batchTransform:'Open Multi-Cel Transform'};
export function keyChord(event:Pick<KeyboardEvent,'key'|'shiftKey'> & Partial<Pick<KeyboardEvent,'ctrlKey'|'metaKey'|'altKey'>>){
 // Ctrl+Alt is reserved here for explicit link/unlink commands. All existing
 // single-letter and Shift+letter tool shortcuts keep their original meaning.
 if(event.ctrlKey&&event.altKey&&!event.metaKey)return 'ctrl+alt+'+(event.shiftKey?'shift+':'')+event.key.toLowerCase();
 return (event.shiftKey?'shift+':'')+event.key.toLowerCase();
}
export const shortcutPattern=/^(?:(?:shift\+)?|ctrl\+alt\+)[a-z]$/;
const reserved=(key:string)=>key==='o'||key==='shift+w'||key==='ctrl+alt+d';

export function shortcutValid(key:string,command:string,bindings:Record<string,string>){return shortcutPattern.test(key)&&!reserved(key)&&!Object.entries(bindings).some(([id,value])=>id!==command&&value===key);}
export function normalizeShortcuts(value:unknown){
 const bindings={} as Record<ShortcutCommand,string>,used=new Set<string>();
 // Existing user choices take precedence over newly introduced default keys.
 if(value&&typeof value==='object')for(const [command,key] of Object.entries(value))if(command in initialShortcuts&&typeof key==='string'&&shortcutPattern.test(key)&&!reserved(key)&&!used.has(key)){bindings[command as ShortcutCommand]=key;used.add(key);}
 for(const [command,key] of Object.entries(initialShortcuts))if(!bindings[command as ShortcutCommand]){const letter=key.split('+').at(-1)!,options=[key,'shift+'+letter,'ctrl+alt+'+letter,...'abcdefghijklmnopqrstuvwxyz'.split(''),...'abcdefghijklmnopqrstuvwxyz'.split('').map(k=>'shift+'+k),...'abcdefghijklmnopqrstuvwxyz'.split('').map(k=>'ctrl+alt+'+k)],available=options.find(candidate=>!reserved(candidate)&&!used.has(candidate))!;bindings[command as ShortcutCommand]=available;used.add(available);}
 return bindings;
}
