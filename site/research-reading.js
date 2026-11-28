import {createCover, icon, pickTheme} from './research-cover.js?v=1';

export function readingStyles(doc) {
  const style = doc.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('research-reader.css?v=5', import.meta.url);
  return style;
}

export function readingPreference(toggle, note, changed) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const preference = 'market-hub-desk-motion';
  let enabled = true;
  try { enabled = localStorage.getItem(preference) !== 'off'; } catch { /* Keep the default. */ }

  function motionAllowed() {
    return enabled && !reduced.matches;
  }

  function syncMotion() {
    toggle.checked = motionAllowed();
    toggle.disabled = reduced.matches;
    note.textContent = reduced.matches ? 'Your device’s reduced-motion setting pauses the effects.'
      : 'Fade in headings and move the cover as you scroll. This setting also applies to the research library and desk.';
    changed();
  }

  toggle.addEventListener('change', () => {
    enabled = toggle.checked;
    try { localStorage.setItem(preference, enabled ? 'on' : 'off'); } catch { /* Keep this tab’s setting. */ }
    syncMotion();
    window.dispatchEvent(new CustomEvent('research-motion-change', {detail: enabled}));
  });
  reduced.addEventListener('change', syncMotion);
  function receive(next) {
    if (enabled === next) return;
    enabled = next;
    syncMotion();
  }
  window.addEventListener('storage', event => {
    if (event.key === preference || event.key === null) receive(event.newValue !== 'off');
  });
  window.addEventListener('research-motion-change', event => receive(event.detail));
  syncMotion();
  return motionAllowed;
}

export function readingControls(bar, dialog) {
  const jump = bar.querySelector('.reader-jump');
  const list = jump.querySelector('nav');
  const gear = bar.querySelector('.reader-settings');
  let effects;
  function syncMotion() {
    if (!effects) return;
    effects.stop();
    if (motionAllowed()) effects.start();
  }
  const motionAllowed = readingPreference(dialog.querySelector('input'), dialog.querySelector('p'), syncMotion);
  bar.querySelectorAll('[data-icon]').forEach(element => {
    element.prepend(icon(element.dataset.icon, 'reader-icon'));
  });
  gear.addEventListener('click', () => dialog.showModal());
  return {
    jump, list, motionAllowed,
    reset() {
      effects?.stop();
      effects = undefined;
      jump.hidden = true;
      jump.open = false;
      list.replaceChildren();
    },
    use(next) {
      effects = next;
      syncMotion();
    }
  };
}

export function readingCover(doc, {title, theme, artwork, kicker: label = 'Research Explained'}) {
  const header = doc.createElement('section');
  header.className = 'research-reading-cover';
  header.setAttribute('aria-label', 'Article cover');
  const text = doc.createElement('div');
  text.className = 'research-reading-intro';
  const kicker = doc.createElement('p');
  kicker.className = 'research-reading-kicker';
  kicker.append(icon('book', 'reader-icon', doc), label);
  const heading = doc.createElement('p');
  heading.className = 'research-reading-title';
  heading.textContent = title;
  text.append(kicker, heading);
  header.append(text, createCover(header, title, theme || pickTheme(title, ''), artwork));
  return header;
}

function setContents(scope, cover, {jump, list, motionAllowed}, headingsSelector) {
  const doc = cover.ownerDocument;
  list.replaceChildren();
  const headings = [...scope.querySelectorAll(headingsSelector)].filter(node =>
    node.textContent.trim() && node.getClientRects().length && !node.closest('nav, dialog, aside, footer, .reader-bar'));
  jump.hidden = !headings.length;
  for (const node of headings) {
    const label = node.textContent.trim();
    const mark = /download|presentation|appendix/i.test(label) ? 'archive'
      : /source|reference|method/i.test(label) ? 'papers'
      : /chart|figure|data/i.test(label) ? 'chart' : 'folio';
    if (!node.querySelector('a, button, svg, img')) node.prepend(icon(mark, 'reader-icon research-chapter-icon', doc));
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      jump.open = false;
      node.scrollIntoView({block:'start', behavior:motionAllowed() ? 'smooth' : 'instant'});
      if (!node.hasAttribute('tabindex')) node.tabIndex = -1;
      node.focus({preventScroll:true});
    });
    list.append(button);
  }
  const returnToCover = document.createElement('button');
  returnToCover.type = 'button';
  returnToCover.prepend(icon('book', 'reader-icon'), 'Article cover');
  returnToCover.addEventListener('click', () => {
    jump.open = false;
    cover.scrollIntoView({block:'start', behavior:motionAllowed() ? 'smooth' : 'instant'});
    cover.tabIndex = -1;
    cover.focus({preventScroll:true});
  });
  list.prepend(returnToCover);
  return headings;
}

export function readingMotion(doc, cover, headings, {scroller = doc.scrollingElement, progress = document.body} = {}) {
  const win = doc.defaultView;
  const root = scroller === doc.scrollingElement ? null : scroller;
  const target = root || win;
  const art = cover.querySelector('.research-cover');
  const shown = new WeakSet();
  const running = new Set();
  let observer;
  let pending = 0;
  let resize;

  function syncProgress() {
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      const distance = scroller.scrollTop;
      const range = scroller.scrollHeight - scroller.clientHeight;
      progress.style.setProperty('--reader-progress', range > 0 ? Math.min(distance / range, 1) : 0);
      art.style.translate = '0 ' + Math.min(28, Math.max(0, distance * .09)) + 'px';
      art.style.opacity = String(1 - Math.min(.45, Math.max(0, distance / 1000)));
    });
  }

  function start() {
    target.addEventListener('scroll', syncProgress, {passive:true});
    win.addEventListener('resize', syncProgress, {passive:true});
    resize = new ResizeObserver(syncProgress);
    resize.observe(root || doc.body);
    syncProgress();
    observer = new win.IntersectionObserver(entries => {
      for (const {target,isIntersecting} of entries) {
        if (!isIntersecting) continue;
        observer.unobserve(target);
        shown.add(target);
        if (target.matches(':focus-within') || target.closest('summary')) continue;
        const animation = target.animate([
          {opacity:.3, transform:'translateY(10px)'}, {opacity:1, transform:'none'}
        ], {duration:430, easing:'cubic-bezier(.2,.7,.25,1)'});
        running.add(animation);
        animation.finished.catch(() => {}).finally(() => running.delete(animation));
      }
    }, {root});
    for (const node of [...headings, cover.querySelector('.research-reading-intro')]) {
      if (!shown.has(node)) observer.observe(node);
    }
  }

  function stop() {
    observer?.disconnect();
    resize?.disconnect();
    target.removeEventListener('scroll', syncProgress);
    win.removeEventListener('resize', syncProgress);
    cancelAnimationFrame(pending);
    pending = 0;
    running.forEach(animation => animation.cancel());
    running.clear();
    progress.style.removeProperty('--reader-progress');
    art.style.removeProperty('translate');
    art.style.removeProperty('opacity');
  }
  return {start, stop};
}

export function presentArticle(scope, controls, {title, theme, artwork, headings = 'h2', before}) {
  const doc = scope.ownerDocument;
  const cover = readingCover(doc, {title, theme, artwork});
  if (before) before.after(cover);
  else scope.prepend(cover);
  const chapters = setContents(scope, cover, controls, headings);
  if (doc.defaultView.IntersectionObserver && window.ResizeObserver && Element.prototype.animate) {
    const minor = [...scope.querySelectorAll('h3')].filter(node => !node.closest('nav, dialog, .reader-bar'));
    controls.use(readingMotion(doc, cover, [...new Set([...chapters, ...minor])]));
  }
  return cover;
}

export function restoreArticleAnchor(doc, hash) {
  if (!hash || doc.location.hash !== hash) return;
  try {
    const id = decodeURIComponent(hash.slice(1));
    (doc.getElementById(id) || doc.getElementsByName(id)[0])?.scrollIntoView();
  } catch { /* Preserve native handling of malformed fragments. */ }
}
