const assert=require('node:assert/strict'),fs=require('node:fs'),M=require('../site/search-metadata.js'),F=require('../site/feed-freshness.js'),G=require('../site/global-search.js');
assert.equal(M.dateInfo('2026-11-06T23:34:23Z').text,'Sat 07:34am, 07-Nov SGT');
assert.equal(M.dateInfo('2026-11-06T16:00:00Z').text,'Sat 12:00am, 07-Nov SGT');
assert.equal(M.dateInfo('2026-11-06T04:00:00Z').text,'Fri 12:00pm, 06-Nov SGT');
assert.equal(M.dateInfo('2026-11-06').text,'Fri, 06-Nov · time not supplied');
for(const value of [null,undefined,''])assert.equal(M.dateInfo(value).text,'Date not supplied');
for(const value of ['2026-02-30','2026-11-06T10:30','today','<script>'])assert.equal(M.dateInfo(value).precision,'unknown');
assert(!M.dateHTML('<script>').includes('<script>'));
const standard=JSON.parse(fs.readFileSync('site/data/search-colour-standard.json'));
assert(M.tagsHTML(['Singapore'],standard).includes('#047857'));assert(!M.tagsHTML(['Unmapped'],standard).includes('style='));
assert(!M.tagsHTML(['<svg>'],standard).includes('<svg>'));assert(M.tagsHTML(['Singapore'],standard,{button:true}).includes('data-tag="Singapore"'));
assert(M.sourceDate({date:null,display_date:'2026-11-06'}).includes('time not supplied'));
assert(F.row(F.feeds[0],{generated_at:'2026-11-06T23:34:23Z'}).includes('Sat 07:34am, 07-Nov SGT'));
assert(F.row(F.feeds[0],{}).includes('Date not supplied'));assert(F.row(F.feeds[0],{},true).includes('Unavailable'));
const catalogue=JSON.parse(fs.readFileSync('site/data/site-search.json'));const banks=catalogue.entries.find(e=>e.href==='research/sti-banks-2026-11-06/index.html');assert.equal(banks.display_date,'2026-11-06');assert.equal(banks.date,null,'Display metadata must not change existing ranking date');
const dated={kind:'Headline',title:'Google earnings',href:'https://example.com',date:'2026-11-06T23:34:23Z',tags:['Earnings']};const row=G.rowHTML(dated,0,standard);assert(row.includes('Sat 07:34am, 07-Nov SGT'));assert(row.includes('search-tags'));assert(row.includes('Earnings'));
const html=fs.readFileSync('site/v4.html','utf8');assert(!html.includes('class="market-shortcuts"'));assert(!html.includes('data-market-anchor'));assert(!html.includes('Shares →'));assert(!html.includes('Bonds →'));assert(html.includes('class="bottom-nav"'));assert(html.includes('Bonds &amp; Credit'));assert(html.includes('Bonds &amp; shares watchlist'));assert(html.includes('class="featured-research featured-research--sti"'));assert(html.includes('The STI’s <em>bank premium</em>'));assert(html.includes('research/sti-banks-2026-11-06/'));assert(html.indexOf('search-metadata.js')<html.indexOf('global-search.js'));
console.log('PASS precise SGT dates, midnight/noon, date-only and unknown states, XSS, neutral unmapped chips, feed provenance, STI feature and preserved bottom navigation');

const workflow=fs.readFileSync('.github/workflows/publish.yml','utf8');for(const stage of ['Test publisher validation and archive retention','Revalidate reconciled source and rebuild deployment catalogue']){const block=workflow.split('- name: '+stage)[1].split('      - name:')[0];assert(block.indexOf('build_site_search.py')>=0&&block.indexOf('build_site_search.py')<block.indexOf('unittest'),'Regenerate catalogue before '+stage);}

const featureCSS=fs.readFileSync('site/intel-quick-wins.css','utf8');
const article=fs.readFileSync('site/research/sti-banks-2026-11-06/index.html','utf8');
for(const [token,values] of Object.entries({bg:['#f4f6f5','#101915'],ink:['#182822','#f0f4f1'],mut:['#485b53','#c1cec7'],line:['#cbd6d0','#415349'],sg:['#047857','#6ee7b7'],earn:['#0369a1','#7dd3fc']})){
  const featureToken={mut:'muted',earn:'link'}[token]||token;
  for(const value of values){assert(article.includes(`--${token}:${value}`));assert(featureCSS.includes(`--sti-${featureToken}:${value}`));}
}
assert(article.includes('h1 em{font-family:Georgia,serif;font-weight:500;color:var(--sg)}'));
assert(featureCSS.includes('h2 em{font-family:Georgia,serif;font-weight:500;color:var(--sti-sg)}'));
assert(featureCSS.includes('@media(prefers-color-scheme:dark){.featured-research--sti'));
assert(featureCSS.includes('@media(forced-colors:active)'));
console.log('PASS scoped STI article-matched light/dark palette and mixed title fonts');
