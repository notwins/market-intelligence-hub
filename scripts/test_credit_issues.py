"""Synthetic fixtures only; these tests make no claims about real issuance terms."""
from contextlib import redirect_stdout, redirect_stderr
from copy import deepcopy
from datetime import datetime, timezone
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from import_credit_issues import (
    active_rows, main, merge_edition, read_json, validate_dataset,
    validate_edition, validate_source_url, write_dataset,
)


NOW = datetime(2026, 11, 4, 10, 0, tzinfo=timezone.utc)


def sample(edition_id="credit-2026-11-04"):
    return {
        "id": edition_id,
        "checked_at": "2026-11-04T09:00:00Z",
        "source_scope": "Synthetic issuer pricing supplement fixture, not live credit quotes.",
        "rows": [{
            "id": "example-2036-2026-11-02", "issuer": "Example Technology Inc.",
            "ticker": "EXM", "currency": "USD", "maturity": "2036-11-02",
            "pricing_date": "2026-11-02", "pricing_time": None,
            "time_precision": "date_only", "coupon_type": "fixed",
            "coupon_percent": 4.5, "issue_price_percent": 99.7,
            "issue_yield_percent": 4.54, "spread_bp": 60,
            "spread_metric": "treasury_benchmark_at_issue",
            "benchmark": {"description": "Synthetic 10-year Treasury", "yield_percent": 3.94},
            "amount_m": 1000, "source_url": "https://www.sec.gov/Archives/edgar/data/1/example.htm",
            "notes": "Synthetic fixture.", "verification": "primary_checked",
        }],
    }


def dataset(*editions):
    return {"schema_version": 1, "editions": list(editions)}


class EditionValidationTests(unittest.TestCase):
    def assert_bad_row(self, field, values):
        for value in values:
            with self.subTest(field=field, value=value):
                edition = sample()
                edition["rows"][0][field] = value
                with self.assertRaises(ValueError):
                    validate_edition(edition, NOW)

    def test_accepts_valid_primary_without_mutation(self):
        edition = sample()
        original = deepcopy(edition)
        self.assertEqual(validate_edition(edition, NOW), edition)
        self.assertEqual(edition, original)
        self.assertIsNone(edition["rows"][0]["pricing_time"])

    def test_date_only_cannot_have_an_invented_timestamp(self):
        self.assert_bad_row("pricing_time", ["2026-11-02T00:00:00Z", "", False])

    def test_timestamp_precision_requires_aware_matching_source_date(self):
        edition = sample()
        row = edition["rows"][0]
        row.update(time_precision="timestamp", pricing_time="2026-11-02T16:30:00-05:00")
        validate_edition(edition, NOW)
        for value in (None, "2026-11-02T16:30:00", "2026-11-03T16:30:00Z",
                      "2026-11-02T25:00:00Z", "2026-11-02T16:30:00+15:00"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                row["pricing_time"] = value
                validate_edition(edition, NOW)

    def test_timestamp_cannot_be_later_than_check(self):
        edition = sample()
        edition["rows"][0].update(pricing_date="2026-11-04", time_precision="timestamp",
                                  pricing_time="2026-11-04T09:00:01Z")
        with self.assertRaises(ValueError):
            validate_edition(edition, NOW)

    def test_strict_dates_and_maturity(self):
        self.assert_bad_row("pricing_date", ["2026-1-02", "20261102", "2026-02-30",
                                             "2026-11-05", True, None])
        self.assert_bad_row("maturity", ["2036-2-02", "2036-02-30", "2026-11-02", "2025-11-02"])

    def test_future_boundary_uses_singapore_day_not_utc_day(self):
        now = datetime(2026, 11, 3, 17, 0, tzinfo=timezone.utc)
        edition = sample()
        edition["checked_at"] = "2026-11-04T00:30:00+08:00"
        edition["rows"][0]["pricing_date"] = "2026-11-04"
        validate_edition(edition, now)
        edition["rows"][0]["pricing_date"] = "2026-11-05"
        with self.assertRaises(ValueError):
            validate_edition(edition, now)

    def test_check_must_be_valid_aware_not_future(self):
        for value in ("2026-11-04", "2026-11-04T09:00:00", "2026-11-04T10:00:01Z",
                      "2026-11-05T00:00:00+08:00", "2026-02-30T09:00:00Z",
                      "2026-11-04T09:00:00+08:99", True):
            with self.subTest(value=value), self.assertRaises(ValueError):
                edition = sample()
                edition["checked_at"] = value
                validate_edition(edition, NOW)

    def test_no_pricing_after_review_date(self):
        edition = sample()
        edition["checked_at"] = "2026-11-01T00:00:00Z"
        with self.assertRaises(ValueError):
            validate_edition(edition, NOW)

    def test_enums_identifiers_and_currency(self):
        for field, values in {
            "id": ["bad id", "<script>", "", 1], "ticker": ["exm", "EX M", "<EXM>", 1],
            "currency": ["SGD", "EUR", None], "coupon_type": ["floating", None],
            "spread_metric": ["oas", "live", None], "verification": ["verified", None],
            "time_precision": ["day", None],
        }.items():
            self.assert_bad_row(field, values)

    def test_number_types_bounds_and_finiteness(self):
        for field in ("coupon_percent", "issue_price_percent", "issue_yield_percent", "spread_bp", "amount_m"):
            self.assert_bad_row(field, [True, False, "4.5", None, float("nan"), float("inf"),
                                       float("-inf"), 10**1000, -10**1000])
        self.assert_bad_row("amount_m", [0, -1, 1000001])
        self.assert_bad_row("issue_price_percent", [0, -1, 201])
        self.assert_bad_row("coupon_percent", [-1, 31])
        self.assert_bad_row("issue_yield_percent", [-11, 51])
        self.assert_bad_row("spread_bp", [-501, 5001])

    def test_primary_requires_benchmark(self):
        self.assert_bad_row("benchmark", [None, {}, "Treasury", {"description": "UST", "yield_percent": True}])

    def test_retained_rows_may_have_no_benchmark_but_stay_retained(self):
        edition = sample()
        edition["rows"][0].update(benchmark=None, verification="retained_prior_import")
        validate_edition(edition, NOW)
        self.assertEqual(edition["rows"][0]["verification"], "retained_prior_import")

    def test_spread_arithmetic_and_documented_rounding_tolerance(self):
        edition = sample()
        edition["rows"][0]["spread_bp"] = 60.5
        validate_edition(edition, NOW)
        edition["rows"][0]["spread_bp"] = 60.6
        with self.assertRaises(ValueError):
            validate_edition(edition, NOW)
        edition["rows"][0]["verification"] = "retained_prior_import"
        with self.assertRaises(ValueError):
            validate_edition(edition, NOW)

    def test_duplicate_rows_even_with_different_ids_are_rejected(self):
        edition = sample()
        edition["rows"].append(deepcopy(edition["rows"][0]))
        with self.assertRaises(ValueError):
            validate_edition(edition, NOW)
        edition["rows"][1]["id"] += "-duplicate"
        with self.assertRaises(ValueError):
            validate_edition(edition, NOW)

    def test_missing_unknown_and_malformed_fields_rejected(self):
        for mutate in (
            lambda e: e.pop("source_scope"), lambda e: e.update(extra="unsupported"),
            lambda e: e.update(rows={}), lambda e: e["rows"][0].pop("notes"),
            lambda e: e["rows"][0].update(extra="unsupported"),
            lambda e: e.update(id="bad id"), lambda e: e.update(source_scope=""),
            lambda e: e["rows"][0].update(notes="text\x00control"),
        ):
            edition = sample()
            mutate(edition)
            with self.assertRaises(ValueError):
                validate_edition(edition, NOW)

    def test_empty_edition_permitted_for_honest_no_new_issue_check(self):
        edition = sample()
        edition["rows"] = []
        validate_edition(edition, NOW)


class SourceUrlTests(unittest.TestCase):
    def test_primary_public_urls_and_nonsecret_queries_allowed(self):
        for url in ("https://www.sec.gov/Archives/edgar/data/1/a.htm",
                    "https://investor.example.org/pricing?year=2026&issue=123", "https://www.sec.gov:443/test"):
            self.assertEqual(validate_source_url(url), url)

    def test_unsafe_private_credential_and_token_links_rejected(self):
        urls = [
            "http://www.sec.gov/a", "javascript:alert(1)", "https://user:pass@www.sec.gov/a",
            "https://user@www.sec.gov/a", "https://chatgpt.com/c/private", "https://www.chatgpt.com/c/x",
            "https://chat.openai.com/share/x", "https://localhost/a", "https://host.internal/a",
            "https://localhost.localdomain/a", "https://10.0.0.1/a", "https://127.0.0.1/a",
            "https://169.254.169.254/a", "https://[::1]/a", "https://[fd00::1]/a",
            "https://127.1/a", "https://2130706433/a", "https://www.sec.gov:8443/a",
            "https://www.sec.gov/a?token=secret", "https://www.sec.gov/a?API_KEY=secret",
            "https://www.sec.gov/a?access%5Ftoken=secret", "https://www.sec.gov/a?X-Amz-Signature=secret",
            "https://www.sec.gov/a?sessionid=secret", "https://www.sec.gov/a?code=secret",
            "https://www.sec.gov/a#token=secret", "https://www.sec.gov/a\n", "https://www.sec.gov/with space",
            "https://www.sec.gov\\@127.0.0.1/a", "https://www.sec.gov./a", "https://%6cocalhost/a",
        ]
        for url in urls:
            with self.subTest(url=url), self.assertRaises(ValueError):
                validate_source_url(url)


class AppendOnlyTests(unittest.TestCase):
    def test_append_preserves_prior_editions_and_inputs(self):
        existing = dataset(sample("first"))
        original = deepcopy(existing)
        incoming = sample("second")
        incoming["checked_at"] = "2026-11-04T09:30:00Z"
        incoming["rows"][0]["notes"] = "Rechecked primary source."
        result = merge_edition(existing, incoming, NOW)
        self.assertEqual(existing, original)
        self.assertEqual(result["editions"], original["editions"] + [incoming])
        self.assertEqual(len(active_rows(result, NOW)), 1)

    def test_idempotence_and_changed_edition_id_rejection(self):
        edition = sample()
        existing = dataset(edition)
        self.assertEqual(merge_edition(existing, deepcopy(edition), NOW), existing)
        incoming = deepcopy(edition)
        incoming["source_scope"] = "Changed attestation."
        with self.assertRaisesRegex(ValueError, "immutable"):
            merge_edition(existing, incoming, NOW)

    def test_same_security_conflicting_terms_rejected_with_any_row_id(self):
        existing = dataset(sample("old"))
        for field, value in (("coupon_percent", 4.6), ("amount_m", 2000),
                             ("issue_price_percent", 99.8), ("id", "new-id")):
            incoming = sample("new")
            incoming["rows"][0][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                merge_edition(existing, incoming, NOW)
        incoming = sample("new")
        incoming["rows"][0].update(id="renamed-id", coupon_type="fixed_to_floating")
        with self.assertRaises(ValueError):
            merge_edition(existing, incoming, NOW)

    def test_row_id_cannot_be_reused_for_another_security_or_date(self):
        existing = dataset(sample("old"))
        for field, value in (("maturity", "2046-11-02"), ("pricing_date", "2026-11-01"), ("ticker", "XYZ")):
            incoming = sample("new")
            incoming["rows"][0][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                merge_edition(existing, incoming, NOW)

    def test_retained_can_gain_primary_benchmark_without_changing_history(self):
        old = sample("old")
        old["rows"][0].update(benchmark=None, verification="retained_prior_import")
        result = merge_edition(dataset(old), sample("new"), NOW)
        self.assertIsNone(result["editions"][0]["rows"][0]["benchmark"])
        self.assertEqual(active_rows(result, NOW)[0]["verification"], "primary_checked")

    def test_metadata_gap_does_not_hide_conflicting_historical_benchmark(self):
        old, gap, new = sample("old"), sample("gap"), sample("new")
        gap["rows"][0].update(benchmark=None, verification="retained_prior_import")
        new["rows"][0]["benchmark"]["yield_percent"] = 3.941
        with self.assertRaisesRegex(ValueError, "benchmark"):
            validate_dataset(dataset(old, gap, new), NOW)

    def test_same_yield_does_not_permit_changed_benchmark_description(self):
        old, gap, new = sample("old"), sample("gap"), sample("new")
        gap["rows"][0].update(benchmark=None, verification="retained_prior_import")
        new["rows"][0]["benchmark"]["description"] = "Different Treasury security with the same yield"
        for editions in ((old, new), (old, gap, new)):
            with self.subTest(edition_count=len(editions)), self.assertRaisesRegex(ValueError, "descriptions"):
                validate_dataset(dataset(*editions), NOW)

    def test_pricing_timestamp_enrichment_cannot_conflict_later(self):
        old, new = sample("old"), sample("new")
        old["rows"][0].update(time_precision="timestamp", pricing_time="2026-11-02T16:00:00Z")
        new["rows"][0].update(time_precision="timestamp", pricing_time="2026-11-02T11:00:00-05:00")
        validate_dataset(dataset(old, new), NOW)
        new["rows"][0]["pricing_time"] = "2026-11-02T11:01:00-05:00"
        with self.assertRaisesRegex(ValueError, "timestamps"):
            validate_dataset(dataset(old, new), NOW)

    def test_active_rows_choose_review_time_not_array_order(self):
        older, newer = sample("older"), sample("newer")
        older["checked_at"] = "2026-11-04T08:00:00Z"
        older["rows"][0]["notes"] = "Older review."
        newer["rows"][0]["notes"] = "Newer review."
        self.assertEqual(active_rows(dataset(newer, older), NOW)[0]["notes"], "Newer review.")

    def test_invalid_history_or_schema_is_not_silently_replaced(self):
        for version in (True, "1", 1.0, 2):
            existing = dataset()
            existing["schema_version"] = version
            with self.subTest(version=version), self.assertRaises(ValueError):
                merge_edition(existing, sample(), NOW)
        with self.assertRaises(ValueError):
            validate_dataset(dataset(sample(), sample()), NOW)


class LocalOutputTests(unittest.TestCase):
    def test_write_roundtrip_js_escaping_and_append_only_output(self):
        data = dataset(sample())
        data["editions"][0]["rows"][0]["notes"] = "A </script> & B\u2028C\u2029D"
        with tempfile.TemporaryDirectory() as temp:
            json_path, js_path = write_dataset(data, temp, NOW)
            self.assertEqual(json_path.relative_to(temp).as_posix(), "site/data/credit-issues.json")
            self.assertEqual(js_path.relative_to(temp).as_posix(), "site/credit-issues-data.js")
            self.assertEqual(read_json(json_path), data)
            js = js_path.read_text(encoding="utf-8")
            self.assertTrue(js.startswith("window.MI_CREDIT_ISSUES="))
            self.assertTrue(js.endswith(";\n"))
            self.assertNotIn("</script>", js)
            self.assertNotIn("\u2028", js)
            self.assertEqual(json.loads(js[len("window.MI_CREDIT_ISSUES="):-2]), data)
            before = (json_path.read_bytes(), js_path.read_bytes())
            write_dataset(data, temp, NOW)
            self.assertEqual((json_path.read_bytes(), js_path.read_bytes()), before)
            with self.assertRaisesRegex(ValueError, "removed or changed"):
                write_dataset(dataset(), temp, NOW)
            self.assertEqual((json_path.read_bytes(), js_path.read_bytes()), before)

    def test_invalid_data_produces_no_output(self):
        data = dataset(sample())
        data["editions"][0]["rows"][0]["amount_m"] = 0
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(ValueError):
                write_dataset(data, temp, NOW)
            self.assertEqual(list(Path(temp).iterdir()), [])

    def test_duplicate_json_keys_and_nonfinite_constants_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "input.json"
            for text in ('{"id":"first","id":"second"}', '{"number":NaN}', '{"number":Infinity}'):
                path.write_text(text)
                with self.subTest(text=text), self.assertRaises(ValueError):
                    read_json(path)

    def test_cli_default_dry_run_and_explicit_candidate(self):
        with tempfile.TemporaryDirectory() as temp, patch("import_credit_issues._now", return_value=NOW):
            root = Path(temp)
            incoming, output = root / "incoming.json", root / "candidate"
            incoming.write_text(json.dumps(sample()))
            with redirect_stdout(io.StringIO()) as stdout:
                code = main([str(incoming), "--new-dataset"])
            self.assertEqual(code, 0)
            self.assertIn("No files written", stdout.getvalue())
            self.assertFalse(output.exists())
            with redirect_stdout(io.StringIO()):
                code = main([str(incoming), "--new-dataset", "--output-dir", str(output), "--dry-run"])
            self.assertEqual(code, 0)
            self.assertFalse(output.exists())
            with redirect_stdout(io.StringIO()):
                code = main([str(incoming), "--new-dataset", "--output-dir", str(output)])
            self.assertEqual(code, 0)
            self.assertEqual(read_json(output / "site/data/credit-issues.json"), dataset(sample()))

    def test_cli_rejects_missing_explicit_history_without_writes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            incoming = root / "incoming.json"
            incoming.write_text(json.dumps(sample()))
            with redirect_stderr(io.StringIO()) as stderr:
                code = main([str(incoming), "--existing", str(root / "missing.json"),
                             "--output-dir", str(root / "candidate")])
            self.assertEqual(code, 2)
            self.assertIn("rejected", stderr.getvalue())
            self.assertFalse((root / "candidate").exists())

    def test_failed_cli_import_preserves_both_existing_files_byte_for_byte(self):
        with tempfile.TemporaryDirectory() as temp, patch("import_credit_issues._now", return_value=NOW):
            root = Path(temp)
            paths = write_dataset(dataset(sample("old")), root, NOW)
            before = [path.read_bytes() for path in paths]
            incoming = root / "incoming.json"
            invalid = sample("new")
            invalid["rows"][0]["amount_m"] = 0
            conflict = sample("new")
            conflict["rows"][0]["amount_m"] = 2000
            for payload in ("{broken json", json.dumps(invalid), json.dumps(conflict)):
                incoming.write_text(payload)
                with self.subTest(payload=payload[:40]), redirect_stderr(io.StringIO()):
                    code = main([str(incoming), "--existing", str(paths[0]), "--output-dir", str(root)])
                self.assertEqual(code, 2)
                self.assertEqual([path.read_bytes() for path in paths], before)

    def test_published_dataset_validates_and_matches_javascript_wrapper(self):
        root = Path(__file__).resolve().parents[1]
        data = read_json(root / "site/data/credit-issues.json")
        validate_dataset(data)
        script = (root / "site/credit-issues-data.js").read_text(encoding="utf-8").strip()
        prefix = "window.MI_CREDIT_ISSUES="
        self.assertTrue(script.startswith(prefix))
        self.assertTrue(script.endswith(";"))
        self.assertEqual(json.loads(script[len(prefix):-1]), data)
        self.assertGreater(len(data["editions"]), 0)


if __name__ == "__main__":
    unittest.main()
