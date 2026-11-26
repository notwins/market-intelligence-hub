/* Shared UI navigation. URLs remain native links, including Back/Forward. */
(() => {
  'use strict';
  if (document.documentElement.classList.contains('hub-primary-ready')) return;
  const root = document.documentElement;
  const preferences = [
    {
      key: 'market-hub-navigation-style',
      attribute: 'data-nav-style',
      options: ['professional', 'sections'],
      labels: {
        en: ['Navigation style', 'Professional', 'Section colours'],
        'zh-Hans': ['导航样式', '专业', '按栏目配色'],
        'zh-Hant': ['導覽樣式', '專業', '按欄目配色']
      }
    },
    {
      key: 'market-hub-navigation-size',
      attribute: 'data-nav-size',
      options: ['standard', 'compact'],
      labels: {
        en: ['Navigation size', 'Standard', 'Compact'],
        'zh-Hans': ['导航大小', '标准', '紧凑'],
        'zh-Hant': ['導覽大小', '標準', '緊湊']
      }
    }
  ];

  function applyPreference({attribute, options}, value) {
    const selected = options.includes(value) ? value : options[0];
    root.setAttribute(attribute, selected);
    for (const picker of document.querySelectorAll(`[${attribute}-picker]`)) picker.value = selected;
    return selected;
  }

  function savePreference(preference, value) {
    const selected = applyPreference(preference, value);
    try { localStorage.setItem(preference.key, selected); } catch { /* The setting still works on this page. */ }
  }

  for (const preference of preferences) {
    let saved;
    try { saved = localStorage.getItem(preference.key); } catch { /* Use the default when storage is unavailable. */ }
    applyPreference(preference, saved);
  }
  window.addEventListener('storage', event => {
    for (const preference of preferences) {
      if (event.key === preference.key || event.key === null) applyPreference(preference, event.newValue);
    }
  });
  document.addEventListener('click', event => {
    if (event.target.closest('#display-settings [data-display-reset]')) {
      for (const preference of preferences) savePreference(preference, preference.options[0]);
    }
  }, true);

  window.HubNavigationStyle = {
    mountSettings(dialog) {
      if (dialog.querySelector('.hub-navigation-preferences')) return;
      const section = document.createElement('section');
      section.className = 'display-section hub-navigation-preferences';
      for (const preference of preferences) {
        const {attribute, options, labels} = preference;
        const [title, ...optionLabels] = labels[root.lang] ?? labels.en;
        const label = document.createElement('label');
        const picker = document.createElement('select');
        picker.setAttribute(attribute + '-picker', '');
        options.forEach((value, index) => picker.add(new Option(optionLabels[index], value)));
        picker.value = root.getAttribute(attribute);
        picker.addEventListener('change', () => savePreference(preference, picker.value));
        label.append(document.createTextNode(title), picker);
        section.append(label);
      }
      const anchor = dialog.querySelector('.display-intro, header');
      if (anchor) anchor.after(section);
      else dialog.prepend(section);
    }
  };

  const base = new URL('./', document.currentScript.src);
  const pagePath = location.pathname.slice(base.pathname.length);
  const onDesk = pagePath === 'desk.html';
  const mobileDock = matchMedia('(max-width:760px)');
  const hasMobileDock = () => onDesk || root.classList.contains('hub-tools-nav');
  const credit = ['Bonds & credit', 'v4.html#credit'];
  const treasury = ['UST selection desk', 'v4.html#ust'];
  const filingsLink = ['Shares Beta 3 · 10-K filings', 'stocks-beta3.html'];
  const nvidiaHistory = ['NVIDIA Historical', 'nvda-history.html'];
  const siPrivateLink = ['SI Private', 'https://si-private.winstonnggw.chatgpt.site/'];
  const accumulatorBeta = ['NVDA Accumulator Beta 2', 'tools/accumulator-beta.html', {src:'tools/accumulator-beta-icon.svg'}];
  const watchlist = ['Bonds & shares watchlist', 'v4.html#watchlist'];
  const crossMarketRoute = /^cross-market-history(?:-beta2)?\.html(?:#|$)/;
  const newsLinks = [
    ['Daily briefing', 'v4.html#overview'],
    ['US earnings', 'v4.html#earnings'],
    credit,
    ['Central Banks / US Admin', 'v4.html#policy'],
    ['Calls', 'v4.html#calls']
  ];
  const sections = [
    ['Home', 'desk.html', 'home', 'blue'],
    ['Tools', 'v4.html#tools', 'tools', 'blue'],
    ['News', 'v4.html#overview', 'news', 'orange'],
    ['Shares', 'stocks-beta.html', 'shares', 'green'],
    ['Bonds BETA', 'bonds-beta.html', 'bonds', 'maroon'],
    ['FRED', 'fred/', 'fred', 'purple'],
    ['Master Pivot', 'v4.html#master/pivot', 'pivot', 'blue'],
    ['Historical charts', 'cross-market-history.html', 'history', 'rose'],
    ['My Blog', 'market-understanding/', 'book', 'orange'],
    ['Markets', 'desk.html#markets', 'markets', 'blue']
  ];
  const moreLinks = [
    ['News and research', [
      ...newsLinks, ['Hourly news', 'v4.html#hourly'], ['Research archive', 'archive.html'],
      ['Research editions', 'research-editions.html'], ['Search library', 'search.html']
    ], 'orange', 'news'],
    ['Stocks, bonds and pricing', [
      filingsLink, ['BOS monthly archive', 'bos-monthly.html'], ['Bond Cashflow Studio', 'bond-cashflow.html'], watchlist,
      treasury, ['SI pricing', 'v4.html#history/si'], ['SI BETA 2', 'si-beta2.html'],
      ['Security master', 'v4.html#master/explore'], ['Saved securities', 'saved-securities.html']
    ], 'green', 'shares'],
    ['Tools', [accumulatorBeta, siPrivateLink], 'blue', 'tools'],
    ['Historical charts', [
      ['Cross-market history', 'cross-market-history.html'], ['Cross-Market History Beta 2', 'cross-market-history-beta2.html'],
      ['Gold charts', 'tools/gold-charts.html'],
      ['SI pricing data', 'v4.html#history/si'], ['SI 2 data', 'si-beta2.html#si-library'],
      ['Yield history', 'v4.html#history/yield'], ['Historical curves', 'v4.html#history/curves'],
      ['FX history', 'v4.html#history/fx'], ['Share prices', 'v4.html#history/shares'], nvidiaHistory,
      ['Event studies', 'v4.html#history/beta2-shares'], ['History pivot', 'v4.html#history/beta4-shares'],
      ['SPX index', 'v4.html#history/spx'], ['Historical FRED', 'historical-fred.html']
    ], 'rose', 'history'],
    ['FRED and rates', [
      ['Historical FRED and Prices', 'historical-fred.html'], ['Fred-1 · Event Replay', 'fred-1.html'],
      ['Fred-2 · Response Matrix', 'fred-2.html'], ['Fred-3 · Transmission Desk', 'fred-3.html'],
      ['V1 Market Desk', 'fred/market-desk.html'], ['V2 Risk Observatory', 'fred/risk-observatory.html'],
      ['V3 Signal Review', 'fred/signal-review.html'], ['V4 Cross-Market Replay', 'fred/cross-market-replay.html'],
      ['Raw FRED data & citations', 'fred/data.html']
    ], 'purple', 'fred'],
    ['Site', [['Site map', 'site-map.html'], ['External sources', 'external-sources.html'], ['Site tags', 'tag-map.html']], 'blue', 'map']
  ];
  const jumpGroups = new Map(moreLinks);
  const subsections = new Map([
    ['Home', [['Daily desk', 'desk.html#daily'], ['Daily automation reports', 'desk.html#daily-dashboards'], ['Watchlist news', 'desk.html#watchlist-end-day'], ['Article archive', 'desk.html#archive']]],
    ['Tools', [
      accumulatorBeta,
      ['All tools & simulators', 'v4.html#tools'],
      ['NVDA Normal accumulator capital', 'tools/accumulator-capital.html'],
      ['NVDA SI Capital Flow & SOFR', 'tools/accumulator-si-flow.html'],
      ['NVDA Accumulator 3D pricing', 'tools/accumulator-3d.html'],
      ['NVDA Accumulator', 'tools/accumulator.html'],
      ['XAU fixed coupon note', 'tools/xau-fcn.html'],
      ['GLD ETF accumulator', 'tools/gld-accumulator.html']
    ]],
    ['News', newsLinks],
    ['Shares', [
      ['Stocks BETA', 'stocks-beta.html'],
      ['Stocks BETA 2', 'stocks-beta2.html'],
      filingsLink, nvidiaHistory,
      ['SI pricing', 'v4.html#history/si'],
      ['SI beta 2', 'si-beta2.html#si-library']
    ]],
    ['Bonds BETA', [['Bond history cards', 'bonds-beta.html#bb-cards'], ['Bond Cashflow Studio', 'bond-cashflow.html'], credit, treasury, watchlist]],
    ['FRED', jumpGroups.get('FRED and rates')],
    ['Master Pivot', [
      ['Explore securities', 'v4.html#master/explore'], ['Master Pivot', 'v4.html#master/pivot'],
      ['Watchlists', 'v4.html#master/watchlists'], ['Screens', 'v4.html#master/screens'], ['Review', 'v4.html#master/review']
    ]],
    ['Historical charts', jumpGroups.get('Historical charts')],
    ['My Blog', [['Latest research', 'market-understanding/#main-published-research'], ['Research explained', 'market-understanding/#research-readings'], ['My research', 'market-understanding/#my-research']]],
    ['Markets', [['Stock moves', 'desk.html#stock-moves'], ['Rates and FX', 'desk.html#market-rates'], ['Bond yields', 'desk.html#market-bonds']]]
  ]);
  const additionalSubsections = [
    ["Home", [
      ["Company news", "desk.html#reading"],
      ["Version 2", "v2.html"],
    ]],
    ["Tools", [
      ["CPF LIFE & RA Modelling", "tools/cpf-life-ra.html"],
      ["Coloured tag & event tree", "tag-map.html"],
      ["V3 Colour map & research templates", "colour-templates-v3/"],
      ["Colour & tag reference", "colour-reference.html"],
      ["External sources", "external-sources.html"],
      ["Data & uploads", "v4.html#feeds"],
    ]],
    ["News", [
      ["Scheduled reports", "v4.html#reports"],
      ["Reuters coverage", "v4.html#headlines"],
      ["White Papers & Research Papers", "v4.html#research"],
      ["Hourly news", "v4.html#hourly"],
      ["Research archive", "archive.html"],
      ["Revisions and Part 2 companions", "research-editions.html"],
      ["Search articles & tags", "search.html"],
    ]],
    ["Bonds BETA", [
      ["Bonds BETA", "bonds-beta.html"],
    ]],
    ["Shares", [
      ["BOS monthly archive", "bos-monthly.html"],
      ["SI BETA 2", "si-beta2.html"],
      ["Saved securities", "saved-securities.html"],
    ]],
    ["Master Pivot", [
      ["Security master", "v4.html#master"],
    ]],
    ["Historical charts", [
      ["Full history desk", "desk.html#full-history"],
      ["Historical charts", "v4.html#history"],
    ]],
    ["My Blog", [
      ["Gold buyers, forecasts & SGD returns", "research/xau-gold-outlook-2026-11-06/"],
      ["Alphabet company research", "research/googl/"],
      ["Wealth inequality", "research/wealth-inequality-2026-11-04/"],
      ["Sharpe, portfolios & leverage", "research/wealth-inequality-2026-11-04/sharpe.html"],
      ["CPF OA vs Temasek 2070", "research/cpf-oa-temasek-2070-2026-11-04/"],
      ["CPF LIFE after 55", "research/cpf-life-after-55-2026-11-04/"],
    ]],
  ];
  for (const [name, links] of additionalSubsections) subsections.set(name, [...subsections.get(name), ...links]);

  // Complete Jump to from the same subsection lists as the header.
  const jumpSections = [
    ['Daily desk', ['Home', 'Markets'], 'blue', 'home'],
    ['Tools', ['Tools'], 'blue', 'tools'],
    ['Stocks, bonds and pricing', ['Shares', 'Bonds BETA', 'Master Pivot'], 'green', 'shares'],
    ['News and research', ['News'], 'orange', 'news'],
    ['Historical charts', ['Historical charts'], 'rose', 'history'],
    ['My Blog', ['My Blog'], 'orange', 'pen']
  ];
  const listed = new Set(moreLinks.flatMap(([, links]) => links.map(([, href]) => href)));
  for (const [title, names, tone, art] of jumpSections) {
    const group = moreLinks.find(([label]) => label === title);
    const links = group ? [...group[1]] : [];
    for (const name of names) {
      for (const item of subsections.get(name)) {
        if (listed.has(item[1])) continue;
        links.push(item);
        listed.add(item[1]);
      }
    }
    if (group) group[1] = links;
    else if (links.length) moreLinks.push([title, links, tone, art]);
  }
  const routeTones = [
    [/^tools\/accumulator(?:-beta|-capital|-3d|-si-flow)?\.html$/, 'green'],
    [/^(?:stocks-beta[23]?\.html|bos-monthly\.html|si-beta2\.html|nvda-history\.html|desk\.html#(?:stock-moves|main-company-cards)|v4\.html#history\/(?:shares|si|spx|beta[24]-shares))/, 'green'],
    [/^(?:bonds-beta\.html|bond-cashflow\.html|desk\.html#(?:market-bonds|yield-curves)|v4\.html#(?:credit|ust|history\/(?:yield|curves)))/, 'maroon'],
    [/^(?:fred\/|(?:historical-fred|fred-[123]|fred-feed)\.html)/, 'purple'],
    [crossMarketRoute, 'rose'],
    [/^(?:desk\.html#full-history|v4\.html#history$)/, 'rose'],
    [/^(?:v4\.html#(?:overview|earnings|policy|calls|hourly|headlines|reports|research)|market-understanding\/|archive\.html|research-editions\.html)/, 'orange'],
    [/^(?:v4\.html#(?:master|tools|watchlist|history\/fx)|desk\.html#market-rates|saved-securities\.html)/, 'blue']
  ];
  const toneFor = (href, fallback) => routeTones.find(([pattern]) => pattern.test(href))?.[1] ?? fallback;
  function controlRoute(control) {
    if (control.dataset.view) return 'v4.html#' + control.dataset.view;
    const href = control.getAttribute('href');
    if (!href) return '';
    const url = new URL(href, location.href);
    return url.origin === base.origin && url.pathname.startsWith(base.pathname)
      ? url.pathname.slice(base.pathname.length) + url.hash : url.href;
  }

  const destinationArt = {
    "fred/": "fred",
    "fred/market-desk.html": "monitor",
    "fred/risk-observatory.html": "radar",
    "fred/signal-review.html": "signal",
    "fred/cross-market-replay.html": "replay",
    "fred/data.html": "database",
    "desk.html": "home",
    "desk.html#daily": "sunrise",
    "desk.html#daily-dashboards": "dashboard",
    "desk.html#reading": "buildings",
    "desk.html#watchlist-end-day": "closebell",
    "desk.html#archive": "library",
    "desk.html#markets": "markets",
    "desk.html#stock-moves": "movers",
    "desk.html#market-rates": "quotes",
    "desk.html#market-bonds": "maturity",
    "desk.html#full-history": "chronicle",
    "market-understanding/": "pen",
    "market-understanding/#main-published-research": "journal",
    "market-understanding/#research-readings": "book",
    "market-understanding/#my-research": "notebook",
    "v4.html#history": "history",
    "v4.html#calls": "calls",
    "v4.html#master": "catalog",
    "v4.html#master/explore": "security",
    "v4.html#master/pivot": "pivot",
    "v4.html#master/watchlists": "watch",
    "v4.html#master/screens": "screen",
    "v4.html#master/review": "review",
    "v4.html#history/yield": "yield",
    "v4.html#history/shares": "ticker",
    "v4.html#history/beta2-shares": "event",
    "v4.html#history/beta4-shares": "layers",
    "v4.html#history/fx": "fx",
    "v4.html#history/curves": "curves",
    "v4.html#history/spx": "index",
    "v4.html#history/si": "pricing",
    "historical-fred.html": "timeline",
    "fred-1.html": "rewind",
    "fred-2.html": "matrix",
    "fred-3.html": "network",
    "v4.html#ust": "treasury",
    "v4.html#watchlist": "bookmark",
    "v4.html#overview": "briefing",
    "v4.html#earnings": "earnings",
    "v4.html#credit": "credit",
    "v4.html#policy": "policy",
    "v4.html#reports": "calendar",
    "v4.html#hourly": "hourly",
    "v4.html#headlines": "wire",
    "v4.html#research": "papers",
    "research/xau-gold-outlook-2026-11-06/": "prospect",
    "research-editions.html": "editions",
    "research/googl/": "browser",
    "research/wealth-inequality-2026-11-04/": "scales",
    "research/wealth-inequality-2026-11-04/sharpe.html": "strategy",
    "research/cpf-oa-temasek-2070-2026-11-04/": "balance",
    "research/cpf-life-after-55-2026-11-04/": "retire",
    "tools/cpf-life-ra.html": "calc",
    "tools/mortgage.html": "calc",
    "v4.html#tools": "tools",
    "tag-map.html": "tags",
    "colour-templates-v3/": "palette",
    "colour-reference.html": "swatch",
    "search.html": "search",
    "external-sources.html": "source",
    "v4.html#feeds": "upload",
    "archive.html": "archive",
    "saved-securities.html": "saved",
    "v2.html": "legacy",
    "stocks-beta.html": "shares",
    "stocks-beta2.html": "compare",
    "stocks-beta3.html": "filing",
    "nvda-history.html": "chip",
    "si-beta2.html": "vault",
    "si-beta2.html#si-library": "cabinet",
    "bonds-beta.html": "bonds",
    "bonds-beta.html#bb-cards": "certificates",
    "bond-cashflow.html": "cashflow",
    "bos-monthly.html": "folio",
    "tools/accumulator-beta.html": "accumulator-beta",
    "tools/accumulator-capital.html": "capital",
    "tools/accumulator-si-flow.html": "flow",
    "tools/accumulator-3d.html": "cube",
    "tools/accumulator.html": "ladder",
    "tools/xau-fcn.html": "coupon",
    "tools/gld-accumulator.html": "etf",
    "tools/gold-charts.html": "gold",
    "cross-market-history.html": "cross",
    "cross-market-history-beta2.html": "exchange",
    "site-map.html": "map",
    "blueprint.html": "blueprint",
    "v4.html#home": "home",
    "v4.html#tags": "tags",
    "v4.html#sources": "source",
    "v4.html#bonds": "bonds",
    "v4.html#markets": "markets",
    "v4.html#search": "search",
    "desk.html#main-company-cards": "buildings",
    "desk.html#main-news": "news",
    "desk.html#yield-curves": "curves",
    "desk.html#briefing": "briefing",
    "desk.html#market-history": "history",
    "desk.html#historical-charts": "history",
    "desk.html#reports": "calendar",
    "desk.html#hourly-briefings": "hourly"
  };
  const routeArtwork = [
    [/^desk\.html#(?:markets|stock-moves|main-company-cards|market-rates)/, 'markets'],
    [/^desk\.html#(?:archive|watchlist-end-day)|^(?:archive|research-editions|bos-monthly)\.html/, 'archive'],
    [/^desk\.html#(?:daily|main-news)|^v4\.html#(?:overview|hourly|headlines|reports|earnings)/, 'news'],
    [/^(?:search|external-sources)\.html/, 'search'],
    [/^(?:site-map|tag-map|blueprint)\.html/, 'map'],
    [/^https:\/\/si-private\./, 'lock'],
    [/^tools\/(?:gold-charts|gld-accumulator|xau-fcn)\.html/, 'gold'],
    [/^tools\/|^v4\.html#tools/, 'tools'],
    [/^v4\.html#master(?:\/|$)|^saved-securities\.html/, 'pivot'],
    [/^market-understanding\/|^v4\.html#(?:calls|research)/, 'book'],
    [/^(?:fred\/|historical-fred\.html|fred-[123]\.html|fred-feed\.html)|^v4\.html#policy/, 'fred'],
    [/^(?:bonds-beta|bond-cashflow)\.html|^desk\.html#market-bonds|^v4\.html#(?:credit|ust|history\/(?:yield|curves))/, 'bonds'],
    [/^(?:stocks-beta[23]?|nvda-history|si-beta2)\.html|^v4\.html#history\/(?:si|shares|spx|beta[24]-shares)/, 'shares'],
    [/^cross-market-history|^desk\.html#full-history|^v4\.html#history/, 'history'],
    [/^desk\.html$/, 'home']
  ];
  const artFor = (href, fallback = 'chart') => destinationArt[href] ?? routeArtwork.find(([pattern]) => pattern.test(href))?.[1] ?? fallback;
  function navigationIcon(key) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('hub-nav-icon');
    const picture = document.createElementNS(ns, 'use');
    picture.setAttribute('href', new URL('assets/navigation-atlas.svg?v=2#' + key, base).href);
    svg.append(picture);
    return svg;
  }
  function destinationPicture(key, brandedIcon = key === 'accumulator-beta' ? accumulatorBeta[2] : null) {
    if (!brandedIcon?.src) return navigationIcon(key);
    const image = document.createElement('img');
    image.className = 'accumulator-beta-icon';
    image.src = new URL(brandedIcon.src, base);
    image.alt = '';
    image.width = image.height = 24;
    return image;
  }
  function addIcon(control, key, brandedIcon) {
    if (control.querySelector(':scope > .hub-nav-icon, :scope > .accumulator-beta-icon')) return;
    control.dataset.navArt = key;
    control.prepend(destinationPicture(key, brandedIcon));
  }
  function link(label, href, {art = artFor(href), tone, brandedIcon} = {}) {
    const a = document.createElement('a');
    a.href = new URL(href, base);
    if (tone) a.dataset.navTone = tone;
    if (href === 'tools/xau-fcn.html') a.classList.add('gold-tools-divider');
    addIcon(a, art, brandedIcon);
    a.append(document.createTextNode(label));
    return a;
  }
  const chapterArt = {
    'mu-starting-point': 'book', 'mu-singapore-growth': 'index', 'mu-inflation-sgd': 'fx',
    'mu-ai-financing': 'chip', 'mu-equity-concentration': 'shares', 'mu-bond-duration': 'maturity',
    'mu-credit-spread': 'credit', 'mu-fx-return': 'quotes', 'mu-public-finances': 'balance',
    'mu-mas-accounts': 'policy', 'mu-gic-temasek': 'buildings', 'mu-temasek-bonds': 'bonds',
    'mu-alternatives-liquidity': 'vault', 'mu-private-credit': 'cashflow', 'mu-portfolio-actions': 'strategy',
    'mu-audit': 'review', 'mu-glossary': 'library', 'mu-sources': 'source', 'mu-disclosures': 'papers'
  };
  function decorateSideMenus() {
    const railLabels = {
      'rail-group-1': 'news', 'rail-group-2': 'editions', 'rail-group-3': 'book',
      'rail-group-history': 'history', 'rail-group-0': 'pivot',
      'rail-group-securities': 'security', 'rail-group-fred': 'fred'
    };
    const blueprintViews = {overview: 'blueprint', pages: 'map', flows: 'flow', changes: 'history', software: 'tools'};
    function useSideArt(control, key) {
      const existing = control.querySelector(':scope > svg.history-nav-icon use');
      if (existing) {
        control.dataset.navArt = existing.getAttribute('href').split('#').at(-1);
      } else {
        addIcon(control, key);
      }
      control.classList.add('hub-side-item');
    }
    function clearLegacyGlyph(control) {
      control.querySelector(':scope > .nav-glyph')?.remove();
      const first = control.firstChild;
      // Some legacy controls put a bare symbol directly before their label.
      if (first?.nodeType === 3 && /^\s*[^\p{Letter}\p{Number}\s]{1,3}\s*$/u.test(first.textContent)) first.remove();
    }
    for (const rail of document.querySelectorAll('.rail > nav:not(#section-jump)')) {
      rail.classList.add('hub-side-menu');
      for (const heading of rail.querySelectorAll('.rail-group-label')) {
        const key = railLabels[heading.id] || 'map';
        heading.dataset.navArt = key;
        useSideArt(heading.querySelector('a') || heading, key);
      }
      for (const control of rail.querySelectorAll('a,button,summary')) {
        if (control.classList.contains('hub-side-item') || control.closest('#section-jump')) continue;
        clearLegacyGlyph(control);
        const route = controlRoute(control);
        const tone = toneFor(route);
        if (tone) control.dataset.navTone = tone;
        useSideArt(control, artFor(route, 'map'));
      }
      const syncCurrent = () => {
        for (const button of rail.querySelectorAll('button[data-view]')) {
          if (button.classList.contains('active')) button.setAttribute('aria-current', 'page');
          else button.removeAttribute('aria-current');
        }
      };
      syncCurrent();
      new MutationObserver(syncCurrent).observe(rail, {subtree:true, attributes:true, attributeFilter:['class']});
    }

    const directory = document.querySelector('.desk-directory');
    if (directory) {
      directory.classList.add('hub-side-directory');
      useSideArt(directory.querySelector('summary'), 'map');
      for (const heading of directory.querySelectorAll('[data-side-heading]')) useSideArt(heading, heading.dataset.sideHeading);
      for (const control of directory.querySelectorAll('a[data-desk-nav]')) useSideArt(control, artFor(controlRoute(control), 'map'));
    }

    for (const side of document.querySelectorAll('.mu-nav,.readside')) {
      const research = side.classList.contains('mu-nav');
      side.classList.add('hub-side-reading');
      useSideArt(side.querySelector('h2'), research ? 'book' : 'library');
      const localLinks = [...side.querySelectorAll('a[href^="#"]')];
      for (const link of side.querySelectorAll('a[href]')) {
        if (research) link.querySelector(':scope > span')?.setAttribute('aria-hidden', 'true');
        const fragment = link.hash.slice(1);
        const key = chapterArt[fragment] || (/bond/.test(fragment) ? 'bonds' : /shares|equity/.test(fragment) ? 'shares'
          : /privacy|account|consent/.test(fragment) ? 'lock' : /sources?|dates?|verif/.test(fragment) ? 'source'
            : /risk/.test(fragment) ? 'radar' : 'papers');
        useSideArt(link, link.getAttribute('href').startsWith('#') ? key : artFor(controlRoute(link), 'library'));
      }
      const syncChapter = () => {
        for (const link of localLinks) {
          if (link.hash === location.hash) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        }
      };
      syncChapter();
      window.addEventListener('hashchange', syncChapter);
    }

    for (const button of document.querySelectorAll('.atlas-sidebar #views button[data-view]')) {
      clearLegacyGlyph(button);
      useSideArt(button, blueprintViews[button.dataset.view] || 'blueprint');
    }
    for (const [selector, key] of [['.attention-panel .rail-heading h2', 'radar'], ['.series-panel .rail-heading h2', 'database']]) {
      const heading = document.querySelector('.monitor-rail ' + selector);
      if (heading) useSideArt(heading, key);
    }
  }
  decorateSideMenus();

  const old = document.querySelector('.bottom-nav');
  const bar = old || document.createElement('nav');
  const more = old?.querySelector('button#more-btn') || document.createElement('button');
  bar.className = 'bottom-nav hub-primary'; bar.setAttribute('aria-label', 'Main sections');
  const scroll = document.createElement('div'); scroll.className = 'hub-primary-scroll';
  const primaryLinks = new Map();
  let openMenu;

  function closeMenu() {
    if (!openMenu) return;
    if (openMenu.panel.hasAttribute('popover')) openMenu.panel.hidePopover?.();
    openMenu.panel.hidden = true;
    openMenu.button.setAttribute('aria-expanded', 'false');
    openMenu = undefined;
  }

  function positionMenu() {
    if (!openMenu) return;
    const {group, panel} = openMenu;
    const anchor = group.getBoundingClientRect(), viewport = scroll.getBoundingClientRect();
    if (anchor.right <= viewport.left || anchor.left >= viewport.right) {
      closeMenu();
      return;
    }
    const docked = hasMobileDock() && mobileDock.matches;
    panel.style.top = docked ? 'auto' : anchor.bottom + 'px';
    panel.style.bottom = docked ? window.innerHeight - anchor.top + 'px' : 'auto';
    panel.style.left = Math.max(8, Math.min(anchor.left, document.documentElement.clientWidth - panel.offsetWidth - 8)) + 'px';
  }

  sections.forEach(([name, href, art, tone], index) => {
    const mainLink = link(name, href);
    mainLink.className = 'hub-primary-link';
    primaryLinks.set(name, mainLink);
    const links = subsections.get(name);
    if (!links?.length) {
      mainLink.dataset.navTone = tone;
      scroll.append(mainLink);
      return;
    }
    const group = document.createElement('div'); group.className = 'hub-primary-group';
    group.dataset.navTone = tone;
    group.dataset.navArt = mainLink.dataset.navArt;
    const button = document.createElement('button'); button.className = 'hub-primary-toggle';
    const panel = document.createElement('div'); panel.className = 'hub-primary-dropdown';
    panel.id = 'hub-primary-subsections-' + index;
    panel.hidden = true;
    panel.append(...links.map(([label, route, brandedIcon]) => link(label, route, {art: artFor(route, art), tone: toneFor(route, tone), brandedIcon})));
    button.type = 'button';
    button.setAttribute('aria-label', name + ' subsections');
    button.setAttribute('aria-controls', panel.id);
    button.setAttribute('aria-expanded', 'false');
    group.append(mainLink, button, panel);
    scroll.append(group);

    function open(pinned) {
      if (openMenu?.group !== group) closeMenu();
      openMenu = {group, panel, button, pinned};
      panel.hidden = false;
      if (hasMobileDock()) {
        panel.setAttribute('popover', 'manual');
        panel.showPopover?.();
      } else {
        panel.removeAttribute('popover');
      }
      button.setAttribute('aria-expanded', 'true');
      positionMenu();
    }
    group.addEventListener('pointerenter', e => {
      if (e.pointerType === 'mouse' && openMenu?.group !== group) open(false);
    });
    group.addEventListener('pointerleave', e => {
      if (e.pointerType === 'mouse' && openMenu?.group === group && !openMenu.pinned &&
        !panel.contains(document.activeElement)) closeMenu();
    });
    button.addEventListener('click', () => {
      if (openMenu?.group === group && openMenu.pinned) closeMenu();
      else open(true);
    });
    group.addEventListener('focusout', e => {
      if (openMenu?.group === group && !group.contains(e.relatedTarget)) closeMenu();
    });
    group.addEventListener('click', e => {
      if (openMenu?.group === group && e.target.closest('a')) closeMenu();
    });
  });
  document.addEventListener('pointerdown', e => {
    if (openMenu && !openMenu.group.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !openMenu) return;
    const {panel, button} = openMenu;
    if (panel.contains(document.activeElement)) button.focus({preventScroll: true});
    closeMenu();
    e.preventDefault();
  });
  scroll.addEventListener('scroll', positionMenu, {passive: true});
  if (onDesk) {
    const marketsTab = document.getElementById('tab-markets');
    let turningPoint = Math.max(0, window.scrollY);
    let compact = false;
    function setCompact(value, y) {
      compact = value;
      turningPoint = y;
      root.classList.toggle('hub-desk-scrolled-down', value);
      if (value && !mobileDock.matches) closeMenu();
    }
    function updateScrollDirection() {
      // Clamp Safari's overscroll so a bounce cannot reverse the detected direction.
      const limit = Math.max(0, root.scrollHeight - root.clientHeight);
      const y = Math.min(limit, Math.max(0, window.scrollY));
      if (marketsTab.getAttribute('aria-selected') !== 'true' || y === 0) setCompact(false, y);
      else if (compact && turningPoint - y >= 8) setCompact(false, y);
      else if (!compact && y - turningPoint >= 8) setCompact(true, y);
      else turningPoint = compact ? Math.max(turningPoint, y) : Math.min(turningPoint, y);
      positionMenu();
    }
    window.addEventListener('scroll', updateScrollDirection, {passive: true});
    window.addEventListener('hub-desk-route', () => setCompact(false, Math.max(0, window.scrollY)));
    root.classList.add('hub-desk-nav');
  } else {
    window.addEventListener('scroll', positionMenu, {passive: true});
  }
  more.type = 'button'; more.classList.add('hub-primary-more'); more.textContent = 'Jump to';
  addIcon(more, 'jump');
  more.setAttribute('aria-haspopup', 'dialog');
  let menu = document.querySelector('dialog#more:has(.more-grid)');
  if (!menu) {
    menu = document.createElement('dialog'); menu.id = 'hub-sections';
    menu.innerHTML = '<div class="dialog-head"><h2 id="hub-sections-title">Explore Market Intel</h2><button type="button" aria-label="Close menu">×</button></div><div class="more-grid"></div>';
    menu.setAttribute('aria-labelledby', 'hub-sections-title'); document.body.append(menu);
    menu.querySelector('button').addEventListener('click', () => menu.close());
    more.addEventListener('click', () => menu.showModal());
  }
  more.setAttribute('aria-controls', menu.id);
  menu.classList.add('hub-sections-menu');
  const menuHeading = menu.querySelector('.dialog-head h2');
  if (menuHeading) addIcon(menuHeading, 'jump');
  const main = document.createElement('div'); main.className = 'hub-menu-main';
  sections.forEach(([name, href, art, tone]) => main.append(link(name, href, {tone})));
  const grid = menu.querySelector('.more-grid');
  const destinations = document.createDocumentFragment();
  destinations.append(main);
  moreLinks.forEach(([title, links, tone, art]) => {
    const group = document.createElement('section');
    group.className = 'hub-menu-group';
    group.dataset.navTone = tone;
    const heading = document.createElement('h3');
    heading.className = 'more-group-title';
    heading.textContent = title;
    addIcon(heading, art);
    const items = document.createElement('div');
    items.className = 'hub-menu-items';
    items.append(...links.map(([name, href, brandedIcon]) => link(name, href, {art: artFor(href, art), tone: toneFor(href, tone), brandedIcon})));
    group.append(heading, items);
    destinations.append(group);
  });
  if (old) {
    const label = document.createElement('h3');
    label.className = 'more-group-title';
    label.textContent = 'Full workspace shortcuts';
    addIcon(label, 'pivot');
    destinations.append(label);
  }
  grid.prepend(destinations);
  function decorateJumpShortcuts() {
    for (const control of grid.querySelectorAll(':scope > a, :scope > button')) {
      const route = controlRoute(control);
      control.dataset.navTone = toneFor(route, 'blue');
      addIcon(control, control.matches('[data-site-settings-open], [data-display-open], #display-settings-open') ? 'settings' : artFor(route));
    }
  }
  decorateJumpShortcuts();
  new MutationObserver(decorateJumpShortcuts).observe(grid, {childList:true});
  for (const control of document.querySelectorAll('.dashboard-links > a:not(.history-featured), .tool-links > a.tool-link')) {
    const route = controlRoute(control);
    const tone = toneFor(route);
    if (tone) control.dataset.navTone = tone;
    const label = control.matches('.tool-link') ? control.querySelector('strong') || control : control;
    addIcon(label, artFor(route, control.closest('.dashboard-links') ? 'report' : 'map'));
  }
  const sectionTabs = document.querySelector('.top-subsections');
  if (sectionTabs) {
    const tabArt = {explore: 'security', pivot: 'pivot', watchlists: 'watch', screens: 'screen', review: 'review'};
    function decorateSubsections() {
      if (sectionTabs.classList.contains('history-menu-toolbar')) return;
      for (const tab of sectionTabs.querySelectorAll(':scope > [data-tab]')) {
        addIcon(tab, tabArt[tab.dataset.tab] || 'pivot');
      }
    }
    decorateSubsections();
    new MutationObserver(decorateSubsections).observe(sectionTabs, {childList:true});
  }
  const reportTabArt = {0: 'pivot', 10: 'chart', 11: 'bonds', 12: 'fx', 13: 'notebook', 14: 'database'};
  for (const tab of document.querySelectorAll('.report-tabs > [role=tab]')) {
    addIcon(tab, tab.id === 'compareTab' ? 'compare' : reportTabArt[tab.dataset.page] || 'chart');
  }
  for (const tab of document.querySelectorAll('.record-tabs > [role=tab]')) {
    addIcon(tab, tab.id === 'native-tab' ? 'database' : 'chart');
  }
  menu.addEventListener('click', e => { if (e.target.closest('a[href]')) menu.close(); });
  menu.addEventListener('close', () => more.focus({preventScroll: true}));
  bar.replaceChildren(scroll, more);
  const skip = document.querySelector('body > .skip, body > .skip-link');
  if (skip) skip.after(bar);
  else document.body.prepend(bar);
  document.documentElement.classList.add('hub-primary-ready');
  const workspaceToolbar = document.querySelector('.topbar');
  function active() {
    const relative = pagePath;
    const route = location.hash || '#overview';
    const deskMode = onDesk ? document.querySelector('.modebar [aria-selected=true]')?.dataset.mode : null;
    const onWorkspace = relative === 'v4.html';
    const shares = ['stocks-beta.html', 'stocks-beta2.html', 'stocks-beta3.html', 'bos-monthly.html', 'si-beta2.html', 'nvda-history.html'].includes(relative)
      || (onWorkspace && route === '#history/si');
    const tools = relative.startsWith('tools/') || (onWorkspace && route === '#tools');
    root.classList.toggle('hub-tools-nav', tools);
    const key = tools ? 'Tools' : shares ? 'Shares'
      : relative.startsWith('fred/') || /^(?:historical-fred|fred-[123]|fred-feed)\.html$/.test(relative) ? 'FRED' : relative.startsWith('market-understanding/') ? 'My Blog'
      : ['bonds-beta.html','bond-cashflow.html'].includes(relative) || (onWorkspace && ['#credit', '#ust'].includes(route)) ? 'Bonds BETA'
      : /#master(?:\/|$)/.test(location.hash) ? 'Master Pivot' : /#history(?:\/|$)/.test(location.hash) || crossMarketRoute.test(relative) ? 'Historical charts'
      : onWorkspace && (route === '#hourly' || newsLinks.some(([, href]) => href === 'v4.html' + route)) ? 'News'
      : deskMode === 'markets' ? 'Markets' : deskMode === 'full-history' ? 'Historical charts' : onDesk || relative === '' ? 'Home' : '';
    if (onWorkspace && workspaceToolbar) workspaceToolbar.dataset.navTone = toneFor(relative + route, 'blue');
    primaryLinks.forEach((a, name) => {
      if (name === key) {
        a.setAttribute('aria-current', 'page');
        const item = a.parentElement === scroll ? a : a.parentElement;
        const bounds = item.getBoundingClientRect(), viewport = scroll.getBoundingClientRect();
        if (bounds.left < viewport.left) scroll.scrollLeft += bounds.left - viewport.left;
        else if (bounds.right > viewport.right) scroll.scrollLeft += bounds.right - viewport.right;
      }
      else a.removeAttribute('aria-current');
    });
    positionMenu();
  }
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--hub-primary-height', bar.getBoundingClientRect().height + 'px');
    positionMenu();
  }).observe(bar);
  if (onDesk) new MutationObserver(active).observe(document.querySelector('.modebar'), {
    subtree: true, attributes: true, attributeFilter: ['aria-selected']
  });
  window.addEventListener('hashchange', active);
  window.addEventListener('resize', active);
  requestAnimationFrame(active);

  const page = pagePath.replace(/^(fred|market-understanding|colour-templates-v3)\/index\.html$/, '$1/');
  const standalone = /^(?:stocks-beta[23]?|nvda-history|si-beta2|bos-monthly|bonds-beta|bond-cashflow|historical-fred|fred-[123]|fred-feed|cross-market-history(?:-beta2)?|archive|research-editions|search|tag-map|colour-reference|external-sources|desk|v4)\.html$/;
  if (standalone.test(page) || page.startsWith('fred/') || page.startsWith('tools/') ||
      page === 'market-understanding/' || page === 'colour-templates-v3/') {
    const content = page === 'v4.html' ? document.getElementById('view')
      : page === 'desk.html' ? document.getElementById('full-history') : document.body;
    if (content) import(new URL('workspace-icons.js?v=2', base).href).then(({mountWorkspaceIcons}) => {
      mountWorkspaceIcons({root: content, page, destinationArt, chapterArt, controlRoute, navigationIcon: destinationPicture});
    });
  }
})();
