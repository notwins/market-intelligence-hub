'use strict';
const A=require('node:assert/strict'),fs=require('node:fs');
const model=require('../site/fred/overview-model.js'),sigma=require('../site/fred/sigma.js');
let n=0;function test(name,run){run();n++;console.log('PASS '+name);}
const item=(id,z,group='Inflation',name=id)=>({entry:{id,name,group},latest:{z}});
test('extreme sigma ranks either sign by absolute distance and keeps missing scores last',()=>{
  const input=[item('plus',3),item('minus',-5),item('small',-2),item('zero',0),item('missing',null),item('invalid',NaN)];
  A.deepEqual(model.order(input,{sort:'extreme',direction:-1,grouped:false}).map(x=>x.entry.id),['minus','plus','small','zero','invalid','missing']);
  A.deepEqual(input.map(x=>x.entry.id),['plus','minus','small','zero','missing','invalid']);
});
test('global extremes ignore categories, while retained groups rank extremes within each parent',()=>{
  const input=[item('a',1,'Inflation'),item('b',-8,'Inflation'),item('c',4,'Equities and profits'),item('d',-2,'Equities and profits')];
  A.deepEqual(model.order(input,{sort:'extreme',direction:-1,grouped:false}).map(x=>x.entry.id),['b','c','d','a']);
  const grouped=model.partition(model.order(input,{sort:'extreme',direction:-1,grouped:true}));
  A.deepEqual(grouped.map(x=>[x.name,x.items.map(i=>i.entry.id)]),[['Equities',['c','d']],['Inflation',['b','a']]]);
});
test('signed sorting remains different from absolute sorting and unavailable readings never become zero',()=>{
  const input=[item('a',-4),item('b',3),item('c',null),item('d',0)];
  A.deepEqual(model.order(input,{sort:'z',direction:-1,grouped:false}).map(x=>x.entry.id),['b','d','a','c']);
  A.deepEqual(model.order(input,{sort:'z',direction:1,grouped:false}).map(x=>x.entry.id),['a','d','b','c']);
});
test('all saved datasets receive a broad category without rewriting native topics or losing entries',()=>{
  const catalog=JSON.parse(fs.readFileSync('site/data/fred/catalog.json','utf8')),before=JSON.stringify(catalog);
  const mapped=catalog.datasets.map(e=>({entry:e,latest:{z:null}})),parents=model.partition(model.order(mapped));
  A.equal(parents.reduce((s,g)=>s+g.items.length,0),catalog.dataset_count);A.equal(new Set(parents.flatMap(g=>g.items.map(i=>i.entry.id))).size,catalog.dataset_count);
  A(parents.length>=8&&parents.length<=12);A(!parents.some(g=>g.name==='Other'||g.name==='Common market and economy'));
  for(const [id,expected] of [['DGS10','Treasury & government debt'],['SP500','Equities'],['PCEPI','Inflation'],['BOPTEXP','Trade & external accounts']])A.equal(model.mainGroup(catalog.datasets.find(e=>e.id===id)),expected);
  A.equal(JSON.stringify(catalog),before);
});
test('one and two SD guides use prior sample statistics and reject insufficient or constant baselines',()=>{
  A.deepEqual(model.guides({n:12,mean:10,sd:2}),{mean:10,lower1:8,upper1:12,lower2:6,upper2:14});
  for(const row of [{n:11,mean:10,sd:2},{n:60,mean:10,sd:0},{n:60,mean:null,sd:2},{n:60,mean:Infinity,sd:2},{mean:10,sd:2}])A.equal(model.guides(row),null);
  A(model.guides({n:12,mean:10,sd:1e-10}));
});
test('a fifteen-year baseline includes its calendar boundary and excludes earlier observations',()=>{
  const points=Array.from({length:241},(_,i)=>[`${2000+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}-01`,i]);
  const row=sigma.analyze(points,{years:15}).at(-1);A.equal(row.baselineStart,'2005-01-01');A.equal(row.n,180);A.equal(row.mean,149.5);
  A.equal(sigma.analyze(points,{years:5}).at(-1).n,60);A.equal(sigma.analyze(points,{years:10}).at(-1).n,120);A.equal(sigma.analyze(points,{years:20}).at(-1).n,240);
});
console.log(n+' overview and baseline contracts passed.');
