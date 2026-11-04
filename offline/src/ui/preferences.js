export function readPreference(key, fallback) { try {
    const v = localStorage.getItem('solo:' + key);
    return v ? JSON.parse(v) : fallback;
}
catch {
    return fallback;
} }
export function writePreference(key, value) { try {
    localStorage.setItem('solo:' + key, JSON.stringify(value));
}
catch { /* Project storage remains independent of optional layout preferences. */ } }
