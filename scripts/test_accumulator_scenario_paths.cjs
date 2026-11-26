// Exercise the comparison through the same selection and input events as the page.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dir = path.join(__dirname, '../site/tools');
const beta = process.argv.includes('--beta');
const version = beta ? 'accumulator-beta' : 'accumulator';
const elements = new Map(), listeners = new Map();
const document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '', innerHTML: '', textContent: '', validity: {}, listeners: new Map(),
      get valueAsNumber() { return Number(this.value); },
      addEventListener(event, cb) { this.listeners.set(event, cb); },
      querySelectorAll() { return []; },
      checkValidity() { return true; }
    });
    return elements.get(id);
  },
  addEventListener(event, cb) { listeners.set(event, cb); },
  dispatchEvent(event) { listeners.get(event.type)?.(event); }
};
const context = {document, CustomEvent:class {
  constructor(type, options) { this.type = type; this.detail = options?.detail; }
}};
context.window = context;
vm.createContext(context);
const run = code => vm.runInContext(code, context);
const load = name => run(fs.readFileSync(path.join(dir, name), 'utf8'));
const set = (id, value) => { document.getElementById(id).value = String(value); };
const snapshot = () => JSON.parse(JSON.stringify(context.AccumulatorComparison.getSnapshot()));
const row = (state, id) => state.rows.find(r => r.id === id);
const note = (state, id) => state.notes.findIndex(n => n.quote.id === id);
const select = (id, checked) => document.getElementById('sn-comparison').listeners.get('change')({
  target: {dataset: {cmpQuote: id}, checked}
});
const render = () => document.dispatchEvent({type:'accumulator:inputs'});
load(version + '-model.js');
load('accumulator-quotes.js');
load('accumulator-format.js');
load('accumulator-benchmark.js');
const page = fs.readFileSync(path.join(dir, version + '.html'), 'utf8');
run(page.match(/<script id="accumulator-model">([\s\S]*?)<\/script>/)[1]);
for (const [id,value] of Object.entries({
  spot:125.53, capital:300000, quote:'sn-9-130-1',
  'cmp-rank':'pnl', 'cmp-gap':'cent', 'cmp-origin':'down'
})) set(id, value);
load(version + '-comparison.js');

const initial = snapshot();
const indexE = note(initial, 'sn-9-130-1');
assert.equal(initial.notes.length,5);
assert(initial.notes.every(n=>n.quote.product==='JPM SN'));
assert.equal(initial.settings.rampDay,123);
assert(row(initial,'down').values[indexE].pnl < 0);
assert(row(initial,'flat').values[indexE].pnl > 0);
assert(initial.ranges[indexE].best.every(i=>!initial.rows[i].follow && initial.rows[i].values[indexE]),
  'Contract ranking excludes optional recovery and inapplicable outcomes');
if (beta) {
  assert.deepEqual(initial.rows.slice(0,7).map(r=>r.id), ['ko-0','ko-1','ko-2','ko-3','ko-6','ko-9','ko-12']);
  const a = note(initial,'sn-9-120-1');
  const b = note(initial,'sn-9-120-2');
  assert.equal(row(initial,'ko-0').exits[a].koDay,1);
  assert.equal(row(initial,'ko-1').exits[a].koDay,initial.notes[a].terms.monthEnds[0]);
  assert.equal(row(initial,'ko-2').values[a],null);
  assert(!row(initial,'ko-2').winners.includes(a) && !row(initial,'ko-2').losers.includes(a));
  assert.equal(row(initial,'ko-2').values[b].shares,2*initial.notes[b].terms.maximum);
  for (const [i,n] of initial.notes.entries()) {
    const benchmark = row(initial,'ko-3');
    const v = benchmark.values[i];
    assert.equal(benchmark.exits[i].koDay,n.terms.monthEnds[2]);
    assert.equal(v.shares,3*n.terms.maximum);
    assert.equal(v.exitSpot,initial.settings.rally);
    assert.equal(v.shareLabel,`${v.shares.toLocaleString('en-US')} shares (${n.quote.minimum}gm/${n.quote.months}m)`);
  }
  select('sn-12-120-3',true);
  const mixed = snapshot(), i = note(mixed,'sn-12-120-3');
  assert.equal(row(mixed,'ko-12').exits[i].koDay,mixed.notes[i].terms.days);
  assert.equal(row(mixed,'ko-12').values[i].shares,12*mixed.notes[i].terms.maximum);
  assert.equal(row(mixed,'ko-12').values[a],null);
  select('sn-12-120-3',false);
}
for (const n of initial.notes) if (n.quote.id !== 'sn-9-130-1') select(n.quote.id,false);
const single = snapshot();
for (const r of initial.rows) {
  assert.deepEqual(row(single,r.id).path, r.path, 'Fixed shared path for ' + r.id);
  if (r.notePaths) assert.deepEqual(row(single,r.id).notePaths[0], r.notePaths[indexE], 'Fixed month-end path for ' + r.id);
  assert.deepEqual(row(single,r.id).values[0], r.values[indexE], 'Fixed E outcome for ' + r.id);
}

const shortId = 'sn-6-120-1';
set('cmp-late',150);
select(shortId,true);
const mixed = snapshot(), idx = note(mixed,shortId);
const shortLate = row(mixed,'late');
assert.equal(shortLate.exits[idx].day,123);
assert.equal(shortLate.values[idx].direct.mark,125.53,'6M benchmark closes before the day-150 shock');
assert.equal(shortLate.values[idx].direct.pnl,0);
set('cmp-down',156);
set('cmp-recovery',200);
set('cmp-reference',shortId);
render();
const follow = row(snapshot(),'hold');
assert(follow.exits[idx].koDay > 0 && follow.exits[0].koDay === 0, 'Test both KO cash and retained shares');
assert(follow.values.every(v=>v.direct.mark === 200), 'Outright shares are valued at the same later observation');
assert.equal(follow.values[idx].change,0,'The note that knocked out held cash while direct ownership continued');
select(shortId,false);
assert.equal(snapshot().settings.referenceId,shortId,'Explicit barrier reference survives removing its quote');
assert.equal(snapshot().settings.down,156);
