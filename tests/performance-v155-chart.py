"""Render the measured before/after chart; run from the app root."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

before=json.loads(Path('validation/v155-before-app-performance.json').read_text())['rows']
after=json.loads(Path('validation/v155-after-app-performance.json').read_text())['rows']
pairs=[(x,y) for x,y in zip(before,after) if x['cpu']==1]
labels={'hb':'HB Pencil','technical':'Technical Ink','dry-ink-bristle':'Dry Ink','color-solid':'Solid Paint','smudge-bristle':'Smudge Bristle 30','color-blender':'Classic Blender 30','eraser-hard':'Hard Eraser'}
fig,axes=plt.subplots(1,2,figsize=(15,6.6))
fig.patch.set_facecolor('#f7fafc')
ys=np.arange(len(pairs))
for ax,metric,title in [(axes[0],'composition','Median composition time'),(axes[1],'frame','Drawing frame p95')]:
    values=[[p[i][metric]['p50' if metric=='composition' else 'p95'] for p in pairs] for i in [0,1]]
    for i,v in enumerate(values):
        bars=ax.barh(ys+(i-.5)*.32,v,height=.30,color=['#647b91','#04aeb8'][i],label=['v0.5.154','v0.5.155'][i])
        ax.bar_label(bars,labels=[f'{n:.1f}' for n in v],padding=4,fontsize=9)
    ax.set_yticks(ys,[labels[x['preset']] for x,y in pairs])
    ax.invert_yaxis()
    ax.set_title(title,loc='left',fontweight='bold',fontsize=13,pad=14)
    ax.set_xlabel('Milliseconds · lower is better')
    ax.spines[['top','right','left']].set_visible(False)
    ax.grid(axis='x',alpha=.15)
    ax.set_axisbelow(True)
    ax.set_xlim(0,max(max(v) for v in values)*1.18)
    ax.set_facecolor('#f7fafc')
fig.suptitle('Solo Anime Studio v0.5.155 · Performance P1',x=.035,ha='left',fontsize=18,fontweight='bold',color='#18384b')
fig.text(.035,.91,'Production app · 281 strokes / 6 layers · 2048×1152 viewport · DPR 2 · CPU 1× · software canvas',fontsize=10,color='#526778')
fig.legend(*axes[0].get_legend_handles_labels(),loc='upper right',bbox_to_anchor=(.97,.91),ncol=2,frameon=False)
fig.text(.035,.045,'Composition improves at 1× CPU; cold starts and classic Blender still produce long frames.\nThe full report includes the 4× CPU stress results, including regressions.',fontsize=10,color='#526778')
fig.subplots_adjust(left=.15,right=.97,top=.82,bottom=.18,wspace=.65)
fig.savefig('performance_v155.png',dpi=135)
plt.close(fig)
