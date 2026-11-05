const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'../site/market-understanding/structured-investment-hypothetical');
const model=require(path.join(dir,'model.js'));
assert.equal(model.rows.length,12);
for(const n of [0,0.1,6.9,50,57.4,99.2,100,106.1]){const r=model.roundTerms({coupon_pct:n,strike_pct:n,ko_pct:n,ki_pct:n});assert.equal(r.coupon_pct,Math.floor(n));for(const k of ['strike_pct','ko_pct','ki_pct'])assert.equal(r[k],Math.ceil(n));}
for(const r of model.rows){assert.equal(r.hypothetical,true);assert.equal(r.pricing_enabled,false);assert.match(r.example_trade_date,/^2026-0[12]-\d\d$/);assert.ok([6,9,12].includes(r.tenor_months));for(const k of ['coupon_pct','strike_pct','ko_pct','ki_pct'])assert.ok(Number.isInteger(r[k]));}
assert.equal(model.filterRows(model.rows,{shares:['MSFT'],mode:'any'}).length,5);
assert.equal(model.filterRows(model.rows,{shares:['MSFT','AMZN'],mode:'all'}).length,1);
assert.equal(model.filterRows(model.rows,{dateFrom:'2026-02-01',dateTo:'2026-02-28'}).length,4);
assert.equal(model.filterRows(model.rows,{ccy:'USD',tenor:6}).length,3);
class Element{constructor(id){this.id=id;this.value='';this.checked=false;this.disabled=false;this.dataset={};this.handlers={};this.innerHTML='';this.textContent='';this.attrs={};this.classes=new Set();this.classList={add:k=>this.classes.add(k),remove:k=>this.classes.delete(k),toggle:(k,on)=>on?this.classes.add(k):this.classes.delete(k)};}addEventListener(n,f){this.handlers[n]=f;}setAttribute(k,v){this.attrs[k]=v;}click(){this.handlers.click?.({target:this});}}
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8'),els=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])])),heat=['coupon_pct','strike_pct','ko_pct','ki_pct'].map(k=>{const e=new Element(k);e.dataset.heat=k;e.checked=true;return e;});
els.heat.checked=true;els.mode.value='any';els.sort.value='date-desc';
const filters=['search','mode','ccy','tenor','dateFrom','dateTo','couponMin','sort'];let downloads=[],blob,printed=0;
const document={getElementById:id=>{assert.ok(els[id],id);return els[id];},documentElement:{dataset:{theme:'light'}},body:new Element('page-body'),querySelectorAll:q=>q==='.filters input,.filters select'?filters.map(k=>els[k]):q==='[data-heat]'?heat:[],createElement:t=>{const e=new Element(t);e.click=()=>downloads.push(e);return e;}};
const context={window:{SIHypothetical:model,print:()=>printed++},document,Blob,URL:{createObjectURL:b=>{blob=b;return 'blob:test';},revokeObjectURL:()=>{}},setTimeout:f=>f()};vm.runInNewContext(fs.readFileSync(path.join(dir,'app.js'),'utf8'),context);
assert.equal((els.body.innerHTML.match(/data-select=/g)||[]).length,12);assert.equal(els.download.disabled,true);
els.search.value='MSFT AMZN';els.mode.value='all';els.search.handlers.input();assert.equal((els.body.innerHTML.match(/data-select=/g)||[]).length,1);
els.reset.click();assert.equal((els.body.innerHTML.match(/data-select=/g)||[]).length,12);
let before=els.body.innerHTML;
for(const r of model.rows.slice(0,6))els.body.handlers.change({target:{dataset:{select:r.id},checked:true}});
assert.equal(els.body.innerHTML,before,'Selection must not replace focused table inputs');assert.equal(els.download.disabled,false);assert.equal((els.report.innerHTML.match(/class="report-card"/g)||[]).length,6);
const seventh={dataset:{select:model.rows[6].id},checked:true};els.body.handlers.change({target:seventh});assert.equal(seventh.checked,false);assert.match(els.count.textContent,/up to six/);
els.download.click();assert.equal(downloads.length,1);assert.equal(downloads[0].download,'Hypothetical_Structured_Investment_Comparison.html');
els.print.click();assert.equal(printed,1);assert.equal(document.body.classes.has('print-comparison'),false);
els.heat.checked=false;els.heat.handlers.change();assert.doesNotMatch(els.body.innerHTML,/class="numeric heat-cell"/);
els.theme.click();assert.equal(document.documentElement.dataset.theme,'dark');assert.equal(els.theme.attrs['aria-pressed'],'true');
els.dateFrom.value='2026-02-20';els.dateTo.value='2026-01-01';els.dateFrom.handlers.input();assert.match(els.filterNote.textContent,/Start date is after/);assert.match(els.body.innerHTML,/No examples match/);
els.clear.click();assert.equal(els.download.disabled,true);assert.equal(els.print.disabled,true);
blob.text().then(text=>{assert.match(text,/HYPOTHETICAL/);assert.match(text,/percentages of a hypothetical initial reference level/);assert.match(text,/All|all dates and terms are invented/);assert.doesNotMatch(text,/<script\b/);console.log('Structured investment: rounding, filters, selection limit, keyboard focus preservation, chart heat, theme, exports and print checks passed.');});
