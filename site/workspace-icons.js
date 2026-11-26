/* Match in-page destinations to the same atlas used by Jump to. */
export function mountWorkspaceIcons({root, page, destinationArt, controlRoute, navigationIcon}) {
  const isWorkspace = page === 'v4.html';
  const anchorArt = {
    'quarterly-dashboard':'chart', 'quarterly-filings':'filing', 'disclosure-charts':'filing',
    'solvency-ranking':'scales', 'quarter-solvency-ranking':'scales', statements:'filing',
    checklist:'review', 'annual-maturity':'maturity', 'annual-revenue-mix':'earnings',
    'quarter-revenue-mix':'earnings', 'heading-quarter-geography':'globe',
    'sb2-detail':'history', 'sb2-pe-rankings':'index', financials:'filing',
    'statement-comparisons':'compare', market:'pricing', peers:'compare', credit:'credit',
    sources:'source', 'comparison-lab':'compare', 'price-simulator':'calc',
    'chart-section':'chart', charts:'chart', 'series-library':'database', universe:'database',
    'data-coverage':'source', 'hf-library':'database', 'grouped-signals':'signal',
    'event-replay':'replay', method:'source', 'series-records':'chart', 'native-records':'database'
  };
  // These rules describe analytical subjects. Exact routes and section anchors take precedence.
  const subjects = [
    [/yield curve|historical curves/i,'curves'], [/treasur|government debt/i,'treasury'],
    [/spreads?|credit|\bOAS\b|default|arrears|delinquen/i,'credit'],
    [/yield|\brates?\b/i,'yield'], [/cash ?flows?|cash generation/i,'cashflow'],
    [/\bfx\b|currenc|dollar index/i,'fx'], [/earning|profit|revenue|income statement/i,'earnings'],
    [/balance sheet|solvency|leverage/i,'scales'], [/maturit|tenor/i,'maturity'],
    [/filing|statements?/i,'filing'], [/share price|stock price|equities/i,'ticker'],
    [/valuation|p\/e|price/i,'pricing'], [/watchlist|favourites?/i,'watch'],
    [/report|write.up/i,'report'], [/sector|geograph|global|trade/i,'globe'],
    [/compare|comparison|peers/i,'compare'], [/breach|signal|inflation/i,'signal'],
    [/risk|focus queue|closer look/i,'radar'], [/replay/i,'replay'], [/timeline|history/i,'history'],
    [/archive|datasets?|data table|series library|records/i,'database'],
    [/method|source|coverage|definitions|guide/i,'source'], [/charts?/i,'chart'],
    [/forecast|scenario/i,'strategy'], [/fundamental|checklist/i,'review'],
    [/portfolio|holdings/i,'folio'], [/funding|liquidity|bank/i,'fred']
  ];
  const subject = (label, fallback) => subjects.find(([term]) => term.test(label))?.[1] || fallback;
  const sectionKey = id => destinationArt[page + '#' + id] || anchorArt[id] || (['overview','workspace','page-title','main'].includes(id) ? pageKey() : null);
  function pageKey() {
    if (isWorkspace && !/^#(?:credit|ust|watchlist|earnings|history)(?:\/|$)/.test(location.hash)) return null;
    const key = destinationArt[isWorkspace ? page + location.hash : page];
    return key || (!isWorkspace && page === 'fred-feed.html' ? 'database' : null);
  }
  const cards = 'button.metric-card, button.attention-item, button.event[data-event], a.preview, [data-card-target]';
  const controls = '[role="tab"], .bb-tabs button, .sb2-metric-toggle button, [data-statement], [data-list], [data-expand-stock]';
  const disclosures = ['hf-observations','hf-event-detail','hf-methods','credit-panel','credit-report','sb-details','sb-coverage','sb-sigma-method',
    'sb2-history-table','sb2-public-peers','fund-statement','bb-returns','universe-panel',
    'form-section','reference-box','hf-library','daily-bonds-history'].map(c => 'details.' + c + ' > summary').join(',');
  const selector = ['h1','h2','h3','.group-card-head','a[href]',cards,controls,disclosures].join(',');
  const skip = 'footer,.hub-primary,.hub-sections-menu,.rail,.topbar,.skip,.skip-link,[class$="-skip"],a.brand,a.hf-brand,.sb-mast > a,table,.report-sheet,[data-company-logo-manual] .sb-identity h2';
  const relevant = node => node instanceof HTMLElement && node.matches(selector);

  function linkKey(el) {
    if (el.hasAttribute('download')) return null;
    const route = controlRoute(el).replace(/^fred\/index\.html(?=#|$)/,'fred/');
    if (destinationArt[route]) return destinationArt[route];
    const [target, fragment] = route.split('#');
    if (fragment && target === page) return sectionKey(fragment);
    return destinationArt[target];
  }

  function decorate(el) {
    const pageArt = pageKey();
    if (!pageArt || !el.isConnected || el.closest(skip)) return;
    let label = el, key;
    if (el.matches('a')) {
      key = linkKey(el);
      if (el.matches('.preview')) label = el.querySelector('.mini-head > span') || el;
      // Keep existing artwork and rich card layouts, placing the icon beside their text.
      else if (el.querySelector('h2,h3')) label = el.querySelector('h2,h3');
      else if (el.querySelector('img,svg:not(.workspace-icon)')) return;
    } else if (el.matches('h1')) {
      key = pageArt;
    } else if (el.matches('h2,h3,.group-card-head')) {
      if (el.closest('a[href]') || el.querySelector(':scope > a[href]')) return;
      if (el.closest('.sb-card-header,.sb-card-head,.sb2-card-header,.sb2-company,.sb-card-identity')) return;
      const design = el.closest('.design');
      const link = design?.querySelector('.design-copy a.button');
      const section = el.closest('section[id],article[id]');
      const mainHeading = section?.querySelector('h2,h3') === el;
      label = el.querySelector(':scope > button.dataset-open, :scope.group-card-head > strong') || el;
      key = (el.closest('.bb-card-head') && destinationArt['bonds-beta.html#bb-cards']) || (link && linkKey(link)) || sectionKey(el.id) || (mainHeading && sectionKey(section.id))
        || subject(el.textContent, pageArt);
    } else if (el.matches(cards)) {
      label = el.querySelector('.metric-top > span, :scope > strong') || el.querySelector(':scope > span') || el;
      key = subject(el.dataset.topic || label.textContent, pageArt);
    } else {
      const bondGroup = {all:'certificates', ust:'treasury', temasek:'buildings', other:'bonds'};
      const stockMetric = {price:'pricing', market_cap_usd_bn:'index', dividend_yield_pct:'yield'};
      const group = bondGroup[el.dataset.group] || stockMetric[el.dataset.metric] ||
        (el.hasAttribute('data-tenor') && 'maturity');
      key = sectionKey(el.getAttribute('aria-controls')) || sectionKey(el.parentElement.id) || group || subject(el.textContent, pageArt);
    }
    if (!key) return;
    const prev = label.querySelector(':scope > .workspace-icon');
    if (prev?.dataset.art === key || label.querySelector(':scope > .hub-nav-icon')) return;
    // Historical FRED chart titles already have a decorative line glyph in this slot.
    const oldGlyph = label.querySelector(':scope > svg.hf-icon[aria-hidden="true"]');
    if (!oldGlyph && label.querySelector(':scope > svg:not(.workspace-icon), :scope > img')) return;
    const icon = navigationIcon(key);
    const glyph = label.firstChild;
    if (glyph?.nodeType === Node.TEXT_NODE && /^[▤▥]\s/.test(glyph.data)) glyph.data = glyph.data.replace(/^[▤▥]\s*/, '');
    icon.classList.remove('hub-nav-icon','accumulator-beta-icon');
    icon.classList.add('workspace-icon');
    icon.dataset.art = key;
    if (prev || oldGlyph) (prev || oldGlyph).replaceWith(icon);
    else label.prepend(icon);
  }

  function scan(container) {
    if (!pageKey() || container.closest(skip)) return;
    if (relevant(container)) decorate(container);
    container.querySelectorAll(selector).forEach(decorate);
  }
  scan(root);
  // Dashboards rebuild cards and sometimes replace only their label. Visit just those
  // branches, and ignore changes produced by inserting our own decorative SVGs.
  new MutationObserver(records => {
    if (!pageKey()) return;
    const added = new Set(), relabelled = new Set();
    for (const {target, addedNodes} of records) {
      if (!target.isConnected || target.closest('svg')) continue;
      for (const node of addedNodes) {
        if (node instanceof HTMLElement) added.add(node);
        if (node instanceof HTMLElement || node.nodeType === Node.TEXT_NODE) {
          const control = target.closest(selector);
          if (control) relabelled.add(control);
        }
      }
    }
    for (const node of added) if (!added.has(node.parentElement) && node.isConnected) scan(node);
    relabelled.forEach(decorate);
  }).observe(root,{childList:true,subtree:true});
  if (isWorkspace) window.addEventListener('hashchange', () => scan(root));
}
