const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const B=require('../site/bond-watchlist.js'),D=require('../site/bond-watchlist-data.js'),C=require('../site/v3-core.js');
const master=JSON.parse(fs.readFileSync('site/data/master-v3.json')),ust=JSON.parse(fs.readFileSync('site/data/ust-v3.json'));
const before=JSON.stringify({master,ust,D});
assert.equal(D.rows.length,30);assert.equal(new Set(D.rows.map(r=>r.isin)).size,30);assert.equal(D.rows.filter(r=>r.issuerType==='ust').length,29);assert.deepEqual(D,JSON.parse(fs.readFileSync('site/data/default-bond-watchlist.json')));
assert.equal(B.masterIds(master.records).length,30);
const isinValid=id=>{const digits=id.split('').map(c=>/\d/.test(c)?c:String(c.charCodeAt(0)-55)).join('');return [...digits].reverse().reduce((sum,c,i)=>{let n=Number(c)*(i%2?2:1);return sum+(n>9?n-9:n)},0)%10===0};
assert(D.rows.every(r=>isinValid(r.isin)));
for(const r of D.rows){assert.equal(r.quoteDate,null);assert.equal(r.receivedOn,'2026-11-04');assert.equal(master.records.filter(m=>m.isin===r.isin).length,1);if(r.issuerType==='ust'){assert.equal(r.raw.ISIN,r.isin);assert.equal(Number(r.raw.Coupons),r.coupon);assert.equal(Number(r.raw.Yield),r.reportedYield);assert.equal(Number(r.raw['Yield (after Spread)']),r.afterSpreadYield);assert.equal(Number(r.raw.MOA),r.moa);const decode=v=>{let [w,f='']=v.split('.');f=f.padEnd(3,'0');return Number(w)+Number(f.slice(0,2))/32+Number(f[2])/256};assert.equal(decode(r.rawBid),r.bidDecimal);assert.equal(decode(r.rawAsk),r.askDecimal);}}
const tem=D.rows.at(-1);assert.equal(tem.isin,'US87973RAW07');assert.equal(tem.maturity,'2070-10-06');assert.equal(tem.coupon,2.5);for(const k of ['reportedYield','afterSpreadYield','moa','rawBid','rawAsk'])assert.equal(tem[k],null);assert(tem.sourceUrl.startsWith('https://www.temasek.com.sg/'));
assert.equal(D.rows.find(r=>r.isin==='US912810TC27').maturity,'2041-11-15');assert.equal(D.rows.find(r=>r.isin==='US912810TC27').raw.Maturity,'30/11/2041');
const s=B._test.state('test'),model=B._test.curveModel(s);assert.equal(model.length,29);assert(model.every(r=>r.issuerType==='ust'));assert(model.every((r,i,a)=>!i||r.years>=a[i-1].years));assert(!B._test.chart(s).includes('NaN'));assert(B._test.table(s).includes('Temasek'));s.selected.clear();assert.equal(B._test.curveModel(s).length,0);assert(B._test.chart(s).includes('Select U.S. Treasury'));s.selected.add(tem.isin);assert.equal(B._test.curveModel(s).length,0);s.query='US87973RAW07';assert.equal((B._test.table(s).match(/<tr class=/g)||[]).length,1);s.query='<script>';assert(!B._test.table(s).includes('<script>'));assert(B.view('watchlist').includes('quote date unknown'));
// Real master pinning and default list navigation preserve all snapshots and saved selections.
const src=fs.readFileSync('site/v4-tools.js','utf8').replace('return{routeSuffix,','return{_test:{getState:()=>X,setHost:api=>host=api,masterRows,masterFilter,masterSaved,rowHTML},routeSuffix,');
const handlers={},doc={addEventListener(t,f){handlers[t]=f;},querySelector:()=>null,createTreeWalker:()=>({nextNode:()=>null}),querySelectorAll:()=>[],body:{},documentElement:{style:{getPropertyValue:()=>1},dataset:{}}};
const ctx={window:{BondWatchlist:B},MarketCore:C,USTDecisionEngine:{},USTDecisionImport:{},localStorage:{getItem:()=>null,setItem(){throw Error('No storage write expected');}},document:doc,Intl,Date,URL,location:{href:'https://example.com/v4.html'},matchMedia:()=>({matches:false}),setTimeout(){},NodeFilter:{SHOW_TEXT:4}};
vm.createContext(ctx);vm.runInContext(src,ctx);const t=ctx.window.MarketV3._test,x=t.getState();x.master=master;x.selection=['existing'];x.watchlists=[{id:'existing',name:'Keep me',ids:[master.records.at(-1).id]}];let nav='';t.setHost({navigate(v){nav=v},render(){}});
for(const sort of ['name','price','ar']){x.sort=sort;const a=t.masterRows();assert.equal(a.length,8466);assert.deepEqual(Array.from(a.slice(0,30),r=>r.isin),D.rows.map(r=>r.isin));}
x.q='US87973RAW07';assert.equal(t.masterRows().length,1);x.q='';x.categories=['Equities'];assert(t.masterRows().every(r=>r.category==='Equities'));x.categories=[];x.activeList=B.defaultListId;assert.equal(t.masterRows().length,30);x.activeList='existing';assert.equal(t.masterRows().length,1);assert.deepEqual(x.selection,['existing']);assert.equal(x.watchlists[0].name,'Keep me');assert(t.rowHTML(master.records.find(r=>r.isin===tem.isin)).includes('Pinned bond watchlist'));
handlers.click({target:{closest:s=>s==='[data-bw-master]'?{dataset:{bwMaster:tem.isin}}:null},preventDefault(){}});assert.equal(nav,'master/explore');assert.equal(x.q,tem.isin);assert.equal(x.activeList,null);
assert.equal(JSON.stringify({master,ust,D}),before,'No source snapshots or identities changed');
// A catalogue deep link opens exactly one known record after the master has loaded.
let opened=0;const dialog={open:false,innerHTML:'',close(){this.open=false;},showModal(){this.open=true;opened++;}};
doc.querySelector=s=>s==='#tool-dialog'?dialog:null;t.setHost({getDirectory:()=>null,render(){}});
const chosen=master.records.find(r=>r.isin==='US91282CCA71');ctx.location.href='https://example.com/v4.html?security='+encodeURIComponent(chosen.id)+'#master/explore';
const selectedBefore=JSON.stringify(x.selection),listsBefore=JSON.stringify(x.watchlists),snapshotBefore=JSON.stringify(x.master);
x.master=null;ctx.window.MarketV3.afterRender('overview');assert.equal(opened,0,'wait for the master data');
x.master=master;ctx.window.MarketV3.afterRender('master');assert.equal(opened,1);assert(dialog.innerHTML.includes(chosen.isin));assert(dialog.innerHTML.includes(chosen.name));
dialog.close();ctx.window.MarketV3.afterRender('master');assert.equal(opened,1,'do not reopen after dismissal or rerender');
ctx.location.href='https://example.com/v4.html?security=unknown-fixture#master/explore';ctx.window.MarketV3.afterRender('master');assert.equal(opened,2);assert(dialog.innerHTML.includes('Security not found'));assert(!dialog.innerHTML.includes(chosen.isin));
ctx.location.href='https://example.com/v4.html#master/explore';dialog.close();ctx.window.MarketV3.afterRender('master');assert.equal(opened,2);
assert.equal(JSON.stringify(x.selection),selectedBefore);assert.equal(JSON.stringify(x.watchlists),listsBefore);assert.equal(JSON.stringify(x.master),snapshotBefore);
const html=fs.readFileSync('site/v4.html','utf8');assert(html.includes("watchlist:()=>BondWatchlist.view('watchlist')+MarketWatchlist.view()"));assert(html.indexOf('bond-watchlist.js')<html.indexOf('v4-tools.js'));assert(!fs.readFileSync('site/bond-watchlist.js','utf8').includes('localStorage'));
// Viewport and existing display preferences are respected without touching heat scales.
const mobileCtx={window:{innerWidth:390,BOND_WATCHLIST_DATA:D,addEventListener(){}},document:{documentElement:{style:{getPropertyValue:()=>2},dataset:{displayCharts:'large'}},addEventListener(){}}};
vm.createContext(mobileCtx);vm.runInContext(fs.readFileSync('site/bond-watchlist.js','utf8'),mobileCtx);const mobileHtml=mobileCtx.window.BondWatchlist.view('ust');assert(mobileHtml.includes('viewBox="0 0 326 390"'));assert(mobileHtml.includes('--bw-chart-scale:2'));assert(mobileHtml.includes('Years to maturity</text>'));assert(!mobileHtml.includes('NaN'));
const css=fs.readFileSync('site/bond-watchlist.css','utf8');assert(css.includes('var(--text-scale,1)'));assert(css.includes('var(--bw-chart-scale,1)'));assert(!css.includes('.ust-heat-'));
console.log('PASS 30 pinned bonds, 29 raw UST source values and price conversions, corrected TC27, Temasek terms/no invented quotes, separate corporate/UST curves, master filters and stable sorting, safe navigation, source immutability');

for(const r of D.rows.filter(r=>r.issuerType==='ust'))assert.equal(r.modifiedDuration,Number(r.raw.Mduration));
assert.equal(B._test.yieldBand(null),'missing');assert.equal(B._test.yieldBand(-.01),'negative');assert.equal(B._test.yieldBand(B._test.yieldRange.min),'0');assert.equal(B._test.yieldBand(B._test.yieldRange.max),'4');
const heatBefore=B._test.yieldBand(D.rows[0].reportedYield);s.query=D.rows[0].isin;assert(B._test.table(s).includes('Modified<br>duration'));assert(B._test.table(s).includes('5.84'));assert.equal(B._test.yieldBand(D.rows[0].reportedYield),heatBefore);for(const id of B._test.verifiedBSM)assert(B._test.bondLink(D.rows.find(r=>r.isin===id)).includes('/bond-factsheet/'+id));

// The daily list is separate from the retained undated reference and has all 34 identities.
const daily=require('../site/Bond Prices - Type JS - 16-Nov-03.10.js');
const prices=JSON.parse(fs.readFileSync('site/data/Bond Prices - Type JSON - 16-Nov-03.10.json','utf8'));
assert.equal(prices.instruments.length,34);assert.equal(new Set(prices.instruments.map(r=>r.id)).size,34);
assert.equal(prices.instruments.filter(r=>r.source==='WSJ').length,29);
assert.equal(prices.instruments.filter(r=>r.source==='Bondsupermart').length,5);
assert.equal(prices.instruments.filter(r=>r.id==='US87973RAW07').length,1);
const dailyHTML=daily.render(prices);assert(dailyHTML.includes('7:00 am Singapore'));assert(dailyHTML.includes('Bid / Ask price'));assert(dailyHTML.includes('Asked yield')||dailyHTML.includes('Ask '));
for(const r of prices.instruments)assert(dailyHTML.includes(r.id));
assert(!dailyHTML.includes('NaN'));assert(!dailyHTML.includes('undefined'));
const days=daily.lastDays([{date:'2026-11-12',bid:1},{date:'2026-11-13',bid:2},{date:'2026-11-13',bid:3}]);
assert.equal(days.length,2);assert.equal(days[0].bid,3);
const unsafe=structuredClone(prices);unsafe.instruments[0].name='<script>bad</script>';unsafe.instruments[0].source_url='javascript:bad';
assert(!daily.render(unsafe).includes('<script>'));assert(!daily.render(unsafe).includes('javascript:bad'));
assert(fs.readFileSync('site/desk.html','utf8').includes('id="bonds" data-daily-bonds'));
assert(fs.readFileSync('.github/workflows/publish.yml','utf8').includes("cron: '0 23 * * *'"));
console.log('PASS daily bond list: 34 distinct identities, source labels, accessible dated prices/history, escaped text and 7am cloud schedule');

const compactFixture = structuredClone(prices);
compactFixture.latest[prices.instruments[0].id] = {ask:97.1640625,yield_pct:4.985,yield_basis:'Asked yield'};
delete compactFixture.latest.US912810TC27;
const compact = daily.render(compactFixture,{compactTreasuries:true});
const treasuries = unsafe.instruments.filter(r=>r.source==='WSJ');
const ustTable = compact.match(/<table class="daily-ust-table"[\s\S]*?<\/table>/)[0];
assert.equal((ustTable.match(/role="rowheader" scope="row" class="daily-ust-maturity"/g)||[]).length,29);
assert.match(ustTable,/Nov-2033/);
assert.match(ustTable,/<td role="cell" class="daily-ust-price">97\.2<\/td>/);
assert.match(ustTable,/data-yield-band="[0-4]">5\.0%/);
assert.match(ustTable,/US912810TC27[\s\S]*?No quote/);
assert.match(ustTable,/class="daily-ust-coupon"[^>]*><a href="https:\/\/www\.wsj\.com\/market-data\/bonds\/treasuries"[^>]*>UST 4\.5%<\/a>/);
assert.equal((ustTable.match(/data-ust-identifier hidden/g)||[]).length,30);
assert.match(compact,/data-ust-identifiers aria-pressed="false"/);
assert.match(daily.render(prices,{compactTreasuries:true,showIdentifiers:true}),/data-ust-identifiers aria-pressed="true"/);
assert.match(ustTable,/https:\/\/www\.wsj\.com\/market-data\/bonds\/treasuries/);
assert.match(compact,/Detailed Treasury quotes &amp; dates/);
assert.match(compact,/Other watched bonds/);
assert.doesNotMatch(dailyHTML,/class="daily-ust-table"/);
const fixtureDate = '2026-06-01';
const withHistory = daily.render(prices,{compactTreasuries:true,curves:{
  1:{date:fixtureDate,source:'U.S. Treasury',points:[{years:10,yieldPct:5.122},{years:20,yieldPct:5.122}]},
  12:{date:'2025-11-19',source:'U.S. Treasury',points:[{years:10,yieldPct:5},{years:30,yieldPct:5}]},
}});
const historyTable = withHistory.match(/<table class="daily-ust-table"[\s\S]*?<\/table>/)[0];
assert(historyTable.includes('Estimated clean prices'));
const distinctDates = [...new Set(prices.instruments.filter(r=>r.source==='WSJ').flatMap(r=>prices.history[r.id].map(q=>q.date)))].sort().reverse().slice(0,5);
for (const observed of distinctDates) assert.match(historyTable,new RegExp(`<time datetime="${observed}"`));
assert.equal((historyTable.match(/<td role="cell" class="daily-ust-observed"/g)||[]).length,29*Math.max(1,distinctDates.length));
const may2046 = historyTable.match(/<tr role="row">[^]*?US912810UV88[^]*?<\/tr>/)[0].split('<tr role="row">').at(-1);
assert.match(may2046,/5\.122% benchmark yield">98\.5<\/td>/); // Official auction price was 98.481099 at this yield.
assert.match(may2046,/First issued 01 Jun 2026">—<\/td>/);
for(const [index,coupon] of [1.875,2,3,4,4.125].entries()) {
  treasuries[index].coupon = coupon;
}
const bands = daily.render(unsafe,{compactTreasuries:true});
for(const [band,coupon] of [["under-2","1.875"],["2-to-3","2"],["3-to-4","3"],["3-to-4","4"],["above-4","4.125"]]) assert(new RegExp('data-coupon-band="'+band+'"><a [^>]+>UST '+coupon.replace('.','\\.')+'%<').test(bands));
assert(!bands.includes('javascript:bad'));
console.log('PASS compact daily Treasury quote: all 29 identities, exact coupon bands, rounded asked values, unavailable quote, full precision and source links');

const beta = require('../site/bonds-beta-data.js');
const utc = value => new Date(value + 'T00:00:00Z');
// TreasuryDirect Appendix B examples for clean prices on and between coupon dates.
assert(Math.abs(daily.cleanPrice(utc('2020-05-15'), utc('1990-05-15'), 8.75, 8.84) - 99.057893) < .000001);
assert(Math.abs(daily.cleanPrice(utc('1995-11-15'), utc('1985-11-29'), 9.5, 9.54) - 99.730918) < .000001);
const weekly = JSON.parse(fs.readFileSync('site/data/fred-weekly-yields.json', 'utf8'));
const archive = beta.fredCurves(weekly);
assert(archive.length >= 1500);
assert(archive.every((curve, i) => curve.date === weekly.observations[i].date));
assert(archive.find(curve => curve.date === '2004-01-02').rates.every(([tenor]) => tenor <= 20));
assert(archive.find(curve => curve.date === '2006-02-10').rates.some(([tenor]) => tenor === 30));
const betaList = beta.publicHistory(prices);
const quoted = prices.instruments.find(item => item.source === 'WSJ' && prices.latest[item.id]);
const accepted = prices.latest[quoted.id];
const latestWSJ = betaList.get(quoted.isin + '|USD').latestWSJ;
assert.deepEqual([latestWSJ.bid, latestWSJ.ask, latestWSJ.yield, latestWSJ.date],
  [accepted.bid, accepted.ask, accepted.yield_pct, accepted.date]);
const failed = beta.publicHistory({ ...prices, checks: { ...prices.checks, [quoted.id]: { status: 'unavailable' } } });
assert.deepEqual(failed.get(quoted.isin + '|USD').latestWSJ, { ...latestWSJ, retained: true });
assert.equal(betaList.get('US912810TC27|USD').latestWSJ, null);
let modelCount = 0;
for (const instrument of betaList.values()) {
  const beforeRows = JSON.stringify([...instrument.rows]);
  const model = beta.reconstructedPrices(instrument, archive, daily);
  if (!instrument.isTreasury) {
    assert.equal(model, null);
    continue;
  }
  modelCount++;
  assert.equal(model.start, instrument.maturity.replace(/^\d{4}/, year => Number(year) - 30));
  const samples = [...model.points];
  assert(samples.length > 1 && samples[0][0] >= model.start);
  assert(samples.every(([date, point], index) => point.price > 0 && point.years <= 30 &&
    date < instrument.maturity && (!index || date > samples[index - 1][0])));
  const firstBid = [...instrument.rows].filter(([, quote]) => quote.bid > 0).map(([date]) => date).sort()[0];
  const firstYield = [...instrument.rows].filter(([, quote]) => Number.isFinite(quote.yield)).map(([date]) => date).sort()[0];
  assert.equal(model.firstBid, firstBid);
  assert.equal(model.firstYield, firstYield);
  if (firstBid) assert(samples.every(([date]) => date < firstBid));
  if (firstYield) assert([...model.yields.keys()].every(date => date < firstYield));
  for (const [date, point] of samples) {
    if (model.yields.has(date)) assert.equal(model.yields.get(date).rate, point.rate);
    assert.equal(point.price, daily.cleanPrice(utc(instrument.maturity), utc(date), instrument.coupon, point.rate));
  }
  assert.equal(JSON.stringify([...instrument.rows]), beforeRows);
}
assert.equal(modelCount, 29);
const oldest = beta.reconstructedPrices(betaList.get('US91282CJJ18|USD'), archive, daily);
const first = oldest.points.values().next().value;
assert.deepEqual([first.lower, first.upper], [20, 20]);
const [day, interpolated] = [...oldest.points].find(([, point]) => point.lower === 10 && point.upper === 20);
const rates = new Map(archive.find(curve => curve.date === day).rates);
assert.equal(interpolated.rate, rates.get(10) + (rates.get(20) - rates.get(10)) * (interpolated.years - 10) / 10);
const csvBid = { bid: 98, yield: 4.75, source: 'BOS_YTM' };
const earlier = { ...betaList.get('US91282CJJ18|USD'), rows: new Map([['2024-01-02', csvBid]]) };
const joined = beta.mergeHistory(betaList, new Map([['US91282CJJ18|USD', earlier]])).get('US91282CJJ18|USD');
assert.equal(beta.reconstructedPrices(joined, archive, daily).firstBid, '2024-01-02');
assert.equal(joined.rows.get('2024-01-02'), csvBid);
const separate = { ...earlier, rows: new Map([
  ['2024-01-02', { ...csvBid, yield: null }],
  ['2024-03-01', { ...csvBid, bid: null }],
]) };
const mixed = beta.reconstructedPrices(separate, archive, daily);
assert.equal(mixed.firstBid, '2024-01-02');
assert.equal(mixed.firstYield, '2024-03-01');
assert.equal([...mixed.points.keys()].at(-1), '2023-12-29');
assert.equal([...mixed.yields.keys()].at(-1), '2024-02-23');
console.log('PASS Treasury clean prices, dynamic FRED tenors, the 30-year publication gap and separate handoffs to reported bids and yields');

const treasuryDirectory = beta.treasuryCatalogue(JSON.parse(fs.readFileSync('site/data/treasury-catalogue.json', 'utf8')));
const expanded = beta.mergeCatalogue(betaList, treasuryDirectory);
const samples = JSON.parse(fs.readFileSync('site/data/wsj-treasury-dashboard.json', 'utf8'));
const pricedCatalogue = beta.mergeWSJSamples(new Map(expanded), samples);
assert([...pricedCatalogue.values()].some(bond => bond.latestWSJ && !betaList.has(bond.isin + '|USD')));
assert.equal(pricedCatalogue.get(quoted.isin + '|USD').latestWSJ.date, accepted.date);
assert(treasuryDirectory.size > betaList.size);
assert.equal(treasuryDirectory.get('US912810UY28|USD').termMonths, 360);
assert.equal(treasuryDirectory.get('US91282CJJ18|USD').termMonths, 120);
assert.equal(beta.treasuryCatalogue({ schema_version: 1, latest_auction_date: '2026-11-12',
  instruments: [['US912810UY28', 'Bond', 5.375, '2026-11-16', '2056-11-15']] }).get('US912810UY28|USD').termMonths, null);
for (const [key, saved] of betaList) {
  assert.equal(expanded.get(key).rows, saved.rows);
  if (!saved.isTreasury) continue;
  assert.equal(treasuryDirectory.get(key).coupon, saved.coupon);
  assert.equal(treasuryDirectory.get(key).maturity, saved.maturity);
  assert(expanded.get(key).issueDate);
}
for (const isin of ['US912810UY28', 'US912810CL09']) {
  const key = isin + '|USD';
  const newBond = expanded.get(key);
  assert(!betaList.has(key));
  assert.equal(newBond.rows.size, 0);
  const history = beta.reconstructedPrices(newBond, archive, daily);
  assert(history.points.size > 0);
  assert.equal(history.firstBid, undefined);
  assert([...history.points].every(([date, point]) => date < newBond.maturity && point.price > 0));
}
assert.throws(() => beta.treasuryCatalogue({ schema_version: 1, latest_auction_date: '2026-11-12',
  instruments: [['US912810UY28', 'TIPS', 5.375, '2026-11-16', '2056-11-15']] }));
const localInventory = new Map([['US912810UY28|USD', { name: 'Imported bond', ar: 42, rows: new Map([['2026-11-23', csvBid]]) }]]);
const identified = beta.mergeCatalogue(localInventory, treasuryDirectory).get('US912810UY28|USD');
assert.equal(identified.isTreasury, true);
assert.equal(identified.ar, 42);
assert.equal(identified.rows.get('2026-11-23'), csvBid);
assert.equal(beta.reconstructedPrices(identified, archive, daily).firstBid, '2026-11-23');

const namedBonds = [
  ['XS0000000001', 'Example Note 3.5 11/22/26', '0'],
  ['XS0000000002', 'Example Perp 11/22/26', '25'],
  ['XS0000000003', 'Example Note 2/30/28', '30'],
  ['XS0000000004', 'Example Note 2024-01-01 to 2030-01-01', '40'],
  ['US912810UY28', 'Example Treasury 12/12/30', '42'],
];
const historyFields = ['Bid Price', 'Yield (%)', 'Quote Source', 'ACE Fixed AR Snapshot (%)'];
const namedCsv = [
  ['Date', ...namedBonds.flatMap(([isin, name]) => historyFields.map(field => `${isin} | USD | ${name} | ${field}`))],
  ['2025-10-31', ...namedBonds.flatMap(([, , ar]) => ['98', '4.75', 'BOS_YTM', ar])],
].map(row => row.join(',')).join('\n');
const namedHistory = beta.readHistory(namedCsv);
assert.equal(namedHistory.get('XS0000000001|USD').listedMaturity, '2026-11-22');
assert.equal(namedHistory.get('XS0000000001|USD').ar, 0);
assert.equal(namedHistory.get('XS0000000002|USD').isPerpetual, true);
assert.equal(namedHistory.get('XS0000000002|USD').listedMaturity, undefined);
assert.equal(namedHistory.get('XS0000000003|USD').listedMaturity, undefined);
assert.equal(namedHistory.get('XS0000000004|USD').listedMaturity, undefined);
assert.equal(beta.mergeCatalogue(namedHistory, treasuryDirectory).get('US912810UY28|USD').maturity, '2056-11-15');
console.log('PASS auction identifiers, historical and current catalogue issues, and exact matching of imported quotes');
