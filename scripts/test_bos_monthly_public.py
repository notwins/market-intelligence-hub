"""Check the exact public archive format for both source and Pages artifacts."""

import json
from pathlib import Path
import unittest

from build_bos_monthly_public import CALLS, KIND, TARGET_MARKERS

DATA = Path(__file__).resolve().parents[1] / "site/data/bos-monthly-history.json"


class PublicBosMonthlyTest(unittest.TestCase):
    def test_public_fields_coverage_and_missing_values(self):
        data = json.loads(DATA.read_bytes())
        self.assertEqual(set(data), {"kind", "version", "months", "listings", "observationCount"})
        self.assertEqual((data["kind"], data["version"]), (KIND, 1))
        months = data["months"]
        self.assertGreaterEqual(len(months), 113)
        self.assertEqual([m[0] for m in months], sorted({m[0] for m in months}))
        for month, report, quote in months:
            self.assertRegex(month, r"^\d{4}-\d{2}$")
            self.assertRegex(report, r"^\d{4}-\d{2}-\d{2}$")
            self.assertRegex(quote, r"^\d{4}-\d{2}-\d{2}$")
            self.assertLessEqual(quote, report)

        identities = set()
        count = 0
        for ticker, unit, rows, isin in data["listings"]:
            self.assertRegex(ticker, r"^[A-Z0-9./&-]+ [A-Z]{2}$")
            self.assertRegex(unit, r"^[A-Za-z]{3}$")
            if isin is not None:
                self.assertRegex(isin, r"^[A-Z]{2}[A-Z0-9]{9}\d$")
            self.assertNotIn((ticker, unit), identities)
            identities.add((ticker, unit))
            indices = []
            for index, price, eps, call, target, gap, pct in rows:
                self.assertIn(call, CALLS)
                self.assertIsInstance(index, int)
                self.assertGreaterEqual(index, 0)
                self.assertLess(index, len(months))
                self.assertGreater(price, 0)
                self.assertGreater(eps, 0)
                if isinstance(target, str):
                    self.assertIn(target, TARGET_MARKERS)
                    self.assertEqual((gap, pct), (None, None))
                else:
                    self.assertGreaterEqual(target, 0)
                    self.assertAlmostEqual(target - price, gap, places=8)
                    self.assertLessEqual(abs(pct - gap / price), 0.00005000001)
                indices.append(index)
            self.assertEqual(indices, sorted(set(indices)))
            count += len(rows)
        self.assertEqual(count, data["observationCount"])
        self.assertGreaterEqual(count, 120164)


if __name__ == "__main__":
    unittest.main()
