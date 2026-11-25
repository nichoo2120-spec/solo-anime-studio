type FieldChange={key:string;change?:AutosaveDelta};
type ArrayChange={index:number;change:AutosaveDelta};
export type AutosaveDelta=
 | {kind:'replace';value:unknown}
 | {kind:'fields';changes:FieldChange[]}
 | {kind:'items';length:number;changes:ArrayChange[];append:unknown[]};

const plain=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype;

/** Studio snapshots share unchanged operations. Only transfer changed fields
 * and appended items after the worker receives a complete base snapshot. */
export function autosaveDelta(before:unknown,after:unknown):AutosaveDelta|undefined{
 if(Object.is(before,after))return;
 if(Array.isArray(before)&&Array.isArray(after)){
  const changes:ArrayChange[]=[];
  for(let i=0;i<Math.min(before.length,after.length);i++){
   const change=autosaveDelta(before[i],after[i]);if(change)changes.push({index:i,change});
  }
  if(changes.length||before.length!==after.length)return {kind:'items',length:after.length,changes,append:after.slice(before.length)};
  return;
 }
 if(plain(before)&&plain(after)){
  const changes:FieldChange[]=[];
  for(const key of Object.keys(before))if(!Object.hasOwn(after,key))changes.push({key});
  for(const key of Object.keys(after)){
   const change=Object.hasOwn(before,key)?autosaveDelta(before[key],after[key]):{kind:'replace' as const,value:after[key]};
   if(change)changes.push({key,change});
  }
  if(changes.length)return {kind:'fields',changes};
  return;
 }
 return {kind:'replace',value:after};
}

export function applyAutosaveDelta(before:unknown,delta:AutosaveDelta|undefined):unknown{
 if(!delta)return before;
 if(delta.kind==='replace')return delta.value;
 if(delta.kind==='items'){
  if(!Array.isArray(before))throw Error('Autosave array base is missing');
  const after=before.slice(0,delta.length).concat(delta.append);
  for(const {index,change} of delta.changes)after[index]=applyAutosaveDelta(before[index],change);
  return after;
 }
 if(!plain(before))throw Error('Autosave object base is missing');
 const after={...before};
 for(const {key,change} of delta.changes){
  if(change)Object.defineProperty(after,key,{value:applyAutosaveDelta(before[key],change),enumerable:true,writable:true,configurable:true});
  else delete after[key];
 }
 return after;
}
