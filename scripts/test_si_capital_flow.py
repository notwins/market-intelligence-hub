import unittest, subprocess
from pathlib import Path
class Sicapitalflow(unittest.TestCase):
    def test_model_and_navigation(self):
        root=Path(__file__).resolve().parents[1]
        source=root/'site'
        self.assertIn('tools/accumulator-si-flow.html',(source/'v4.html').read_text())
        self.assertIn('tools/accumulator-si-flow.html',(source/'Primary Navigation - Type JS - 16-Nov-16.06.js').read_text())
        subprocess.run(['node','--check',str(source/'tools/accumulator-si-flow.js')],check=True)
        subprocess.run(['node','-e',"""const assert=require('node:assert/strict');
const {calculate}=require('./site/tools/accumulator-si-flow-model.js');
const c={months:6,shares:1000,strike:90,spot:100,ko:110,guarantee:2,interest:true,rate:3.92,spread:0,fraction:100,valuation:'exit',sale:110};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,a+' != '+b);
for(const [params,path,shares,refund,interest] of [[c,[90,101,115,97,97,97],3000,270000,4410],[c,[115,100,100,100,100,100],2000,360000,1764],[c,[90,91,92,93,94,95],6000,0,6174],[{...c,fraction:50},[90,101,115,97,97,97],2500,315000,4410],[{...c,interest:false},[90,101,115,97,97,97],3000,270000,0],[{...c,guarantee:0,fraction:0},[115,100,100,100,100,100],0,540000,1764]]){const r=calculate(params,path);close(r.totalShares,shares);close(r.refund,refund);close(r.interest,interest);close(r.cost+r.refund,r.capital);close(r.interest,r.tranches.reduce((s,t)=>s+t.interest,0));}
"""],cwd=root,check=True)
