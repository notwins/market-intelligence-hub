/* Match in-page destinations to the same atlas used by Jump to. */
export function mountWorkspaceIcons({root, page, destinationArt, chapterArt, controlRoute, navigationIcon}) {
  const isWorkspace = page === 'v4.html';
  const blog = page === 'market-understanding/';
  const charts = page.startsWith('cross-market-history');
  const anchorArt = {
    'library-basics':'book', 'library-news':'wire', 'library-all':'notebook', 'library-older':'archive', 'my-thoughts':'pen',
    'published-research':'journal', 'research-additions':'papers', 'research-additions-jump':'papers',
    'overview-latest':'papers', 'company-dashboard-title':'watch', 'market-snapshot':'markets',
    'price-path':'chart', 'chart-title':'chart', 'market-title':'markets', 'sector-title':'shares',
    'watchlist-title':'watch', methods:'source', current:'quotes', 'sgs-report':'bonds',
    'event-2024-09-18':'event', library:'library', compare:'compare', chartTitle:'chart',
    'delivery-sales-title':'cashflow', 'client-sheet':'report', 'nvda-stress-context':'chip',
    'notes-and-terms':'notebook', 'accumulator-guide':'book', 'holdings-note':'folio',
    calculator:'calc', si:'pricing', sn:'filing', ra:'capital', life:'retire', mechanics:'calc',
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
  const sectionKey = id => destinationArt[page + '#' + id] || (blog && chapterArt[id]) || anchorArt[id] || (['overview','workspace','page-title','main'].includes(id) ? pageKey() : null);
  function pageKey() {
    if (page === 'desk.html') return destinationArt['desk.html#full-history'];
    const route = location.hash || '#overview';
    if (isWorkspace && !/^#(?:overview|policy|calls|headlines|hourly|reports|research|tools|feeds|credit|ust|watchlist|earnings|history)(?:\/|$)/.test(route)) return null;
    const key = destinationArt[isWorkspace ? page + route : page];
    return key || (!isWorkspace && page === 'fred-feed.html' ? 'database' : null);
  }
  const cards = 'button.metric-card, button.attention-item, button.event[data-event], a.preview, [data-card-target]';
  const controls = '[role="tab"], .bb-tabs button, .sb2-metric-toggle button, [data-statement], [data-list], [data-expand-stock]';
  const disclosures = ['hf-observations','hf-event-detail','hf-methods','credit-panel','credit-report','sb-details','sb-coverage','sb-sigma-method',
    'sb2-history-table','sb2-public-peers','fund-statement','bb-returns','universe-panel',
    'library-group','form-section','reference-box','hf-library','daily-bonds-history'].map(c => 'details.' + c + ' > summary').join(',');
  const actions = ['button[data-view]', '[data-ws-jump]', 'button[data-report]', '.history-tabs [data-tab]',
    'button[data-policy]', '.mu-filters [data-filter]', '.mu-card-actions button', 'button[data-scenario]',
    '.jump [data-jump]', '.history-jumps button', '.chart-panel [data-group]'].join(',');
  const selector = ['h1','h2','h3','.group-card-head','a[href]',cards,controls,disclosures,actions].join(',');
  const skip = 'footer,.mu-nav,.hub-side-item,.mih-colour-term,.mih-colour-chip,.company-search-link,[data-mih-tag],.hub-primary,.hub-sections-menu,.rail,.topbar,.skip,.skip-link,[class$="-skip"],a.brand,a.hf-brand,.sb-mast > a,table,.report-sheet,[data-company-logo-manual] .sb-identity h2';
  const relevant = node => node instanceof HTMLElement && node.matches(selector);

  const routeOf = link => controlRoute(link).replace(/\/index\.html(?=#|$)/, '/');

  function topicForCard(card) {
    if (!card) return null;
    const fullArticle = card.querySelector('.mu-card-actions a[href]');
    if (fullArticle) {
      const route = routeOf(fullArticle);
      const exact = destinationArt[route] || destinationArt[route.split('#')[0]];
      if (exact) return exact;
    }
    if (card.matches('.sr-credit,.briefing-credit')) return 'credit';
    if (card.matches('.sr-earnings,.briefing-earnings')) return 'earnings';
    if (card.matches('.hourly-story')) return 'hourly';
    if (card.matches('.policy-event,.policy-archive-card')) return 'policy';
    if (card.matches('.headline')) return 'wire';
    const title = card.querySelector('h2,h3,h4')?.textContent || '';
    return subject(title, blog ? 'pen' : 'papers');
  }

  function linkKey(el) {
    if (el.hasAttribute('download')) return null;
    const route = routeOf(el);
    if (destinationArt[route]) return destinationArt[route];
    const [target, fragment] = route.split('#');
    if (fragment && target === page) {
      const sectionArt = sectionKey(fragment);
      if (sectionArt || !el.closest('nav,.hero-links,.quote-actions,.cmp-tools,.days')) return sectionArt;
      const section = document.getElementById(fragment);
      if (section) return subject((section.matches('h1,h2,h3') ? section : section.querySelector('h2,h3'))?.textContent || el.textContent, pageKey());
    }
    if (destinationArt[target]) return destinationArt[target];
    if (el.matches('.tool-link')) return subject(el.querySelector('strong')?.textContent || el.textContent,'tools');
    if (/^(?:research|market-understanding)\//.test(target) || el.closest('.mu-card-actions,.rr-main,.featured-research,.result h2,.result h3')) {
      return topicForCard(el.closest('article,.result')) || 'papers';
    }
    if (el.closest('.headline,.hourly-story') && el.closest('h2,h3,.source-line,.headline')) return topicForCard(el.closest('article'));
    return null;
  }

  function actionKey(el, fallback) {
    const {view, tab, wsJump, filter, group, policy, report, jump} = el.dataset;
    if (view || tab) return destinationArt['v4.html#' + (view || 'history/' + tab)] || fallback;
    if (wsJump) return sectionKey(wsJump) || subject(el.textContent, fallback);
    if (filter && blog) return ({'All topics':'book',Singapore:'globe',Equities:'shares',Bonds:'bonds',Currency:'fx',Alternatives:'vault',Portfolio:'folio'})[filter];
    if (group && charts) return ({prices:'fx',yields:'yield',sectors:'shares',shares:'watch'})[group];
    if (policy) return 'policy';
    if (report || el.closest('.mu-card-actions')) return topicForCard(el.closest('article')) || fallback;
    if (el.hasAttribute('data-scenario')) return 'strategy';
    if (jump) return jump === 'history' ? 'history' : 'calendar';
    return subject(el.textContent, fallback);
  }

  function decorate(el) {
    const pageArt = pageKey();
    if (!pageArt || !el.isConnected || el.closest(skip)) return;
    let label = el, key;
    if (el.matches('a')) {
      if (el.querySelector(':scope > .hub-nav-icon,:scope > .accumulator-beta-icon,:scope > .history-nav-icon')) return;
      key = linkKey(el);
      if (el.matches('.preview')) label = el.querySelector('.mini-head > span') || el;
      // Keep existing artwork and rich card layouts, placing the icon beside their text.
      else if (el.querySelector('h2,h3')) label = el.querySelector('h2,h3');
      else if (el.matches('.tool-link,.mu-summary-grid a,.library-choices a,.days a')) label = el.querySelector('strong,b') || el;
      else if (el.querySelector('img,svg:not(.workspace-icon)')) return;
    } else if (el.matches('h1,.ws-intro > h2')) {
      key = pageArt;
    } else if (el.matches('h2,h3,.group-card-head')) {
      if (el.closest('a[href]') || el.querySelector(':scope > a[href]:not([data-mih-tag],.company-search-link)')) return;
      if (el.closest('.sb-card-header,.sb-card-head,.sb2-card-header,.sb2-company,.sb-card-identity')) return;
      const design = el.closest('.design');
      const link = design?.querySelector('.design-copy a.button');
      const section = el.closest('section[id],article[id]');
      const card = el.closest('.mu-writeup,.tools-browse .card,.sr-report-card,.hourly-story,.policy-event,.policy-archive-card');
      const cardLink = card?.querySelector('.mu-card-actions a[href],a.button[href]');
      const cardArt = (cardLink && linkKey(cardLink)) || topicForCard(card);
      const mainHeading = section?.querySelector('h2,h3') === el;
      label = el.querySelector(':scope > button.dataset-open, :scope.group-card-head > strong') || el;
      key = (el.closest('.bb-card-head') && destinationArt['bonds-beta.html#bb-cards']) || (link && linkKey(link)) || sectionKey(el.id) || (mainHeading && sectionKey(section.id))
        || cardArt || subject(el.textContent, pageArt);
    } else if (el.matches(actions)) {
      label = el.querySelector(':scope > strong') || el;
      key = actionKey(el, pageArt);
    } else if (el.matches(cards)) {
      label = el.querySelector('.metric-top > span, :scope > strong') || el.querySelector(':scope > span') || el;
      key = subject(el.dataset.topic || label.textContent, pageArt);
    } else {
      if (el.matches('.library-group > summary')) label = el.querySelector(':scope > strong') || el;
      const bondGroup = {all:'certificates', ust:'treasury', temasek:'buildings', other:'bonds'};
      const stockMetric = {price:'pricing', market_cap_usd_bn:'index', dividend_yield_pct:'yield'};
      const group = bondGroup[el.dataset.group] || stockMetric[el.dataset.metric] ||
        (el.hasAttribute('data-tenor') && 'maturity');
      key = sectionKey(el.getAttribute('aria-controls')) || sectionKey(el.parentElement.id) || group || subject(el.textContent, pageArt);
    }
    if (!key) return;
    if (el.matches('.tool-link')) {
      const glyph = label.querySelector(':scope > span[aria-hidden="true"]:first-child');
      if (glyph?.textContent.trim() === '∿') glyph.remove();
    }
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
