/* Release regressions for sparse public valuation evidence and reported actuals. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const dataSource = fs.readFileSync('site/equity-research-data.js', 'utf8');
const valuation = JSON.parse(fs.readFileSync('site/data/equity-valuation-history.json', 'utf8'));
const earnings = JSON.parse(fs.readFileSync('site/data/earnings-history.json', 'utf8'));
const api = require('../site/equity-research-data.js');
const bundle = {valuation, earnings};
const clone = value => structuredClone(value);
const observation = (symbol, date) => valuation.observations.find(row => row.symbol === symbol && row.report_date === date);

function validateEvidence() {
  api.validateValuation(valuation);
  api.validateEarnings(earnings);
  assert.equal(valuation.coverage.complete, false);
  assert.equal(valuation.coverage.edition_count, 6);
  assert.equal(valuation.coverage.listing_count, 14);
  assert.equal(valuation.observations.length, 83);
  assert.deepEqual(valuation.coverage.report_dates, ['2021-12-01','2022-11-01','2023-11-01','2024-11-01','2025-11-03','2026-11-02']);
  const expectedDates = {'2021-12-01':'2021-11-30','2022-11-01':'2022-10-31','2023-11-01':'2023-10-31','2024-11-01':'2024-10-31','2025-11-03':'2025-10-31','2026-11-02':'2026-10-30'};
  const expectedCurrencies = {'D05.SI':'SGD','U11.SI':'SGD',NVDA:'USD',MSFT:'USD',AAPL:'USD',TSM:'USD',GOOGL:'USD',AMZN:'USD',META:'USD','BRK-B':'USD',AMD:'USD',AVGO:'USD',MU:'USD',TSLA:'USD'};
  const fields = ['dividend_yield_pct','eps_growth_pct','fair_value_or_target','market_cap_usd_bn','pb','pe','price','roe_pct'];
  for (const listing of valuation.listings) {
    const rows = valuation.observations.filter(row => row.symbol === listing.symbol);
    assert.equal(rows.length, listing.symbol === 'META' ? 5 : 6, 'Only exact source listings enter the supplied editions');
    assert.equal(listing.currency, expectedCurrencies[listing.symbol]);
    assert.equal(new Set(rows.map(row => row.report_date)).size, rows.length);
  }
  for (const row of valuation.observations) {
    assert.equal(row.price_date, expectedDates[row.report_date]);
    assert.equal(row.metric_basis, 'consensus_forward_estimates');
    assert.equal(row.forecast_horizon, 'unspecified');
    assert.equal(row.price_basis, 'source_snapshot_unadjusted');
    assert.equal(row.reference_value_type, 'fair_value_or_target_undifferentiated');
    assert.equal(row.reference_provider, null, 'No provider is guessed from mixed table sections');
    assert.deepEqual(Object.keys(row.source_values).sort(), fields);
    for (const field of fields) {
      const exact = row.source_values[field];
      const value = ['','NA','N/A','N.M.','NM','-','—'].includes(exact.trim().toUpperCase()) ? null : Number(exact.replaceAll(',', '').replace(/^\((.*)\)$/, '-$1'));
      assert.equal(row[field], value, 'Numeric rendering retains the checked source value: '+field);
    }
  }
  // Independently checked extraction cases: blank moat column, appendix duplicate
  // ticker hits, and an explicit zero that must not become a useful ratio minimum.
  assert.equal(observation('AAPL','2024-11-01').pe, 30.3);
  assert.equal(observation('AAPL','2024-11-01').pb, 38.8);
  assert.equal(observation('AAPL','2024-11-01').source_values.price, '225.91');
  assert.equal(observation('D05.SI','2021-12-01').pe, 10.9);
  assert.equal(observation('D05.SI','2021-12-01').source_page, 10);
  assert.equal(observation('U11.SI','2023-11-01').pb, 1);
  assert.equal(observation('U11.SI','2023-11-01').source_page, 9);
  assert.equal(observation('NVDA','2026-11-02').pe, 14.3);
  assert.equal(observation('TSM','2021-12-01').source_values.pb, '0.0');
  assert(observation('TSM','2021-12-01').quality_flags.includes('pb_nonmeaningful_for_range'));
  assert.equal(observation('META','2021-12-01'), undefined, 'Historical ticker changes are not inferred');
  assert.equal(observation('MU','2023-11-01').pe, 0);
  assert(observation('MU','2023-11-01').quality_flags.includes('pe_nonmeaningful_for_range'));
  assert.equal(valuation.methodology.percentiles_available, false);

  const forbiddenKeys = /^(?:raw_text|raw_cells_json|ar|moa|ar_pct|fixed_ar|advance_rate|holdings|borrowing|client|client_id|account|facility|concentration|risk_rating|esg_rating)$/i;
  const inspect = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert(!forbiddenKeys.test(key), 'Private or raw-input field cannot enter public pilot: '+key);
      inspect(child);
    }
  };
  inspect(valuation);
  assert(!/libfile_|sediment:\/\/|chatgpt\.com\/(?:c|g)\/|[A-Z]:\\|\/workspace\/|\/home\/agent\/|file:\/\//i.test(JSON.stringify(valuation)), 'Public evidence contains no private file or chat locations');

  for (const mutate of [
    copy => copy.observations[0].currency = 'SGD',
    copy => copy.observations[0].source_ticker = 'TSM US',
    copy => copy.observations[0].report_date = '2026-02-30',
    copy => copy.observations[0].price_date = '2026-11-15',
    copy => copy.observations[0].forecast_horizon = 'FY1',
    copy => copy.observations[0].pe = '28.6',
    copy => copy.observations.push(clone(copy.observations[0])),
    copy => copy.coverage.report_dates.reverse(),
    copy => copy.coverage.report_dates[0] = '2021-11-01',
    copy => copy.coverage.first_report_date = '2016-12-01',
    copy => copy.coverage.last_report_date = '2026-11-13',
    copy => Object.values(copy.sources)[0].price_dates = ['2026-11-13'],
    copy => Object.values(copy.sources)[0].report_date = '2026-02-30',
    copy => copy.sources.duplicate = clone(Object.values(copy.sources)[0]),
    copy => copy.listings[0].report_dates = [],
    copy => copy.listings[0].first_report_date = '2016-12-01',
    copy => copy.listings[0].last_report_date = '2026-11-13',
    copy => copy.listings.find(row=>row.symbol==='META').missing_editions = [],
  ]) {
    const copy = clone(valuation); mutate(copy);
    assert.throws(() => api.validateValuation(copy));
  }
  assert.equal(api.validDate('2026-02-30'), false);
  assert.equal(api.validDate('2024-02-29'), true);
}

function validateRangeEvidence() {
  const before = JSON.stringify(bundle);
  const tsm = api.observedRange('TSM', bundle, 'pb');
  assert.equal(tsm.edition_count, 6);
  assert.equal(tsm.observation_count, 6);
  assert.equal(tsm.missing_count, 0);
  assert.equal(tsm.latest_status, 'valid');
  assert.equal(tsm.latest_observation.source_values.pb, '6.8');
  assert.equal(tsm.latest_observation.report_date, '2026-11-02');
  assert.equal(tsm.min_observations.length, 1);
  assert.equal(tsm.min_observations[0].source_values.pb, '3.0');
  assert.equal(tsm.excluded_observations[0].source_values.pb, '0.0');
  assert.equal(tsm.excluded_observations[0].exclusion_reason, 'nonmeaningful');
  assert.equal(tsm.excluded_observations[0].report_date, '2021-12-01');
  assert.equal(tsm.min_observations[0].source.report_date, tsm.min_observations[0].report_date);
  const yieldRange = api.observedRange('NVDA', bundle, 'dividend_yield_pct');
  assert.equal(yieldRange.min, 0, 'A supplied zero dividend yield is a valid observation');
  assert.equal(yieldRange.count, 6);
  assert.equal(yieldRange.excluded_count, 0);
  const negativeYield = clone(bundle), yieldRow = negativeYield.valuation.observations.find(row=>row.symbol==='NVDA'&&row.report_date==='2026-11-02');
  yieldRow.dividend_yield_pct = -1; yieldRow.source_values.dividend_yield_pct = '-1.0';
  const yieldReview = api.observedRange('NVDA', negativeYield, 'dividend_yield_pct');
  assert.equal(yieldReview.latest, null);
  assert.equal(yieldReview.latest_status, 'nonmeaningful');
  assert.equal(yieldReview.excluded_observations[0].source_values.dividend_yield_pct, '-1.0');
  assert.equal(yieldReview.count, 5, 'Negative yield is retained as source evidence but excluded from the meaningful range');
  const meta = api.coverageFor('META', bundle);
  assert.equal(meta.observation_count, 5);
  assert.equal(meta.edition_count, 6);
  assert.equal(meta.missing_count, 1);
  assert.deepEqual(meta.missing_report_dates, ['2021-12-01']);
  assert.equal(meta.editions[0].observation, null);
  assert.equal(meta.first_report_date, '2021-12-01');
  assert.equal(meta.first_observation_date, '2022-11-01');
  const mu = api.observedRange('MU', bundle, 'pe');
  assert.equal(mu.excluded_count, 1);
  assert.equal(mu.excluded_observations[0].report_date, '2023-11-01');

  const omittedLatest = clone(bundle);
  omittedLatest.valuation.observations = omittedLatest.valuation.observations.filter(row=>!(row.symbol==='MSFT'&&row.report_date==='2026-11-02'));
  const missingRow = api.observedRange('MSFT', omittedLatest, 'pe');
  assert.equal(missingRow.latest_date, '2026-11-02');
  assert.equal(missingRow.latest, null, 'A missing row in the newest global edition must not carry forward a prior multiple');
  assert.equal(missingRow.latest_observation, null);
  assert.equal(missingRow.latest_status, 'missing_observation');
  assert.equal(missingRow.most_recent_observation.report_date, '2025-11-03');
  assert.equal(missingRow.excluded_count, 0, 'A missing listing row is distinct from an excluded numeric observation');
  assert.equal(missingRow.missing_count, 1);
  assert.deepEqual(missingRow.missing_report_dates, ['2026-11-02']);

  const missingValue = clone(bundle), latest = missingValue.valuation.observations.find(row=>row.symbol==='MSFT'&&row.report_date==='2026-11-02');
  latest.pe = null; latest.source_values.pe = 'N/A';
  const absent = api.observedRange('MSFT', missingValue, 'pe');
  assert.equal(absent.latest, null);
  assert.equal(absent.latest_status, 'missing_value');
  assert.equal(absent.latest_observation.source_values.pe, 'N/A');
  assert.equal(absent.excluded_count, 1);
  assert.equal(absent.missing_count, 0);
  latest.pe = 0; latest.source_values.pe = '0.0';
  assert.equal(api.observedRange('MSFT', missingValue, 'pe').latest_status, 'nonmeaningful');
  const tied = clone(bundle);
  for (const row of tied.valuation.observations.filter(row=>row.symbol==='AAPL')) { row.pe=30; row.source_values.pe='30.0'; }
  const ties = api.observedRange('AAPL', tied, 'pe');
  assert.equal(ties.min_observations.length, 6, 'Every tied extreme retains its original report date');
  assert.equal(ties.max_observations.length, 6);
  assert.equal(ties.min, ties.max);
  assert.equal(ties.percentile, null);
  assert(!Object.hasOwn(ties,'position'), 'No percentile-like normalized range score is exposed');

  const windowed = api.observedRange('META', bundle, 'pe', {from:'2022-01-01',to:'2024-11-01'});
  assert.equal(windowed.edition_count, 3);
  assert.equal(windowed.count, 3);
  assert.equal(windowed.latest_date, '2024-11-01');
  assert.equal(windowed.missing_count, 0);
  const empty = api.observedRange('MSFT', bundle, 'pe', {from:'2026-11-03',to:'2026-11-14'});
  assert.equal(empty.edition_count, 0);
  assert.equal(empty.latest_date, null);
  assert.equal(empty.most_recent_observation, null);
  assert.equal(empty.min, null);
  for (const input of ['2330.TW', {ticker:'TSM',currency:'TWD'}, {ticker:'NVDA',asset_type:'index'}]) {
    const unavailable = api.observedRange(input, bundle, 'pe');
    assert.equal(unavailable.count, 0);
    assert.equal(unavailable.latest, null);
    assert.equal(unavailable.min_observations.length, 0);
    assert.equal(api.coverageFor(input,bundle).status, 'unavailable');
  }
  const unavailable = api.observedRange('MSFT', {valuation:null}, 'pe');
  assert.equal(unavailable.edition_count, 0);
  assert.deepEqual(unavailable.report_dates, []);
  assert.equal(JSON.stringify(bundle), before, 'Coverage and range projections do not alter source evidence');
}

function validateFinancialSemantics() {
  const before = JSON.stringify(bundle);
  const msft = api.valuationSeries('MSFT', bundle);
  assert.equal(msft.observations.length, 6);
  assert.equal(msft.percentile, null);
  assert.equal(msft.status, 'partial');
  assert.equal(api.valuationSeries('MSFT', bundle, {from:'2026-01-01',to:'2026-11-14'}).observations.length, 1);
  assert.equal(api.valuationSeries('MSFT', bundle, {from:'2026-11-03',to:'2026-11-14'}).observations.length, 0);
  for (const input of ['2330.TW', 'DBS', {name:'Microsoft'}, {ticker:'TSM',currency:'TWD'}, {ticker:'NVDA',asset_type:'index'}]) {
    assert.equal(api.valuationSeries(input, bundle).observations.length, 0, 'No name, alternate listing, currency or asset-type substitution');
  }
  const pb = api.observedRange('TSM', bundle, 'pb');
  assert.equal(pb.count, 5);
  assert.equal(pb.excluded_count, 1);
  assert.equal(pb.min, 3);
  assert.equal(pb.max, 7.3);
  assert.equal(pb.latest, 6.8);
  assert.equal(pb.percentile, null);
  const missingLatest=clone(bundle),latestTSM=missingLatest.valuation.observations.find(row=>row.symbol==='TSM'&&row.report_date==='2026-11-02');
  latestTSM.pb=null;latestTSM.source_values.pb='N/A';
  const missingRange=api.observedRange('TSM',missingLatest,'pb');
  assert.equal(missingRange.latest,null,'A missing latest ratio cannot silently carry forward a prior valid observation');
  assert.equal(missingRange.latest_date,'2026-11-02');
  assert.equal(api.observedRange('TSM', bundle, 'price').min, null, 'Unadjusted evidence prices cannot become a return or valuation range');
  const reported = api.earningsFor('MSFT', bundle);
  assert.equal(reported.observations.length, 2);
  assert.equal(reported.events.length, 1, 'Later-release comparatives are not backdated into an earnings-event series');
  assert.equal(reported.events[0].date, '2026-10-28');
  assert.equal(reported.observations.find(row => row.period === 'FY2026 Q1').report_date, null);
  assert.equal(reported.cashflows[0].fcf_usd_bn, 18.633);
  const tsm = api.earningsFor('TSM', bundle);
  assert.equal(tsm.events.length, 1);
  assert.equal(tsm.observations[0].eps, 4.6);
  assert.equal(tsm.observations[0].ordinary_eps_ntd, 29.43);
  assert.match(tsm.observations[0].eps_basis, /ADR/);
  assert.equal(api.earningsFor({ticker:'TSM',currency:'TWD'}, bundle).observations.length, 0, 'TWD ordinary shares cannot borrow USD ADR earnings');
  assert.equal(api.earningsFor({ticker:'NVDA',asset_type:'index'}, bundle).observations.length, 0);
  assert.equal(api.earningsFor('D05.SI', bundle).status, 'unavailable', 'Missing bank earnings remain unavailable');
  assert.equal(api.earningsFor('D05.SI', bundle).cashflows.length, 0);
  assert.match(api.earningsFor('AAPL',bundle).cashflow_note,/capex.*not.*reconciled/i);
  assert.match(api.earningsFor('TSM',bundle).cashflow_note,/currency conversion.*not.*reconciled/i);
  const meta = api.earningsFor('META', bundle).cashflows[0];
  assert.equal(meta.other_adjustment_usd_bn, -0.964);
  assert.equal(meta.fcf_usd_bn, -2.12);
  assert.match(meta.definition, /finance-lease principal/);
  const amazon = api.earningsFor('AMZN', bundle).cashflows[0];
  assert.equal(amazon.other_adjustment_usd_bn, 1.381);
  assert.equal(amazon.fcf_usd_bn, -33.456);
  assert.equal(JSON.stringify(bundle), before, 'Research queries cannot mutate source data or earnings dates');
  for (const mutate of [
    copy => copy.companies[0].history[0].eps = '2.10',
    copy => copy.companies[0].history[0].report_date = '2026-02-30',
    copy => copy.fcf.rows[0].fcf_usd_bn += 1,
    copy => copy.fcf.rows[0].operating_cash_flow_usd_bn = Infinity,
    copy => copy.fcf.rows[0].source = 'missing-source',
  ]) {
    const copy = clone(earnings); mutate(copy);
    assert.throws(() => api.validateEarnings(copy));
  }
}

function loaderFixture(mode = 'ok') {
  let currentMode = mode;
  const calls = {valuation:0, earnings:0};
  const context = {Date, URL, console, AbortController, setTimeout, clearTimeout, fetch:async path => {
    const kind = path === 'data/equity-valuation-history.json' ? 'valuation' : path === 'data/earnings-history.json' ? 'earnings' : null;
    assert(kind, 'Only the two declared read-only datasets may load');
    calls[kind]++;
    if (currentMode === 'offline' || currentMode === kind+'-offline') throw Error('fixture offline');
    return {ok:true,json:async () => clone(kind === 'valuation' ? valuation : earnings)};
  }};
  context.window = context;
  vm.createContext(context); vm.runInContext(dataSource, context);
  return {api:context.EquityResearchData,calls,setMode:value => currentMode=value};
}

async function validateLoading() {
  const good = loaderFixture();
  const [first, second] = await Promise.all([good.api.load(), good.api.load()]);
  assert.equal(good.calls.valuation, 1);
  assert.equal(good.calls.earnings, 1);
  assert.equal(first.valuation, second.valuation);
  assert(Object.isFrozen(first.valuation.observations[0].source_values));
  assert.equal(first.status.valuation.state, 'partial');
  assert.equal(first.status.earnings.state, 'partial');
  good.setMode('offline');
  const stale = await good.api.load({force:true});
  assert.equal(stale.valuation, first.valuation, 'Failed refresh retains already checked dated data');
  assert.equal(stale.earnings, first.earnings);
  assert.equal(stale.status.valuation.refresh_failed, true);
  assert.equal(stale.status.valuation.state, 'partial');
  const cold = loaderFixture('offline');
  const unavailable = await cold.api.load();
  assert.equal(unavailable.valuation, null);
  assert.equal(unavailable.status.valuation.state, 'unavailable');
  cold.setMode('ok');
  const recovered = await cold.api.load();
  assert.equal(recovered.status.valuation.state, 'partial');
  assert.equal(recovered.status.valuation.refresh_failed, false);
  assert.equal(cold.calls.valuation, 2, 'Rejected requests do not poison future retries');
  const partial = loaderFixture('valuation-offline');
  const result = await partial.api.load();
  assert.equal(result.status.valuation.state, 'unavailable');
  assert.equal(result.status.earnings.state, 'partial', 'One failed dataset cannot hide the other');
  assert(result.earnings.companies.length > 0);
}

function validateRegistryIdentity() {
  const brk={id:'brk-b',ticker:'BRK-B',aliases:['BRK.B'],asset_type:'equity',currency:'USD',isin:'US0846707026'};
  const nvda={id:'nvda',ticker:'NVDA',asset_type:'equity',currency:'USD',isin:'US67066G1040'};
  const context={Date,URL,console,MarketPrices:{resolve:ticker=>['BRK-B','BRK.B'].includes(ticker)?brk:ticker==='NVDA'?nvda:null}};
  context.window=context;vm.createContext(context);vm.runInContext(dataSource,context);
  const reader=context.EquityResearchData;
  assert.equal(reader.earningsFor('BRK-B',bundle).company.ticker,'BRK.B','Only the existing registry can join an alternate ticker spelling');
  assert.equal(reader.earningsFor('BRK.A',bundle).company,null);
  assert.equal(reader.earningsFor({ticker:'BRK-B',currency:'SGD'},bundle).company,null);
  assert.equal(reader.valuationSeries({ticker:'NVDA',currency:'USD',id:'nvda',isin:'US67066G1040'},bundle).observations.length,6);
  assert.equal(reader.valuationSeries({ticker:'NVDA',isin:'US8740391003'},bundle).observations.length,0);
  assert.equal(reader.valuationSeries({ticker:'NVDA',id:'tsm'},bundle).observations.length,0);
  brk.aliases=[];
  assert.equal(reader.earningsFor('BRK-B',bundle).company,null,'No automatic punctuation or share-class rewriting');
}

async function validateWorkbenchIntegration() {
  const prices = require('../site/share-prices.js');
  const listeners = {}, calls = [], plots = [];
  const result = {innerHTML:'',removeAttribute:()=>{}};
  const host = {innerHTML:'',isConnected:true};
  const picker = {value:'MSFT'};
  const el = {dataset:{shareWorkbench:'history'},isConnected:true,innerHTML:'',querySelector:selector => selector === '[data-equity-research]' ? host : selector === '[data-share-add-select]' ? picker : result};
  const items = ['AAPL','MSFT'].map(ticker => ({id:ticker.toLowerCase(),ticker,name:ticker,currency:'USD',unit:'USD per share',asset_type:'equity',history_url:'https://example.com/'+ticker}));
  const daily = {AAPL:[['2026-11-12',100],['2026-11-13',120]],MSFT:[['2026-11-12',10],['2026-11-13',12]]};
  const before = JSON.stringify(daily);
  let rejectResearch = false, rejectPrices = false;
  const context = {Date,URL,console,document:{addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn),querySelectorAll:()=>[el]},
    MarketPrices:{version:()=> 'fixture',instruments:()=>items,series:async ticker=>{
      if(rejectPrices)throw Error('fixture price outage');
      const item=items.find(row=>row.ticker===ticker),points=daily[ticker];
      return {item,quote:{close:points.at(-1)[1],date:points.at(-1)[0]},base:{daily:points,weekly:[],monthly:[],period_note:'Actual daily sessions'},daily:points};
    },selectPoints:prices.selectPoints,earnings:async()=>[],resolve:ticker=>items.find(row=>row.ticker===ticker),displayUnit:prices.displayUnit,sourceUrl:prices.sourceUrl,priceBasis:prices.priceBasis,quoteStatus:()=> 'Daily closing price',svg:lines=>{plots.push(clone(lines));return '<svg></svg>'; }},
    EquityResearch:{mount:async (node,opts)=>{
      assert.equal(node,host);calls.push(clone(opts));
      opts.symbols.push('UNTRUSTED_MUTATION'); // Parent must pass a copied selection.
      if(rejectResearch)throw Error('fixture research outage');
    }}
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('site/share-chart-workbench.js','utf8'),context);
  const settle=async()=>{await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));};
  const click=async(selector,dataset={})=>{
    const target={closest:query=>query==='[data-share-workbench]'?el:query===selector?{dataset}:null};
    for(const listener of listeners.click)listener({target});
    await settle();
  };
  context.MarketShareCharts.mount();await settle();
  assert.deepEqual(calls.at(-1).symbols,['AAPL']);
  assert.equal(calls.at(-1).range,'6M');
  assert.equal(calls.at(-1).selectionKey,'history');
  assert.equal(calls.at(-1).to,'2026-11-13');
  assert.deepEqual(plots.at(-1)[0].points,daily.AAPL);
  await click('[data-share-range]',{shareRange:'1Y'});
  assert.deepEqual(calls.at(-1).symbols,['AAPL']);
  assert.equal(calls.at(-1).range,'1Y');
  await click('[data-share-add]');
  assert.deepEqual(calls.at(-1).symbols,['AAPL','MSFT'],'Research shares the existing chart selection');
  assert.equal(plots.at(-1).length,2);
  for(const line of plots.at(-1)){
    assert.equal(line.points[0][1],0);
    assert(Math.abs(line.points.at(-1)[1]-20)<1e-10,'Comparison retains the existing common-date return formula');
  }
  rejectResearch=true;
  await click('[data-share-range]',{shareRange:'5Y'});
  assert.match(host.innerHTML,/could not load/);
  assert.equal(plots.at(-1).length,2,'Research rejection never breaks price rendering');
  assert.equal(JSON.stringify(daily),before,'Research does not mutate historical close observations');
  rejectPrices=true;rejectResearch=false;
  const count=calls.length;
  await click('[data-share-range]',{shareRange:'6M'});
  assert(calls.length>count,'Research still mounts when the price service fails');
  assert.match(result.innerHTML,/fixture price outage/);
}

function uiFixture(load=async()=>bundle) {
  const context={Date,URL,console,EquityResearchData:{...api,load},document:{activeElement:null},MarketPrices:{
    resolve:symbol=>({id:symbol.toLowerCase(),ticker:symbol,currency:symbol.endsWith('.SI')?'SGD':'USD'}),
    currentQuote:()=>({close:900,date:'2026-11-13',sourceLabel:'Separate selected quote',current:true})
  }};
  context.window=context;vm.createContext(context);
  vm.runInContext(fs.readFileSync('site/equity-research.js','utf8'),context);
  return {api:context.EquityResearch,context};
}

function uiContainer() {
  const listeners={},attrs={};
  return {innerHTML:'',isConnected:true,listeners,attrs,classList:{add:()=>{}},contains:()=>false,querySelectorAll:()=>[],
    addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn),
    removeEventListener:(type,fn)=>listeners[type]=(listeners[type]||[]).filter(item=>item!==fn),
    setAttribute:(key,value)=>attrs[key]=value
  };
}

function validateRendering() {
  const ui=uiFixture().api;
  const msft=api.valuationSeries('MSFT',bundle),nvda=api.valuationSeries('NVDA',bundle);
  assert.deepEqual(Array.from(ui.commonEditions([msft,nvda])),valuation.coverage.report_dates);
  assert.deepEqual(Array.from(ui.commonEditions([msft,{observations:[{report_date:'2026-11-02'}]}])),['2026-11-02']);
  assert.deepEqual(Array.from(ui.commonEditions([msft,{observations:[{report_date:'2026-11-03'}]}])),[]);
  assert.deepEqual(Array.from(ui.commonEditions([{observations:[]}])),[]);
  const timeline=ui.timelineSvg(nvda,api.earningsFor('NVDA',bundle));
  assert(timeline.includes('Own scale'));
  assert(!timeline.includes('<polyline'),'Sparse valuation observations are not connected into invented daily data');
  assert(!timeline.includes('326.76'),'Unadjusted source price is not plotted as historical price');
  assert(!timeline.includes('2025-07-26'),'Undated comparatives do not produce assumed release dates');
  assert(!/NaN|Infinity/.test(timeline));
  const single=ui.timelineSvg({symbol:'NVDA',observations:[nvda.observations.at(-1)]},{events:[]});
  assert(!/NaN|Infinity/.test(single),'Single source date and flat ratios have finite chart geometry');
  const filtered=ui.timelineSvg(nvda,api.earningsFor('NVDA',bundle),{from:'2026-01-01',to:'2026-11-14'});
  assert(!filtered.includes('2021-12-01'));
  const tsmHtml=ui.renderContent(bundle,{symbols:['TSM']},{},api);
  assert(tsmHtml.includes('0.0<small>Source review; excluded from range'));
  assert(tsmHtml.includes('NT$29.43 / ordinary share'));
  assert(tsmHtml.includes('US$/ADR unit'));
  assert(tsmHtml.includes('original release dates'));
  assert(tsmHtml.includes('not continuous historical ranges or valuation percentiles'));
  assert(tsmHtml.includes('currency conversion have not been reconciled'));
  const beforeCashflow=ui.renderContent(bundle,{symbols:['MSFT'],from:'2026-01-01',to:'2026-10-27'},{window:'chart'},api);
  assert(beforeCashflow.includes('No reconciled cash-flow observation is published within this window.'));
  assert(!beforeCashflow.includes('18.633'),'A fiscal period end does not make subsequently published FCF available earlier');
  const afterCashflow=ui.renderContent(bundle,{symbols:['MSFT'],from:'2026-01-01',to:'2026-10-28'},{window:'chart'},api);
  assert(afterCashflow.includes('18.633'));
  const compare=ui.renderContent(bundle,{symbols:['NVDA','JNJ']},{mode:'comparison',edition:'2026-11-02'},api);
  assert(compare.includes('900 USD'),'Comparison uses selected quote service directly');
  assert(compare.includes('Separate selected quote'));
  assert(compare.includes('2026-11-13'));
  assert(compare.includes('14.3'),'Separate dated forward P/E is not recalculated from a newer quote');
  assert(compare.includes('1 of 2 selected shares have valuation evidence'));
  assert(compare.includes('Unavailable: JNJ'));
  assert(compare.includes('2026-11-02'));
  assert(!compare.includes('eligible market value'));
  const noData=ui.renderContent({valuation:null,earnings:null,status:{valuation:{state:'unavailable',message:'Could not load'},earnings:{state:'unavailable',message:'Could not load'}}},{symbols:['MSFT']},{},api);
  assert(noData.includes('Could not load'));
  assert(noData.includes('Refresh evidence'));
  assert(noData.includes('unavailable'));
  const hostile=clone(bundle);
  hostile.valuation.listings.find(row=>row.symbol==='AAPL').name='<img src=x onerror=alert(1)>';
  const source=hostile.earnings.sources[hostile.earnings.companies.find(row=>row.ticker==='AAPL').history[0].source];
  source.url='javascript:alert(1)';source.title='<script>alert(1)</script>';
  const escaped=ui.renderContent(hostile,{symbols:['AAPL']},{},api);
  assert(escaped.includes('&lt;img'));
  assert(escaped.includes('&lt;script&gt;'));
  assert(!escaped.includes('<img src=x'));
  assert(!escaped.includes('href="javascript:'));
  const moduleSource=fs.readFileSync('site/equity-research.js','utf8');
  assert(!/localStorage|sessionStorage|indexedDB/.test(moduleSource),'View does not add a watchlist or private-input persistence store');
}

function validateRangeRendering() {
  const ui = uiFixture().api;
  const ranges = ui.renderContent(bundle, {symbols:['TSM','META','JNJ']}, {mode:'ranges',metric:'pb'}, api);
  assert(ranges.includes('data-er-mode="ranges" aria-pressed="true"'));
  assert(ranges.includes('<option value="pb" selected>'));
  assert.equal((ranges.match(/class="er-range-card"/g)||[]).length, 3, 'Every selected share remains visible, including an unavailable listing');
  assert(ranges.includes('<b>5 valid</b> · 1 excluded · 0 missing rows'));
  assert(ranges.includes('<b>5 valid</b> · 0 excluded · 1 missing rows'));
  assert(ranges.includes('<b>0 valid</b> · 0 excluded · 6 missing rows'));
  assert(ranges.includes('0.0<small>Excluded from range'));
  assert(ranges.includes('No exact row'));
  assert(ranges.includes('no historical ticker alias is inferred'));
  assert(ranges.includes('Forecast horizon') || ranges.includes('forecast horizon unspecified'));
  assert(ranges.includes('do not measure completeness of the monthly archive'));
  assert(ranges.includes('Historical valuation percentiles are unavailable'));
  assert(!/NaN|Infinity|undefined/.test(ranges));
  assert.equal((ranges.match(/class="er-range-latest"/g)||[]).length, 2, 'Unavailable listing has no plotted latest observation');
  const yieldHtml = ui.renderContent(bundle, {symbols:['NVDA']}, {mode:'ranges',metric:'dividend_yield_pct'}, api);
  assert(yieldHtml.includes('0.0–0.5'), 'Ranges preserve source precision even for valid zero yield');
  assert(yieldHtml.includes('<b>6 valid</b> · 0 excluded'));
  assert(yieldHtml.includes('Zero yield is a valid supplied value'));
  const zeroLatest = clone(bundle), row = zeroLatest.valuation.observations.find(point=>point.symbol==='NVDA'&&point.report_date==='2026-11-02');
  row.dividend_yield_pct = 0; row.source_values.dividend_yield_pct = '0.0';
  assert(ui.renderContent(zeroLatest,{symbols:['NVDA']},{mode:'ranges',metric:'dividend_yield_pct'},api).includes('class="er-range-latest"'), 'A valid zero latest yield still gets a marker');
  const omittedLatest = clone(bundle);
  omittedLatest.valuation.observations = omittedLatest.valuation.observations.filter(point=>!(point.symbol==='MSFT'&&point.report_date==='2026-11-02'));
  const missing = ui.renderContent(omittedLatest,{symbols:['MSFT']},{mode:'ranges',metric:'pe'},api);
  assert(missing.includes('<dd>Unavailable<small>2026-11-02 · No exact listing row in this edition'));
  assert(!missing.includes('class="er-range-latest"'), 'Missing newest global edition cannot display an older marker');
  const tied = clone(bundle);
  for(const point of tied.valuation.observations.filter(point=>point.symbol==='AAPL')) { point.pe=30; point.source_values.pe='30.0'; }
  const tiedHtml = ui.renderContent(tied,{symbols:['AAPL']},{mode:'ranges',metric:'pe'},api);
  assert(tiedHtml.includes('30.0–30.0'));
  assert(!/NaN|Infinity/.test(tiedHtml),'Flat supplied ranges have finite plot geometry');
  assert(tiedHtml.includes(valuation.coverage.report_dates.join(' · ')), 'Every tied low/high date stays visible');
  const empty = ui.renderContent(bundle,{symbols:['MSFT'],from:'2026-11-03',to:'2026-11-14'},{mode:'ranges',metric:'pe',window:'chart'},api);
  assert(empty.includes('No supplied edition in this window'));
  assert(!empty.includes('class="er-range-latest"'));
  const unavailable = ui.renderContent({valuation:null,earnings:null},{symbols:['MSFT']},{mode:'ranges'},api);
  assert(unavailable.includes('Valuation coverage is currently unavailable'));
  assert(!/NaN|Infinity|undefined/.test(unavailable));
  const hostile = clone(bundle);
  hostile.valuation.listings.find(point=>point.symbol==='META').missing_editions[0].note='<img src=x onerror=alert(1)>';
  const safe = ui.renderContent(hostile,{symbols:['META']},{mode:'ranges'},api);
  assert(safe.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert(!safe.includes('<img src=x'));
}

async function validateUiLifecycle() {
  const ui=uiFixture().api,first=uiContainer();
  const mounted=await ui.mount(first,{symbols:['MSFT'],range:'6M',selectionKey:'history'});
  assert.equal(mounted.ok,true);assert.equal(first.attrs['aria-busy'],'false');
  for(const listener of first.listeners.click)listener({target:{closest:selector=>selector==='[data-er-mode]'?{dataset:{erMode:'comparison'}}:null}});
  assert(first.innerHTML.includes('class="er-comparison"'));
  for(const listener of first.listeners.change)listener({target:{value:'chart',matches:selector=>selector==='[data-er-window]'}});
  first.isConnected=false;
  const replacement=uiContainer();
  await ui.mount(replacement,{symbols:['MSFT','NVDA'],range:'1Y',from:'2025-11-13',to:'2026-11-13',selectionKey:'history'});
  assert(replacement.innerHTML.includes('class="er-comparison"'),'Workbench repaint preserves research view, not a separate security selection');
  assert(replacement.innerHTML.includes('Report-date window:'));
  assert(replacement.innerHTML.includes('2 selected shares'));
  await ui.mount(replacement,{symbols:['MSFT','NVDA'],selectionKey:'history'});
  assert.equal(replacement.listeners.click.length,1,'Repeated mounts do not accumulate listeners');
  assert.equal(replacement.listeners.change.length,1);
  for(const listener of replacement.listeners.click)listener({target:{closest:selector=>selector==='[data-er-mode]'?{dataset:{erMode:'ranges'}}:null}});
  for(const listener of replacement.listeners.change)listener({target:{value:'dividend_yield_pct',matches:selector=>selector==='[data-er-metric]'}});
  assert(replacement.innerHTML.includes('class="er-valuation-ranges"'));
  assert(replacement.innerHTML.includes('<option value="dividend_yield_pct" selected>'));
  const rangeReplacement=uiContainer();
  await ui.mount(rangeReplacement,{symbols:['NVDA'],selectionKey:'history'});
  assert(rangeReplacement.innerHTML.includes('data-er-mode="ranges" aria-pressed="true"'), 'Range view survives a workbench repaint');
  assert(rangeReplacement.innerHTML.includes('<option value="dividend_yield_pct" selected>'), 'Range metric survives a workbench repaint');
  assert.equal((rangeReplacement.innerHTML.match(/class="er-range-card"/g)||[]).length,1,'Parent selection replaces range cards without a second selection store');
  ui.unmount(replacement);
  assert.equal(replacement.listeners.click.length,0);
  assert.equal(replacement.listeners.change.length,0);
  const failure=uiFixture(async()=>{throw Error('fixture offline');}).api,failed=uiContainer();
  assert.equal((await failure.mount(failed,{symbols:['MSFT']})).ok,false);
  assert(failed.innerHTML.includes('Retry evidence'));
  assert.equal(failed.attrs['aria-busy'],'false');
  const resolvers=[],racing=uiFixture(()=>new Promise(resolve=>resolvers.push(resolve))).api,host=uiContainer();
  const old=racing.mount(host,{symbols:['AAPL'],selectionKey:'race'});
  const current=racing.mount(host,{symbols:['MSFT'],selectionKey:'race'});
  resolvers[0](bundle);assert.equal((await old).stale,true);
  resolvers[1](bundle);assert.equal((await current).ok,true);
  assert(host.innerHTML.includes('Microsoft <small>MSFT</small>'),'Outdated async result cannot replace current selected company');
}

(async () => {
  validateEvidence();
  validateFinancialSemantics();
  validateRangeEvidence();
  await validateLoading();
  validateRegistryIdentity();
  await validateWorkbenchIntegration();
  validateRendering();
  validateRangeRendering();
  await validateUiLifecycle();
  console.log('PASS public sparse equity evidence, exact listing/currency, no look-ahead, FCF definitions, privacy and retry behavior');
})().catch(error => {console.error(error); process.exitCode = 1;});
