import copy
import datetime as dt
from email.message import Message
import json
from pathlib import Path
import tempfile
import unittest
import urllib.error

import bos_equity_feed as feed


NOW = dt.datetime(2026, 11, 15, 4, tzinfo=dt.timezone.utc)
PDF = b"%PDF-1.7\nsynthetic test document\n%%EOF\n"


def snapshot(day="2026-11-13", raw=PDF, count=3, as_of=None):
    records = []
    for index in range(count):
        row = {key: 10 for key in feed.NUMERIC_FIELDS}
        row.update(instrumentId=f"S{index} US", instrumentType="equity", name=f"Share {index}",
                   ticker=f"S{index} US", region="North America", marketGroup="North America",
                   sector="Financials", currency="USD", priceAsOf=as_of or day,
                   sourcePage=1, sourceRow=index + 1, esgRating="RESTRICTED_ESG_TEST_VALUE",
                   moat="Wide", rating="Buy", riskRating=3, analystReportMonth="2026-11",
                   analystOrUncertainty="Medium", researchProvider="Morningstar",
                   researchProviderEvidence="embedded_report_link", researchReportUrl=None,
                   fairValueOrTargetKind="fair_value", priceKind="published_reference_price")
        row["raw"] = {key: str(row.get(key, "")) for key in feed.SOURCE_COLUMNS}
        records.append(row)
    return {
        "schemaVersion": 1, "sourceId": feed.SOURCE_ID, "reportDate": day,
        "priceAsOf": as_of or day, "sourceUrl": feed.source_url(dt.date.fromisoformat(day)),
        "sourceSha256": feed.sha256(raw), "metricBasis": "Consensus forward estimates; period not specified",
        "columns": [{"key": key, "sourceLabel": key, "unit": None, "basis": None} for key in feed.SOURCE_COLUMNS],
        "records": records,
        "validation": {"passed": True, "records": count, "equities": count, "indices": 0,
                       "pageCount": 2, "tablePages": [1], "pages": {"1": {"records": count, "independentTextRows": count}},
                       "groups": {"North America": count}},
    }


class Response:
    def __init__(self, url, data=PDF, mime="application/pdf"):
        self.status, self.url, self.data = 200, url, data
        self.headers = Message()
        self.headers["Content-Type"] = mime
        self.headers["Content-Length"] = str(len(data))

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def geturl(self):
        return self.url

    def read(self, size):
        return self.data[:size]


class IngestionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.public, self.private = self.root / "feed", self.root / "private"

    def ingest(self, data=None, raw=PDF, **kwargs):
        return feed.ingest(data or snapshot(raw=raw), raw, self.public, self.private,
                           now=NOW, public=True, **kwargs)

    def manifest(self):
        return feed.read_json(self.public / "bos/manifest.json")

    def files(self):
        return {str(path.relative_to(self.root)): path.read_bytes()
                for path in self.root.rglob("*") if path.is_file()}

    def test_public_omits_all_esg_cells_and_preserves_private(self):
        self.ingest()
        manifest = self.manifest()
        public = feed.read_ref(self.public / "bos", manifest["latest"])
        self.assertEqual(len(public["columns"]), 18)
        self.assertEqual(public["records"][0]["fairValueOrTargetKind"], "fair_value")
        for path in self.public.rglob("*"):
            if path.is_file():
                self.assertNotIn(b"RESTRICTED_ESG_TEST_VALUE", path.read_bytes())
                self.assertNotIn(b'"esgRating"', path.read_bytes())
        private_json = next((self.private / "extracted").glob("*.json"))
        self.assertIn("RESTRICTED_ESG_TEST_VALUE", private_json.read_text())
        self.assertEqual(len(list(self.public.rglob("*.pdf"))), 0)

    def test_identical_pdf_is_byte_identical_noop(self):
        self.ingest()
        before = self.files()
        result = self.ingest()
        self.assertEqual(result["status"], "unchanged")
        self.assertEqual(before, self.files())

    def test_same_day_revision_preserves_original(self):
        self.ingest()
        original = self.manifest()["latest"]
        revised_pdf = PDF + b"\nrevision"
        revised = snapshot(raw=revised_pdf)
        revised["records"][0]["price"] = 11
        self.ingest(revised, revised_pdf)
        manifest = self.manifest()
        self.assertEqual(len(manifest["editions"]), 2)
        self.assertNotEqual(manifest["latest"]["path"], original["path"])
        self.assertEqual(feed.read_ref(self.public / "bos", original)["records"][0]["price"], 10)

    def test_older_backfill_does_not_downgrade_latest(self):
        self.ingest()
        original = self.manifest()["latest"]
        earlier_pdf = PDF + b"\nearlier"
        self.ingest(snapshot("2026-11-12", earlier_pdf), earlier_pdf)
        self.assertEqual(self.manifest()["latest"], original)
        self.assertEqual(len(self.manifest()["editions"]), 2)

    def test_later_report_with_older_price_date_cannot_downgrade(self):
        self.ingest()
        original = self.manifest()["latest"]
        later_pdf = PDF + b"\nlater report older quote"
        self.ingest(snapshot("2026-11-14", later_pdf, as_of="2026-11-12"), later_pdf)
        self.assertEqual(self.manifest()["latest"], original)

    def test_failures_preserve_all_previous_bytes(self):
        self.ingest()
        before = self.files()
        raw = PDF + b"\nbad"
        variants = []
        data = snapshot(raw=raw)
        del data["records"][0]["pe"]
        variants.append(data)
        data = snapshot(raw=raw)
        data["validation"]["pages"]["1"]["independentTextRows"] = 2
        variants.append(data)
        data = snapshot(raw=raw)
        data["records"][1]["instrumentId"] = data["records"][0]["instrumentId"]
        variants.append(data)
        data = snapshot(raw=raw)
        data["records"][0]["price"] = float("nan")
        variants.append(data)
        for invalid in variants:
            with self.subTest(invalid=invalid):
                with self.assertRaises(ValueError):
                    self.ingest(invalid, raw)
                self.assertEqual(self.files(), before)

    def test_count_drop_requires_review(self):
        self.ingest()
        before = self.files()
        raw = PDF + b"\nsmaller"
        with self.assertRaisesRegex(ValueError, "20%"):
            self.ingest(snapshot(raw=raw, count=1), raw)
        self.assertEqual(self.files(), before)

    def test_private_mode_does_not_create_public_feed(self):
        result = feed.ingest(snapshot(), PDF, self.public, self.private, now=NOW)
        self.assertEqual(result["status"], "prepared_private")
        self.assertFalse(self.public.exists())
        self.assertTrue(self.private.exists())

    def test_private_directory_cannot_be_public(self):
        with self.assertRaisesRegex(ValueError, "outside"):
            feed.ingest(snapshot(), PDF, self.public, self.public / "private", now=NOW, public=True)
        self.assertFalse(self.public.exists())

    def test_source_date_and_checksum_validation(self):
        for modification in ({"sourceSha256": "bad"}, {"reportDate": "2026-11-16"}, {"sourceUrl": "https://example.org/a.pdf"}):
            data = snapshot()
            data.update(modification)
            with self.assertRaises(ValueError):
                self.ingest(data)
        with self.assertRaisesRegex(ValueError, "URL date"):
            self.ingest(expected_date=dt.date(2026, 11, 14))
        self.assertFalse(self.public.exists())

    def test_verified_mapping_currency_and_ambiguity(self):
        mapping = {"ticker": "S0", "currency": "USD", "instrumentId": "S0 US", "verified": True}
        self.ingest(mappings=[mapping])
        self.assertEqual(self.manifest()["verifiedMappings"], [mapping])
        raw = PDF + b"\nnext"
        self.ingest(snapshot("2026-11-14", raw), raw)
        self.assertEqual(self.manifest()["verifiedMappings"], [mapping])
        for mappings in ([dict(mapping, currency="SGD")], [mapping, mapping], [dict(mapping, verified=False)]):
            with self.assertRaises(ValueError):
                feed.validated_mappings(mappings, snapshot()["records"], require_present=True)

    def test_csv_preserves_numeric_negative_and_protects_formulas(self):
        data = snapshot()
        data["records"][0]["name"] = "=SUSPICIOUS()"
        data["records"][0]["pe"] = -5
        public = feed.public_snapshot(data, feed.group_counts(data["records"]))
        text = feed.csv_bytes(public).decode("utf-8-sig")
        self.assertIn("'=SUSPICIOUS()", text)
        self.assertIn(",-5,", text)


class DiscoveryTests(unittest.TestCase):
    def test_http_200_html_missing_day_looks_back(self):
        seen = []
        def opener(request, timeout):
            seen.append(request.full_url)
            self.assertEqual(timeout, 20)
            return Response(request.full_url, b"<html>not found</html>", "text/html") if len(seen) < 3 else Response(request.full_url)
        day, url, raw = feed.discover_pdf(dt.date(2026, 11, 15), opener=opener)
        self.assertEqual(day, dt.date(2026, 11, 13))
        self.assertEqual(raw, PDF)
        self.assertEqual(len(seen), 3)

    def test_bounds_not_found_requests(self):
        seen = []
        def opener(request, timeout):
            seen.append(request.full_url)
            raise urllib.error.HTTPError(request.full_url, 404, "missing", {}, None)
        with self.assertRaises(FileNotFoundError):
            feed.discover_pdf(dt.date(2026, 11, 15), opener=opener)
        self.assertEqual(len(seen), 11)

    def test_rejects_fake_pdf_and_cross_host_redirect(self):
        for response in (Response(feed.source_url(dt.date(2026, 11, 15)), b"HTML error masquerading as PDF"),
                         Response("https://example.org/foreign.pdf")):
            with self.assertRaises(ValueError):
                feed.discover_pdf(dt.date(2026, 11, 15), opener=lambda *args, **kwargs: response)

    def test_does_not_silently_hide_server_or_auth_error(self):
        for status in (403, 500):
            def opener(request, timeout):
                raise urllib.error.HTTPError(request.full_url, status, "failure", {}, None)
            with self.assertRaises(urllib.error.HTTPError):
                feed.discover_pdf(dt.date(2026, 11, 15), opener=opener)


if __name__ == "__main__":
    unittest.main()
