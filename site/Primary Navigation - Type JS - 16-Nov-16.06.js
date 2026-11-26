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
    ['Home', [['Daily desk', 'desk.html#daily'], ['Watchlist news', 'desk.html#watchlist-end-day'], ['Article archive', 'desk.html#archive']]],
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
    const href = control.getAttribute('href') || '';
    return href.startsWith('#') ? pagePath + href : href;
  }

  const artwork = {
    home: ['M4 10 12 3l8 7v10H4z', 'M2.5 11 12 3l9.5 8M9 20v-6h6v6M16.5 6V4h2v3.7'],
    tools: ['M4 7h16v12H4z', 'M8 7V4h8v3M4 12h16m-10 0v2h4v-2M4 7h16v12H4z'],
    news: ['M4 4h14v15H4z', 'M18 8h3v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h15v13a2 2 0 0 0 2 2M6.5 8h7M7 12h2m3 0h2M7 15h2m3 0h2'],
    shares: ['M4 13h4v6H4zm6-4h4v10h-4zm6-5h4v15h-4z', 'M2 20h20M4 16h4m2-3h4m2-4h4'],
    bonds: ['M4 4h16v14H4z', 'M7 8h10M7 11h5m4 0a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6Zm-1.5 4.1-.6 5 2.1-1.3 2.1 1.3-.6-5'],
    fred: ['M3 8 12 3l9 5zM5 17h14v3H5z', 'M3 8 12 3l9 5v2H3zm3 2v7m4-7v7m4-7v7m4-7v7M3 20h18M5 17h14'],
    pivot: ['M4 4h16v5H4zM4 9h5v11H4z', 'M4 4h16v16H4zm5 0v16M4 9h16m-11 5.5h11m-5.5-5.5v11'],
    history: ['M5.6 8a8 8 0 1 1 .4 10.2', 'M3 5v5h5M12 7v5l3 1.5m-9.4-5a8 8 0 1 1 .4 10.2'],
    book: ['M3 5c3.8-.3 6.8.9 9 3 2.2-2.1 5.2-3.3 9-3v13c-3.8-.1-6.5.8-9 2.5-2.5-1.7-5.2-2.6-9-2.5Z', 'M12 8v12m-6-11 3 1.1M6 13l3 1.1m6-4.1 3-1.1m-3 5.1 3-1.1'],
    markets: ['M4 10h4v7H4zm6-4h4v8h-4zm6 3h4v7h-4z', 'M2.5 21h19M6 7v3m0 7v2m6-16v3m0 8v3m6-11v3m0 7v3'],
    jump: ['M4 4h6v6H4zm0 10h6v6H4zm10 0h6v6h-6z', 'M14 4h6v6h-6zm3 1.5v3m-1.5-1.5h3'],
    map: ['M9 3h6v5H9zM3 15h6v5H3zm12 0h6v5h-6z', 'M12 8v4M6 15v-3h12v3'],
    search: ['M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z', 'm15.5 15.5 5 5'],
    lock: ['M5 10h14v10H5z', 'M8 10V7a4 4 0 0 1 8 0v3m-4 4v3'],
    settings: ['M10 3h4l.6 2.5 2 .9 2.4-.9 2 3.5-1.8 1.7v2.6l1.8 1.7-2 3.5-2.4-.9-2 .9L14 21h-4l-.6-2.5-2-.9-2.4.9-2-3.5 1.8-1.7v-2.6L3 9l2-3.5 2.4.9 2-.9Z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
    gold: ['M7 7h10l4 11H3Z', 'M6 14h12m-9-4h6'],
    chart: ['M4 18 9 11l4 3 6-8v12z', 'M3 4v16h18M5 16l4-5 4 3 6-8'],
    archive: ['M5 8h14v12H5zM3 4h18v4H3z', 'M9 12h6']
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
  const artFor = (href, fallback = 'chart') => routeArtwork.find(([pattern]) => pattern.test(href))?.[1] ?? fallback;
  function navigationIcon(key) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('hub-nav-icon');
    const [fill, detail] = artwork[key];
    for (const [shape, className] of [[fill, 'hub-nav-icon-fill'], [detail, 'hub-nav-icon-detail']]) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', shape);
      path.classList.add(className);
      svg.append(path);
    }
    return svg;
  }
  function addIcon(control, key, brandedIcon) {
    if (control.querySelector(':scope > .hub-nav-icon, :scope > .accumulator-beta-icon')) return;
    control.dataset.navArt = key;
    if (brandedIcon?.src) {
      const image = document.createElement('img');
      image.className = 'accumulator-beta-icon';
      image.src = new URL(brandedIcon.src, base);
      image.alt = '';
      image.width = image.height = 24;
      control.prepend(image);
    } else {
      control.prepend(navigationIcon(key));
    }
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
    const mainLink = link(name, href, {art});
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
    group.dataset.navArt = art;
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
  sections.forEach(([name, href, art, tone]) => main.append(link(name, href, {art, tone})));
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
      addIcon(control, control.hasAttribute('data-site-settings-open') || control.id === 'display-settings-open' ? 'settings' : artFor(route));
    }
  }
  decorateJumpShortcuts();
  new MutationObserver(decorateJumpShortcuts).observe(grid, {childList:true});
  for (const control of document.querySelectorAll('.rail-group:not(.rail-history) > :is(a,button), .dashboard-links > a:not(.history-featured)')) {
    const tone = toneFor(controlRoute(control));
    if (tone) control.dataset.navTone = tone;
  }
  const sectionTabs = document.querySelector('.top-subsections');
  if (sectionTabs) {
    const tabArt = {explore: 'search', pivot: 'pivot', watchlists: 'book', screens: 'map', review: 'archive'};
    function decorateSubsections() {
      if (sectionTabs.classList.contains('history-menu-toolbar')) return;
      for (const tab of sectionTabs.querySelectorAll(':scope > [data-tab]')) {
        addIcon(tab, tabArt[tab.dataset.tab] || 'pivot');
      }
    }
    decorateSubsections();
    new MutationObserver(decorateSubsections).observe(sectionTabs, {childList:true});
  }
  const reportTabArt = {0: 'pivot', 10: 'chart', 11: 'bonds', 12: 'markets', 13: 'book', 14: 'archive'};
  for (const tab of document.querySelectorAll('.report-tabs > [role=tab]')) {
    addIcon(tab, tab.id === 'compareTab' ? 'history' : reportTabArt[tab.dataset.page] || 'chart');
  }
  for (const tab of document.querySelectorAll('.record-tabs > [role=tab]')) {
    addIcon(tab, tab.id === 'native-tab' ? 'archive' : 'chart');
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
})();
