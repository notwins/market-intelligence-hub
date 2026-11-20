const assert=require('node:assert/strict'),fs=require('node:fs'),C=require('../site/si-beta2-core.js');
const p={...C.blank(),shares:[{symbol:'TEST',fixing:100,name:'Example',description:''}],ko:100,ki:69.31,strike:88.06,step:2,months:11,coupon:7};
assert.deepEqual(C.validate(p),[]);assert.equal(C.finalKO(p),80);assert.equal(C.finalKO({...p,firstStep:3}),82);assert.equal(C.finalKO({...p,step:0}),100);assert.equal(C.finalKO({...p,step:null}),null);assert.equal(C.finalKO({...p,tenorUnit:'unconfirmed'}),null);
const l=C.levels(p,431.95);assert(Math.abs(l.strike-380.37517)<1e-9);assert.equal(C.levels(p,null).strike,null);assert(C.validate({...p,step:15}).length);assert(C.validate({...p,shares:[p.shares[0],p.shares[0]]}).length);assert(C.validate({...p,coupon:null}).length);assert(C.validate({...p,date:'2026-02-31'}).length);
assert.equal(C.symbol('MSFT UQ'),'MSFT');assert.equal(C.symbol('939 HK'),'0939.HK');assert.equal(C.symbol('6146'),'6146');
const original=JSON.parse(fs.readFileSync('site/data/si-pricing-reference.json','utf8')),before=JSON.stringify(original),imported=C.fromReference(original.rows[0]);assert.equal(imported.couponBasis,'unconfirmed');assert.equal(imported.tenorUnit,'months');assert.equal(imported.step,null);assert.equal(imported.date,'');assert.equal(imported.source.reference,'SI-001');assert.equal(JSON.stringify(original),before);
assert.equal(C.reference({...p,date:'2026-11-01'},{fixing:null},{daily:[['2026-10-30',20]],quote:{close:30,date:'2026-11-02'}}).value,null);
assert.equal(C.reference(p,{fixing:null},{quote:{close:30,date:'2026-11-02'}}).value,30);
const svg=C.svg({...p,issuer:'<script>alert(1)</script>',notes:'<img onerror=alert(1)>',shares:[{symbol:'TEST',fixing:null,name:'A & B',description:''}]});assert(!svg.includes('<script>'));assert(!svg.includes('<img'));assert(svg.includes('A &amp; B'));assert(svg.includes('Price history unavailable'));assert(svg.includes('88.06%'));assert(C.svg({...p,date:'2026-11-12'}).includes('Reference: 2026-11-12'));assert(svg.includes('Capital is at risk'));assert(!svg.includes('NaN'));assert(!svg.includes('Bloomberg'));
const html=fs.readFileSync('site/si-beta2.html','utf8'),app=fs.readFileSync('site/si-beta2.js','utf8');for(const id of ['si-form','page-tabs','pdf-one','pdf-all','library-rows','restore-pages'])assert(html.includes('id="'+id+'"'));assert(app.includes("market-si-beta2-v1"));assert(!app.includes('method:\'POST\''));assert(app.includes('structuredClone(selected)'));assert(app.includes('C.validate(p)'));assert(html.includes('si-beta2.css'));assert(fs.existsSync('site/vendor/pdf-lib-LICENSE.md'));
const description='A complete company description should survive the four-share PDF layout. '.repeat(3)+'ENDINGCHECK';
const four=C.svg({...p,shares:['ONE','TWO','THREE','FOUR'].map(symbol=>({...p.shares[0],symbol,description}))});
assert.equal((four.match(/ENDINGCHECK/g)||[]).length,4,'All four descriptions must retain the ending');assert(!four.includes('…'),'Descriptions must not be silently truncated');
console.log('PASS SI beta 2: precise barriers, step-down schedule, missing dates/terms, preserved references, escaping, complete descriptions and PDF controls');
require('./test_si_beta2_state.cjs');
for(const values of [[62.5,258.2],[.0001,.0004],[100,100],[100000,10000000]]){const ticks=C.axisTicks(values);assert.equal(ticks.length,5);assert(ticks[0]<=Math.min(...values));assert(ticks[4]>=Math.max(...values));for(let i=2;i<5;i++)assert(Math.abs((ticks[i]-ticks[i-1])-(ticks[1]-ticks[0]))<1e-8);}
assert.equal(C.monthLabel(Date.parse('2026-11-13T12:00Z')),'Nov-2026');
const chart=C.svg(p,{TEST:{points:[['2025-11-01',100],['2026-11-01',110]]}});assert(chart.includes('Final KO'));assert(chart.includes('7%PA'));assert(!chart.includes('2025-11-01</text>'));
for(const positions of [[50,50,50,50],[0,1,2,3],[98,99,100,100],[90,10,50,51]]){const labels=C.barrierLabels(positions,5,95);assert.deepEqual(labels.map(x=>x.target),positions);const sorted=labels.map(x=>x.y).sort((a,b)=>a-b);assert(sorted[0]>=5&&sorted.at(-1)<=95);for(let i=1;i<sorted.length;i++)assert(sorted[i]-sorted[i-1]>=11);}
assert(chart.includes('class="si-inline-barrier-label"'),'Labels should stay within clear sections of their barrier lines');assert(chart.indexOf('class="si-price-line"')>chart.lastIndexOf('class="si-inline-barrier-label"'),'Price is painted above every barrier');
const collisionBox={left:40,right:60,top:40,bottom:60};assert(C.segmentHitsBox([0,0],[100,100],collisionBox),'Check the line between observations, not only its endpoints');assert(!C.segmentHitsBox([0,0],[100,0],collisionBox));
const crossing=[[0,50],[50,50],[100,0],[200,50],[300,100],[400,50]],closeBars=[{label:'KO',y:50},{label:'KI',y:51},{label:'Strike',y:52},{label:'Final KO',y:50}];const placements=C.inlineBarrierLabels(closeBars,crossing,0,400);assert(placements.every(l=>l.inline),'Close barriers should find separate clear gaps along their own lines');for(let i=0;i<placements.length;i++){const l=placements[i];assert.equal(l.y,closeBars[i].y);assert(!C.priceHitsBox(crossing,l.box));for(const other of placements.slice(0,i))assert(!(l.box.left<other.box.right&&l.box.right>other.box.left&&l.box.top<other.box.bottom&&l.box.bottom>other.box.top));}
assert.equal(C.inlineBarrierLabels([{label:'KI',y:50}],[[0,50],[400,50]],0,400)[0].inline,false,'A price path coinciding with the full barrier must never be hidden by forced text');
assert(C.inlineBarrierLabels([{label:'KO',y:50},{label:'Final KO',y:50}],[[0,100],[0,0],[65,0],[65,50],[145,50],[145,0],[200,0]],0,200).every(p=>p.inline),'Small words must leave the only wide gap available for Final KO');
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jc0cAAAAASUVORK5CYII=';
const logoPage={...p,shares:[{...p.shares[0],description:'Company description to read over the logo.'}]};
const marked=C.svg(logoPage,{TEST:{logo:png}});
assert.match(marked,/<image class="si-company-watermark" x="496"[^>]+opacity="0\.12"/);
assert(marked.indexOf('si-company-watermark')<marked.indexOf('Company description to read'),'Artwork must sit behind the company text');
assert(!C.svg(logoPage,{TEST:{logo:png}},1,1,{showWatermarks:false}).includes('si-company-watermark'));
assert(!C.svg(logoPage,{TEST:{logo:'https://example.com/logo.png'}}).includes('si-company-watermark'),'PDF images must be self-contained');
const PDFLib=require('../site/vendor/pdf-lib-1.17.1.min.js');
const report='https://productgroup.bankofsingapore.com/apollo/assets/reports/example.pdf?a=1&b=2';
const bos={rating:'Buy',researchProvider:'Morningstar',fairValueOrTargetKind:'fair_value',currency:'USD',fairValueOrTargetPrice:250,researchReportUrl:report};
const researchLinks=[];
const researchSvg=C.svg(p,{TEST:{metrics:bos}},1,1,{links:researchLinks});
assert.match(researchSvg,/<a class="si-bos-report" href="[^"]+example\.pdf\?a=1&amp;b=2"/);
assert.match(researchSvg,/Morningstar · Fair value USD 250/);
assert.match(researchSvg,/>BUY<\/text>/);
assert.equal(researchLinks.length,1);
assert.equal(researchLinks[0].url,report);
const target=C.svg(p,{TEST:{metrics:{...bos,rating:'Sell',researchProvider:'OCBC',fairValueOrTargetKind:'target_price',currency:'SGD',researchReportUrl:'javascript:alert(1)'}}});
assert.match(target,/OCBC · Target price SGD 250/);
assert.match(target,/>SELL<\/text>/);
assert(!target.includes('si-bos-report'),'An invalid destination leaves the call unlinked');
assert(!C.svg(p,{TEST:{metrics:{...bos,researchReportUrl:'https://example.com/report.pdf'}}}).includes('si-bos-report'));
assert(!C.svg(p).includes('BOS research'),'No research fields are invented for an unmatched listing');

async function checkPDFLinks(){
 const pixel=Buffer.from(png.split(',')[1],'base64');
 const bytes=await C.pdfFromImages([pixel,pixel],PDFLib,[[],researchLinks]);
 const pdf=await PDFLib.PDFDocument.load(bytes),key=PDFLib.PDFName.of;
 assert.equal(pdf.getPage(0).node.Annots()?.size()??0,0);
 const annotations=pdf.getPage(1).node.Annots();
 assert.equal(annotations.size(),1);
 const link=pdf.context.lookup(annotations.get(0));
 assert.equal(link.get(key('Subtype')).toString(),'/Link');
 const action=link.get(key('A'));
 assert.equal(action.get(key('S')).toString(),'/URI');
 assert.equal(action.get(key('URI')).decodeText(),report);
 const [left,bottom,right,top]=link.get(key('Rect')).asArray().map(v=>v.asNumber());
 assert(left>400&&right>left&&top>bottom&&top<842,'The call has a usable rectangle on its PDF page');
}
checkPDFLinks().catch(error=>{console.error(error);process.exitCode=1;});
const settings=C.chartOptions({years:8,pe:true,pb:true,target:true});
assert.deepEqual(C.chartOptions({years:9,pe:'true'}),{years:1,pe:false,pb:false,target:false});
assert.equal(C.yearsBefore('2024-02-29',1),'2023-02-28');
const listing={instrumentId:'TEST US',currency:'USD'};
const observation=(reportDate,date,value)=>({reportDate,date,value,currency:'USD',sourceId:'bos:'+reportDate});
const hist={record:{bbTicker:'TEST US',currency:'USD'},metrics:{
 pe:[observation('2019-01-02','2018-12-31',20),observation('2025-10-01','2025-09-30',35)],
 pb:[observation('2025-10-01','2025-09-30',5),observation('2025-11-01','2025-10-31',0)],
 fairValueOrTarget:[observation('2019-01-02','2018-12-31',240),observation('2025-10-01','2025-09-30',100)],
 sourcePrice:[observation('2019-01-02','2018-12-31',200),observation('2025-10-01','2025-09-30',89)],
}};
const current={...listing,pe:37,pb:7,price:105,researchProvider:'Morningstar',fairValueOrTargetKind:'fair_value',fairValueOrTargetPrice:110,rating:'Hold'};
const data=C.valuationPoints(listing,hist,[{reportDate:'2026-11-19',row:current},{reportDate:'2026-11-20',row:{...current,currency:'EUR'}}]);
assert.equal(data.pe.length,3);
assert.equal(data.pb.length,2,'Nonpositive multiples and wrong currencies are excluded');
assert.equal(data.target[0].date,'2026-11-19','Publication dates, rather than price snapshot dates, place research points');
assert.deepEqual(C.valuationPoints(listing,{...hist,record:{...hist.record,bbTicker:'OTHER US'}},[]).pe,[]);
const sample={points:[['2018-12-31',20],['2025-09-30',90],['2026-11-18',105]],quote:{close:105,date:'2026-11-18'},currency:'USD',overlays:data};
const windowData=C.chartWindow(sample,settings);
assert.equal(windowData.from,'2018-11-19');
assert.equal(windowData.incompatibleArchive,1,'An older share basis does not enter the price scale');
assert.deepEqual(windowData.series.archive.map(p=>p.value),[100]);
assert.deepEqual(C.chartWindow(sample,C.chartOptions()).prices,[['2026-11-18',105]]);
const overlaySvg=C.svg(p,{TEST:sample},1,1,{chart:settings});
assert(overlaySvg.includes('8-year price history'));
assert(overlaySvg.includes('class="si-price-area"'));
assert(overlaySvg.includes('Ratios ×'));
assert(overlaySvg.includes('Morningstar fair value')&&overlaySvg.includes('1 archive off scale'));
assert(!overlaySvg.includes('class="si-overlay si-overlay-pe"'),'Long observation gaps are rendered as separate points');
assert(!C.svg(p,{TEST:sample}).includes('class="si-price-area"'));
