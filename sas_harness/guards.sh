O=/workspace/sas_b18_out; W=/workspace/sas_b18_work; cd $W
export CHROMIUM_PATH=/usr/bin/google-chrome
for t in dry-v148-goldens blender-v154-legacy smudge-v156-visual; do timeout 1200 node tests/$t.mjs > $O/guard_$t.log 2>&1; echo "guard $t exit $?" >> $O/progress.txt; done
for t in drawing-v157-parity drawing-v155-parity; do for d in 1 2; do for i in $(seq 1 10); do s=$(date +%s); PARITY_DPRS="[$d]" timeout 900 node tests/$t.mjs > $O/par_d${d}_${t}_r$i.log 2>&1; echo "$t dpr$d r$i exit $? $(( $(date +%s)-s ))s" >> $O/parity_summary.txt; done; done; done
echo GUARDSDONE >> $O/progress.txt
