import {createCover, icon, pickTheme} from './research-cover.js?v=1';
import {articleURL, artworkURL} from './research-reader-route.js?v=1';

const args = new URLSearchParams(location.search);
const source = articleURL(args.get('article'));
const artwork = artworkURL(args.get('art'))?.href;
const title = args.get('title')?.trim().slice(0, 240);
const theme = args.get('theme');
const frame = document.querySelector('.reader-frame');
const original = document.querySelector('.reader-original');
const jump = document.querySelector('.reader-jump');
const list = jump.querySelector('nav');
const settings = document.querySelector('.reader-settings');
const dialog = document.querySelector('.reader-dialog');
const toggle = dialog.querySelector('input');
const note = dialog.querySelector('p');
const footer = document.querySelector('.mih-legal-footer');
if (footer) {
  const legal = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Legal & transparency';
  legal.append(summary, footer);
  dialog.append(legal);
}
const status = document.querySelector('.reader-status');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const preference = 'market-hub-desk-motion';
let enabled = true;
try { enabled = localStorage.getItem(preference) !== 'off'; } catch { /* Keep the default. */ }

function motionAllowed() {
  return enabled && !reduced.matches;
}

let stopEffects = () => {};
let startEffects = () => {};
function syncMotion() {
  toggle.checked = motionAllowed();
  toggle.disabled = reduced.matches;
  note.textContent = reduced.matches ? 'Your device’s reduced-motion setting pauses the effects.'
    : 'Fade in headings and move the cover as you scroll. This setting also applies to the research library and desk.';
  stopEffects();
  if (motionAllowed()) startEffects();
}

document.querySelectorAll('[data-icon]').forEach(element => {
  element.prepend(icon(element.dataset.icon, 'reader-icon'));
});
settings.addEventListener('click', () => dialog.showModal());
toggle.addEventListener('change', () => {
  enabled = toggle.checked;
  try { localStorage.setItem(preference, enabled ? 'on' : 'off'); } catch { /* Keep this tab’s setting. */ }
  syncMotion();
});
reduced.addEventListener('change', syncMotion);
window.addEventListener('storage', event => {
  if (event.key !== preference && event.key !== null) return;
  enabled = event.newValue !== 'off';
  syncMotion();
});
syncMotion();

function addCover(doc, articleTitle) {
  const header = doc.createElement('section');
  header.className = 'research-reading-cover';
  header.setAttribute('aria-label', 'Article cover');
  const text = doc.createElement('div');
  text.className = 'research-reading-intro';
  const kicker = doc.createElement('p');
  kicker.className = 'research-reading-kicker';
  kicker.append(icon('book', 'reader-icon', doc), 'Research Explained');
  const heading = doc.createElement('p');
  heading.className = 'research-reading-title';
  heading.textContent = articleTitle;
  text.append(kicker, heading);
  header.append(text, createCover(header, articleTitle, theme || pickTheme(articleTitle, ''), artwork));
  doc.body.prepend(header);
  return header;
}

function setContents(doc, cover) {
  list.replaceChildren();
  const headings = [...doc.querySelectorAll('h2')].filter(node =>
    node.textContent.trim() && node.getClientRects().length && !node.closest('nav, dialog, aside, footer'));
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
}

function bindArticleMotion(doc, cover) {
  const scroller = doc.scrollingElement;
  const win = doc.defaultView;
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
      document.body.style.setProperty('--reader-progress', range > 0 ? Math.min(distance / range, 1) : 0);
      art.style.translate = '0 ' + Math.min(28, Math.max(0, distance * .09)) + 'px';
      art.style.opacity = String(1 - Math.min(.45, Math.max(0, distance / 1000)));
    });
  }

  startEffects = () => {
    win.addEventListener('scroll', syncProgress, {passive:true});
    win.addEventListener('resize', syncProgress, {passive:true});
    resize = new ResizeObserver(syncProgress);
    resize.observe(doc.body);
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
    });
    for (const node of doc.querySelectorAll('h2, h3, .research-reading-intro')) {
      if (!shown.has(node)) observer.observe(node);
    }
  };

  stopEffects = () => {
    observer?.disconnect();
    resize?.disconnect();
    win.removeEventListener('scroll', syncProgress);
    win.removeEventListener('resize', syncProgress);
    cancelAnimationFrame(pending);
    pending = 0;
    running.forEach(animation => animation.cancel());
    running.clear();
    document.body.style.removeProperty('--reader-progress');
    art.style.removeProperty('translate');
    art.style.removeProperty('opacity');
  };
}

function mountArticle() {
  stopEffects();
  stopEffects = () => {};
  startEffects = () => {};
  jump.hidden = true;
  jump.open = false;
  const doc = frame.contentDocument;
  if (!doc?.body || doc.URL === 'about:blank') return;
  status.hidden = true;
  if (!articleURL(doc.URL)) return;
  if (!doc.querySelector('h1, main, article') || doc.querySelector('h1')?.textContent.trim() === '404') return;

  const articleTitle = title || doc.querySelector('h1')?.textContent.trim() || doc.title;
  const style = doc.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('research-reader.css?v=2', import.meta.url);
  const cover = addCover(doc, articleTitle);
  setContents(doc, cover);
  if (doc.defaultView.IntersectionObserver && window.ResizeObserver && Element.prototype.animate) {
    bindArticleMotion(doc, cover);
    syncMotion();
  }
  style.addEventListener('load', () => {
    if (!source.hash) return;
    try { doc.getElementById(decodeURIComponent(source.hash.slice(1)))?.scrollIntoView(); } catch { /* Keep the native anchor. */ }
  }, {once:true});
  doc.head.append(style);
  doc.addEventListener('click', event => {
    if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname === new URL(doc.URL).pathname) return;
    // Keep site and report navigation outside the reading pane.
    if (!articleURL(url.href) && !/\/(?:market-understanding\/?|v4\.html|desk\.html|index\.html)$/.test(url.pathname)) return;
    event.preventDefault();
    location.assign(url);
  });
}

if (source) {
  original.href = source;
  original.hidden = false;
  if (title) document.title = title + ' | Market Intelligence Hub';
  frame.title = title || 'Research article';
  frame.addEventListener('load', mountArticle);
  frame.hidden = false;
  frame.src = source;
} else {
  status.textContent = 'Choose an article from the research library.';
}
