export function readPreference<T>(key:string,fallback:T):T{try{const v=localStorage.getItem('solo:'+key);return v?JSON.parse(v):fallback;}catch{return fallback;}}
export function writePreference(key:string,value:unknown){try{localStorage.setItem('solo:'+key,JSON.stringify(value));}catch{/* Project storage remains independent of optional layout preferences. */}}
