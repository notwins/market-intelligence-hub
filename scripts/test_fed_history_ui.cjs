const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const C=require('../site/v3-core.js');
const code=fs.readFileSync(require('node:path').join(__dirname,'../site/v4-tools.js'),'utf8').replace('return{routeSuffix,','return{_test:{loadHistory,chooseHistory,timeData,lineChart,historyControls,toggleEventGroup,chosenEvents,contextControls,getState:()=>X},routeSuffix,');
const workbook=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../site/data/history-v3.json')));
const sample={schemaVersion:1,status:'provider_snapshot',verified_provider_refresh:true,source_file:'Fed via FRED',archive_path:'history-fed-archive/test.json',series:['USD/SGD','CHF/SGD','UST 10Y','UST 5Y'].map((id,i)=>({id,family:id.includes('/')?'fx':'ust',unit:id.includes('/')?'SGD per unit':'% p.a.',points:[['2020-01-01',1+i],['2020-03-01',2+i],['2020-04-01',3+i]],missing_periods:['2020-02-01'],latest_observation:'2020-04-01',source:'Fed via FRED',source_url:'https://fred.stlouisfed.org/series/GS10'})),recession_context:{periods:[{start:'2020-03-01',end_exclusive:'2020-05-01'}],source:'St. Louis Fed / NBER',source_url:'https://fred.stlouisfed.org/series/USREC',chronology_url:'https://www.nber.org/research/business-cycle-dating',latest_observation:'2020-04-01',convention:'Month following peak through trough'}};
function setup(published=sample,status={status:'success',last_success:new Date().toISOString()}){
 const responses={'history-v3':workbook,'history-fed':published,'history-fed-status':status};
 const context={window:{},MarketCore:C,USTDecisionEngine:{},USTDecisionImport:{},localStorage:{getItem:()=>null},Intl,Date,URL,location:{href:'https://example.com/v4.html'},matchMedia:()=>({matches:false}),document:{addEventListener(){},documentElement:{style:{getPropertyValue:()=>1},dataset:{}},querySelector:()=>null},fetch:async url=>({ok:!!responses[url.slice(5,-5)],json:async()=>structuredClone(responses[url.slice(5,-5)])})};
 vm.createContext(context);vm.runInContext(code,context);return context.window.MarketV3;
}
(async()=>{
 const app=setup(),api=app._test;
 await api.loadHistory();assert.equal(api.getState().history.status,'provider_snapshot');assert.equal(api.getState().end,'2020-04-01');
 assert.match(app.historyView(),/History source/);assert.match(app.historyView(),/Last successful Fed retrieval/);
 assert.match(api.contextControls(),/Monetary and currency policy/);assert.match(api.contextControls(),/U.S. recessions/);
 const all=api.chosenEvents().length;api.toggleEventGroup('fed-qe',false);assert.equal(api.chosenEvents().length,all-5);assert.ok(api.chosenEvents().some(e=>e.group==='snb'));api.toggleEventGroup('fed-qe',true);assert.equal(api.chosenEvents().length,all);
 app.applyRoute('history','fx');let data=api.timeData();assert.equal(data.lines[0].points.find(p=>p[0]==='2020-02-01')[1],null);
 api.getState().fxMode='index';data=api.timeData();assert.equal(data.lines[0].points[0][1],100);assert.equal(data.lines[0].points[1][1],null);
 const chart=api.lineChart(data.lines,{unit:'100'});assert.match(chart,/recession-band/);assert.ok((chart.match(/<polyline/g)||[]).length>=4);assert.match(chart,/USREC/);
 api.getState().recessions=false;assert.doesNotMatch(api.lineChart(data.lines),/recession-band/);
 api.chooseHistory('workbook');assert.equal(api.getState().history.series.length,31);assert.equal(api.getState().end,'2026-08-01');assert.match(app.historyView(),/Supplied monthly observations/);
 const original=JSON.stringify(workbook);api.chooseHistory('published');assert.equal(JSON.stringify(workbook),original);
 const failed=setup(null,{status:'failed',last_attempt:'2026-11-03T00:00:00Z'});await failed._test.loadHistory();assert.equal(failed._test.getState().history.series.length,31);assert.match(failed.historyView(),/Latest Fed refresh failed/);
 const invalid=setup({...sample,series:[]});await invalid._test.loadHistory();assert.equal(invalid._test.getState().history.series.length,31);
 console.log('PASS weekly source selection, latest dates, original history retention, gap-safe rebasing, recession toggle and failure fallback');
})().catch(error=>{console.error(error);process.exitCode=1;});
