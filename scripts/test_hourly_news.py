import copy
import unittest
from datetime import datetime, timezone
from import_hourly_news import empty_feed, merge, validate

NOW = datetime(2026, 11, 1, 5, tzinfo=timezone.utc)


def sample():
    return {'id': 'hourly-20261101-1100', 'report_at': '2026-11-01T11:02:04+08:00',
            'cutoff': '2026-11-01T11:00:00+08:00', 'window_start': '2026-11-01T10:00:00+08:00',
            'coverage': 'partial', 'summary': 'Test coverage gap', 'limitations': ['Limited source access'],
            'original_url': 'https://chatgpt.com/c/test', 'sources': [], 'stories': []}


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
