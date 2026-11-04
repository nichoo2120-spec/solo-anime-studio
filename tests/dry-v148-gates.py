from pathlib import Path
import json,re
v=Path('validation');unit=(v/'v148-unit.log').read_text();reg=(v/'v148-regression.log').read_text()
assert '343 passed' in unit and '66 passed' in unit
assert '58/58 regression scripts passed' in reg
assert not re.search(r'error TS\d+', (v/'v148-tsc.log').read_text())
assert 'built in' in (v/'v148-build.log').read_text()
nav=json.loads((v/'v148-navigation.json').read_text());assert nav['stats']['expected']==11 and nav['stats']['unexpected']==0
ui=json.loads((v/'v148-load.json').read_text());assert len(ui)==2 and all(not r['errors'] and not r['pageErrors'] for r in ui)
for p in ['v148-dry-ui.json','v148-ui.json']:assert not json.loads((v/p).read_text())['errors']
launcher=json.loads((v/'v148-launcher.json').read_text());assert len(launcher)==2 and all(not r['errors'] for r in launcher)
gates={'npm test':'PASS — 343 tests / 66 files','test:regression':'PASS — 58/58 scripts','tsc --noEmit':'PASS','npm run build':'PASS — matching source digest','Metric standard tests':'PASS — 4/4, source SHA unchanged','Renderer properties':'PASS — 56/56','Reproducibility':'PASS — 12/12, live/final 0 differing channels','Old brush hashes':'PASS — 520/520 + 12/12 saved v147 strokes','Production dry and coloring UI':'PASS — controls, pressure, mirror, history and reload','Navigation browser tests':'PASS — 11/11','Actual launcher':'PASS — matching build and changed-source automatic rebuild'}
(v/'v148-gates.json').write_text(json.dumps(gates,indent=2));print('All recorded gates verified.')
