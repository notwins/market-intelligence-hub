import subprocess, unittest
from pathlib import Path
class SIBeta2Tests(unittest.TestCase):
 def test_creator_contract(self):
  subprocess.run(['node','scripts/test_si_beta2.cjs'],cwd=Path(__file__).resolve().parents[1],check=True)
if __name__=='__main__':unittest.main()
