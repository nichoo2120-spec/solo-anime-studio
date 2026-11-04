export function pickItems(items, current, id, shift = false, alt = false) {
    if (!items.includes(id))
        return current;
    const valid = current.ids.filter(value => items.includes(value));
    const anchor = current.anchor && items.includes(current.anchor) ? current.anchor : id;
    if (shift) {
        const a = items.indexOf(anchor), b = items.indexOf(id);
        return { ids: items.slice(Math.min(a, b), Math.max(a, b) + 1), anchor };
    }
    if (alt) {
        return { ids: valid.includes(id) ? valid.filter(value => value !== id) : [...valid, id], anchor: current.anchor && items.includes(current.anchor) ? current.anchor : id };
    }
    return { ids: [id], anchor: id };
}
