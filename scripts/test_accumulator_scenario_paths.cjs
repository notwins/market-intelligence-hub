// Exercise the comparison through the same selection and input events as the page.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dir = path.join(__dirname, '../site/tools');
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
load('accumulator-model.js');
load('accumulator-format.js');
load('accumulator-benchmark.js');
const page = fs.readFileSync(path.join(dir, 'accumulator.html'), 'utf8');
run(page.match(/<script id="accumulator-model">([\s\S]*?)<\/script>/)[1]);
for (const [id,value] of Object.entries({
  spot:125.53, capital:300000, quote:'nv9086',
  'cmp-rank':'pnl', 'cmp-gap':'cent', 'cmp-origin':'down'
})) set(id, value);
load('accumulator-comparison.js');

const initial = snapshot();
const indexE = note(initial, 'nv9086');
assert.deepEqual([initial.settings.lateDay,initial.settings.rampDay,initial.settings.down], [93,124,93.87]);
assert.equal(row(initial,'late').values[indexE].pnl, 35080.22);
assert.equal(row(initial,'down').values[indexE].pnl, -53059.32);
assert.equal(row(initial,'early').values[indexE].direct.noteAdvantage, -35904.51);
assert.equal(row(initial,'flat').values[indexE].direct.noteAdvantage, 30143.16);
assert.deepEqual(initial.ranges[indexE].best, [4], 'Contract-only ranking excludes the optional price recovery');
for (const n of initial.notes) if (n.quote.id !== 'nv9086') select(n.quote.id,false);
const single = snapshot();
for (const r of initial.rows) {
  assert.deepEqual(row(single,r.id).path, r.path, 'Fixed shared path for ' + r.id);
  assert.deepEqual(row(single,r.id).values[0], r.values[indexE], 'Fixed E outcome for ' + r.id);
}

const shortId = 'sn-3-120-1';
select(shortId,true);
const mixed = snapshot(), idx = note(mixed,shortId);
const shortLate = row(mixed,'late');
assert.equal(shortLate.exits[idx].day,61);
assert.equal(shortLate.values[idx].direct.mark,125.53,'3M stock benchmark closes before the day-93 shock');
assert.equal(shortLate.values[idx].direct.pnl,0);
set('cmp-down',170);
set('cmp-recovery',200);
set('cmp-reference',shortId);
render();
const follow = row(snapshot(),'hold');
assert(follow.exits[0].koDay > 0 && follow.exits[idx].koDay === 0, 'Test both KO cash and retained shares');
assert(follow.values.every(v=>v.direct.mark === 200), 'Outright shares are valued at the same later observation');
assert.equal(follow.values[0].change,0,'The note that knocked out held cash while direct ownership continued');
select(shortId,false);
assert.equal(snapshot().settings.referenceId,shortId,'Explicit barrier reference survives removing its quote');
assert.equal(snapshot().settings.down,170);
