/* Export semantics, source scopes and projection math; no real client data. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../site/si-beta2-core.js'),A=require('../site/si-equity-pages.js');
const shares=['ONE','TWO','THREE'].map(symbol=>({symbol})),pages=[{id:'a',shares},{id:'b',shares:[{symbol:'FOUR'}]}];
assert.deepEqual(A.plan(pages,false).map(p=>p.kind),['si','si']);
assert.deepEqual(A.plan(pages,true).map(p=>p.share?.symbol||p.page.id),['a','ONE','TWO','THREE','b','FOUR']);
assert.equal(A.plan(pages.slice(0,1),true).length,4);
assert.deepEqual(A.plan(pages.slice(0,1),true,true).map(p=>p.kind),['si','equity','equity','equity','terms']);
assert.deepEqual(A.plan(pages.slice(0,1),false,true).map(p=>p.kind),['si','terms']);
const report={currency:'TWD',fiscalEnd:'December',periods:['Q4 2026','Q3 2026','Q2 2026','Q1 2026','Q4 2025','Q4 2023','2025','TTM'],rows:[
 [0,'Total Revenue',[null,4e6,3e6,2e6,1e6,90e6,92e6,99e6]],
 [0,'Net Income',[null,2e6,null,-1e6,0,80e6,92e6,99e6]],
 [0,'Diluted EPS',[null,4,3,2,1,90,92,99]],
 [1,'Extra detail',[null,99,99,99,99,99,99,99]],
]};
const before=JSON.stringify(report),hi=A.highlights(report,'income');
assert.equal(hi.periods.length,12);assert.equal(hi.periods[0],'Q4 2023');assert.equal(hi.periods.at(-1),'Q3 2026');
assert.equal(hi.currency,'TWD');
assert.deepEqual(hi.rows.find(r=>r.label==='Net income').values,
 [80e6,null,null,null,null,null,null,null,0,-1e6,null,2e6]);
assert.equal(hi.rows.find(r=>r.label.startsWith('Diluted EPS')).scale,1);
assert(!hi.rows.some(r=>r.label==='Extra detail'));assert.equal(JSON.stringify(report),before);
assert.equal(A.highlights({...report,periods:['TTM']},'income'),null);
const balance={...report,periods:['Q4 2023','Q1 2024','Q4 2026'],rows:[[0,'Total Assets',[10e6,0,100e6]]]};
const quarters=A.fiscalQuarters({income:report,balance,cash:null});
assert.equal(quarters[0],'Q1 2024');assert.equal(quarters.at(-1),'Q4 2026');
assert.equal(A.highlights(balance,'balance',quarters).rows.find(r=>r.label==='Total assets').values[0],0);
assert.equal(A.highlights(report,'income',quarters).rows.find(r=>r.label==='Revenue').values.at(-1),null);
const growth={currency:'USD',fiscalEnd:'December',periods:['Q3 2023','Q4 2023','Q1 2024','Q2 2024','Q3 2024','Q1 2025','Q3 2026','TTM'],rows:[
 [0,'Total Revenue',[100000001,100000002,150e6,120e6,120e6,60e6,30e6,1e9]],
 [0,'Net Income',[-1e5,-5e4,25e3,-5e4,0,7e4,5e4,1e8]],
 [0,'Gross Profit',[1e6,2e6,3e6,4e6,5e6,6e6,7e6,8e6]],
]};
const growthTable=A.highlights(growth,'income'),[revenue,gross,,income]=growthTable.rows;
assert.equal(growthTable.periods[0],'Q4 2023');
assert.equal(revenue.scale,1e6);assert.equal(income.scale,1e3);
assert(revenue.changes[0]>0&&revenue.changes[0]<0.05,'Use the unrounded prior quarter just before the displayed range');
assert.deepEqual(revenue.changes.slice(2,7),[-20,0,null,null,null]);
assert.deepEqual(income.changes.slice(0,7),[50,150,-300,100,null,null,null]);
assert.equal(gross.changes,null);
const zeroBase=A.highlights({...growth,rows:[[0,'Net Income',[25e3,0,5e4,null,null,null,5e4,null]]]},'income').rows[3];
assert.equal(zeroBase.changes[1],null,'Growth from a zero base is undefined');
const growthSvg=A.svg({symbol:'ONE'},{fundamentals:{company:{quarterly:{income:growth}}}});
assert.equal((growthSvg.match(/>Revenue</g)||[]).length,1);
assert.equal((growthSvg.match(/>Net income</g)||[]).length,1);
assert.equal((growthSvg.match(/>QoQ change</g)||[]).length,3);
assert.equal((growthSvg.match(/>Q3 2026</g)||[]).length,1);
assert(growthSvg.includes('>&#39;000<'));assert(growthSvg.includes('>M<'));
assert(growthSvg.includes('>≈0%<'));assert(growthSvg.includes('>+150%<'));assert(growthSvg.includes('>−300%<'));
const FX=require('../site/si-statement-currency.js');
const weekly=JSON.parse(fs.readFileSync('site/data/fred-weekly-fx.json','utf8'));
const fx=FX.translation(weekly,'TWD','USD','2026-11-22');
assert(fx&&fx.rate>.025&&fx.rate<.04&&fx.date<='2026-11-22');
assert.equal(FX.translation(weekly,'TWD','XYZ','2026-11-22'),null);
assert.equal(FX.translation(weekly,'TWD','USD','2099-11-22'),null);
const fxTable=A.highlights({...report,currency:'USD'},'income',undefined,{listingId:'TSM US',target:'USD',fx});
assert.equal(fxTable.sourceCurrency,'TWD');assert.equal(fxTable.currency,'USD');
assert.equal(fxTable.rows[0].values.at(-1),4e6*fx.rate);
assert.deepEqual(fxTable.rows.find(r=>r.kind==='perShare').changes.slice(-4),[null,100,50,(1/3)*100]);
assert.equal(fxTable.rows.find(r=>r.label==='Net profit margin').values.at(-1),50);
const noRate=A.highlights({...report,currency:'USD'},'income',undefined,{listingId:'TSM US',target:'USD'});
assert.equal(noRate.currency,'TWD');assert.equal(noRate.fxMissing,true);
const cashReport={...report,periods:['Q2 2026','Q3 2026'],rows:[
 [0,'Cash Flow from Operating Activities, Indirect',[12e6,15e6]],
 [0,'Capital Expenditure, Reported',[-3e6,-5e6]],
 [0,'Purchase/Sale and Disposal of Property, Plant and Equipment, Net',[-1e6,-2e6]]
]};
const fcf=A.highlights(cashReport,'cash').rows.find(r=>r.label==='Free cash flow');
assert.deepEqual(fcf.values.slice(-2),[9e6,10e6]);
assert.equal(fcf.changes.at(-1),(1e6/9e6)*100);
const halfYear={currency:'SGD',fiscalEnd:'Dec 31',periods:['Q1 2025','Q2 2025','Q3 2025','Q4 2025','Q1 2026'],
 rows:[[0,'Total Revenue',[5905e6,5732e6,5932e6,11263e6,5948e6]]]};
const halfYearTable=A.highlights(halfYear,'income',undefined,{annual:{
 ...halfYear,periods:['2025'],rows:[[0,'Total Revenue',[22895e6]]]
}});
assert.equal(halfYearTable.displayedPeriods.get('Q4 2025'),'H2 2025');
assert.deepEqual(halfYearTable.rows[0].changes.slice(-2),[null,null]);
const mixed=A.highlights(growth,'income',undefined,{listingId:'857 HK',target:'HKD'});
assert(mixed.rows[0].changes.every(change=>change===null),'Suppress flow QoQ when the archive mixes durations');
const bbg=JSON.parse(fs.readFileSync('site/data/beta-shares.json','utf8'));
const mu=A.ratings(bbg.records.find(r=>r.bbTicker==='MU US'));
assert(mu.some(r=>r.agency==="Moody's"&&r.scope==='Issuer'&&r.status==='withdrawn'));
assert(mu.some(r=>r.agency==="Moody's"&&r.scope==='Senior unsecured debt'&&r.raw==='Baa1'));
assert(mu.every(r=>r.date===null));assert.equal(A.summary(mu).length,3);
assert.equal(A.ratings(bbg.records.find(r=>r.bbTicker==='ANET US')).length,0);
const svg=A.svg({symbol:'ONE',name:'A & B'}, {currency:'USD',creditRatings:mu,
 fundamentals:{company:{quarterlyCapturedAt:'2026-11-22',quarterly:{income:report,balance,cash:null}}}},2,4);
assert(svg.includes('A &amp; B'));assert(svg.includes('>TWD<'));assert(!svg.includes('TTM'));
assert(svg.includes('Q1 2024 to Q4 2026'));assert(!svg.includes('Q4 2023'));assert(svg.includes('captured 2026-11-22'));
assert(svg.includes('>—<'));assert.equal((svg.match(/Quarterly statement unavailable/g)||[]).length,1);
assert(svg.includes('withdrawn'));assert(svg.includes('rating observation dates unavailable'));
assert(!svg.includes('Extra detail'));assert(!svg.includes('NaN'));assert(!svg.includes('undefined'));
const missing=A.svg({symbol:'MISSING'},{fundamentals:{company:{statements:{income:report}}}});
assert.equal((missing.match(/Quarterly statement unavailable/g)||[]).length,3);
assert(missing.includes('No agency rating supplied'));assert(!missing.includes('>0<'));
const monthly=Array.from({length:38},(_,i)=>[C.monthsAfter('2023-08-31',i),100*Math.exp(.012*i+.035*Math.sin(i))]);
const data={quote:{date:'2026-11-19',close:160},comparisonPrices:[...monthly,['2028-01-01',1e9]],points:monthly};
const cone=C.probabilityCone(data);assert.equal(cone.end,'2027-11-19');assert(cone.count>=12&&cone.count<=36);
const sampled=monthly.filter(p=>p[0]>='2023-10-19'&&p[0]<'2026-11-01');
const returns=sampled.slice(1).map((p,i)=>Math.log(p[1]/sampled[i][1]));
const mean=returns.reduce((a,b)=>a+b,0)/returns.length;
const sd=Math.sqrt(returns.reduce((s,r)=>s+(r-mean)**2,0)/(returns.length-1));
assert(Math.abs(cone.sigma-sd)<1e-12);
assert.equal(cone.points[0].values[0],160);assert.equal(cone.points.at(-1).values[2],160);
assert(Math.abs(cone.points.at(-1).values[4]-160*Math.exp(2*sd*Math.sqrt(12)))<1e-8);
assert.equal(C.monthsAfter('2024-02-29',12),'2025-02-28');
assert(!C.probabilityCone({...data,comparisonPrices:monthly.slice(-5)}).points);
assert(!C.probabilityCone({...data,comparisonPrices:monthly.map((p,i)=>[p[0],i>20?p[1]/10:p[1]])}).points,'Unexplained split-like discontinuities must not inflate the cone');
const p={...C.blank(),shares:[{symbol:'ONE'}],ko:100,ki:70,strike:90,step:1,months:11,coupon:8};
const schedule=A.termsSvg({...p,shares:[{symbol:'ONE',fixing:100}]},{ONE:{currency:'USD'}},2,2);
assert(schedule.includes('90%')&&schedule.includes('>90<'),'Month 11 must use the final step-down');
assert(schedule.includes('ONE · USD'));
assert(A.termsSvg({...p,months:20}, {},2,2).includes('First and final months shown.'));
const on=C.svg(p,{ONE:{...data,currency:'USD'}},1,1,{chart:{cone:true}});
assert(on.includes('class="si-probability-cone"'));assert(on.includes('data-end="2027-11-19"'));
assert(!C.svg(p,{ONE:data}).includes('class="si-probability-cone"'));
assert(on.includes('not a forecast or barrier-hit probability'));
const metrics=C.svg({...p,shares:[{symbol:'ONE'},{symbol:'TWO'},{symbol:'THREE'}]});
assert.equal((metrics.match(/class="si-company-metric"/g)||[]).length,27,'Each metric occupies one row');
console.log('PASS SI company pages: A4 ordering, aligned fiscal quarters, rounded units, QoQ growth, scoped ratings and dated 12-month model ranges');
