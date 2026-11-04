const assert=require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('src/tools/transform/TransformTool.ts','utf8');
assert(src.includes('private meshIsUndeformed():boolean'), 'neutral warp check must exist');
assert(src.includes('&&this.meshIsUndeformed()'), 'neutral paint must bypass texture mesh');
assert(src.includes('c.drawImage(source,srcBox.x,srcBox.y);c.restore();return;'), 'neutral warp should paint source pixels directly');
assert(src.includes("meshWarp&&this.meshIsUndeformed()"), 'neutral commit should not rebake ink');
console.log('PASS mesh neutral source preservation source-path test');
