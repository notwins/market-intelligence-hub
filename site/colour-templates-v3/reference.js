(()=>{'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFKC').toLocaleLowerCase();
const hex=v=>/^#[0-9A-F]{6}$/i.test(v)?v:'#222D31';
const match=(q,values)=>norm(q).trim().split(/\s+/).filter(Boolean).every(t=>norm(values.join(' ')).includes(t));
let data,selected='03',companyLimit=24,tagLimit=24;
async function copyUnifiedPrompt(){
 try{if(!navigator.clipboard)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(JSON.parse($('unified-prompt-source').textContent));$('unified-copy-status').textContent='Complete research prompt copied.';}catch{$('unified-copy-status').textContent='Copy is unavailable here. Use Download prompt or select the full text below.';}
}
if($('copy-unified-prompt'))$('copy-unified-prompt').addEventListener('click',copyUnifiedPrompt);
let articleLimit=12;
function renderArticles(){
 const cards=[...document.querySelectorAll('[data-article-search]')], q=$('article-query').value, chosen=$('article-theme').value, status=$('article-status').value;
 const rows=cards.filter(c=>(!chosen||c.dataset.articleTheme===chosen)&&(!status||c.dataset.articleStatus===status)&&match(q,[c.dataset.articleSearch]));
 const visible=new Set(rows.slice(0,articleLimit));cards.forEach(c=>c.hidden=!visible.has(c));
 $('article-count').textContent=rows.length+' matching article editions · showing '+Math.min(articleLimit,rows.length)+' of '+cards.length+' published editions.';
 $('article-more').hidden=rows.length<=articleLimit;$('article-empty').hidden=rows.length!==0;
}
for(const id of ['article-query','article-theme','article-status'])$(id).addEventListener(id.endsWith('query')?'input':'change',()=>{articleLimit=12;renderArticles();});
$('article-more').addEventListener('click',()=>{articleLimit+=24;renderArticles();});renderArticles();

const theme=id=>data.themes.find(t=>t.id===id);
const semanticPalette=name=>data.semanticPalettes.find(p=>p['Colour name']===name);
const identityIcon=(label,light,backdrop)=>'<span class="identity-icon" aria-hidden="true" style="color:'+hex(light)+';background:'+hex(backdrop)+'">'+esc(label)+'</span>';
const themeName=id=>{const t=theme(id);return t?t.id+' · '+t.name:'No presentation assignment';};
function selectTheme(id,scroll=false){
 const t=theme(id);if(!t)return;selected=id;
 document.querySelectorAll('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===id)));
 $('preview-title').textContent=t.id+' · '+t.name;$('preview-use').textContent=t.useCases;
 const keys={canvas:'canvas',card:'card',panel:'panel',focus:'focusPanel',border:'border',ink:'ink',secondary:'secondaryInk'};
 for(const [a,b]of Object.entries(keys))$('theme-preview').style.setProperty('--p-'+a,hex(t.tokens[b]));
 $('preview-tokens').innerHTML=Object.entries(t.tokens).map(([k,v])=>'<span><i aria-hidden="true" style="background:'+hex(v)+'"></i>'+esc(k)+' '+esc(v)+'</span>').join('');
 if(scroll)$('theme-preview').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function renderThemes(){
 $('theme-grid').innerHTML=data.themes.map(t=>'<button class="theme-card" type="button" data-theme="'+esc(t.id)+'" aria-pressed="'+(t.id===selected)+'" style="--t-canvas:'+hex(t.tokens.canvas)+';--t-ink:'+hex(t.tokens.ink)+'"><span class="num">'+esc(t.id)+'</span><strong>'+esc(t.name)+'</strong><span class="use">'+esc(t.primaryUse)+'</span><span class="mini-swatches" aria-hidden="true">'+data.swatches.filter(s=>s.themeId===t.id&&s.shade==='Original').map(s=>'<span style="background:'+hex(s.hex)+'"></span>').join('')+'</span></button>').join('');
 $('theme-grid').addEventListener('click',e=>{const b=e.target.closest('[data-theme]');if(b)selectTheme(b.dataset.theme,true);});selectTheme('03');
 for(const id of ['palette-filter','company-theme'])$(id).insertAdjacentHTML('beforeend',data.themes.map(t=>'<option value="'+esc(t.id)+'">'+esc(themeName(t.id))+'</option>').join(''));
}
function renderPalettes(){
 const chosen=$('palette-filter').value;
 $('palette-grid').innerHTML=data.themes.filter(t=>!chosen||t.id===chosen).map(t=>'<details class="palette" id="palette-'+esc(t.id)+'" '+(chosen||t.id==='03'?'open':'')+'><summary>'+esc(themeName(t.id))+'<span>'+esc(t.primaryUse)+' · 15 swatches</span></summary><div class="palette-content"><div class="swatch-head"><span>CORE</span><span>LIGHT</span><span>ORIGINAL</span><span>DARK</span></div>'+[1,2,3,4,5].map(core=>'<div class="swatch-row"><span class="core-number">C'+core+'</span>'+['Light','Original','Dark'].map(shade=>{const s=data.swatches.find(x=>x.themeId===t.id&&x.core===core&&x.shade===shade);return '<div class="swatch"><div class="swatch-colour" style="background:'+hex(s.hex)+'" aria-label="'+esc(s.hex)+'"></div><div class="swatch-info"><code>'+esc(s.hex)+'</code><small>'+esc(s.contrastWhite)+':1 vs white<br>'+(Number(s.contrastWhite)>=4.5?'Normal text passes':'Not normal text on white')+'</small></div></div>';}).join('')+'</div>').join('')+'<p class="caption">Contrast shown against white only. Check actual backgrounds, opacity and meaningful chart marks. Normal text target 4.5:1; essential chart marks 3:1. Exact swatches never change to manufacture a pass.</p></div></details>').join('');
}
function renderRoutes(){
 const q=$('route-query').value,axis=$('route-axis').value,rows=data.routes.filter(r=>r.themeId&&(!axis||r.axis===axis)&&match(q,[r.keyword,r.criteria,r.axis,themeName(r.themeId)]));
 $('route-count').textContent=rows.length+' of 83 subject routes. Reference search only; it does not assign tags or choose a theme automatically.';
 $('route-results').innerHTML=rows.map(r=>'<article class="route-card"><span class="badge">'+esc(r.axis)+' · '+esc(r.id)+'</span><h3>'+esc(r.keyword)+'</h3><a class="theme-link" href="#themes" data-route-theme="'+esc(r.themeId)+'">'+esc(themeName(r.themeId))+'</a><p>'+esc(r.criteria)+'</p><p class="caption">'+esc(r.semanticPolicy)+'</p></article>').join('')||'<p class="empty">No matching route. Try a broader subject. Do not invent an assignment for an unmatched topic.</p>';
}
function renderCompanies(){
 const rows=data.companies.filter(c=>(!$('company-theme').value||c.themeId===$('company-theme').value)&&match($('company-query').value,[c.name,c.id,c.listings,c.colourName,...c.aliases]));
 $('company-count').textContent=rows.length+' matching companies · showing '+Math.min(companyLimit,rows.length)+'. Full supplied set: 212 entities.';
 $('company-results').innerHTML=rows.slice(0,companyLimit).map(c=>'<article class="entry"><div class="identity-heading">'+identityIcon(c.name.slice(0,2).toUpperCase(),c.light,semanticPalette(c.colourName)['Light chip'])+'<h3>'+esc(c.name)+'</h3></div><div class="meta">'+esc(c.listings)+' · '+esc(c.id)+'</div><div class="semantic-samples"><span style="color:'+hex(c.light)+';background:'+hex(semanticPalette(c.colourName)['Light chip'])+'">Light · '+esc(c.colourName)+' '+esc(c.light)+'</span><span style="color:'+hex(c.dark)+';background:'+hex(semanticPalette(c.colourName)['Dark chip'])+'">Dark · '+esc(c.dark)+'</span></div><p><strong>Exact backdrop HEX:</strong> '+esc(semanticPalette(c.colourName)['Light chip'])+' / '+esc(semanticPalette(c.colourName)['Dark chip'])+'.</p><p><strong>Presentation default:</strong> '+esc(themeName(c.themeId))+'. '+esc(c.rationale)+'.</p><p>'+esc(c.identityPolicy)+'</p><details><summary>Aliases and inherited source labels</summary><p><strong>Aliases:</strong> '+c.aliases.map(esc).join(' · ')+'</p><p><strong>Sector:</strong> '+esc(c.sectorSource||'Not supplied')+'</p><p><strong>Country source, not headquarters:</strong> '+esc(c.countrySourceNotHQ||'Not supplied')+'</p><p>Listings and membership are inherited references, not fresh verification. A company mention alone does not establish a specific security or share class.</p></details></article>').join('')||'<p class="empty">No supplied company matches. This is a lookup of the approved source set, not proof a company does not exist.</p>';
 $('company-more').hidden=rows.length<=companyLimit;$('company-all').hidden=rows.length<=companyLimit;
}
function renderTags(){
 const rows=data.tags.filter(t=>(!$('tag-category').value||t.category===$('tag-category').value)&&match($('tag-query').value,[t.label,t.id,t.category,t.colourName,...t.aliases]));
 $('tag-count').textContent=rows.length+' matching canonical tags · showing '+Math.min(tagLimit,rows.length)+'. Full preserved set: 437.';
 $('tag-results').innerHTML=rows.slice(0,tagLimit).map(t=>'<article class="entry"><div class="identity-heading">'+identityIcon('#',t.light,t.lightChip)+'<h3>'+esc(t.label)+'</h3></div><div class="meta">'+esc(t.category)+' · '+esc(t.id)+'</div><div class="semantic-samples"><span style="color:'+hex(t.light)+';background:'+hex(t.lightChip)+'">Light · '+esc(t.colourName)+'</span><span style="color:'+hex(t.dark)+';background:'+hex(t.darkChip)+'">Dark · '+esc(t.colourName)+'</span></div><p><strong>Exact text HEX:</strong> '+esc(t.light)+' / '+esc(t.dark)+'.<br><strong>Chip backgrounds:</strong> '+esc(t.lightChip)+' / '+esc(t.darkChip)+'.</p><p><strong>Matching rule:</strong> '+esc(t.matchingRule)+' · priority '+esc(t.priority)+'. Context and longest valid phrase come before a numeric tie-break.</p><details><summary>Aliases and presentation context</summary><p>'+t.aliases.map(esc).join(' · ')+'</p><p><strong>Presentation default:</strong> '+esc(themeName(t.themeId))+'. '+esc(t.routingRationale||'No extra routing rationale supplied.')+'</p><p>This directory is not a tagging engine. Resolve the actual context and ambiguity guards before applying a label.</p></details></article>').join('')||'<p class="empty">No canonical tag matches. Keep unverified or unmapped terms explicit; do not invent a semantic colour.</p>';
 $('tag-more').hidden=rows.length<=tagLimit;$('tag-all').hidden=rows.length<=tagLimit;
}
function renderRules(){
 const rows=data.rules.filter(r=>r['Priority / rule']!=='Website / accounts');
 $('source-rules').innerHTML=rows.map(r=>'<div class="source-rule"><strong>'+esc(r['Priority / rule'])+' · '+esc(r['Status'])+'</strong><p>'+esc(r['Key decision'])+'</p><p>'+esc(r['Explanation / action'])+'</p></div>').join('');
 $('alias-guards').innerHTML=data.aliasGuards.map(r=>'<div class="source-rule"><strong>'+esc(r['Alias / phrase'])+' · '+esc(r['Type'])+'</strong><p>'+esc(r['Candidate meaning'])+'</p><p>'+esc(r['Required handling'])+'</p></div>').join('');
 $('limits').innerHTML=data.limits.filter(v=>!v.startsWith('Source QUALITY CHECKS')&&!v.startsWith('Source PDF page')).map(v=>'<li>'+esc(v)+'</li>').join('');
}
async function copyAll(){
 const text=data.themes.map(t=>themeName(t.id)+'\n'+[1,2,3,4,5].map(c=>'C'+c+'  '+['Light','Original','Dark'].map(s=>s+': '+data.swatches.find(x=>x.themeId===t.id&&x.core===c&&x.shade===s).hex).join('  ')).join('\n')).join('\n\n');
 try{if(!navigator.clipboard)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(text);$('copy-status').textContent='Copied all 150 HEX entries.';}catch{$('copy-status').textContent='Clipboard unavailable here. Use the copy-ready text download below.';}
}
fetch('../data/colour-templates-v3.json').then(r=>{if(!r.ok)throw Error('Reference data unavailable');return r.json();}).then(d=>{
 if(d.version!=='3.0'||d.themes.length!==10||d.swatches.length!==150||d.tags.length!==437||d.companies.length!==212)throw Error('Reference counts do not match the source');data=d;
 renderThemes();renderPalettes();renderRoutes();renderCompanies();renderTags();renderRules();
 $('route-axis').insertAdjacentHTML('beforeend',[...new Set(data.routes.filter(r=>r.themeId).map(r=>r.axis))].map(v=>'<option>'+esc(v)+'</option>').join(''));
 $('tag-category').insertAdjacentHTML('beforeend',[...new Set(data.tags.map(t=>t.category))].sort().map(v=>'<option>'+esc(v)+'</option>').join(''));
 $('palette-filter').addEventListener('change',renderPalettes);$('copy-all').addEventListener('click',copyAll);
 for(const id of ['route-query','route-axis'])$(id).addEventListener(id.endsWith('query')?'input':'change',renderRoutes);
 for(const id of ['company-query','company-theme'])$(id).addEventListener(id.endsWith('query')?'input':'change',()=>{companyLimit=24;renderCompanies();});
 for(const id of ['tag-query','tag-category'])$(id).addEventListener(id.endsWith('query')?'input':'change',()=>{tagLimit=24;renderTags();});
 $('company-all').addEventListener('click',()=>{companyLimit=data.companies.length;renderCompanies();});$('tag-all').addEventListener('click',()=>{tagLimit=data.tags.length;renderTags();});
 $('company-more').addEventListener('click',()=>{companyLimit+=48;renderCompanies();});$('tag-more').addEventListener('click',()=>{tagLimit+=48;renderTags();});
 $('route-results').addEventListener('click',e=>{const a=e.target.closest('[data-route-theme]');if(a)selectTheme(a.dataset.routeTheme);});
 const requested=new URLSearchParams(location.search).get('theme');if(requested&&theme(requested))selectTheme(requested);
}).catch(()=>{$('theme-grid').innerHTML='<p class="error">The interactive reference could not load. Reload to retry, or use the verified Excel, PDF and text files in Downloads. No substitute colours have been loaded.</p>';for(const id of ['company-more','company-all','tag-more','tag-all','copy-all'])$(id).disabled=true;});
})();
