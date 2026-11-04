set -x
for cfg in "2 4 busy 30,70,150 '' 2048 1152" "1 4 busy 30,150 '' 2048 1152" "2 4 busy720 30,150 '' 2048 1152" "2 4 busy10 30,150 '' 2048 1152" "2 1 busy 30,150 '' 2048 1152" "2 4 busy 30,150 '' 1280 720"; do
 for v in v154 v156; do eval node matrix.mjs $v $cfg; done
done
echo ALLDONE
