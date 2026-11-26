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
  const credit = ['Bonds & credit', 'v4.html#credit', '▤'];
  const treasury = ['UST selection desk', 'v4.html#ust', '◒'];
  const filingsLink = ['Shares Beta 3 · 10-K filings', 'stocks-beta3.html', '▤'];
  const siPrivateLink = ['SI Private', 'https://si-private.winstonnggw.chatgpt.site/', '🔒'];
  const watchlist = ['Bonds & shares watchlist', 'v4.html#watchlist'];
  const crossMarketRoute = /^cross-market-history(?:-beta2)?\.html(?:#|$)/;
  const newsLinks = [
    ['Daily briefing', 'v4.html#overview', '◫'],
    ['US earnings', 'v4.html#earnings', '◈'],
    credit,
    ['Central Banks / US Admin', 'v4.html#policy', '◎'],
    ['Calls', 'v4.html#calls', '✎']
  ];
  const sections = [
    ['Home', 'desk.html', '⌂', 'blue'], ['Tools', 'v4.html#tools', '↗', 'blue'], ['News', 'v4.html#overview', '◫', 'orange'],
    ['Shares', 'stocks-beta.html', '▥', 'green'], ['Bonds BETA', 'bonds-beta.html', '▥', 'maroon'],
    ['FRED', 'fred/', '⌁', 'purple'], ['Master Pivot', 'v4.html#master/pivot', '▦', 'blue'],
    ['Historical charts', 'cross-market-history.html', '↗', 'rose'],
    ['My Blog', 'market-understanding/', '▤', 'orange'], ['Markets', 'desk.html#markets', '◫', 'blue']
  ];
  const moreLinks = [
    ['News and research', [
      ...newsLinks, ['Hourly news', 'v4.html#hourly'], ['Research archive', 'archive.html'],
      ['Research editions', 'research-editions.html'], ['Search library', 'search.html']
    ], 'orange'],
    ['Stocks, bonds and pricing', [
      filingsLink, ['BOS monthly archive', 'bos-monthly.html'], ['Bond Cashflow Studio', 'bond-cashflow.html'], watchlist,
      treasury, ['SI pricing', 'v4.html#history/si'], ['SI BETA 2', 'si-beta2.html'],
      ['Security master', 'v4.html#master/explore'], ['Saved securities', 'saved-securities.html']
    ], 'green'],
    ['Tools', [siPrivateLink], 'blue'],
    ['Historical charts', [
      ['Cross-market history', 'cross-market-history.html'], ['Cross-Market History Beta 2', 'cross-market-history-beta2.html'],
      ['Gold charts', 'tools/gold-charts.html'],
      ['SI pricing data', 'v4.html#history/si'], ['SI 2 data', 'si-beta2.html#si-library'],
      ['Yield history', 'v4.html#history/yield'], ['Historical curves', 'v4.html#history/curves'],
      ['FX history', 'v4.html#history/fx'], ['Share prices', 'v4.html#history/shares'],
      ['Event studies', 'v4.html#history/beta2-shares'], ['History pivot', 'v4.html#history/beta4-shares'],
      ['SPX index', 'v4.html#history/spx'], ['Historical FRED', 'historical-fred.html']
    ], 'rose'],
    ['FRED and rates', [
      ['Historical FRED and Prices', 'historical-fred.html'], ['Fred-1 · Event Replay', 'fred-1.html'],
      ['Fred-2 · Response Matrix', 'fred-2.html'], ['Fred-3 · Transmission Desk', 'fred-3.html'],
      ['V1 Market Desk', 'fred/market-desk.html'], ['V2 Risk Observatory', 'fred/risk-observatory.html'],
      ['V3 Signal Review', 'fred/signal-review.html'], ['V4 Cross-Market Replay', 'fred/cross-market-replay.html'],
      ['Raw FRED data & citations', 'fred/data.html']
    ], 'purple'],
    ['Site', [['Site map', 'site-map.html'], ['External sources', 'external-sources.html'], ['Site tags', 'tag-map.html']], 'blue']
  ];
  const jumpGroups = new Map(moreLinks);
  const subsections = new Map([
    ['Home', [['Daily desk', 'desk.html#daily'], ['Watchlist news', 'desk.html#watchlist-end-day'], ['Article archive', 'desk.html#archive']]],
    ['Tools', [
      ['All tools & simulators', 'v4.html#tools'],
      ['NVDA Normal accumulator capital', 'tools/accumulator-capital.html', '▦'],
      ['NVDA SI Capital Flow & SOFR', 'tools/accumulator-si-flow.html', '∿'],
      ['NVDA Accumulator 3D pricing', 'tools/accumulator-3d.html', '⬡'],
      ['NVDA Accumulator', 'tools/accumulator.html', '∿'],
      ['XAU fixed coupon note', 'tools/xau-fcn.html', '◇'],
      ['GLD ETF accumulator', 'tools/gld-accumulator.html', '∿']
    ]],
    ['News', newsLinks],
    ['Shares', [
      ['Stocks BETA', 'stocks-beta.html', '▥'],
      ['Stocks BETA 2', 'stocks-beta2.html', '▥'],
      filingsLink,
      ['SI pricing', 'v4.html#history/si', '▧'],
      ['SI beta 2', 'si-beta2.html#si-library', '▧']
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
    [/^tools\/accumulator(?:-capital|-3d|-si-flow)?\.html$/, 'green'],
    [/^(?:stocks-beta[23]?\.html|bos-monthly\.html|si-beta2\.html|desk\.html#(?:stock-moves|main-company-cards)|v4\.html#history\/(?:shares|si|spx|beta[24]-shares))/, 'green'],
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

  function link(label, href, icon, tone) {
    const a = document.createElement('a'); a.href = new URL(href, base);
    if (tone) a.dataset.navTone = tone;
    if (href === 'tools/xau-fcn.html') a.classList.add('gold-tools-divider');
    if (icon) { const span = document.createElement('span'); span.textContent = icon; span.setAttribute('aria-hidden', 'true'); a.append(span); }
    a.append(document.createTextNode(label)); return a;
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

  sections.forEach(([name, href, icon, tone], index) => {
    const mainLink = link(name, href, icon);
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
    const button = document.createElement('button'); button.className = 'hub-primary-toggle';
    const panel = document.createElement('div'); panel.className = 'hub-primary-dropdown';
    panel.id = 'hub-primary-subsections-' + index;
    panel.hidden = true;
    panel.append(...links.map(([label, route, icon]) => link(label, route, icon, toneFor(route))));
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
  const main = document.createElement('div'); main.className = 'hub-menu-main';
  sections.forEach(([name, href, , tone]) => main.append(link(name, href, undefined, tone)));
  const grid = menu.querySelector('.more-grid');
  const destinations = document.createDocumentFragment();
  destinations.append(main);
  moreLinks.forEach(([title, links, tone]) => {
    const group = document.createElement('section');
    group.className = 'hub-menu-group';
    group.dataset.navTone = tone;
    const heading = document.createElement('h3');
    heading.className = 'more-group-title';
    heading.textContent = title;
    const items = document.createElement('div');
    items.className = 'hub-menu-items';
    items.append(...links.map(item => {
      const [name, href, icon] = item;
      return link(name, href, item === filingsLink || item === siPrivateLink ? icon : undefined, toneFor(href));
    }));
    group.append(heading, items);
    destinations.append(group);
  });
  if (old) {
    const label = document.createElement('h3');
    label.className = 'more-group-title';
    label.textContent = 'Full workspace shortcuts';
    destinations.append(label);
  }
  grid.prepend(destinations);
  for (const control of grid.querySelectorAll(':scope > a, :scope > button')) {
    control.dataset.navTone = toneFor(controlRoute(control), 'blue');
  }
  for (const control of document.querySelectorAll('.rail-group:not(.rail-history) > :is(a,button), .dashboard-links > a:not(.history-featured)')) {
    const tone = toneFor(controlRoute(control));
    if (tone) control.dataset.navTone = tone;
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
    const onWorkspace = relative === 'v4.html';
    const shares = ['stocks-beta.html', 'stocks-beta2.html', 'stocks-beta3.html', 'bos-monthly.html', 'si-beta2.html'].includes(relative)
      || (onWorkspace && route === '#history/si');
    const tools = relative.startsWith('tools/') || (onWorkspace && route === '#tools');
    root.classList.toggle('hub-tools-nav', tools);
    const key = tools ? 'Tools' : shares ? 'Shares'
      : relative.startsWith('fred/') || /^(?:historical-fred|fred-[123]|fred-feed)\.html$/.test(relative) ? 'FRED' : relative.startsWith('market-understanding/') ? 'My Blog'
      : ['bonds-beta.html','bond-cashflow.html'].includes(relative) || (onWorkspace && ['#credit', '#ust'].includes(route)) ? 'Bonds BETA'
      : /#master(?:\/|$)/.test(location.hash) ? 'Master Pivot' : /#history(?:\/|$)/.test(location.hash) || crossMarketRoute.test(relative) ? 'Historical charts'
      : onWorkspace && (route === '#hourly' || newsLinks.some(([, href]) => href === 'v4.html' + route)) ? 'News'
      : relative === 'desk.html' && location.hash === '#markets' ? 'Markets' : relative === 'desk.html' || relative === '' ? 'Home' : '';
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
  window.addEventListener('hashchange', active); window.addEventListener('resize', active); requestAnimationFrame(active);
})();
