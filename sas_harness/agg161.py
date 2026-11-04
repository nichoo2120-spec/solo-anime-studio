import json,statistics as st
def L(v,s):return json.load(open(f'data/m_{v}_{s}.json'))['rows']
K={'p95':lambda r:r['frames'].get('p95',0),'lat95':lambda r:r['lat'].get('p95',0),'ltmax':lambda r:r['ltMax'],'up':lambda r:r['upMs'],'undo':lambda r:r['undoMs'],'gid':lambda r:r['gid']}
S={'v160':['d2_t4_busy_2048_r1','d2_t4_busy_2048_r2','d2_t4_busy_2048_r3'],'v161':['d2_t4_busy_2048_r1','d2_t4_busy_2048_r2','d2_t4_busy_2048_r3']}
R={v:[L(v,s) for s in S[v]] for v in S}
def med(v,i,m):return st.median(K[m](run[i]) for run in R[v])
o=['| Brush | Size | p95 frame | input lat p95 | longest task | pen-up | undo | readbacks/stroke |','|---|---|---|---|---|---|---|---|']
rng={}
for i,r in enumerate(R['v160'][0]):
  assert R['v161'][0][i]['brush']==r['brush']
  cells=[]
  for m in K:
    a,b=med('v160',i,m),med('v161',i,m);rng.setdefault(m,{'v160':[],'v161':[]});rng[m]['v160'].append(a);rng[m]['v161'].append(b);cells.append(f'{a:.0f} → {b:.0f}')
  o.append(f"| {r['brush']} | {r['size']} | "+' | '.join(cells)+' |')
o+=['','Ranges v160 / v161:']
for m in K:o.append(f"- {m}: {min(rng[m]['v160']):.0f}–{max(rng[m]['v160']):.0f} / {min(rng[m]['v161']):.0f}–{max(rng[m]['v161']):.0f}")
a,b=L('v160','d2_t4_busy10_2048'),L('v161','d2_t4_busy10_2048')
o+=['','### busy10 (10 layers), single run, v160 → v161','| Brush | Size | p95 | pen-up | undo | longest task |','|---|---|---|---|---|---|']
for x,y in zip(a,b):o.append(f"| {x['brush']} | {x['size']} | "+' | '.join(f"{K[m](x):.0f} → {K[m](y):.0f}" for m in ['p95','up','undo','ltmax'])+' |')
o+=['','### dry-ink 30, DPR 1, 1280x720, CPU 4x, median of 3 (fresh runs today, both builds)']
for v in ['v160','v161']:
  rr=[L(v,f'd1_t4_busy_1280_r{s}')[0] for s in 'xyz'];o.append(f"- {v}: p95 {st.median(K['p95'](r) for r in rr):.0f}, lat95 {st.median(K['lat95'](r) for r in rr):.0f}, longest {st.median(K['ltmax'](r) for r in rr):.0f}, pen-up {st.median(K['up'](r) for r in rr):.0f}, undo {st.median(K['undo'](r) for r in rr):.0f}  (raw p95 {[K['p95'](r) for r in rr]})")
open('tables.md','w').write('\n'.join(o));print('\n'.join(o))
