/* Reviewed public research selection. No publication or report data is changed. */
(function (root) {
  'use strict';
  const curated = [
    ['pending-us-cre-remake', 'research/us-cre-refinancing-test-2026-11-08/'],
    ['research-ai-circular-financing-2026-11-10', 'research/ai-circular-financing-2026-11-10/'],
    ['research-sti-banks-v2-2026-11-09', 'research/sti-banks-v2-2026-11-09/']
  ];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function validDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value;
  }
  const formatDate = value => new Date(value + 'T00:00:00Z').toLocaleDateString('en-SG', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  function select(data) {
    if (data?.schema_version !== 1 || !Array.isArray(data.entries)) return null;
    return curated.map(([id,href], rank) => {
      // Exact reviewed destinations prevent newly added promotional entries or redirects becoming the feature.
      const rows = data.entries.filter(entry => entry?.id === id);
      const entry = rows.length === 1 ? rows[0] : null;
      return entry && entry.state === 'published' && entry.href === href && validDate(entry.date) && validDate(entry.published_date) && typeof entry.title === 'string' && entry.title.trim() && typeof entry.summary === 'string' && entry.summary.trim() ? {entry,rank} : null;
    }).filter(Boolean).sort((a,b) => b.entry.published_date.localeCompare(a.entry.published_date) || a.rank-b.rank)[0]?.entry || null;
  }
  const archiveLinks = '<div class="links"><a href="research/sti-banks-2026-11-06/">Earlier bank research · Part 1 →</a><a href="research/sti-banks-part2-2026-11-06/">Earlier bank research · Part 2 →</a><a href="market-understanding/#my-research">More of my write-ups →</a></div>';
  function card(entry) {
    const body = entry ? '<h2 id="featured-research-title"><a href="'+escape(entry.href)+'">'+escape(entry.title)+'</a></h2><p>'+escape(entry.summary)+'</p><div class="featured-date">'+escape(entry.date_label || 'Research date')+': '+formatDate(entry.date)+' · Published: '+formatDate(entry.published_date)+' · Dated analysis, not live prices</div><div class="links"><a href="'+escape(entry.href)+'">Read the featured research →</a></div>' : '<h2 id="featured-research-title"><a href="market-understanding/#my-research">Explore my research</a></h2><p>Browse dated research editions and earlier bank analysis.</p>';
    return '<article class="featured-research" aria-labelledby="featured-research-title"><div class="eyebrow">Featured research</div>'+body+archiveLinks+'</article>';
  }
  function shell() { return '<div data-featured-research>'+card(null)+'</div>'; }
  let pending = null, cached = null;
  async function mount() {
    const host = document.querySelector('#featured-research-slot [data-featured-research]');
    if (!host) return;
    if (!pending && !cached) {
      pending = (async () => {
        try {
          const response = await fetch('data/research-register.json', {cache:'no-store'});
          if (!response.ok) throw new Error('Research register unavailable');
          const entry = select(await response.json());
          if (entry) cached = entry;
          return entry;
        } catch (_) { return null; }
        finally { pending = null; }
      })();
    }
    const entry = cached || await pending;
    // A route change replaces the shell. Never write into a detached or newer view.
    if (host.isConnected && document.querySelector('#featured-research-slot [data-featured-research]') === host) host.innerHTML = card(entry);
  }
  const api = {shell,mount};
  root.FeaturedResearch = api;
  if (typeof module !== 'undefined') module.exports = {select,validDate,formatDate,card,shell,mount};
})(typeof window === 'undefined' ? globalThis : window);
