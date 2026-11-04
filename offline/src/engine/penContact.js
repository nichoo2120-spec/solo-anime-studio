export function rejectCanvasContact(event, activePointerId, busy) {
    if (busy)
        return 'busy';
    if (event.button !== 0 && event.button !== 1)
        return 'unsupported-button';
    if (event.isPrimary !== false)
        return undefined;
    if (event.pointerType !== 'pen' || event.button !== 0)
        return 'secondary-pointer';
    if (activePointerId !== undefined)
        return 'secondary-pen-while-active';
    // A pen tip with no active canvas owner is eligible regardless of isPrimary.
    return undefined;
}
/** Pen tip presses on UI controls should release abandoned canvas capture,
 * even when the tablet driver labels that pen non-primary. */
export function endsCanvasCaptureOnControl(event) {
    return event.isPrimary !== false || (event.pointerType === 'pen' && event.button === 0);
}
