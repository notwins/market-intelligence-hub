'use strict';

const assert = require('node:assert/strict');
const history = require('../site/xau-history-model.js');
const open = require('../site/xau-open-history.js');
const snapshot = require('../site/data/metals/xau-research.json');
const macro = require('../site/data/metals/xau-open-macro.json');
const benchmarks = require('../site/data/metals/xau-regime-context.json');
const spx = require('../site/data/spx/history.json');

const all = open.assemble(history, snapshot, benchmarks, spx, macro);
const dates = [...all.gold.points.keys()];
assert.equal(dates[0], '1960-01-01');
assert.equal(dates.at(-1), '2026-10-01');
assert.equal(dates.length, 802);
const chapterDates = open.chapters.flatMap(({dates:[start,end]}) => open.datesBetween(start,end ?? dates.at(-1)));
assert.deepEqual(chapterDates, dates, 'Every gold month belongs to exactly one chapter');
assert.equal(all.jobs.points.get('2020-04-01'),14.8);
assert.equal(all.payroll.points.get('2020-04-01'),130426);
assert.ok(!all.jobs.points.has('2025-10-01'));
assert.equal(all.risk.points.get('1960-01-01'),116.35);
assert.ok(!all.stress.points.has('1970-12-01'));

const period = (from,to,driver) => open.changes(history,open.datesBetween(from,to),all.gold,driver);
const near = (actual, expected) => assert.ok(Math.abs(actual-expected)<.015, String(actual));
const pandemic = period('2020-01','2021-12',all.real);
assert.equal(pandemic.length,23);
near(open.correlation(pandemic),-.61);
near(open.correlation(period('2022-01','2023-12',all.dollar)),-.53);
assert.equal(open.correlation(pandemic.slice(0,17)),null);
assert.equal(period('2025-09','2025-11',all.jobs).length,0);
assert.equal(period('1972-01','1979-12',all.stocks).length,0);

const tail = open.tailStats(open.changes(history, dates, all.gold, all.stocks));
assert.equal(tail.count,24);
assert.equal(tail.up,13);
near(tail.mean,1.665);
console.log('Gold chapter continuity, history coverage, missing periods, macro changes and downside sample passed.');
