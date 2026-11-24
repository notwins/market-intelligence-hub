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
load('accumulator-quotes.js');
load('accumulator-format.js');
load('accumulator-benchmark.js');
const page = fs.readFileSync(path.join(dir, 'accumulator.html'), 'utf8');
run(page.match(/<script id="accumulator-model">([\s\S]*?)<\/script>/)[1]);
for (const [id,value] of Object.entries({
  spot:125.53, capital:300000, quote:'sn-9-130-1',
  'cmp-rank':'pnl', 'cmp-gap':'cent', 'cmp-origin':'down'
})) set(id, value);
load('accumulator-comparison.js');

const initial = snapshot();
const indexE = note(initial, 'sn-9-130-1');
assert.equal(initial.notes.length,5);
assert(initial.notes.every(n=>n.quote.product==='JPM SN'));
assert.equal(initial.settings.rampDay,123);
assert(row(initial,'down').values[indexE].pnl < 0);
assert(row(initial,'flat').values[indexE].pnl > 0);
assert(initial.ranges[indexE].best.every(i=>i<5),'Contract ranking excludes optional recovery');
for (const n of initial.notes) if (n.quote.id !== 'sn-9-130-1') select(n.quote.id,false);
const single = snapshot();
for (const r of initial.rows) {
  assert.deepEqual(row(single,r.id).path, r.path, 'Fixed shared path for ' + r.id);
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
