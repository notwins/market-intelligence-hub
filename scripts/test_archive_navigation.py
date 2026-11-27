import unittest

from archive_navigation import NAVIGATION, decorate, restore


class ArchiveNavigationTests(unittest.TestCase):
    def test_original_bytes_and_anchors_survive(self):
        for original in (
            b'\xef\xbb\xbf<!doctype html>\r\n<head><title>Archive</title></HEAD>\r\n<body id="archive"></body>',
            b'<!doctype html><html><title>Notes</title><main id="references"></main></html>',
            b'<!doctype html><main id="chapter">Legacy notes</main>',
        ):
            with self.subTest(original=original):
                result = decorate(original)
                self.assertEqual(result.count(NAVIGATION), 1)
                self.assertEqual(restore(result), original)

    def test_missing_duplicate_or_moved_script_fails(self):
        original = b'<head></head><body></body>'
        for altered in (original, decorate(original) + NAVIGATION, original + NAVIGATION):
            with self.subTest(altered=altered):
                with self.assertRaises(ValueError):
                    restore(altered)
        with self.assertRaises(ValueError):
            decorate(decorate(original))
