((root) => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? esc(u.href) : ''; } catch { return ''; } };
  const link = (url, label) => safeURL(url) ? `<a href="${safeURL(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : '';
  function reportHTML(r) {
    return `<article id="report-${esc(r.id)}"><p class="meta">${esc(r.date)} · ${esc(r.time_sgt)} · ${esc(r.type)}<br>${esc(r.status)}</p>
      <h3>${esc(r.title)}</h3><p>${esc(r.subtitle)}</p><p class="takeaway"><strong>Key insight:</strong> ${esc(r.takeaway)}</p>
      ${r.period_note ? `<p>${esc(r.period_note)}</p>` : ''}
      ${(r.items || []).map(x => `<section><h4>${esc(x.company)} (${esc(x.ticker)})</h4><p class="meta">${esc(x.change_label)}</p><p><strong>${esc(x.headline)}</strong></p><p>${esc(x.detail)}</p>
        <ul class="metrics">${(x.metrics || []).map(m => `<li>${esc(m[0])}: <strong>${esc(m[1])}</strong></li>`).join('')}</ul>
        <div class="links">${link(x.url,'Reporting source')}${link(x.evidence_url,'Verification source')}</div></section>`).join('')}
      ${(r.sections || []).map(s => `<section><h4>${esc(s.label)}</h4><p>${esc(s.text)}</p></section>`).join('')}
      <details><summary>All source links</summary><ul>${(r.sources || []).map(u => `<li>${link(u,u)}</li>`).join('')}</ul></details>
      <p class="meta">Verified at: ${esc(r.verified_at || 'Not recorded')}</p><a href="archive.html?report=${encodeURIComponent(r.id)}#report-${esc(r.id)}">Link to this edition</a></article>`;
  }
  function snapshotHTML(d, day) {
    const items = d.items || [];
    return `<h3>${esc(day)} · ${items.length} saved headlines</h3><p class="meta">Snapshot recorded: ${esc(d.generated_at || 'Not recorded')}</p>` + items.map(x => `<article class="headline"><p class="meta">${esc(x.published_at)} · ${esc(x.category || 'Markets')} · Reuters</p><h4>${esc(x.title)}</h4><p>${esc((x.tickers || []).join(' · '))}</p>${link(x.url,x.link_type === 'google_news' ? 'Google News → Reuters' : 'Reuters article')}</article>`).join('');
  }
  async function json(path) { const response = await fetch(path,{cache:'no-store'}); if (!response.ok) throw Error('Unavailable'); return response.json(); }
  if (typeof module === 'object' && module.exports) { module.exports = {reportHTML,snapshotHTML,safeURL}; return; }
  let reports = [], days = [], request = 0;
  const $ = id => document.getElementById(id);
  async function render() {
    const token = ++request, query = new URLSearchParams(location.search), selected = query.get('report');
    const match = reports.find(r => r.id === selected);
    $('archive-reports').innerHTML = (selected && !match ? '<p class="notice">This edition was not found. All available editions are listed below.</p>' : '') + (match ? '<p><a href="archive.html">Browse all editions</a></p>' : '') + (match ? [match] : reports).map(reportHTML).join('');
    const day = query.get('day') || days[0]?.date;
    $('archive-days').innerHTML = days.map(d => `<a href="archive.html?day=${encodeURIComponent(d.date)}#archive-snapshot" ${d.date === day ? 'aria-current="date"' : ''}>${esc(d.date)}<small>${esc(d.count)} headlines</small></a>`).join('') || '<p>No daily snapshots are indexed.</p>';
    if (day && !days.some(d => d.date === day && /^\d{4}-\d{2}-\d{2}$/.test(day))) { $('archive-snapshot').textContent = 'This snapshot date is not in the archive. Choose an available date above.'; return; }
    if (day) {
      $('archive-snapshot').textContent = 'Loading snapshot…';
      try { const d = await json('data/archive/' + day + '.json'); if (token !== request) return; $('archive-snapshot').innerHTML = snapshotHTML(d,day); }
      catch { if (token === request) $('archive-snapshot').textContent = 'This snapshot could not load. The saved data has not been changed. Please reload to try again.'; }
    }
    if (token === request && location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  }
  async function start() {
    const results = await Promise.allSettled([json('data/reports.json'),json('data/archive-index.json')]);
    if (results[0].status === 'fulfilled') reports = (results[0].value.reports || []).sort((a,b) => b.date.localeCompare(a.date));
    if (results[1].status === 'fulfilled') days = (results[1].value.days || []).sort((a,b) => b.date.localeCompare(a.date));
    await render();
    if (results[0].status === 'rejected') $('archive-reports').innerHTML = '<p class="notice">The report data could not load. <a href="data/reports.json">Open the saved report data</a> or reload to try again.</p>';
    if (results[1].status === 'rejected') $('archive-days').innerHTML = '<p class="notice">The snapshot index could not load. <a href="data/archive-index.json">Open the saved index</a> or reload to try again.</p>';
  }
  start();
})(globalThis);
