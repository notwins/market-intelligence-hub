/* Public, stored hourly report reader. Loading a page does not run a Reuters scan. */
(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe = value => { try {const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? esc(u.href) : '#';} catch {return '#';} };
  const time = value => value ? new Date(value).toLocaleString('en-SG', {timeZone:'Asia/Singapore',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}) + ' SGT' : 'Not established';
  const publication = source => source?.publication_precision === 'date' && !source.published_at
    ? `${source.published_date || 'Date unknown'} (publication time unverified)`
    : time(source?.published_at);
  const text = {complete:'Complete scan reported',partial:'Partial source coverage',unavailable:'Source unavailable'};
  let ctx = null, filter = 'all', topic = 'all', query = '', limit = 40;
  function versions(data) {
    const map = new Map();
    for (const edition of data?.editions || []) for (const story of edition.stories || []) {
      const list = map.get(story.story_id) || [];
      list.push({...story, report_at:edition.report_at, sources:edition.sources, original_url:edition.original_url});
      map.set(story.story_id, list);
    }
    return [...map.values()].map(list => list.sort((a,b) => b.version-a.version)).sort((a,b) => Date.parse(b[0].report_at)-Date.parse(a[0].report_at));
  }
  function counts(edition) {
    const out = {'new':0,'follow-up':0,'correction':0};
    for (const story of edition?.stories || []) if (story.status in out) out[story.status]++;
    return out;
  }
  function badge(coverage) {return `<span class="tag ${coverage === 'complete' ? 'green' : 'amber'}">${esc(text[coverage] || 'Awaiting source report')}</span>`;}
  function sources(story) {
    return (story.source_urls || []).map(url => {
      const s = story.sources.find(x => x.url === url);
      return `<div class="source-line"><a href="${safe(url)}" target="_blank" rel="noopener noreferrer">${esc(s?.title || 'Reuters source')} ↗</a><small>Published ${esc(publication(s))}${s?.updated_at ? ' · Updated '+esc(time(s.updated_at)) : ''}</small></div>`;
    }).join('');
  }
  function storyBody(s) {
    return `${s.earlier ? `<div class="insight"><b>Earlier</b><p>${esc(s.earlier)}</p></div>` : ''}<p>${esc(s.body)}</p>${s.analysis ? `<p><b>Why it matters · analysis</b><br>${esc(s.analysis)}</p>` : ''}${s.watch_next ? `<p><b>Watch next</b><br>${esc(s.watch_next)}</p>` : ''}${sources(s)}`;
  }
  function card(list) {
    const s = list[0], label = {'new':'New','follow-up':'Follow-up','correction':'Correction'}[s.status];
    return `<article class="card hourly-story"><div class="tags"><span class="tag ${s.status === 'correction' ? 'red' : 'purple'}">${esc(label)}</span><span class="tag">${esc(s.topic)}</span>${s.freshness !== 'current' ? `<span class="tag amber">${s.freshness === 'catch-up' ? 'Catch-up' : 'Breaking'}</span>` : ''}</div><h2>${esc(s.headline)}</h2><small>Reported ${esc(time(s.report_at))}${s.development_at ? '<br>Development '+esc(time(s.development_at)) : '<br>Exact development time not established'}</small>${storyBody(s)}${list.length > 1 ? `<details><summary>Earlier updates · ${list.length-1}</summary>${list.slice(1).map(v => `<section class="hourly-version"><h3>Version ${v.version} · ${esc(time(v.report_at))}</h3><p>${esc(v.headline)}</p>${storyBody(v)}</section>`).join('')}</details>` : ''}</article>`;
  }
  function teaser(data) {
    const e = data?.editions?.[0];
    return `<section class="section hourly"><article class="card hourly-teaser"><div><div class="eyebrow">Reuters Hourly News</div><h2>What changed since the last update?</h2>${e ? `${badge(e.coverage)}<p>${esc(e.summary)}</p><small>Latest report ${esc(time(e.report_at))} · Scan cutoff ${esc(time(e.cutoff))}</small>` : '<p>Hourly reports have their own reporting cutoff and coverage status.</p>'}</div><button class="button" data-view="hourly">Open hourly news ↗</button></article></section>`;
  }
  function view(data) {
    const e = data?.editions?.[0];
    if (!e) return `<section class="hourly"><div class="eyebrow">Reuters Hourly News</div><h1>Hourly news, with context.</h1><article class="card"><h2>Awaiting a completed source report</h2><p>The last verified reports stay in place if the source or publisher is unavailable. A page refresh does not collect Reuters news.</p><a href="https://chatgpt.com/c/6ae56595-efc0-83ec-aae5-fd9a9266c2f1" target="_blank" rel="noopener noreferrer">Open original news task ↗</a></article></section>`;
    const all = versions(data), c = counts(e), topics = [...new Set(all.map(x=>x[0].topic))].sort();
    const matched = all.filter(list => (filter === 'all' || list[0].status === filter) && (topic === 'all' || list[0].topic === topic) && (!query || [list[0].headline,list[0].body,list[0].topic].join(' ').toLowerCase().includes(query.toLowerCase())));
    const stale = Date.now()-Date.parse(e.report_at) > 2*60*60*1000;
    return `<section class="hourly"><div class="eyebrow">Reuters Hourly News</div><h1>Hourly news, with context.</h1><p class="muted">Completed report extracts, substantive follow-ups and corrections. All times are Singapore time.</p><article class="card"><div class="tags">${badge(e.coverage)}${data.source_schedule?.status === "Paused" ? '<span class="tag amber">Original hourly task paused</span>' : data.source_schedule?.status === "Active" ? '<span class="tag green">Original hourly task active</span>' : ''}${stale ? '<span class="tag amber">Latest report over two hours old</span>' : ''}</div><h2>Latest available report</h2>${data.source_schedule?.status === "Paused" ? '<div class="health warn">The original news task is paused. Previous reports remain readable; fresh scheduled reports will need the source task to resume.</div>' : ''}<p>${esc(e.summary)}</p><dl class="hourly-times"><div><dt>Source report completed</dt><dd>${esc(time(e.report_at))}</dd></div><div><dt>Coverage window</dt><dd>${esc(time(e.window_start))}<br>to ${esc(time(e.cutoff))}</dd></div><div><dt>Last complete scan cutoff</dt><dd>${esc(time(data.last_complete_cutoff))}</dd></div><div><dt>Website updated</dt><dd>${esc(time(data.publisher_checked_at))}</dd></div></dl>${e.limitations.length ? `<div class="health warn"><b>Coverage limits</b><ul>${e.limitations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}<div class="links"><a href="${safe(e.original_url)}" target="_blank" rel="noopener noreferrer">Open original report ↗</a><a href="https://chatgpt.com/c/6ae56595-efc0-83ec-aae5-fd9a9266c2f1" target="_blank" rel="noopener noreferrer">Original news task ↗</a></div></article><div class="hourly-counts section" aria-label="Stories in latest report">${[['new','New'],['follow-up','Follow-ups'],['correction','Corrections']].map(([key,label])=>`<article class="card mini-stat"><div class="label">${label} · latest report</div><div class="value">${c[key]}</div></article>`).join('')}</div><section class="section"><h2>News timeline</h2><p class="muted">One current card per story. Earlier versions remain attached to follow-ups and corrections.</p><div class="hourly-filters"><label>Status<select data-hourly-status>${[['all','All stories'],['new','New'],['follow-up','Follow-ups'],['correction','Corrections']].map(([k,v])=>`<option value="${k}" ${filter===k?'selected':''}>${v}</option>`).join('')}</select></label><label>Topic<select data-hourly-topic><option value="all">All topics</option>${topics.map(x=>`<option value="${esc(x)}" ${topic===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>Search stories<input data-hourly-query type="search" value="${esc(query)}" placeholder="Topic, company or headline"></label></div><div class="hourly-timeline">${matched.length ? `<p class="muted">${matched.length} matching stories · showing up to ${limit}</p>${matched.slice(0,limit).map(card).join('')}${matched.length>limit ? '<button class="button" data-hourly-more>Show more stories</button>' : ''}` : `<article class="card hourly-empty"><h3>${all.length ? 'No matching stories' : 'No verified story cards in the imported reports'}</h3><p>${all.length ? 'Try another topic or search.' : e.coverage === 'complete' ? 'The source reported a completed scan without a material new development.' : 'The source reported incomplete coverage. Zero selected stories does not confirm that no Reuters news occurred.'}</p></article>`}</div></section><section class="section"><h2>Scan history</h2><p class="muted">Each imported report retains its original cutoff and coverage status.</p><div class="hourly-history">${data.editions.map(x=>`<details class="card"><summary>${esc(time(x.report_at))} · ${esc(text[x.coverage])}</summary><p>${esc(x.summary)}</p><p>Window ${esc(time(x.window_start))} to ${esc(time(x.cutoff))}</p>${x.limitations.map(y=>`<p>${esc(y)}</p>`).join('')}<a href="${safe(x.original_url)}" target="_blank" rel="noopener noreferrer">Original report ↗</a></details>`).join('')}</div></section><p class="body-note">The publisher checks for completed source reports at 15 minutes past each hour. Generation and deployment can take longer. This page reads saved extracts; it is not an exhaustive Reuters wire or a live price feed. Full news text remains in the original English report.</p></section>`;
  }
  function connect(options) {ctx = options;}
  if (typeof document !== 'undefined') {
    document.addEventListener('change', e => {
      if (e.target.matches('[data-hourly-status]')) {filter=e.target.value;limit=40;ctx?.render();}
      if (e.target.matches('[data-hourly-topic]')) {topic=e.target.value;limit=40;ctx?.render();}
    });
    document.addEventListener('input', e => {
      if (!e.target.matches('[data-hourly-query]')) return;
      query=e.target.value;limit=40;
      const panel = document.querySelector('.hourly-timeline');
      if (!panel || !ctx) return;
      // Re-render only the results so typing and the phone keyboard retain focus.
      const template = document.createElement('template');template.innerHTML=view(ctx.getData());
      panel.innerHTML=template.content.querySelector('.hourly-timeline').innerHTML;
    });
    document.addEventListener('click', e => {if (e.target.closest('[data-hourly-more]')) {limit+=40;ctx?.render();}});
  }
  root.MarketHourly = {view,teaser,connect,versions,counts};
})(typeof window === 'undefined' ? globalThis : window);
