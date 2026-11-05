"""Public SPX research: aggregate-only publication, arithmetic and navigation contracts."""
from pathlib import Path
from html.parser import HTMLParser
from decimal import Decimal as D
import json, math, re, unittest
ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'site/market-understanding/spx-floor-cap-2026-11-05'
class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(); self.tags=[]; self.ids=[]; self.links=[]; self.feed(text)
    def handle_starttag(self, tag, attrs):
        a=dict(attrs); self.tags.append((tag,a))
        if 'id' in a: self.ids.append(a['id'])
        if tag == 'a': self.links.append(a.get('href',''))
class SPXResearch(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text=(FOLDER/'index.html').read_text(); cls.page=Page(cls.text)
        cls.record=json.loads((FOLDER/'publication.json').read_text())
    def test_complete_structure_and_accessible_charts(self):
        self.assertEqual(len(re.findall(r'<section id="section-\d+">',self.text)),35)
        self.assertEqual(sum(t=='svg' for t,a in self.page.tags),9)
        self.assertEqual(len(self.page.ids),len(set(self.page.ids)))
        for n in range(1,36): self.assertIn(f'#section-{n}',self.page.links)
        self.assertEqual(self.text.count('class="chart-scroll"'),9)
        self.assertEqual(self.text.count('<figcaption>'),9)
        self.assertIn('overflow-x:auto',self.text); self.assertIn('@media print',self.text)
        self.assertIn('window.print()',self.text)
    def test_links_and_no_raw_series_distribution(self):
        for href in self.page.links:
            if href.startswith('#'): self.assertIn(href[1:],self.page.ids)
            elif href and not href.startswith(('https:','http:')):
                self.assertTrue((FOLDER/href.split('#')[0]).exists(),href)
        self.assertEqual(sorted(p.name for p in FOLDER.iterdir()),['index.html','publication.json'])
        self.assertFalse(self.record['raw_series_downloads']); self.assertFalse(self.record['copied_source_documents'])
        self.assertNotRegex(self.text,r'libfile_|/workspace/|chatgpt\.com/c/|sediment:|\.csv["\']|\.zip["\']')
        for n in range(31,35):
            section=re.search(rf'<section id="section-{n}">(.*?)</section>',self.text,re.S)[1]
            self.assertNotIn('<table',section)
        self.assertIn('redistribution rights remain unverified',self.text)
        self.assertIn('required data rights permit it',self.text)
    def test_historical_counts_and_basis(self):
        h=self.record['verified_headlines']
        self.assertEqual(h['annual_counts'],[17,10,38]);self.assertEqual(sum(h['annual_counts']),65)
        self.assertEqual(h['monthly_counts'],[16,16,65]);self.assertEqual(sum(h['monthly_counts']),97)
        for x in ['1961-2025','year-end 1960','2011','-0.003181','109','overlapping','two-decimal','NYU','Slickcharts']:
            self.assertIn(x,self.text)
        self.assertEqual(self.record['published_sections'],35)
    def test_clip_boundaries_and_payoff_identity(self):
        clip=lambda r:min(max(r,D(0)),D('.09'))
        for r, expected in [('-0.10','0'),('0','0'),('.065','.065'),('.09','.09'),('.12','.09')]:
            self.assertEqual(clip(D(r)),D(expected))
        self.assertLess(D('1257.60')/D('1257.64')-1,0)
        for end in [D(70),D(100),D('106.5'),D(109),D(120)]:
            payoff=end+max(D(100)-end,0)-max(end-D(109),0)
            self.assertEqual(payoff/D(100)-1,clip(end/D(100)-1))
    def test_independent_model_calculation(self):
        N=lambda x: (1+math.erf(x/math.sqrt(2)))/2
        def option(k,put=False):
            s,r,q,v,t=100,.03,.015,.20,1
            d1=(math.log(s/k)+(r-q+v*v/2)*t)/(v*math.sqrt(t));d2=d1-v*math.sqrt(t)
            return k*math.exp(-r*t)*N(-d2)-s*math.exp(-q*t)*N(-d1) if put else s*math.exp(-q*t)*N(d1)-k*math.exp(-r*t)*N(d2)
        self.assertAlmostEqual(option(100,True),7.07706385183854,places=9)
        self.assertAlmostEqual(option(109),5.0106647696078,places=9)
        self.assertAlmostEqual(option(100,True)-option(109),2.0663990822307,places=9)
        self.assertAlmostEqual(option(103.302907437),option(100,True),places=8)
    def test_evidence_limits_and_sources(self):
        for x in ['hypothetical','dividends','tax','fees','bid/ask','settlement','1983','mark-to-market','not a market quote','not actual product performance']:
            self.assertIn(x,self.text.lower())
        sources=['pages.stern.nyu.edu','slickcharts.com','fred.stlouisfed.org','govinfo.gov','optionseducation.org','cboe.com']
        for host in sources: self.assertTrue(any(host in h for h in self.page.links),host)
    def test_discoverable_and_existing_reports_preserved(self):
        landing=(ROOT/'site/market-understanding/index.html').read_text()
        for slug in ['spx-floor-cap-2026-11-05','structured-investment-hypothetical','ai-data-centres']:
            self.assertIn(slug,landing)
        script=(ROOT/'scripts/build_site_search.py').read_text()
        self.assertIn('market-understanding/spx-floor-cap-2026-11-05/index.html',script)
if __name__=='__main__': unittest.main()
