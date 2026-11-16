'use strict';
const assert=require('node:assert/strict');
const sigma=require('../site/fred/sigma.js');
let checks=0;
function test(name,run){run();checks++;console.log(`PASS ${name}`);}
function near(actual,expected,tolerance=1e-9){assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} ≠ ${expected}`);}
const monthly=(values,year=2020)=>values.map((v,i)=>[`${year+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}-01`,v]);
test('sample standard deviation uses N−1 and excludes current observation',()=>{
  const result=sigma.analyze(monthly([...Array.from({length:12},(_,i)=>i),1000]));
  const row=result.at(-1);assert.equal(row.n,12);near(row.mean,5.5);near(row.sd,Math.sqrt(13));near(row.z,(1000-5.5)/Math.sqrt(13));
  assert.equal(result[11].z,null);assert.match(result[11].reason,/11\/12/);
});
test('future values cannot change past scores',()=>{
  const points=monthly(Array.from({length:60},(_,i)=>i%9));
  const before=sigma.analyze(points),after=sigma.analyze([...points,...monthly([1e15,null,-1e15],2026)]);
  assert.deepEqual(after.slice(0,before.length),before);
});
test('baseline windows use calendar years including lower date and exclude older rows',()=>{
  const points=[['2014-12-31',999],['2015-01-01',10],['2018-01-01',12],['2019-01-01',14],['2020-01-01',100]];
  const row=sigma.analyze(points,{years:5,minN:2}).at(-1);
  assert.equal(row.n,3);near(row.mean,12);near(row.sd,2);assert.equal(row.baselineStart,'2015-01-01');
});
test('missing values and source strings do not become zero; actual zero is retained',()=>{
  const values=[0,null,'','ND','*','(*)','null','0',NaN,Infinity,1,2,3,4,5,6,7,8,9,10,11,12];
  const result=sigma.analyze(monthly(values));
  assert.equal(result[0].raw,0);assert.equal(result[0].value,0);
  for(let i=1;i<10;i++){assert.equal(result[i].value,null);assert.equal(result[i].z,null);}
  assert.equal(result.at(-1).n,12);near(result.at(-1).mean,5.5);
});
test('zero-variance baseline cannot produce a standardized distance',()=>{
  const result=sigma.analyze(monthly([...Array(12).fill(7),8])).at(-1);
  assert.equal(result.n,12);assert.equal(result.sd,0);assert.equal(result.z,null);assert.match(result.reason,/Zero/);
});
test('aged-out variation leaves exact zero SD while genuine tiny variance remains available',()=>{
  for(const constant of [0,0.1,700]){
    const points=monthly([...Array.from({length:24},(_,i)=>constant+(i%3)/10),...Array(72).fill(constant)],2018);
    const latest=sigma.analyze(points,{years:5}).at(-1);
    assert.equal(latest.n,60);assert.equal(latest.mean,constant);assert.equal(latest.sd,0);assert.equal(latest.z,null);assert.match(latest.reason,/Zero/);
  }
  const tiny=monthly([...Array.from({length:24},(_,i)=>i%3),...Array.from({length:72},(_,i)=>i%2*1e-10)],2018);
  const latest=sigma.analyze(tiny,{years:5}).at(-1);
  assert.equal(latest.n,60);assert.ok(latest.sd>0 && latest.sd<1e-9);assert.ok(Number.isFinite(latest.z));assert.equal(latest.reason,'');
});
test('signed bands include equality at one and two sigma',()=>{
  for(const z of [-.999,0,.999])assert.equal(sigma.band(z),'neutral');
  for(const z of [-1,1,-1.999,1.999])assert.equal(sigma.band(z),'soft');
  for(const z of [-2,2,-100,100])assert.equal(sigma.band(z),'strong');
  for(const z of [null,undefined,NaN,Infinity,'2'])assert.equal(sigma.band(z),'unavailable');
});
test('monthly and quarterly YoY require matching year-ago source dates',()=>{
  for(const frequency of ['Monthly','Quarterly']){
    const rows=sigma.transform([['2020-01-01',100],['2020-03-30',200],['2021-01-01',110],['2021-03-31',220]],'yoy',frequency);
    near(rows[2].value,10);assert.equal(rows[2].baseDate,'2020-01-01');assert.equal(rows[3].value,null);
  }
});
test('nonpositive YoY bases unavailable, native year-change still meaningful',()=>{
  const points=[['2020-01-01',0],['2020-02-01',-10],['2021-01-01',5],['2021-02-01',-5]];
  const yoy=sigma.transform(points,'yoy','Monthly'),change=sigma.transform(points,'year_change','Monthly');
  assert.equal(yoy[2].value,null);assert.equal(yoy[3].value,null);assert.match(yoy[2].reason,/Nonpositive/);
  assert.equal(change[2].value,5);assert.equal(change[3].value,5);
});
test('weekly and daily comparisons use prior date up to ten days away, never a later one',()=>{
  const points=[['2020-01-01',100],['2020-02-01',200],['2020-03-02',300],['2021-01-11',110],['2021-02-12',220],['2021-03-01',330]];
  for(const frequency of ['Daily','Weekly','Auction']){
    const rows=sigma.transform(points,'yoy',frequency);near(rows[3].value,10);assert.equal(rows[3].baseDate,'2020-01-01');assert.equal(rows[4].value,null);assert.equal(rows[5].value,null);
  }
});
test('a missing matched year-ago row is never filled with an earlier good reading',()=>{
  const rows=sigma.transform([['2020-01-01',100],['2020-01-02',null],['2021-01-02',110]],'yoy','Daily');
  assert.equal(rows[2].value,null);assert.match(rows[2].reason,/unavailable/);
});
test('transformed sigma baseline excludes the current transform and all unavailable transforms',()=>{
  const points=monthly(Array.from({length:30},(_,i)=>100+i*i));
  const rows=sigma.analyze(points,{transform:'yoy',frequency:'Monthly'}),last=rows.at(-1),prior=rows.slice(0,-1).map(row=>row.value).filter(v=>v!==null);
  assert.equal(last.n,prior.length);const mean=prior.reduce((a,b)=>a+b,0)/prior.length,sd=Math.sqrt(prior.reduce((sum,v)=>sum+(v-mean)**2,0)/(prior.length-1));
  near(last.mean,mean);near(last.sd,sd);near(last.z,(last.value-mean)/sd);
});
test('calendar leap dates clamp to the prior year end of February',()=>{
  assert.equal(sigma.shiftYear('2024-02-29',1),'2023-02-28');
  assert.equal(sigma.shiftYear('2024-02-29',20),'2004-02-29');
});
test('source quality flags preserve native values but exclude heat, baselines and affected growth bases',()=>{
  const points=monthly(Array.from({length:30},(_,i)=>i===5?99999:100+i));
  const excluded=points[5][0],level=sigma.analyze(points,{excludeDates:[excluded]}),growth=sigma.analyze(points,{transform:'yoy',frequency:'Monthly',excludeDates:[excluded]});
  assert.equal(level[5].raw,99999);assert.equal(level[5].value,null);assert.equal(level[5].z,null);assert.match(level[5].reason,/quality/);
  assert.equal(level[13].n,12);near(level[13].mean,(Array.from({length:13},(_,i)=>100+i).reduce((a,b)=>a+b,0)-105)/12);
  assert.equal(growth[17].raw,117);assert.equal(growth[17].value,null);assert.equal(growth[17].z,null);assert.equal(growth[17].baseDate,excluded);assert.match(growth[17].reason,/quality flag in year-ago/);
});
test('duplicate dates and impossible source dates refuse ambiguous analytics',()=>{
  assert.throws(()=>sigma.analyze([['2020-01-01',1],['2020-01-01',2]]),/Duplicate/);
  assert.throws(()=>sigma.analyze([['2020-02-31',1]]),/Invalid/);
  assert.throws(()=>sigma.analyze([['2020-01-01',1]],{years:0}),/Invalid/);
});
test('rolling calculation agrees with independent brute-force calendar-window statistics',()=>{
  const points=monthly(Array.from({length:300},(_,i)=>i%17===0?null:40+Math.sin(i/7)*5+i/100),2000),rows=sigma.analyze(points,{years:5});
  for(const index of [65,110,180,299]){
    const row=rows[index],prior=rows.slice(0,index).filter(r=>r.date>=row.baselineStart&&r.value!==null).map(r=>r.value),mean=prior.reduce((a,b)=>a+b,0)/prior.length,sd=Math.sqrt(prior.reduce((a,b)=>a+(b-mean)**2,0)/(prior.length-1));
    assert.equal(row.n,prior.length);near(row.mean,mean);near(row.sd,sd);if(row.value!==null)near(row.z,(row.value-mean)/sd);
  }
});
console.log(`${checks} analytical boundary tests passed.`);
