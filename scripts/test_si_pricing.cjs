const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync('site/'+p,'utf8'),source=read('si-pricing.js'),payload=JSON.parse(read('data/si-pricing-reference.json'));
const listeners={},nodes={'si-rows':{innerHTML:''},'si-count':{textContent:''},'si-query':{value:''},'si-currency':{value:'All'},'si-review-only':{checked:false}};
let renders=0,broken=false;
const ctx={window:null,console,fetch:async()=>({ok:!broken,json:async()=>payload}),document:{addEventListener:(n,f)=>(listeners[n]??=[]).push(f),getElementById:k=>nodes[k]}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(read('si-quick-filter.js'),ctx);vm.runInContext(source,ctx);const si=ctx.MarketSI;
(async()=>{
 assert(si.acceptable(payload));assert.equal(payload.rows.length,246);assert.equal(payload.rows.filter(r=>r.additional_review).length,23);
 assert.deepEqual(payload.rows[0],{reference:'SI-001',shares:['NVDA','AMD','NOW','MRVL'],source_date:'2026-11-05',currency:'SGD',tenor_source_value:9,coupon_pct:15,strike_pct:90,ko_pct:100,ki_pct:50,additional_review:false});
 si.connect(()=>renders++);await new Promise(r=>setTimeout(r,0));assert(renders);
 assert.equal(si.stepDown('SI-226'),1.5);assert.equal(si.stepDown('SI-246'),1.5);
 assert.equal(si.stepDown('SI-006'),2);assert.equal(si.stepDown('SI-050'),3.5);assert.equal(si.stepDown('SI-100'),4.5);
 assert.equal(si.stepDown('SI-017'),null);assert.equal(si.stepDown('SI-225'),2);
 const legacy=structuredClone(payload);delete legacy.ko_step_down_pp;assert(si.acceptable(legacy));
 for(const steps of [null,[],{'SI-006':null},{'SI-247':1.5},{'SI-226':'1.50'},{'SI-226':-1}]){
  assert.equal(si.acceptable({...payload,ko_step_down_pp:steps}),false);
 }
 let html=si.view();for(const text of ['SI Pricing','Historical charts','Not live prices','Basis unconfirmed','Unit unconfirmed','whole percentage points','not a verified annual yield','not a verified 11-month term','issuer terms','23 additional-review rows'])assert(html.includes(text),text);
 assert.equal((html.match(/<tr>/g)||[]).length,247);assert(html.includes('p.a. (screen)'));assert(html.includes('Months (screen)'));assert(html.includes('Date not shown'));assert(html.includes('KO step'));assert(html.includes('>2 pp</td>'));assert(html.includes('2026-11-13'));assert(html.includes('Indicative · Photo unverified'));assert(!html.includes('source_excel_row'));assert(!html.includes('IMG_609'));assert(html.includes('tabindex="0" role="region"'));assert(html.includes('scope="col"'));assert(html.includes('scope="row"'));assert(html.includes('data-si-reference-table'));
 listeners.input[0]({target:{id:'si-query',value:'NVDA'}});assert(si.filtered().length>0&&si.filtered().length<246);assert(si.filtered().every(r=>r.shares.includes('NVDA')));assert(nodes['si-count'].textContent.includes('of 246'));assert(!nodes['si-rows'].innerHTML.includes('colspan'));
 listeners.change[0]({target:{id:'si-currency',value:'USD'}});assert(si.filtered().every(r=>r.currency==='USD'));listeners.change[0]({target:{id:'si-review-only',checked:true}});assert(si.filtered().every(r=>r.additional_review));
 listeners.input[0]({target:{id:'si-query',value:'<svg onload=alert(1)>'}});assert(nodes['si-rows'].innerHTML.includes('No matching saved SI references for this selection'));assert(!nodes['si-rows'].innerHTML.includes('<svg'));
 listeners.click[0]({target:{closest:s=>s==='[data-si-reset]'?{}:null}});assert.equal(si.filtered().length,246);assert.equal(nodes['si-currency'].value,'All');assert.equal(nodes['si-review-only'].checked,false);
 const before=JSON.stringify(payload);
 listeners.input[0]({target:{id:'si-query',value:'Alphabet'}});
 assert(si.filtered().length>0);assert(si.filtered().every(r=>r.shares.includes('GOOGL')),'search accepts approved company names');
 assert(nodes['si-rows'].innerHTML.includes('aria-label="Alphabet (GOOGL)"'));
 assert(nodes['si-rows'].innerHTML.includes('class="si-shares"'));
 assert(si.view().includes('data-table-controls="off"'),'SI keeps its direct filters while the new pivot remains design-first');
 listeners.click[0]({target:{closest:s=>s==='[data-si-reset]'?{}:null}});
 assert.equal(JSON.stringify(payload),before,'sorting and presentation must not mutate source records');
 assert(si.view().includes('class="si-mobile-source"'));assert(si.view().includes('class="si-source-column"'));
 assert(si.view().includes('--si-label:#6D28D9'),'approved Nvidia text colour');
 listeners.toggle[0]({target:{matches:()=>true,isConnected:true,open:false}});const panel=si.panel();assert(panel.startsWith('<details'));assert(!panel.includes('data-si-panel open'));listeners.toggle[0]({target:{matches:()=>true,isConnected:true,open:true}});assert(si.panel().includes('data-si-panel open'));listeners.toggle[0]({target:{matches:()=>true,isConnected:true,open:false}});assert(!si.panel().includes('data-si-panel open'));
 for(const mutate of [d=>{d.live_quotes=true;},d=>{d.tenor_unit='months';},d=>{d.coupon_basis='annual';},d=>{d.rows[0].coupon_pct=15.01;},d=>{d.rows[0].isin='private';},d=>{d.rows[0].shares=['<img>','AMD'];},d=>{d.rows[0].reference=d.rows[1].reference;},d=>{d.rows[0].source_date='2027-11-05';},d=>{d.source_date_range=null;},d=>{d.rows[0]=null;}]){const bad=structuredClone(payload);mutate(bad);assert.equal(si.acceptable(bad),false);}
 for(const mutate of [d=>{d.record_count++;},d=>{d.additional_review_count++;},d=>{d.rows[225].coupon_basis='monthly';},d=>{delete d.rows[225].tenor_unit;},d=>{d.rows[225].source_date='2026-11-31';},d=>{d.rows[236].additional_review=false;},d=>{d.rows[0].source_date=null;}]){const bad=structuredClone(payload);mutate(bad);assert.equal(si.acceptable(bad),false);}
 listeners.input[0]({target:{id:'si-query',value:'SI-237'}});assert.equal(si.filtered().length,1);assert(nodes['si-rows'].innerHTML.includes('Date not shown'));assert(nodes['si-rows'].innerHTML.includes('Date unconfirmed'));
 broken=true;await si.refresh();html=si.view();assert(html.includes('Showing the last loaded reference'));assert(html.includes('SI-237'));
 const v4=read('v4.html'),tools=read('v4-tools.js'),watch=read('watchlist.js');
 assert(v4.includes('si-pricing.js?v=20261121.ocrsteps1'));assert(v4.includes('si-pricing.css?v=20261121.ocrsteps1'));assert(v4.includes('MarketSI.connect('));assert(watch.includes('href="#history/si"'));assert.equal((v4.match(/data-view="history\/si"/g)||[]).length,2,'desktop and More-menu SI shortcuts');assert(tools.includes("['si','▧ SI Pricing']"));assert(tools.includes("['yield','shares','beta-shares','beta2-shares','beta3-shares','beta4-shares','fx','curves','spx','si']"));assert(tools.indexOf("if(X.historyTab==='si')")<tools.indexOf("if(!X.history)return intro+tabs+loading('history')"));
 // User-facing controls must match complete baskets, combine with currency/ranges and keep legacy terms honest.
 listeners.click[0]({target:{closest:s=>s==='[data-si-reset]'?{}:null}});
 const change=(id,value)=>listeners.change[0]({target:{id,value}}),input=(id,value)=>listeners.input[0]({target:{id,value}});
 const reset=()=>listeners.click[0]({target:{closest:s=>s==='[data-si-reset]'?{}:null}});
 change('si-share-1','NVDA');change('si-share-2','TSM');assert(si.filtered().length>0);assert(si.filtered().every(r=>r.shares.includes('NVDA')&&r.shares.includes('TSM')));
 change('si-join-2','OR');assert.equal(si.filtered().length,payload.rows.filter(r=>r.shares.includes('NVDA')||r.shares.includes('TSM')).length);
 change('si-share-3','AMD');assert.equal(si.filtered().length,payload.rows.filter(r=>r.shares.includes('NVDA')||(r.shares.includes('TSM')&&r.shares.includes('AMD'))).length,'AND binds before OR');
 change('si-currency','USD');change('si-tenor','11');assert(si.filtered().every(r=>r.currency==='USD'&&r.tenor_source_value===11));reset();
 input('si-coupon-min','8');input('si-coupon-max','8');assert.equal(si.filtered().length,21);assert(si.filtered().every(r=>r.coupon_basis==='per_annum'));
 listeners.change[0]({target:{id:'si-include-unconfirmed',checked:true}});assert(si.filtered().length>21);reset();
 input('si-step-min','1.5');input('si-step-max','1.5');assert.equal(si.filtered().length,payload.rows.filter(r=>payload.ko_step_down_pp?.[r.reference]===1.5).length,'filter every captured step-down');input('si-strike-max','80');assert(si.filtered().every(r=>r.strike_pct<=80));
 input('si-strike-min','90');assert.equal(si.filtered().length,0,'reversed ranges fail visibly');input('si-strike-min','');assert(si.filtered().length>0);reset();
 change('si-share-4','DBSM');assert(si.filtered().length>0);assert(si.filtered().every(r=>r.shares.includes('DBSM')),'empty slots are ignored');reset();
 assert.equal(JSON.stringify(payload),before,'all quick-filter operations preserve the data');
 const controls=si.view();for(const label of ['SI quick filter','Top 20 · most used in SI','Singapore · 5 quick choices','Others','si-share-4','si-join-4','si-coupon-min','si-coupon-max','si-step-min','si-step-max'])assert(controls.includes(label),label);
 assert(controls.indexOf('aria-label="SI quick filter"')<controls.indexOf('id="si-records"'),'quick filters remain visible while records are collapsed');
 const sample=[{shares:['A','B']},{shares:['C']},{shares:['B','C']},{shares:['AB']}].map(r=>({...r,coupon_pct:0,strike_pct:90,ko_pct:100,ki_pct:50,tenor_source_value:11,reference:'fixture'}));
 const q=ctx.SIQuickFilters.create({rows:()=>sample,stepDown:()=>null,company:s=>({name:s})});
 q.handle({id:'si-share-1',value:'A'});q.handle({id:'si-share-2',value:'B'});assert.equal(sample.filter(q.matches).length,1);
 q.handle({id:'si-join-2',value:'OR'});q.handle({id:'si-share-3',value:'C'});assert.equal(sample.filter(q.matches).length,2);assert(q.expression().includes('(B AND C)'));
 q.reset();q.handle({id:'si-coupon-min',value:'0'});q.handle({id:'si-include-unconfirmed',checked:true});assert.equal(sample.filter(q.matches).length,4,'zero is an actual bound');q.handle({id:'si-step-min',value:'0'});assert.equal(sample.filter(q.matches).length,0,'missing is not zero');
 console.log('PASS compact quick filters, exact basket Boolean logic, range bounds, p.a. coverage, missing terms, reset and immutable source');
 console.log('PASS SI246 allowlist, unverified historical terms, unit/basis limits, filters/reset, safe data, failure retention and Historical charts integration');
})().catch(e=>{console.error(e);process.exitCode=1;});
