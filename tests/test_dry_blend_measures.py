"""Tests the supplied measuring standard, not the retired Phase 1 definitions."""
import unittest,importlib.util,hashlib,tempfile
from pathlib import Path
import numpy as np
from PIL import Image
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('provided_metrics',HERE/'reference/metrics.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class StandardTests(unittest.TestCase):
 def test_supplied_source_is_unchanged(self):self.assertEqual(hashlib.sha256((HERE/'reference/metrics.py').read_bytes()).hexdigest(),'bca694ce831a227be994c6f4b4a7107c30c6979abf3ee3b31b5085206cafa460')
 def test_run_measure(self):
  s,e=m.runs(np.array([0,1,1,0,1,1,1,0],bool));self.assertEqual((e-s).tolist(),[2,3])
 def test_alpha_loading(self):
  with tempfile.TemporaryDirectory()as t:
   a=np.zeros((10,10,4),np.uint8);a[:,:,3]=128;p=Path(t)/'layer.png';Image.fromarray(a).save(p);np.testing.assert_allclose(m.load_layer(p),128/255,atol=1e-7)
 def test_reference_has_the_four_expected_strokes(self):
  data=m.load_ref(HERE/'reference/ref_drybrush.png');parts=m.split_strokes(data,4);self.assertEqual(len(parts),4)
  for r,_ in parts:
   d=m.analyze(r);self.assertGreater(d['mean_alpha_hull'],.75);self.assertLess(d['aniso_gx_gy'],.34)
if __name__=='__main__':unittest.main()
