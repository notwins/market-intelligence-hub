const assert=require('node:assert/strict'),fs=require('node:fs');
const m=require('../site/morningstar-links.js');
for(const t of ['AAPL','MSFT','NVDA','GOOGL','AMZN','META','BRK.B','AMD','AVGO','MU','TSLA','TSM'])assert(m.resolve(t),t);
assert.equal(m.resolve('TSM').mic,'XNYS');assert.match(m.resolve('TSM').name,/ADR/);assert.equal(m.resolve('MU').mic,'XNAS');
assert.equal(m.resolve('NYSE:MU'),null);assert.equal(m.resolve('XTPE:TSM'),null);
assert.equal(m.resolve('NASDAQ:MU').ticker,'MU');assert.equal(m.resolve('BRK-B').ticker,'BRK.B');
assert.equal(m.resolve('2330'),null);assert.equal(m.resolve('Google'),null);
assert.deepEqual(m.matches('Apple and Google are not ticker identifiers. NOW ALL IT A T COST').map(x=>x.text),[]);
assert.deepEqual(m.matches('AAPL, MU; TSM and BRK.B (NASDAQ:MSFT) $COST').map(x=>x.record.ticker),['AAPL','MU','TSM','BRK.B','MSFT','COST']);
assert.deepEqual(m.matches('AAPLish xAAPL AAPL.foo NYSE:MU Nasdaq:MU').map(x=>x.text),['MU']); // Only explicit uppercase ticker MU after unrecognized mixed-case label.
assert.equal(m.matches('NYSE:MU').length,0);
m.rows.push({...m.resolve('MU'),exchange:'NYSE',url:'https://www.morningstar.com/stocks/xnys/mu/quote'});
assert.equal(m.resolve('MU'),null);assert.equal(m.resolve('XNAS:MU').mic,'XNAS');m.rows.pop();
for(const f of ['v3.html','v4.html']){const s=fs.readFileSync('site/'+f,'utf8');assert(s.includes('morningstar-links.js'));assert(s.includes('MorningstarLinks.resolve(t)'));}
const script=fs.readFileSync('site/morningstar-links.js','utf8');
assert(script.includes("p.closest('a,button"));assert(script.includes("a.rel='noopener noreferrer'"));assert(script.includes('observer.disconnect()'));
console.log('PASS 12 watchlist identities, exchange mismatch, ADR identity, BRK alias, ambiguity, boundaries, source-link preservation, rerender integration and safe external links');
