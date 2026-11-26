/* Presentation controls for the three views of the market desk. */
(() => {
  'use strict';
  const root = document.documentElement;
  const icons = {
    Home: 'm3 10 9-7 9 7 M5 9v11h5v-7h4v7h5V9',
    Tools: 'm14 5 4 4 M4 16l10-10 4 4L8 20H4z M16 4l1-1 4 4-1 1',
    News: 'M3 5h15v15H5a2 2 0 0 1-2-2z M18 9h3v9a2 2 0 0 1-2 2 M6 9h8 M6 13h8 M6 16h5',
    Shares: 'M3 20h18 M5 16v-5h3v5z M11 16V7h3v9z M17 16V3h3v13z',
    'Bonds BETA': 'M4 5h16v12H4z M7 9h10 M7 13h5 M13 17v4l2-1 2 1v-4',
    FRED: 'm2 9 10-6 10 6z M3 20h18 M6 11v6 M10 11v6 M14 11v6 M18 11v6',
    'Master Pivot': 'M3 4h18v16H3z M3 9h18 M9 4v16 M9 14h12',
    'Historical charts': 'M3 3v17h18 M6 15l4-5 4 2 6-7',
    'My Blog': 'M3 4c4 0 6 0 9 2 3-2 5-2 9-2v14c-4 0-6 0-9 2-3-2-5-2-9-2z M12 6v14',
    Markets: 'M4 17V6 M2 9h4v5H2z M12 20V9 M10 12h4v5h-4z M20 15V3 M18 6h4v6h-4z',
    Settings: 'm10 3-.5 2.1-2 .9-2-.7-2 3.4 1.6 1.5-.1 2.3-1.5 1.5 2 3.4 2.1-.6 2 .9.5 2.1h4l.5-2.1 2-.9 2.1.6 2-3.4-1.6-1.5v-2.3l1.6-1.5-2-3.4-2.1.7-2-.9L14 3z M15 11.8a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    Search: 'M16 16l5 5 M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
    Jump: 'M4 5h5v5H4z M14 5h5v5h-5z M4 15h5v5H4z M14 15h5v5h-5z'
  };
  function icon(name) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('desk-icon');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', icons[name]);
    svg.append(path);
    return svg;
  }

  const directory = document.querySelector('.desk-directory');
  function closeDirectory() { directory.open = false; }
  document.addEventListener('click', event => {
    if (!directory.contains(event.target) || event.target.closest('a')) closeDirectory();
  });
  document.addEventListener('keydown', event => {
    if (directory.open && event.key === 'Escape') {
      closeDirectory();
      directory.querySelector('summary').focus();
    }
  });

  const jump = document.querySelector('.hub-primary-more');
  if (jump) {
    for (const anchor of document.querySelectorAll('.hub-primary-link')) {
      const glyph = anchor.querySelector('span[aria-hidden]');
      const name = anchor.lastChild.textContent.trim();
      if (glyph && icons[name]) glyph.replaceWith(icon(name));
    }
    jump.prepend(icon('Jump'));
    document.querySelector('.desk-mast .search-link')?.prepend(icon('Search'));
    const gear = document.createElement('button');
    gear.type = 'button';
    gear.className = 'desk-gear';
    gear.setAttribute('aria-label', 'Desk settings');
    gear.title = 'Desk settings';
    gear.setAttribute('aria-haspopup', 'dialog');
    gear.setAttribute('aria-controls', 'hub-site-settings');
    gear.append(icon('Settings'));
    const bar = jump.parentElement;
    const mobile = matchMedia('(max-width: 760px)');
    function placeTools() {
      const host = mobile.matches ? document.querySelector('.desk-mobile-tools') : bar;
      host.append(jump, gear);
    }
    placeTools();
    mobile.addEventListener('change', placeTools);
    // Use the same settings dialog as the Jump to menu, including its navigation controls.
    window.HubBlueprintAccess?.refresh();
    gear.addEventListener('click', () => {
      const opener = document.querySelector('[data-site-settings-open]');
      if (!opener) return;
      opener.click();
      document.getElementById('hub-site-settings').addEventListener('close', () => gear.focus({preventScroll: true}), {once: true});
    });
  }

  const settings = document.getElementById('hub-site-settings');
  if (!settings) return;
  const option = document.createElement('section');
  option.className = 'desk-motion-setting';
  option.innerHTML = '<label><span>Interactive scrolling</span><input type="checkbox" role="switch" aria-describedby="desk-motion-hint"><i aria-hidden="true"></i></label><p id="desk-motion-hint"></p>';
  settings.querySelector('header').after(option);
  const toggle = option.querySelector('input');
  const hint = option.querySelector('p');
  const key = 'market-hub-desk-motion';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = true;
  try { enabled = localStorage.getItem(key) !== 'off'; } catch { /* Use this tab's setting. */ }

  // Feeds replace these cards after initial layout. Observe only their stable list containers.
  function observeEntries(doc, selector, containers) {
    const view = doc.defaultView;
    if (!view?.IntersectionObserver) return;
    const observer = new view.IntersectionObserver(entries => {
      for (const {target, isIntersecting} of entries) target.classList.toggle('desk-enter', isIntersecting);
    }, {rootMargin: '0px 0px -3% 0px'});
    let observed = new Set();
    function syncTargets() {
      const current = new Set(doc.querySelectorAll(selector));
      for (const node of observed) {
        if (!current.has(node)) {
          observer.unobserve(node);
          node.classList.remove('desk-enter');
        }
      }
      for (const node of current) {
        if (!observed.has(node)) observer.observe(node);
      }
      observed = current;
    }
    syncTargets();
    const updates = new view.MutationObserver(syncTargets);
    doc.querySelectorAll(containers).forEach(list => updates.observe(list, {childList: true}));
    return () => {
      updates.disconnect();
      observer.disconnect();
      observed.forEach(node => node.classList.remove('desk-enter'));
    };
  }
  const targets = '.desk-hero-copy, .desk-plate, #briefing > section > .section-head, ' +
    '#markets > section > .section-head, #markets > section > h2, #full-history-frame, #archive > summary, ' +
    '#daily-desk-editions > .daily-edition, #markets .dashboard-grid > .dashboard-card';
  const frame = document.getElementById('full-history-frame');
  let stopHistory;
  function styleHistory() {
    stopHistory?.();
    stopHistory = undefined;
    const doc = frame.contentDocument;
    if (!doc?.body?.classList.contains('embedded-history')) return;
    if (!doc.getElementById('desk-history-design')) {
      const theme = doc.createElement('link');
      theme.id = 'desk-history-design';
      theme.rel = 'stylesheet';
      theme.href = new URL('desk-history-edition.css?v=2', document.baseURI).href;
      doc.head.append(theme);
    }
    const active = enabled && !reduce.matches;
    doc.documentElement.classList.toggle('desk-motion', active);
    if (active) stopHistory = observeEntries(doc, '.episode .core > .panel', '#market-episodes');
  }
  frame.addEventListener('load', styleHistory);
  const nativeProgress = CSS.supports('animation-timeline', 'scroll()');
  function updateProgress() {
    const total = root.scrollHeight - root.clientHeight;
    root.style.setProperty('--desk-progress', total > 0 ? Math.min(1, Math.max(0, scrollY / total)) : 0);
  }
  let stopDesk;
  function applyMotion() {
    stopDesk?.();
    stopDesk = undefined;
    styleHistory();
    window.removeEventListener('scroll', updateProgress);
    window.removeEventListener('resize', updateProgress);
    root.classList.remove('desk-motion');
    toggle.checked = enabled && !reduce.matches;
    toggle.disabled = reduce.matches;
    hint.textContent = reduce.matches
      ? 'Your device’s reduced-motion setting pauses desk animations.'
      : 'Sections fade in, selected cards slide in from the sides, and a line shows your reading progress.';
    if (!enabled || reduce.matches) return;
    root.classList.add('desk-motion');
    if (!nativeProgress) {
      updateProgress();
      window.addEventListener('scroll', updateProgress, {passive: true});
      window.addEventListener('resize', updateProgress);
    }
    stopDesk = observeEntries(document, targets, '#daily-desk-editions, #markets .dashboard-grid');
  }
  toggle.addEventListener('change', () => {
    enabled = toggle.checked;
    try { localStorage.setItem(key, enabled ? 'on' : 'off'); } catch { /* Remains active for this tab. */ }
    applyMotion();
  });
  window.addEventListener('storage', event => {
    if (event.storageArea === window.localStorage && (event.key === key || event.key === null)) {
      enabled = event.newValue !== 'off';
      applyMotion();
    }
  });
  reduce.addEventListener('change', applyMotion);
  applyMotion();
})();
