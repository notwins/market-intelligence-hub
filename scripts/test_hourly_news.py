import copy
import unittest
from datetime import datetime, timezone
from import_hourly_news import empty_feed, merge, validate, source_report_key

NOW = datetime(2026, 11, 1, 5, tzinfo=timezone.utc)


def sample():
    return {'id': 'hourly-20261101-1100', 'report_at': '2026-11-01T11:02:04+08:00',
            'cutoff': '2026-11-01T11:00:00+08:00', 'window_start': '2026-11-01T10:00:00+08:00',
            'coverage': 'partial', 'summary': 'Test coverage gap', 'limitations': ['Limited source access'],
            'original_url': None, 'source_report_key': source_report_key('https://chatgpt.com/c/test'), 'sources': [], 'stories': []}


def story():
    return {'story_id': 'test-event', 'version': 1, 'status': 'new', 'freshness': 'current',
            'topic': 'Test', 'headline': 'Fixture only', 'body': 'Fixture fact', 'analysis': '',
            'watch_next': '', 'earlier': '', 'source_urls': ['https://www.reuters.com/test/fixture'],
            'development_at': '2026-11-01T10:50:00+08:00'}


def with_story():
    x = sample()
    x['sources'] = [{'url': 'https://www.reuters.com/test/fixture', 'title': 'Fixture only',
                     'published_at': '2026-11-01T10:50:00+08:00'}]
    x['stories'] = [story()]
    return x


class HourlyNewsTests(unittest.TestCase):
    def test_private_url_rejected_for_new_editions(self):
        x = sample(); x['original_url'] = 'https://chatgpt.com/c/test'
        with self.assertRaisesRegex(ValueError, 'Private conversation'):
            merge(empty_feed(), {'editions': [x]}, NOW)
        x.pop('source_report_key')
        with self.assertRaisesRegex(ValueError, 'public-safe'):
            merge(empty_feed(), {'editions': [x]}, NOW)

    def test_legacy_replay_preserves_bytes_and_dedupe(self):
        old = sample(); old.pop('source_report_key'); old['original_url'] = 'https://chatgpt.com/c/test?messageId=old'
        current = empty_feed(); current['editions'] = [old]
        result, changed = merge(current, {'editions': [old]}, NOW)
        self.assertFalse(changed); self.assertEqual(current, result)
        alias = sample(); alias['id'] += '-alias'
        with self.assertRaisesRegex(ValueError, 'Source report already imported'):
            merge(current, {'editions': [alias]}, NOW)

    def test_source_key_rejects_private_text(self):
        x = sample(); x['source_report_key'] = 'https://chatgpt.com/c/test'
        with self.assertRaisesRegex(ValueError, 'SHA-256'):
            validate(x, NOW)

    def test_report_alias_cannot_duplicate_same_source_run(self):
        x = sample(); x['source_report_key'] = source_report_key('https://chatgpt.com/c/test?messageId=original')
        current, _ = merge(empty_feed(), {'editions': [x]}, NOW)
        alias = copy.deepcopy(x); alias['id'] = 'another-prefix-same-report'
        alias['source_report_key'] = source_report_key('https://chatgpt.com/c/test/')
        alias['cutoff'] = '2026-11-01T03:00:00Z'
        alias['summary'] = 'Different editorial wording does not make a new report'
        before = copy.deepcopy(current)
        with self.assertRaisesRegex(ValueError, 'Source report already imported'):
            merge(current, {'editions': [alias]}, NOW)
        self.assertEqual(current, before)
        with self.assertRaisesRegex(ValueError, 'Source report already imported'):
            merge(empty_feed(), {'editions': [x, alias]}, NOW)

    def test_later_report_same_window_can_retain_correction_history(self):
        x = with_story(); current, _ = merge(empty_feed(), {'editions': [x]}, NOW)
        correction = copy.deepcopy(x); correction['id'] += '-later-correction'
        correction['report_at'] = '2026-11-01T12:02:00+08:00'
        correction['stories'][0].update(version=2, status='correction', earlier='Correcting previous fixture')
        result, _ = merge(current, {'editions': [correction]}, NOW)
        self.assertEqual(len(result['editions']), 2)
        self.assertIn(x, result['editions'])

    def test_date_only_source_retains_unknown_time_and_history(self):
        old = sample()
        prior, _ = merge(empty_feed(), {'editions': [old]}, NOW)
        incoming = with_story(); incoming['id'] += '-date'
        incoming['report_at'] = '2026-11-01T12:02:00+08:00'
        incoming['sources'][0].update(published_at=None, published_date='2026-11-01',
                                      publication_precision='date')
        incoming['stories'][0]['development_at'] = None
        incoming['limitations'].append('Original Reuters publication time is unknown; date only.')
        result, _ = merge(prior, {'editions': [incoming]}, NOW)
        self.assertIn(old, result['editions'])
        self.assertIsNone(result['last_complete_cutoff'])
        self.assertIsNone(result['editions'][0]['sources'][0]['published_at'])
        replay, changed = merge(result, {'editions': [incoming]}, NOW)
        self.assertFalse(changed)
        self.assertEqual(result, replay)

    def test_date_only_source_cannot_claim_complete_or_unverified_breaking(self):
        x = with_story()
        x['sources'][0].update(published_at=None, published_date='2026-11-01', publication_precision='date')
        x['coverage'] = 'complete'
        with self.assertRaises(ValueError): validate(x, NOW)
        x['coverage'] = 'partial'
        x['stories'][0].update(freshness='breaking', development_at=None)
        with self.assertRaises(ValueError): validate(x, NOW)

    def test_date_only_invalid_future_old_boundary_and_unknown_dates_reject(self):
        for value in ('2026-11-02', '2026-10-25', '2026-10-24', '2026-02-30', None, '2026-1-1'):
            with self.subTest(value=value):
                x = with_story()
                x['sources'][0].update(published_at=None, published_date=value, publication_precision='date')
                with self.assertRaises(ValueError): validate(x, NOW)

    def test_precision_contract_does_not_accept_invented_times_or_unknown_eligibility(self):
        x = with_story()
        x['sources'][0].update(published_date='2026-11-01', publication_precision='date')
        with self.assertRaises(ValueError): validate(x, NOW)
        x['sources'][0].update(published_at=None, publication_precision='unknown')
        with self.assertRaises(ValueError): validate(x, NOW)
        x['sources'][0].pop('publication_precision')
        with self.assertRaises(ValueError): validate(x, NOW)

    def test_partial_zero_stories_does_not_advance_completed_cutoff(self):
        d, changed = merge(empty_feed(), {'editions': [sample()]}, NOW)
        self.assertTrue(changed)
        self.assertIsNone(d['last_complete_cutoff'])

    def test_complete_quiet_scan_can_advance_cutoff(self):
        x = sample(); x['coverage'] = 'complete'; x['limitations'] = []
        d, _ = merge(empty_feed(), {'editions': [x]}, NOW)
        self.assertEqual(d['last_complete_cutoff'], x['cutoff'])

    def test_replay_is_noop_and_published_edition_is_immutable(self):
        x = sample(); d, _ = merge(empty_feed(), {'editions': [x]}, NOW)
        same, changed = merge(d, {'editions': [x]}, NOW)
        self.assertFalse(changed); self.assertEqual(d, same)
        x['summary'] = 'Changed'
        with self.assertRaises(ValueError): merge(d, {'editions': [x]}, NOW)

    def test_corrections_keep_connected_history_and_repeats_reject(self):
        x = with_story(); d, _ = merge(empty_feed(), {'editions': [x]}, NOW)
        y = copy.deepcopy(x); y['id'] += '-correction'; y['report_at'] = '2026-11-01T12:02:00+08:00'
        y['stories'][0].update(version=2, status='correction', earlier='Fixture fact was corrected', body='Corrected fixture')
        fixed, _ = merge(d, {'editions': [y]}, NOW)
        self.assertEqual(len(fixed['editions']), 2)
        y['id'] += '-repeat'
        with self.assertRaises(ValueError): merge(fixed, {'editions': [y]}, NOW)

    def test_orphan_followup_and_initial_correction_reject(self):
        x = with_story(); x['stories'][0].update(version=2, status='follow-up', earlier='Missing prior')
        with self.assertRaises(ValueError): merge(empty_feed(), {'editions': [x]}, NOW)
        x['stories'][0]['version'] = 1
        with self.assertRaises(ValueError): merge(empty_feed(), {'editions': [x]}, NOW)

    def test_unsafe_sources_unknown_private_fields_and_future_times_reject(self):
        x = with_story(); x['sources'][0]['url'] = 'javascript:alert(1)'
        with self.assertRaises(ValueError): validate(x, NOW)
        x = sample(); x['private_register'] = 'must not publish'
        with self.assertRaises(ValueError): validate(x, NOW)
        x = sample(); x['report_at'] = '2099-01-01T00:00:00Z'
        with self.assertRaises(ValueError): validate(x, NOW)

    def test_old_sources_and_unverified_breaking_times_reject(self):
        x = with_story(); x['sources'][0]['published_at'] = '2026-10-20T10:00:00+08:00'
        with self.assertRaises(ValueError): validate(x, NOW)
        x = with_story(); x['stories'][0].update(freshness='breaking', development_at=None)
        with self.assertRaises(ValueError): validate(x, NOW)

    def test_source_pause_state_does_not_resume_or_repeat_publication(self):
        state = {'status': 'Paused', 'checked_at': '2026-11-01T12:00:00+08:00'}
        d, changed = merge(empty_feed(), {'editions': [], 'source_schedule': state}, NOW)
        self.assertTrue(changed); self.assertEqual(d['source_schedule']['status'], 'Paused')
        _, changed = merge(d, {'editions': [], 'source_schedule': state}, NOW)
        self.assertFalse(changed)


if __name__ == '__main__': unittest.main()

