(function (root) {
  'use strict';
  const validPath = value => typeof value==='string' && /^https:\/\/notwins\.github\.io\/market-intelligence-content\/research\/[a-z0-9-]+\/index\.html$/.test(value) || typeof value === 'string' && /^(?:research|market-understanding)\/[a-z0-9/_\.\-]+$/.test(value) && !value.includes('..');
  const searchable = (entry, tags) => [entry.title, entry.edition, entry.summary, entry.section, ...(entry.tags || []).map(id => tags.get(id)?.label || '')].join(' ').toLocaleLowerCase();
  function select(entries, options, tags) {
    const words = options.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return entries.filter(entry => (options.state === 'all' || entry.state === options.state) && (!options.tag || entry.tags.includes(options.tag)) && words.every(word => searchable(entry, tags).includes(word)))
      .slice().sort((a, b) => {
        const date = (a.date || '0000-00-00').localeCompare(b.date || '0000-00-00');
        return (options.order === 'oldest' ? date : -date) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
      });
  }
  const formatDate = value => value ? new Date(value + 'T00:00:00Z').toLocaleDateString('en-SG', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}) : 'Date not recorded';
  const api = {select, validPath, formatDate};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  const host = document.getElementById('my-research');
  if (!host) return;
  const base = new URL('.', document.currentScript.src);
  const element = (name, text, className) => { const el = document.createElement(name); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
  async function start() {
    const [response, standardResponse] = await Promise.all([fetch(new URL('data/research-register.json', base)), fetch(new URL('data/external-source-standard.json', base))]);
    if (!response.ok || !standardResponse.ok) throw new Error('Research list unavailable');
    const [data, standard] = await Promise.all([response.json(), standardResponse.json()]);
    if (data.schema_version !== 1 || standard.version !== data.standard_version) throw new Error('Research standard mismatch');
    const tags = new Map(standard.tags.map(tag => [tag.id, tag]));
    const entries = data.entries;
    function mergeFeed(feed) {
      if (!root.ResearchFeed || !feed) return;
      for(const [id,tag] of Object.entries(feed.tags||{}))if(!tags.has(id))tags.set(id,tag);
      const known=new Set(entries.map(x=>x.id));
      root.ResearchFeed.libraryEntries(feed).forEach(row=>{if(!known.has(row.id)){entries.push(row);known.add(row.id);}});
    }
    try { mergeFeed(root.MIH_RESEARCH_FEED); } catch { /* Existing verified library remains available. */ }
    const controls = host.querySelector('[data-research-controls]');
    const results = host.querySelector('[data-research-results]');
    const count = host.querySelector('[data-research-count]');
    const checked = host.querySelector('[data-research-checked]');
    checked.textContent = 'Status checked ' + new Date(data.checked_at).toLocaleString('en-SG', {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Singapore'}) + ' SGT';
    const publishedCount = entries.filter(entry => entry.state === 'published').length;
    const pendingCount = entries.filter(entry => entry.state === 'pending').length;
    host.querySelector('[data-research-totals]').textContent = publishedCount + ' published editions · ' + pendingCount + ' pending files or revisions';
    const state = element('select'); state.id = 'research-state';
    [['published','Published editions'], ['pending','Not yet published'], ['all','All entries']].forEach(([value, label]) => { const option = element('option', label); option.value = value; state.append(option); });
    if (new URLSearchParams(location.search).get('research-status') === 'pending') state.value = 'pending';
    const query = element('input'); query.id = 'research-query'; query.type = 'search'; query.placeholder = 'Title, topic or version';
    const category = element('select'); category.id = 'research-topic';
    const all = element('option', 'All topics'); all.value = ''; category.append(all);
    [...new Set(entries.flatMap(entry => entry.tags))].map(id => tags.get(id)).filter(Boolean).sort((a,b) => a.label.localeCompare(b.label)).forEach(tag => { const option = element('option', tag.label); option.value = tag.id; category.append(option); });
    const order = element('select'); order.id = 'research-order';
    [['newest','Newest report date first'], ['oldest','Oldest report date first']].forEach(([value,label]) => { const option = element('option',label); option.value = value; order.append(option); });
    [[state,'Show'],[query,'Search research'],[category,'Topic'],[order,'Sort']].forEach(([control,text]) => { const label = element('label', text); label.htmlFor = control.id; label.append(control); controls.append(label); });
    const descriptions = element('button','Show descriptions','rr-description-toggle'); descriptions.type = 'button'; descriptions.setAttribute('aria-pressed','false'); controls.append(descriptions);
    const reset = element('button','Reset','rr-reset'); reset.type = 'button'; controls.append(reset);
    let expanded = false;
    const tagChip = id => {
      const tag = tags.get(id); if (!tag) return null;
      const chip = element('button',tag.label,'rr-tag'); chip.type = 'button'; chip.title = 'Filter by ' + tag.label;
      for (const [variable,key] of [['--tag-text','text'],['--tag-bg','background'],['--tag-dark-text','dark_text'],['--tag-dark-bg','dark_background']]) if (/^#[\da-f]{6}$/i.test(tag[key])) chip.style.setProperty(variable,tag[key]);
      chip.addEventListener('click',() => { category.value = id; render(); category.focus({preventScroll:true}); });
      return chip;
    };
    function render() {
      const selected = select(entries, {state:state.value, query:query.value,tag:category.value,order:order.value},tags);
      results.replaceChildren();
      count.textContent = selected.length + (state.value === 'pending' ? ' pending files or revisions' : ' entries') + ' shown';
      host.querySelector('[data-research-pending-note]').hidden = state.value === 'published';
      if (!selected.length) { results.append(element('p','No matching research. Try another topic or clear the search.','rr-empty')); return; }
      for (const entry of selected) {
        const item = element('li',undefined,'rr-item');
        const date = element('div',undefined,'rr-date'); date.append(element('span',entry.date_label)); const time = element('time',formatDate(entry.date)); if (entry.date) time.dateTime=entry.date; date.append(time);
        const main = element('div',undefined,'rr-main');
        const heading = element('h3');
        if (entry.state === 'published' && validPath(entry.href)) { const a = element('a',entry.title); a.href=new URL(entry.href,base).href; heading.append(a); } else heading.textContent=entry.title;
        main.append(heading);
        const meta = element('div',undefined,'rr-meta');
        meta.append(element('span','My research','rr-own-tag')); if(entry.section === 'Calls') meta.append(element('span','Calls · research','rr-section-tag'));
        meta.append(element('span',entry.edition,'rr-edition'));
        if(entry.assets.length) { const tally={}; entry.assets.forEach(path=>{const ext=path.split('.').pop().toUpperCase();tally[ext]=(tally[ext]||0)+1;});meta.append(element('span',Object.entries(tally).map(([ext,n])=>(n>1?n+' ':'')+ext).join(' · '),'rr-assets')); }
        main.append(meta);
        if (entry.summary) {
          const details=element('details',undefined,'rr-details'); details.open=expanded;
          details.append(element('summary','Description'));
          const p=element('p',entry.summary); details.append(p);
          if(entry.state==='pending' && validPath(entry.href)) { const a=element('a','Read current published edition');a.href=new URL(entry.href,base).href;details.append(a); }
          main.append(details);
        }
        const topics=element('div',undefined,'rr-tags'); entry.tags.forEach(id=>{const chip=tagChip(id);if(chip)topics.append(chip);});
        const status=element('span',entry.state==='published'?'Published':'Pending','rr-status rr-status-'+entry.state);
        item.append(date,main,topics,status);results.append(item);
      }
    }
    for(const control of [state,query,category,order])control.addEventListener(control===query?'input':'change',render);
    descriptions.addEventListener('click',()=>{expanded=!expanded;descriptions.textContent=expanded?'Hide descriptions':'Show descriptions';descriptions.setAttribute('aria-pressed',String(expanded));results.querySelectorAll('details').forEach(details=>{details.open=expanded;});});
    reset.addEventListener('click',()=>{state.value='published';query.value='';category.value='';order.value='newest';render();});
    host.querySelector('[data-research-loading]').hidden=true;controls.hidden=false;render();
    root.addEventListener('mih-research-feed-updated',event=>{
      try {
        mergeFeed(event.detail);
        host.querySelector('[data-research-totals]').textContent=entries.filter(x=>x.state==='published').length+' published editions · '+entries.filter(x=>x.state==='pending').length+' pending files or revisions';
        const existing=new Set(Array.from(category.options,x=>x.value));
        [...new Set(entries.flatMap(x=>x.tags))].filter(id=>!existing.has(id)&&tags.has(id)).forEach(id=>{const option=element('option',tags.get(id).label);option.value=id;category.append(option);});
        render();
      } catch { /* Keep the prior verified library. */ }
    });
  }
  start().catch(()=>{host.querySelector('[data-research-loading]').textContent='The research register could not be loaded. The existing research library and article links remain available below.';});
})(typeof window !== 'undefined' ? window : globalThis);
