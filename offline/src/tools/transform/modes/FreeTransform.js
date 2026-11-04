import { move } from './Move.js';
import { scale } from './Scale.js';
import { rotate } from './Rotate.js';
import { skew } from './Skew.js';
import { perspective } from './Perspective.js';
import { distort } from './Distort.js';
export const freeTransform = (s, d, p, k) => { if (d.handle.type === 'rotate')
    rotate(s, d, p, k);
else if (d.handle.type === 'corner')
    (k.ctrl && k.shift ? perspective : k.ctrl ? distort : scale)(s, d, p, k);
else if (d.handle.type === 'edge')
    (k.ctrl ? skew : scale)(s, d, p, k);
else
    move(s, d, p, k); };
