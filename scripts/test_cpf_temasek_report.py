"""Regression checks for the complete CPF OA–Temasek research article.

Run: python3 -m unittest discover -s scripts -p test_cpf_temasek_report.py
All financial checks use exact fractions, never binary floating-point money.
"""
from collections import Counter
from fractions import Fraction as F
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
ARTICLE = ROOT / "site/research/cpf-oa-temasek-2070-2026-11-04"


class Structure(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.tags = Counter()
        self.ids = []
        self.links = []
        self.assets = []
        self.sections = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.tags[tag] += 1
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "a":
            self.links.append(a.get("href", ""))
        if tag in {"script", "img", "iframe"} and a.get("src"):
            self.assets.append(a["src"])
        if tag == "section":
            self.sections.append(a.get("id"))


class CPFTemasekReportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ARTICLE / "index.html").read_text()
        cls.data = json.loads((ARTICLE / "scenarios.json").read_text())
        cls.structure = Structure(cls.html)

    def test_complete_native_article(self):
        self.assertEqual(len(self.structure.sections), 34)
        self.assertEqual(self.structure.tags["svg"], 5)
        self.assertEqual(self.structure.tags["table"], 38)
        self.assertEqual(self.structure.tags["img"], 0)
        self.assertEqual(self.structure.assets, [])
        self.assertLess(len(self.html.encode()), 600_000)
        for section in ["explorer", "summary", "gic-returns", "source-mas",
                        "source-temasek", "math", "schedule"]:
            self.assertIn(section, self.structure.sections)

    def test_links_and_publication_boundary(self):
        self.assertEqual(len(self.structure.ids), len(set(self.structure.ids)))
        for href in self.structure.links:
            if href.startswith("#"):
                self.assertIn(href[1:], self.structure.ids)
        for forbidden in ["/workspace/", "file_000", "libfile_", "chatgpt.com/c/",
                          "data:image/", "Prepared for Winston Ng"]:
            self.assertNotIn(forbidden, self.html)
            self.assertNotIn(forbidden, json.dumps(self.data))
        self.assertIn("Five takeaways", self.html)
        self.assertIn("scenarios.json", self.structure.links)
        self.assertIn("../../v4.html#research", self.structure.links)

    def test_embedded_exact_data_matches_download(self):
        embedded = re.search(r'<script id="scenarioData" type="application/json">(.*?)</script>',
                             self.html, re.S)
        self.assertIsNotNone(embedded)
        self.assertEqual(json.loads(embedded.group(1)), self.data)

    def test_source_references_and_risk_distinctions(self):
        for host in ["cpf.gov.sg", "gic.com.sg", "mas.gov.sg", "mof.gov.sg",
                     "temasek.com.sg", "bis.org"]:
            self.assertTrue(any(host in link for link in self.structure.links), host)
        for term in ["not a forecast", "not live dealing quotes", "87 coupons", "88 coupons",
                     "make-whole", "investor eligibility", "guarantee"]:
            self.assertTrue(term in self.html, term)
        self.assertIn("min-width:640px", self.html)
        self.assertIn("overflow-x:auto", self.html)
        self.assertIn("@media(max-width:650px)", self.html)

    def test_entry_budget_and_costs(self):
        v = self.data["main_practical_case"]["financial_values"]
        face, price, fx = F(v["face_usd"]), F(v["clean_price_percent_of_face"]), F(v["entry_usd_sgd"])
        self.assertEqual(face, 312000)
        self.assertEqual(F(v["clean_cost_usd"]), face * price / 100)
        self.assertEqual(F(v["accrued_interest_usd"]), face * F("0.025") * 30 / 360)
        dirty = (face * price / 100 + F(v["accrued_interest_usd"])) * fx
        self.assertEqual(dirty, F("199728.75"))
        self.assertEqual(dirty + F(v["residual_cash_sgd_before_unspecified_fees"]), 200000)
        self.assertEqual(F(v["annual_coupon_usd"]), face * F("0.025"))

    def test_every_constant_fx_scenario(self):
        rows = self.data["main_practical_case"]["constant_fx_rows"]
        self.assertEqual([F(r["usd_sgd"]) for r in rows], list(map(F, ["1.35", "1.325", "1.3", "1.275", "1.25", "1.225", "1.2"])))
        for r in rows:
            fx = F(r["usd_sgd"])
            with self.subTest(fx=fx):
                self.assertEqual(F(r["semiannual_coupon_sgd"]), 3900 * fx)
                self.assertEqual(F(r["annual_coupon_sgd"]), 7800 * fx)
                self.assertEqual(F(r["annual_coupon_multiple_of_oa_5000"]), 7800 * fx / 5000)
                ending = 312000 * fx + F("271.25")
                self.assertEqual(F(r["ending_estate_sgd_if_all_coupons_spent"]), ending)
                for key, count in [("first_par_call", 87), ("contractual_maturity", 88)]:
                    case = r[key]
                    self.assertEqual(case["coupon_count"], count)
                    self.assertEqual(F(case["gross_coupons_received_sgd"]), 3900 * count * fx)
                    self.assertEqual(F(case["paid_coupons_plus_ending_estate_sgd"]), 3900 * count * fx + ending)

    def test_full_coupon_schedule(self):
        rows = self.data["dated_cashflows_88_with_call_subset"]
        self.assertEqual(len(rows), 88)
        self.assertEqual(sum(r["included_if_called_on_2070_04_06"] for r in rows), 87)
        self.assertEqual(rows[0]["contractual_date_unadjusted_for_business_day"], "2027-04-06")
        self.assertEqual(rows[-1]["contractual_date_unadjusted_for_business_day"], "2070-10-06")
        for i, row in enumerate(rows):
            year, month = 2027 + i // 2, "04" if i % 2 == 0 else "10"
            self.assertEqual(row["contractual_date_unadjusted_for_business_day"], f"{year}-{month}-06")
            self.assertEqual(F(row["contractual_maturity_scenario"]["coupon_usd"]), 3900)
        self.assertEqual(F(rows[-1]["contractual_maturity_scenario"]["principal_usd"]), 312000)
        self.assertEqual(F(rows[-2]["first_par_call_scenario"]["principal_usd"]), 312000)

    def test_discoverable_research_card(self):
        hub = (ROOT / "site/v4.html").read_text()
        self.assertEqual(hub.count('id="cpf-temasek-research-card"'), 1)
        self.assertIn('href="research/cpf-oa-temasek-2070-2026-11-04/"', hub)


if __name__ == "__main__":
    unittest.main()
