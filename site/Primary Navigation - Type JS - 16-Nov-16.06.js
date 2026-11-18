/* Shared UI navigation. URLs remain native links, including Back/Forward. */
(() => {
  'use strict';
  const base = new URL('./', document.currentScript.src);
  const sections = [
    ['Home', 'desk.html', '⌂'], ['Stocks BETA', 'stocks-beta.html', '▥'], ['FRED', 'fred/', '⌁'],
    ['Master Pivot', 'v4.html#master/pivot', '▦'],
    ['Historical charts', 'v4.html#history/shares', '↗'],
    ['My Blog', 'market-understanding/', '▤'], ['Markets', 'desk.html#markets', '◫']
  ];
  const moreLinks = [
    ['Daily briefing', 'v4.html#overview'], ['Calls & full reports', 'v4.html#calls'],
    ['US earnings', 'v4.html#earnings'], ['Bonds & credit', 'v4.html#credit'],
    ['Hourly news', 'v4.html#hourly'], ['Event studies', 'v4.html#history/beta2-shares'],
    ['Share explorer', 'v4.html#history/beta3-shares'],
    ['Historical FRED and Prices', 'historical-fred.html'], ['Fred-1 · Event Replay', 'fred-1.html'],
    ['Fred-2 · Response Matrix', 'fred-2.html'], ['Fred-3 · Transmission Desk', 'fred-3.html'],
    ['V1 Market Desk', 'fred/market-desk.html'],
    ['V2 Risk Observatory', 'fred/risk-observatory.html'],
    ['V3 Signal Review', 'fred/signal-review.html'], ['V4 Cross-Market Replay', 'fred/cross-market-replay.html'], ['Search library', 'search.html'],
    ['Site map', 'site-map.html']
  ];
  function link(label, href, icon) {
    const a = document.createElement('a'); a.href = new URL(href, base);
    if (icon) { const span = document.createElement('span'); span.textContent = icon; span.setAttribute('aria-hidden', 'true'); a.append(span); }
    a.append(document.createTextNode(label)); return a;
  }
  const old = document.querySelector('.bottom-nav');
  const bar = old || document.createElement('nav');
  const more = document.getElementById('more-btn') || document.createElement('button');
  bar.className = 'bottom-nav hub-primary'; bar.setAttribute('aria-label', 'Main sections');
  const scroll = document.createElement('div'); scroll.className = 'hub-primary-scroll';
  sections.forEach(([name, href, icon]) => scroll.append(link(name, href, icon)));
  more.type = 'button'; more.classList.add('hub-primary-more'); more.textContent = '••• More';
  more.setAttribute('aria-haspopup', 'dialog');
  let menu = document.getElementById('more');
  if (!menu) {
    menu = document.createElement('dialog'); menu.id = 'hub-sections';
    menu.innerHTML = '<div class="dialog-head"><h2 id="hub-sections-title">Explore Market Intel</h2><button type="button" aria-label="Close menu">×</button></div><div class="more-grid"></div>';
    menu.setAttribute('aria-labelledby', 'hub-sections-title'); document.body.append(menu);
    moreLinks.forEach(([name, href]) => {
      const grid = menu.querySelector('.more-grid');
      if (href === 'historical-fred.html' || href === 'fred/market-desk.html') {
        const heading = document.createElement('h3'); heading.className = 'more-group-title';
        heading.textContent = href === 'historical-fred.html' ? 'Historical Datas' : 'Federal Reserve Economic Data (DASHBOARD)'; grid.append(heading);
      }
      grid.append(link(name, href));
    });
    menu.querySelector('button').addEventListener('click', () => menu.close());
    more.addEventListener('click', () => menu.showModal());
  }
  more.setAttribute('aria-controls', menu.id);
  menu.classList.add('hub-sections-menu');
  const main = document.createElement('div'); main.className = 'hub-menu-main';
  sections.forEach(([name, href]) => main.append(link(name, href)));
  menu.querySelector('.more-grid').prepend(main);
  menu.addEventListener('click', e => { if (e.target.closest('a[href]')) menu.close(); });
  menu.addEventListener('close', () => more.focus({preventScroll: true}));
  bar.replaceChildren(scroll, more); document.body.prepend(bar);
  document.documentElement.classList.add('hub-primary-ready');
  function active() {
    const relative = location.pathname.slice(base.pathname.length);
    const key = relative.startsWith('fred/') ? 'FRED' : relative.startsWith('market-understanding/') ? 'My Blog'
      : /#master(?:\/|$)/.test(location.hash) ? 'Master Pivot' : /#history(?:\/|$)/.test(location.hash) || /^(?:historical-fred|fred-[123])\.html$/.test(relative) ? 'Historical charts'
      : relative === 'desk.html' && location.hash === '#markets' ? 'Markets' : relative === 'desk.html' || relative === '' ? 'Home' : '';
    scroll.querySelectorAll('a').forEach(a => {
      const selected = a.textContent.endsWith(key) && !!key;
      if (selected) { a.setAttribute('aria-current', 'page'); scroll.scrollLeft = Math.max(0, a.offsetLeft - scroll.offsetLeft - 12); }
      else a.removeAttribute('aria-current');
    });
  }
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--hub-primary-height', bar.getBoundingClientRect().height + 'px');
  }).observe(bar);
  window.addEventListener('hashchange', active); window.addEventListener('resize', active); requestAnimationFrame(active);
})();
