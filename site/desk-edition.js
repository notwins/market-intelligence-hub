/* Presentation controls for the three views of the market desk. */
(() => {
  'use strict';
  const root = document.documentElement;
  const icons = {
    Settings: 'm10 3-.5 2.1-2 .9-2-.7-2 3.4 1.6 1.5-.1 2.3-1.5 1.5 2 3.4 2.1-.6 2 .9.5 2.1h4l.5-2.1 2-.9 2.1.6 2-3.4-1.6-1.5v-2.3l1.6-1.5-2-3.4-2.1.7-2-.9L14 3z M15 11.8a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    Search: 'M16 16l5 5 M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0'
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
    '#markets .dashboard-grid > .dashboard-card';
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
    root.classList.toggle('desk-motion', enabled && !reduce.matches);
    window.dispatchEvent(new Event('desk-motion-change'));
    toggle.checked = enabled && !reduce.matches;
    toggle.disabled = reduce.matches;
    hint.textContent = reduce.matches
      ? 'Your device’s reduced-motion setting pauses desk animations.'
      : 'Scroll down through briefing cards, or swipe them sideways on mobile. A line shows your reading progress.';
    if (!enabled || reduce.matches) return;
    if (!nativeProgress) {
      updateProgress();
      window.addEventListener('scroll', updateProgress, {passive: true});
      window.addEventListener('resize', updateProgress);
    }
    stopDesk = observeEntries(document, targets, '#markets .dashboard-grid');
  }
  toggle.addEventListener('change', () => {
    enabled = toggle.checked;
    try { localStorage.setItem(key, enabled ? 'on' : 'off'); } catch { /* Remains active for this tab. */ }
    applyMotion();
    window.dispatchEvent(new CustomEvent('research-motion-change', {detail: enabled}));
  });
  window.addEventListener('research-motion-change', event => {
    if (enabled === event.detail) return;
    enabled = event.detail;
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
