const assert = require('node:assert/strict');
require('../site/hourly-news.js');
const source = {url:'https://www.reuters.com/test/fixture',title:'Fixture',published_at:null,
  published_date:'2026-11-03',publication_precision:'date'};
const edition = {id:'fixture',report_at:'2026-11-04T00:45:16+08:00',window_start:'2026-11-03T23:42:07+08:00',
  cutoff:'2026-11-04T00:42:07+08:00',coverage:'partial',summary:'Fixture',limitations:['Publication time unknown'],
  original_url:'https://chatgpt.com/c/fixture',sources:[source],stories:[{story_id:'fixture-event',version:1,
  status:'new',freshness:'catch-up',topic:'Fixture',headline:'Fixture',body:'Fixture',analysis:'',watch_next:'',
  earlier:'',source_urls:[source.url],development_at:null}]};
const data = {editions:[edition],last_complete_cutoff:null,publisher_checked_at:null};
const html = globalThis.MarketHourly.view(data);
assert.ok(html.includes('Published 2026-11-03 (publication time unverified)'));
assert.ok(html.includes('Exact development time not established'));
assert.ok(html.includes(String.fromCodePoint(0x2197)));
assert.ok(!html.includes(String.fromCodePoint(0xFFFD)));
assert.ok(!html.includes('1970'));
source.publication_precision = 'timestamp';
source.published_at = '2026-11-03T15:22:00Z';
const exact = globalThis.MarketHourly.view(data);
assert.ok(exact.includes('23:22:00 SGT'));
assert.ok(!exact.includes('publication time unverified'));
console.log('Hourly publication precision UI checks passed.');
