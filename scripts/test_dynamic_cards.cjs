const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'../site',f),'utf8');
const script=read('v4-display.js'),css=read('v4.css'),html=read('v4.html');
for(const saved of [null,'auto','one','two','three','four','invalid']){
 const props={},root={dataset:{},style:{setProperty:(k,v)=>props[k]=v}};
 const ctx={window:{},document:{documentElement:root,readyState:'loading',addEventListener(){}},localStorage:{getItem:k=>k==='market-hub-display-v4'&&saved?JSON.stringify({columns:saved,scale:1.5,cardScale:.5}):null}};
 vm.runInNewContext(script,ctx);
 assert.equal(root.dataset.displayColumns,['one','two','three','four'].includes(saved)?saved:'auto');
 assert.equal(props['--text-scale'],saved?1.5:1);
}
assert.match(script,/Dynamic · automatic columns/);
for(const n of ['one','two','three','four'])assert.ok(css.includes('html[data-display-columns='+n+'] #view :is(.grid,.deal-grid,.watchlist-grid,.ed-companies)'));
assert.ok(css.includes('grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--layout-floor)),1fr))'));
assert.ok(css.includes('.grid:has(.chart){--layout-min:var(--chart-min)}'));
assert.ok(!read('brief-cards.css').includes('html:not([data-display-columns=one]) #view .grid'));
for(const f of ['v4-display.js','v4.css','brief-cards.css'])assert.ok(html.includes(f+'?v=20261105.dynamic1'));
console.log('PASS dynamic default, saved fixed 1/2/3/4 choices, readable chart limits, shared card groups and cache versions');
