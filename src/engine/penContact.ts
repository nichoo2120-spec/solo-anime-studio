/** Decide whether a canvas pointerdown can own a new drawing gesture.
 * Some Windows tablet/browser combinations report the first pen tip as
 * isPrimary=false even with no other pointer drawing. Do not equate that
 * flag with an unwanted touch: a free canvas may accept a pen tip.
 * Secondary mouse/touch contacts are never promoted to drawing input.
 * A secondary pen must not displace an already active pointer.
 */
export type PenContact = Pick<PointerEvent,'pointerType'|'pointerId'|'button'|'isPrimary'>;
export type ContactRejection = 'busy'|'unsupported-button'|'secondary-pointer'|'secondary-pen-while-active';

export function rejectCanvasContact(event:PenContact,activePointerId:number|undefined,busy:boolean):ContactRejection|undefined{
 if(busy)return 'busy';
 if(event.button!==0&&event.button!==1)return 'unsupported-button';
 if(event.isPrimary!==false)return undefined;
 if(event.pointerType!=='pen'||event.button!==0)return 'secondary-pointer';
 if(activePointerId!==undefined)return 'secondary-pen-while-active';
 // A pen tip with no active canvas owner is eligible regardless of isPrimary.
 return undefined;
}

/** Pen tip presses on UI controls should release abandoned canvas capture,
 * even when the tablet driver labels that pen non-primary. */
export function endsCanvasCaptureOnControl(event:PenContact):boolean{
 return event.isPrimary!==false||(event.pointerType==='pen'&&event.button===0);
}
