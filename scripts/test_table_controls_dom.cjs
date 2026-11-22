/* Optional DOM interaction checks: TABLE_DOM_MODULE may name an external jsdom install. */
const {JSDOM,VirtualConsole}=require(process.env.TABLE_DOM_MODULE||'jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
const wait=()=>new Promise(resolve=>setTimeout(resolve,70));
(async()=>{const errors=[],console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM('<html><body><div style="overflow-x:auto"><table id="t"><thead><tr><th>Name<button id="keep">Keep</button></th><th>Number</th><th data-table-kind="signed-change" data-table-unit="%">Return</th><th>ISIN</th></tr></thead><tbody><tr id="a"><th>A</th><td>10</td><td>1.2500</td><td>1234</td></tr><tr id="b"><th>B</th><td>2</td><td>−2.00</td><td>5678</td></tr><tr id="c"><th>C</th><td>—</td><td>—</td><td>9012</td></tr></tbody></table></div></body></html>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.com/v4.html',virtualConsole:console});
const {window:w}=dom,d=w.document;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
w.eval(fs.readFileSync('site/table-controls.js','utf8'));await wait();
const q=s=>d.querySelector(s),qa=s=>[...d.querySelectorAll(s)],click=s=>q(s).click(),open=i=>qa('#t [data-tc-button]')[i].click();
const input=(id,value)=>{q(id).value=value;q(id).dispatchEvent(new w.Event('input',{bubbles:true}));},change=(id,value)=>{const element=q(id);if(typeof value==='boolean')element.checked=value;else element.value=value;element.dispatchEvent(new w.Event('change',{bubbles:true}));};
const order=()=>qa('#t tbody tr').map(r=>r.id);assert.equal(qa('#t [data-tc-button]').length,4);assert(q('#keep'));assert.equal(q('#t').parentElement.tabIndex,0);
open(1);click('[data-tc-sort=asc]');assert.deepEqual(order(),['b','a','c']);assert.equal(qa('#t th')[1].getAttribute('aria-sort'),'ascending');click('[data-tc-sort=desc]');assert.deepEqual(order(),['a','b','c']);click('[data-tc-sort=none]');assert.deepEqual(order(),['a','b','c']);assert.equal(qa('#t thead th')[1].hasAttribute('aria-sort'),false);
change('#tc-heat',true);assert.deepEqual(qa('#t tbody td:nth-child(2)').map(c=>c.dataset.tcBand||''),['4','0','']);input('#tc-filter','2');assert.equal(qa('#t .tc-filtered').length,2);assert.deepEqual(qa('#t tbody td:nth-child(2)').map(c=>c.dataset.tcBand||''),['4','0','']);input('#tc-filter','');change('#tc-font','purple');change('#tc-focus',true);assert.equal(qa('#t tbody .tc-focus').length,3);assert.equal(qa('#t [data-tc-font=purple]').length,3);assert(q('#tc-percent-label').hidden);click('#tc-done');
open(2);assert(!q('#tc-percent-label').hidden);const source=qa('#t tbody td:nth-child(3)').map(c=>c.innerHTML);change('#tc-percent',true);assert.equal(q('#a [data-tc-formatted]').textContent,'+1.2500%');assert.equal(q('#b [data-tc-formatted]').textContent,'−2.00%');click('#tc-reset');assert.deepEqual(qa('#t tbody td:nth-child(3)').map(c=>c.innerHTML),source);click('#tc-done');assert.equal(d.activeElement,qa('#t [data-tc-button]')[2]);
open(3);assert(q('#tc-heat').disabled);click('#tc-done');open(0);input('#tc-filter','A');click('#tc-done');open(1);input('#tc-filter','<img onerror=alert(1)>');assert.equal(qa('#t .tc-filtered').length,3);assert.equal(qa('#t img').length,0);click('#tc-reset-table');assert.equal(qa('#t .tc-filtered').length,0);click('#tc-done');
// External sorting must not be undone when the column sorter is inactive.
q('#t tbody').insertBefore(q('#b'),q('#a'));await wait();assert.deepEqual(order(),['b','a','c']);
q('#t tbody').innerHTML='<tr id="new"><td>New</td><td>50</td><td>0.20</td><td>000</td></tr>';await wait();assert.equal(qa('#t [data-tc-button]').length,4);open(1);assert(q('#tc-heat-note').textContent.includes('50 to 50'));change('#tc-heat',true);assert.equal(q('#new td:nth-child(2)').dataset.tcBand,'2');click('#tc-done');
open(1);q('#t thead').innerHTML='<tr><th>Only</th></tr>';q('#t tbody').innerHTML='<tr><td>1</td></tr>';await wait();assert(!q('#tc-dialog').open);assert.equal(qa('#t [data-tc-button]').length,1);open(0);click('[data-tc-sort=asc]');click('#tc-done');
q('#t').outerHTML='<table id="t"><thead><tr><th>Label</th><th>Value</th></tr></thead><tbody><tr id="g"><th colspan="2">Group</th></tr><tr id="g1"><th>A</th><td>9</td></tr><tr id="g2"><th>B</th><td>1</td></tr><tr id="total"><th>Total</th><td>10</td></tr></tbody><tbody><tr id="g3"><th>C</th><td>8</td></tr><tr id="g4"><th>D</th><td>2</td></tr></tbody></table>';await wait();open(1);click('[data-tc-sort=asc]');assert.deepEqual(order(),['g','g2','g1','total','g4','g3']);click('#tc-reset-table');assert.deepEqual(order(),['g','g1','g2','total','g3','g4']);click('#tc-done');
q('#t').outerHTML='<table id="t"><thead><tr><th>Label</th><th>Value</th></tr></thead><tbody><tr><th rowspan="2">One</th><td>2</td></tr><tr><td>1</td></tr></tbody></table>';await wait();open(0);assert(q('[data-tc-sort=asc]').disabled);assert(q('#tc-filter').disabled);click('#tc-done');
// A pre-existing header sort indication is restored rather than discarded.
q('#t').outerHTML='<table id="t"><thead><tr><th aria-sort="descending">Number</th></tr></thead><tbody><tr><td>2</td></tr><tr><td>1</td></tr></tbody></table>';await wait();open(0);click('[data-tc-sort=asc]');click('#tc-reset-table');assert.equal(q('#t th').getAttribute('aria-sort'),'descending');click('#tc-done');
// Small reading tables omit controls; larger tables and explicit opt-ins retain them.
const article=d.createElement('article');article.id='reading';d.body.append(article);
const tableHTML=(id,n,attrs='')=>'<table id="'+id+'" '+attrs+'><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>'+Array.from({length:n},(_,i)=>'<tr><td>Row '+i+'</td><td>'+i+'</td></tr>').join('')+'</tbody></table>';
article.innerHTML=tableHTML('small',8)+tableHTML('large',9)+tableHTML('explicit',2,'data-table-controls="on"');await wait();
assert.equal(qa('#small [data-tc-button]').length,0);assert.equal(qa('#large [data-tc-button]').length,2);assert.equal(qa('#explicit [data-tc-button]').length,2);assert.equal(qa('#large .tc-triangle').length,2);assert.equal(q('#large [data-tc-button]').textContent,'');assert.equal(q('#large svg').getAttribute('aria-hidden'),'true');
qa('#large [data-tc-button]')[1].click();input('#tc-filter','8');assert.equal(qa('#large .tc-filtered').length,8);await wait();assert.equal(qa('#large [data-tc-button]').length,2);change('#tc-heat',true);change('#tc-focus',true);
q('#large tbody tr:last-child').remove();await wait();assert(!q('#tc-dialog').open);assert.equal(qa('#large [data-tc-button]').length,0);assert.equal(qa('#large .tc-filtered, #large .tc-heat, #large .tc-focus').length,0);assert(!q('#large').classList.contains('tc-table'));
q('#large tbody').insertAdjacentHTML('beforeend','<tr><td>Restored</td><td>9</td></tr>');await wait();assert.equal(qa('#large [data-tc-button]').length,2);
article.dataset.tableControls='off';await wait();assert.equal(qa('#reading [data-tc-button]').length,0);article.removeAttribute('data-table-controls');await wait();assert.equal(qa('#large [data-tc-button]').length,2);assert.equal(qa('#explicit [data-tc-button]').length,2);assert.equal(qa('#small [data-tc-button]').length,0);
// An initially empty table keeps its declared default as rows arrive and are replaced.
d.body.insertAdjacentHTML('beforeend','<table id="defaults"><thead><tr><th data-tc-skip>Add</th><th data-tc-default-heat>Strike</th></tr></thead><tbody></tbody></table>');
await wait();assert.equal(qa('#defaults [data-tc-button]').length,1);
q('#defaults tbody').innerHTML='<tr><td>Add</td><td>100%</td></tr><tr><td>Add</td><td>70%</td></tr>';await wait();
assert.deepEqual(qa('#defaults .tc-heat').map(c=>c.dataset.tcBand),['4','0']);
click('#defaults [data-tc-button]');assert(q('#tc-heat').checked);
change('#tc-heat',false);assert.equal(qa('#defaults .tc-heat').length,0);
click('#tc-reset-table');assert(q('#tc-heat').checked);click('#tc-done');
// SI action columns stay at the edges while the other headers offer widths.
d.body.insertAdjacentHTML('beforeend','<table id="library" data-tc-companies="library"><thead><tr><th data-tc-skip>Save</th><th data-tc-company-column>Shares</th><th>Coupon</th><th data-tc-skip>Add</th></tr></thead><tbody><tr data-tc-company-codes="NVDA AMD"><td></td><td>NVDA / AMD</td><td>8%</td><td></td></tr><tr data-tc-company-codes="NVDX"><td></td><td>NVDX</td><td>9%</td><td></td></tr><tr data-tc-company-codes="AMD TSM"><td></td><td>AMD / TSM</td><td>10%</td><td></td></tr></tbody></table>');
await wait();
assert.equal(qa('#library [data-tc-button]').length,2);
click('#library [data-tc-button]');
assert(!q('#tc-layout').hidden);
assert(q('[data-tc-move="-1"]').disabled);
change('#tc-width','220');
assert.equal(qa('#library col')[1].style.width,'220px');
assert.equal(q('#tc-company-list').children.length,4);
input('#tc-company-search','NVDA');
assert.equal(q('#tc-company-list').children.length,1);
change('#tc-company-all',false);
assert.deepEqual(qa('#library tr.tc-filtered').map(row=>row.dataset.tcCompanyCodes),['NVDA AMD']);
click('#tc-done');
const library=q('#library');
const replacement=library.cloneNode(true);
replacement.querySelectorAll('[data-tc-ui]').forEach(node=>node.remove());
library.replaceWith(replacement);
await wait();
assert.equal(qa('#library tr.tc-filtered').length,1);
assert.equal(qa('#library col')[1].style.width,'220px');
w.MarketTableControls.clearSiFilters(q('#library'));
assert.equal(qa('#library tr.tc-filtered').length,0);
// Numeric cutoffs are strict, and secondary sorts run only within primary ties.
const terms=[
 ['A','NVDA AMD',10,79,79,92],['B','NVDA',10,80,79,99],['C','TSM',10,79,80,99],
 ['D','MSFT',10,70,75,98],['E','MSFT',8,70,75,100],['F','AMD NVDA',10,70,77,95],
];
const termHeaders=['stocks','coupon','ki','strike','ko'];
d.body.insertAdjacentHTML('beforeend','<div id="organize-case"><table data-tc-companies="organize-case"><thead><tr>'+termHeaders.map(field=>'<th data-tc-field="'+field+'">'+field+'</th>').join('')+'</tr></thead><tbody>'+terms.map(([id,shares,...values])=>'<tr id="term-'+id+'" data-tc-company-codes="'+shares+'"><td>'+shares+'</td>'+values.map(value=>'<td>'+value+'%</td>').join('')+'</tr>').join('')+'</tbody></table></div>');
await wait();
const shown=()=>qa('#organize-case tbody tr[data-tc-company-codes]:not(.tc-filtered)').map(row=>row.id.at(-1));
const applyOrganizer=()=>q('.tc-organizer form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
click('#organize-case .tc-organize-button');
change('#tc-group-by','coupon');change('#tc-ki-below','80');change('#tc-strike-below','80');
change('.tc-sort-level [data-tc-level-field]','1');click('#tc-add-level');
change('.tc-sort-level:last-child [data-tc-level-field]','4');
const groupSource=q('#organize-case table'),replacementTable=groupSource.cloneNode(true);
replacementTable.querySelectorAll('[data-tc-ui]').forEach(node=>node.remove());
groupSource.replaceWith(replacementTable);await wait();
assert(q('.tc-organizer').open);
assert.equal(q('#tc-ki-below').value,'80');
applyOrganizer();
assert.deepEqual(shown(),['D','F','A','E']);
assert.deepEqual(qa('#organize-case [data-tc-group-heading]').map(row=>row.textContent),['Coupon 10% · 3','Coupon 8% · 1']);
click('#organize-case .tc-organize-button');change('#tc-group-by','shares');applyOrganizer();
assert(qa('#organize-case [data-tc-group-heading]').some(row=>row.textContent==='AMD / NVDA · 2'));
assert.equal(qa('#organize-case tbody tr.tc-filtered').length,2);
click('#organize-case .tc-organize-button');click('#tc-organizer-reset');
assert.deepEqual(shown(),['A','B','C','D','E','F']);
assert.equal(qa('#organize-case [data-tc-group-heading]').length,0);
// Real SI search, notes and the shared column controls can be used together.
const payload=JSON.parse(fs.readFileSync('site/data/si-pricing-reference.json','utf8'));w.fetch=async()=>({ok:true,json:async()=>payload});w.eval(fs.readFileSync('site/si-beta2-core.js','utf8'));w.eval(fs.readFileSync('site/si-pricing.js','utf8'));w.MarketSI.connect(()=>{d.body.innerHTML=w.MarketSI.view();});await wait();await wait();const sourceRows=qa('#si-rows tr').length;assert(sourceRows>=225);assert.equal(qa('[data-si-reference-table] [data-tc-button]').length,11);q('.si-records').open=true;
input('#si-query','NVDA');await wait();assert(qa('#si-rows tr').length<sourceRows);assert.equal(qa('[data-si-reference-table] [data-tc-button]').length,11);assert(q('.si-notice').textContent.includes('unconfirmed source coupon basis and tenor units'));click('[data-si-reset]');await wait();assert.equal(qa('#si-rows tr').length,sourceRows);
assert.deepEqual(errors,[]);w.close();process.stdout.write('PASS DOM: sorting/reset and pre-existing aria-sort, filter combinations/literal input, stable heat bounds, font/focus, precise percent restoration, external ordering, body/header replacement, orphaned modal dismissal, group/total preservation, rowspan safety, control idempotency, rounded triangle, small/large article thresholds, clean unmount/remount, explicit ancestor opt-out and live SI renderer/filter integration\n');
})().catch(error=>{process.stderr.write(error.stack+'\n');process.exit(1)});
