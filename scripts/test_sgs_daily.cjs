const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../site/sgs-daily.js'),data=JSON.parse(fs.readFileSync('site/data/sgs-daily-snapshot.json','utf8'));
a.equal(M.validate(data),data);M.state.data=data;
const row=data.observations.at(-1),i=4;
a.equal(M.history(data,'10Y').at(-1).value,row.values[i]);
a.equal(M.history(data,'10Y','price').at(-1).value,row.prices[i]);
a.equal(M.history(data,'10Y','price')[0].value,null);
const table=M.bondTable(data);
for(const t of data.tenors){a.ok(table.includes(t.issue_code));a.ok(table.includes(t.maturity));}
a.match(table,/PRICE/);a.match(table,/clean price in S\$/);a.match(table,/No coupon/);a.match(table,/Not published/);
a.ok(table.includes(row.prices[i].toFixed(2)));
for(const kind of ['dashboard','prices','history']){const html=M.render(kind);a.ok(!html.includes('NaN'));a.match(html,/MAS Closing Levels/);if(kind!=='dashboard'){a.match(html,/PRICE history/);a.match(html,/data-sgs-tenor/);a.match(html,/Daily dates, yields, prices/);}}
const points=[{date:'2026-11-01',value:100,issue:'A'},{date:'2026-11-02',value:101,issue:'A'},{date:'2026-11-03',value:90,issue:'B'},{date:'2026-11-04',value:null,issue:'B'},{date:'2026-11-05',value:92,issue:'B'}];
a.deepEqual(M.paths(points,Date.parse,v=>v,true).map(s=>s.length),[2,1,1]);
const single=M.plot([points[0]],'One source date','S$/100',{price:true});a.ok(!single.includes('NaN'));a.match(single,/<circle/);
const missing=M.plot([{date:'2026-11-01',value:null}],'No source date','S$/100');a.match(missing,/No published/);a.ok(!missing.includes('<svg'));
const bad=structuredClone(data);bad.observations.push(bad.observations[0]);a.throws(()=>M.validate(bad));
M.state.selected='6M';a.match(M.render('history'),/A Treasury bill price is not shown/);M.state.selected='10Y';
const h=fs.readFileSync('site/desk.html','utf8'),v4=fs.readFileSync('site/v4.html','utf8');
for(const text of ['data-sgs-daily="dashboard"','data-sgs-daily="prices"','sgs-daily.js','sgs-daily.css'])a.ok(h.includes(text));a.ok(v4.includes('SGSDaily.mount(S.view)'));
for(const p of ['site/sgs-daily.js','site/desk.js'])new vm.Script(fs.readFileSync(p,'utf8'));
console.log('PASS daily SGS exact source values, issue identities, date/price histories, nulls, rollover gaps, table and both dashboard/history integrations');
