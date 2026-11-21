/* Shared UI navigation. URLs remain native links, including Back/Forward. */
(() => {
  'use strict';
  if (document.documentElement.classList.contains('hub-primary-ready')) return;
  const base = new URL('./', document.currentScript.src);
  const credit = ['Bonds & credit', 'v4.html#credit', '▤'];
  const treasury = ['UST selection desk', 'v4.html#ust', '◒'];
  const newsLinks = [
    ['Daily briefing', 'v4.html#overview', '◫'],
    ['US earnings', 'v4.html#earnings', '◈'],
    credit,
    ['Central Banks / US Admin', 'v4.html#policy', '◎'],
    ['Calls', 'v4.html#calls', '✎']
  ];
  const sections = [
    ['Home', 'desk.html', '⌂'], ['News', 'v4.html#overview', '◫'], ['Stocks BETA', 'stocks-beta.html', '▥'], ['Stocks BETA 2', 'stocks-beta2.html', '▥'], ['Bonds BETA', 'bonds-beta.html', '▥'], ['FRED', 'fred/', '⌁'],
    ['Master Pivot', 'v4.html#master/pivot', '▦'],
    ['Historical charts', 'cross-market-history.html', '↗'],
    ['My Blog', 'market-understanding/', '▤'], ['Markets', 'desk.html#markets', '◫']
  ];
  const moreLinks = [
    ['News and research', [
      ...newsLinks, ['Hourly news', 'v4.html#hourly'], ['Research archive', 'archive.html'],
      ['Research editions', 'research-editions.html'], ['Search library', 'search.html']
    ]],
    ['Stocks, bonds and pricing', [
      ['BOS monthly archive', 'bos-monthly.html'], ['Bond Cashflow Studio', 'bond-cashflow.html'], ['Bonds & shares watchlist', 'v4.html#watchlist'],
      treasury, ['SI pricing', 'v4.html#history/si'], ['SI BETA 2', 'si-beta2.html'],
      ['Security master', 'v4.html#master/explore'], ['Saved securities', 'saved-securities.html']
    ]],
    ['Historical charts', [
      ['Cross-market history', 'cross-market-history.html'],
      ['Yield history', 'v4.html#history/yield'], ['Historical curves', 'v4.html#history/curves'],
      ['FX history', 'v4.html#history/fx'], ['Share prices', 'v4.html#history/shares'],
      ['Event studies', 'v4.html#history/beta2-shares'], ['History pivot', 'v4.html#history/beta4-shares'],
      ['SPX index', 'v4.html#history/spx'], ['Historical FRED', 'historical-fred.html']
    ]],
    ['FRED and rates', [
      ['Historical FRED and Prices', 'historical-fred.html'], ['Fred-1 · Event Replay', 'fred-1.html'],
      ['Fred-2 · Response Matrix', 'fred-2.html'], ['Fred-3 · Transmission Desk', 'fred-3.html'],
      ['V1 Market Desk', 'fred/market-desk.html'], ['V2 Risk Observatory', 'fred/risk-observatory.html'],
      ['V3 Signal Review', 'fred/signal-review.html'], ['V4 Cross-Market Replay', 'fred/cross-market-replay.html'],
      ['Raw FRED data & citations', 'fred/data.html']
    ]],
    ['Site', [['Site map', 'site-map.html'], ['External sources', 'external-sources.html'], ['Site tags', 'tag-map.html']]]
  ];
  const jumpGroups = new Map(moreLinks);
  const subsections = new Map([
    ['Home', [['Daily desk', 'desk.html#daily'], ['Watchlist news', 'desk.html#watchlist-end-day'], ['Article archive', 'desk.html#archive']]],
    ['News', newsLinks],
    ['Stocks BETA', [['Share comparison', 'stocks-beta.html#sb-watchlist-table'], ['Stock cards', 'stocks-beta.html#sb-cards']]],
    ['Stocks BETA 2', [['Company history', 'stocks-beta2.html#sb2-detail'], ['P/E rankings', 'stocks-beta2.html#sb2-pe-rankings'], ['BOS monthly archive', 'bos-monthly.html']]],
    ['Bonds BETA', [['Bond history cards', 'bonds-beta.html#bb-cards'], ['Bond Cashflow Studio', 'bond-cashflow.html'], credit, treasury, ['Bond watchlist', 'v4.html#watchlist']]],
    ['FRED', jumpGroups.get('FRED and rates')],
    ['Master Pivot', [
      ['Explore securities', 'v4.html#master/explore'], ['Master Pivot', 'v4.html#master/pivot'],
      ['Watchlists', 'v4.html#master/watchlists'], ['Screens', 'v4.html#master/screens'], ['Review', 'v4.html#master/review']
    ]],
    ['Historical charts', jumpGroups.get('Historical charts')],
    ['My Blog', [['Latest research', 'market-understanding/#main-published-research'], ['Research explained', 'market-understanding/#research-readings'], ['My research', 'market-understanding/#my-research']]],
    ['Markets', [['Stock moves', 'desk.html#stock-moves'], ['Rates and FX', 'desk.html#market-rates'], ['Bond yields', 'desk.html#market-bonds']]]
  ]);
  function link(label, href, icon) {
    const a = document.createElement('a'); a.href = new URL(href, base);
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
    panel.style.top = anchor.bottom + 'px';
    panel.style.left = Math.max(8, Math.min(anchor.left, document.documentElement.clientWidth - panel.offsetWidth - 8)) + 'px';
  }

  sections.forEach(([name, href, icon], index) => {
    const mainLink = link(name, href, icon);
    mainLink.className = 'hub-primary-link';
    primaryLinks.set(name, mainLink);
    const links = subsections.get(name);
    if (!links?.length) {
      scroll.append(mainLink);
      return;
    }
    const group = document.createElement('div'); group.className = 'hub-primary-group';
    const button = document.createElement('button'); button.className = 'hub-primary-toggle';
    const panel = document.createElement('div'); panel.className = 'hub-primary-dropdown';
    panel.id = 'hub-primary-subsections-' + index;
    panel.hidden = true;
    panel.append(...links.map(([label, route, icon]) => link(label, route, icon)));
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
  window.addEventListener('scroll', positionMenu, {passive: true});
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
  sections.forEach(([name, href]) => main.append(link(name, href)));
  const grid = menu.querySelector('.more-grid');
  const destinations = document.createDocumentFragment();
  destinations.append(main);
  moreLinks.forEach(([title, links]) => {
    const heading = document.createElement('h3');
    heading.className = 'more-group-title';
    heading.textContent = title;
    destinations.append(heading, ...links.map(([name, href]) => link(name, href)));
  });
  if (old) {
    const label = document.createElement('h3');
    label.className = 'more-group-title';
    label.textContent = 'Full workspace shortcuts';
    destinations.append(label);
  }
  grid.prepend(destinations);
  menu.addEventListener('click', e => { if (e.target.closest('a[href]')) menu.close(); });
  menu.addEventListener('close', () => more.focus({preventScroll: true}));
  bar.replaceChildren(scroll, more);
  const skip = document.querySelector('body > .skip, body > .skip-link');
  if (skip) skip.after(bar);
  else document.body.prepend(bar);
  document.documentElement.classList.add('hub-primary-ready');
  function active() {
    const relative = location.pathname.slice(base.pathname.length);
    const route = location.hash || '#overview';
    const onWorkspace = relative === 'v4.html';
    const key = relative.startsWith('fred/') || /^(?:historical-fred|fred-[123]|fred-feed)\.html$/.test(relative) ? 'FRED' : relative.startsWith('market-understanding/') ? 'My Blog'
      : ['bonds-beta.html','bond-cashflow.html'].includes(relative) || (onWorkspace && ['#credit', '#ust'].includes(route)) ? 'Bonds BETA' : ['stocks-beta2.html','bos-monthly.html'].includes(relative) ? 'Stocks BETA 2' : relative === 'stocks-beta.html' ? 'Stocks BETA'
      : /#master(?:\/|$)/.test(location.hash) ? 'Master Pivot' : /#history(?:\/|$)/.test(location.hash) || relative === 'cross-market-history.html' ? 'Historical charts'
      : onWorkspace && (route === '#hourly' || newsLinks.some(([, href]) => href === 'v4.html' + route)) ? 'News'
      : relative === 'desk.html' && location.hash === '#markets' ? 'Markets' : relative === 'desk.html' || relative === '' ? 'Home' : '';
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
  }).observe(bar);
  window.addEventListener('hashchange', active); window.addEventListener('resize', active); requestAnimationFrame(active);
})();
