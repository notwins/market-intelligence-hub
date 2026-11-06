const assert=require('node:assert/strict'),fs=require('node:fs');
const {scalar,profile,compare,heatBand}=require('../site/table-controls.js');
for(const [raw,value,unit]of [['−2.50%',-2.5,'%'],['+1,234.50',1234.5,''],['US$ 1,000',1000,'US$'],['−12 bp',-12,'bp'],['2.1 years',2.1,'years']])assert.deepEqual({...scalar(raw)},{value,unit,text:raw.replace('−','-')});
for(const raw of ['12 / 14','Adj +2.4','99.28 0.1','1,23','1,234,56','2026-11-05','<script>3</script>','++3','3% rel.','12 USD per share','123 4'])assert.equal(scalar(raw),undefined,raw);
for(const raw of ['—','–','Unavailable','N/A',''])assert.equal(scalar(raw),null);
assert(profile(['1','—','-3'],{label:'Value'}).numeric);
assert(!profile(['2%','3bp']).numeric);assert(!profile(['2','3%']).numeric);assert(!profile(['—','Unavailable']).numeric);
assert(!profile(['1234','5678'],{label:'CUSIP'}).numeric);
assert.equal(profile(['2026-02','2025-11']).type,'date');
assert(profile(['-2%','+4.20%','—'],{kind:'signed-change',unit:'%'}).percent);
for(const header of [{label:'Yield',unit:'%'},{label:'Return'},{kind:'signed-change',unit:'bp'},{kind:'signed-change',unit:'USD'}])assert(!profile(['-2','+4.2'],header).percent);
assert.equal(compare('10','2','number'),8);assert(compare('10','2','number',true)<0);
for(const descending of [false,true])assert(compare('—','2','number',descending)>0);
assert(compare('2026-01','2025-11','date')>0);assert(compare('Bond 2','Bond 10','text')<0);
assert.equal(heatBand(null,0,10),null);assert.equal(heatBand(3,3,3),2);assert.equal(heatBand(0,0,10),0);assert.equal(heatBand(10,0,10),4);
for(const name of ['v4','v2','archive','saved-securities','external-sources','watchlist-report']){const html=fs.readFileSync('site/'+name+'.html','utf8');assert.equal((html.match(/src="table-controls.js/g)||[]).length,1,name);assert(html.includes('table-controls.css'));}
// Every foreground remains readable on every selectable heat background.
const luminance=h=>{const c=h.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
for(const text of ['153852','103a69','491958','023c35'])for(const background of ['f0f7ff','deedff','c6ddf5','a9c9ec','8ab2df','dcc8ef','eee3f8','f7f8fb']){const a=luminance(text),b=luminance(background);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,text+' on '+background);}
assert(profile(['-2%','+4.2%'],{kind:'signed-change',unit:'%'}).change);assert(!profile(['3%','4%'],{label:'Coupon'}).change);
const js=fs.readFileSync('site/table-controls.js','utf8');assert(!/localStorage|sessionStorage|fetch\(|\.innerHTML\s*=\s*(?!')/.test(js));
const css=fs.readFileSync('site/table-controls.css','utf8');assert(js.includes('tc-triangle'));assert(!js.includes("button.textContent='⋮'"));assert(css.includes('@media(pointer:coarse)'));assert(css.includes('width:28px'));assert(css.includes('width:44px'));
console.log('PASS strict scalar parsing, unit compatibility, explicit signed percent types, missing/date/natural stable comparison, heat bounds and active host includes');
