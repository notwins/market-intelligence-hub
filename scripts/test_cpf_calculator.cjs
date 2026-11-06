const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../site/tools/cpf-life-ra.html','utf8');
const code=html.match(/<script id="cpf-model">([\s\S]*?)<\/script>/)[1];
const ctx={};vm.createContext(ctx);vm.runInContext(code,ctx);const {ra,life}=ctx.CPFModel;
let count=0;function test(name,f){f();console.log('PASS '+name);count++;}function close(a,b){assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);}
const r={age:55,start:65,balance:220400,topup:100000,rate:4,extra:true},l={start:65,end:100,premium:330000,level:1800,escalating:1500,inflation:2};
test('one-year RA tiers and continuity',()=>{for(const [b,i]of [[0,0],[30000,1800],[60000,3300],[100000,4900]])close(ra({...r,age:64,balance:b,topup:0}).at(-1).total,b+i);for(const b of [29999.99,30000,30000.01,59999.99,60000,60000.01]){const x=ra({...r,age:64,balance:b,topup:0}).at(-1);close(x.total,b*1.04+Math.min(b,30000)*.02+Math.min(Math.max(b-30000,0),30000)*.01);assert.ok(x.extra<=900);}});
test('topup zero paths identical and base-only compounding exact',()=>{const rows=ra({...r,topup:0});rows.forEach(x=>close(x.base,x.total));close(ra({...r,extra:false}).at(-1).total,(r.balance+r.topup)*1.04**10);});
test('zero accumulation years include initial topup only',()=>{const rows=ra({...r,age:65});assert.equal(rows.length,1);close(rows[0].total,320400);});
test('tier interest marginal above60000 is not extra900 again',()=>{close(ra(r).at(-1).total-ra(r).at(-1).base,100000*1.04**10);});
test('monthly payment and escalation timing',()=>{const rows=life({...l,end:67,level:1000,escalating:1000});close(rows[0].levelPaid,0);close(rows[1].levelPaid,12000);close(rows[1].escalatingPaid,12000);close(rows[1].escalating,1020);close(rows[2].escalatingPaid,24240);});
test('2percent escalation holds real income at2percent inflation',()=>life(l).forEach(x=>close(x.escalatingReal,1500)));
test('zero inflation equals nominal monthly values',()=>life({...l,inflation:0}).forEach(x=>{close(x.level,x.levelReal);close(x.escalating,x.escalatingReal);}));
test('premium never negative and payouts continue after depletion',()=>{const rows=life({...l,premium:100,end:67});assert.equal(rows[1].levelRemaining,0);assert.equal(rows[2].escalatingRemaining,0);assert.ok(rows[2].levelPaid>rows[1].levelPaid);});
test('zero premium and zero payouts handled honestly',()=>{const rows=life({...l,premium:0,level:0,escalating:0});rows.forEach(x=>{close(x.levelPaid,0);close(x.escalatingPaid,0);close(x.levelRemaining,0);});});
test('invalid input rejected',()=>{for(const p of [{age:54},{start:71},{age:70,start:65},{balance:-1},{topup:Infinity},{rate:NaN},{age:55.1}])assert.throws(()=>ra({...r,...p}));for(const p of [{end:64},{end:111},{premium:-1},{level:NaN},{escalating:Infinity},{inflation:-1},{start:64},{end:85.5}])assert.throws(()=>life({...l,...p}));});
test('all scripts parse and no data transmission or external runtime dependencies',()=>{for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);assert.ok(!/<script[^>]+src=/.test(html));assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|cpf-life-builder\.winstonnggw/.test(html));});
test('critical boundaries and local navigation remain visible',()=>{for(const text of ['not matched CPF quotations','Basic Plan is deliberately not simulated','monthly balances','annual crediting','not total bequest','2%','S$440,800','2026'])assert.ok(html.includes(text),text);const hub=fs.readFileSync(__dirname+'/../site/v4.html','utf8');assert.ok(hub.includes('href="tools/cpf-life-ra.html" target="_blank" rel="noopener noreferrer"'));});
console.log(`${count} CPF calculator checks passed.`);
