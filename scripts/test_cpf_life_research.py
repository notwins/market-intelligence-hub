"""Publication and arithmetic safeguards for the original CPF LIFE research."""
import json
import pathlib
import subprocess
import unittest
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
REPORT = ROOT / "site/research/cpf-life-after-55-2026-11-04"


class CPFLifeResearchTests(unittest.TestCase):
    def test_required_artifacts_and_no_private_links(self):
        for name in ("index.html", "model.js", "ui.js", "research-prompt.md", "cpf-life-xirr-comparison.xlsx"):
            self.assertTrue((REPORT / name).is_file(), name)
        html = (REPORT / "index.html").read_text()
        for text in ("Synthetic scenario", "not a CPF or HSBC quotation", "No invented payout or XIRR", "S$440,800", "S$220,400"):
            self.assertIn(text, html)
        for private in ("libfile_", "chatgpt.com/c/", "PRIVATE.txt", "Client -"):
            self.assertNotIn(private, html)
        self.assertNotIn("https://cdn", html)

    def test_same_capital_and_death_date_arithmetic(self):
        program = """const M=require(process.argv[1]); const r=M.run(M.defaults);
        const a=M.run(M.defaults,90); const z=M.run({...M.defaults,raRate:0,accumulation:0,returnRate:0},70);
        console.log(JSON.stringify({cash:r.cumCPF,estate:r.portfolio,xirr:r.cpfXirr,portfolioXirr:r.portfolioXirr,
        payments:r.flows.cpf.length-1,last:r.rows.at(-1).date,zeroCPF:z.cpfXirr,zeroPortfolio:z.portfolioXirr,
        depletion:a.depletion,shortfall:a.cumCPF-a.cumPortfolio,early:M.run(M.defaults,63).cpfIncomeXirr}));"""
        result = json.loads(subprocess.check_output(["node", "-e", program, str(REPORT / "model.js")], text=True))
        self.assertEqual(result["payments"], 240)
        self.assertEqual(result["cash"], 156000)
        self.assertEqual(result["last"], "2051-11-01")
        self.assertAlmostEqual(result["estate"], 29312.279179906756, places=7)
        self.assertAlmostEqual(result["xirr"], .031240257404825056, places=10)
        self.assertAlmostEqual(result["portfolioXirr"], .03997520761798079, places=10)
        self.assertAlmostEqual(result["zeroCPF"], 0, places=10)
        self.assertAlmostEqual(result["zeroPortfolio"], 0, places=10)
        self.assertEqual(result["depletion"], 89)
        self.assertAlmostEqual(result["shortfall"], 7344.550803687336, places=7)
        self.assertIsNone(result["early"])

    def test_workbook_is_excel_with_xirr(self):
        with zipfile.ZipFile(REPORT / "cpf-life-xirr-comparison.xlsx") as z:
            sheets = [n for n in z.namelist() if n.startswith("xl/worksheets/sheet") and n.endswith(".xml")]
            self.assertGreaterEqual(len(sheets), 3)
            self.assertTrue(any("XIRR(" in z.read(n).decode() for n in sheets))

    def test_writeup_is_unique_in_research_explained(self):
        hub = (ROOT / "site/v4.html").read_text()
        explained = (ROOT / "site/market-understanding/index.html").read_text()
        self.assertEqual(explained.count('href="../research/cpf-life-after-55-2026-11-04/"'), 1)
        self.assertIn('href="market-understanding/"', hub)
        self.assertNotIn('id="cpf-life-after-55-card"', hub)

    def test_browserless_ui_behaviour(self):
        output = subprocess.check_output(["node", str(ROOT / "scripts/test_cpf_life_ui.cjs")], text=True)
        self.assertIn("Passed 16 UI-harness assertions", output)


if __name__ == "__main__":
    unittest.main()
