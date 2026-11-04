// Source-level browser-menu regression for Solo Anime Studio v0.5.26.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'App.tsx'), 'utf8');
const canvasTag = source.split('\n').find(line => line.includes('<canvas ref={canvas}'));
assert(canvasTag, 'Expected main drawing canvas');
assert.match(canvasTag, /onContextMenu=\{event=>\{[^}]*event\.preventDefault\(\);[^}]*\}\}/, 'Must prevent native Chrome menu on drawing canvas');
assert(!source.includes('document.addEventListener(\'contextmenu\''), 'Global context menu must remain unaffected');
assert(!source.includes('window.addEventListener(\'contextmenu\''), 'Window-wide context menu must remain unaffected');
const version = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
assert(/^0\.5\.\d+$/.test(version)&&Number(version.split('.')[2])>=26, 'The Wacom context-menu fix must survive later versions');
console.log('PASS: Chrome/Wacom context menu blocked only on main drawing canvas, no global suppression');
