/* Illustrated research cards and scroll position for the Research Explained landing. */
import {createCover} from './research-cover.js?v=1';
import {cardArticleLinks, cardCover} from './research-cover-metadata.js?v=1';
import {articleURL, readerURL} from './research-reader-route.js?v=2';

const library = document.querySelector('[data-library-ready]');
const base = new URL('./', import.meta.url);
const style = document.createElement('link');
style.rel = 'stylesheet';
style.href = new URL('research-editorial-gallery.css?v=3', base);
document.head.append(style);
if (!document.getElementById('mih-usage')) {
  const usage = document.createElement('script');
  usage.id = 'mih-usage';
  usage.src = new URL('hub-usage.js?v=4', base);
  document.head.append(usage);
}
const sections = [
  ['main-published-research', 'Latest reports'],
  ['my-thoughts', 'My thoughts'],
  ['library-all', 'All editions'],
  ['library-news', 'Reuters briefs'],
  ['library-older', 'Earlier research'],
  ['library-basics', 'Market basics']
];

const cardSelector = '.mu-writeup, #my-research .rr-item';
function decorateCard(card) {
  if (card.dataset.coverDesign) return;
  const title = card.querySelector('h3')?.textContent.trim();
  if (!title) return;
  const {theme: key, artwork} = cardCover(card, title);
  const originalArt = card.querySelector('figure img, img:not([class*="logo"]):not([class*="flag"])');
  let primary;
  for (const link of cardArticleLinks(card)) {
    const source = articleURL(link.href);
    if (!source || source.hash) continue;
    const destination = readerURL(source, {title, theme: key, artwork});
    link.dataset.researchSource = source.href;
    link.href = destination;
    primary ||= link;
  }
  card.dataset.coverDesign = originalArt ? 'existing' : key;
  const cover = createCover(card, title, key, null, primary);
  if (!originalArt) card.prepend(cover);
}

const nav = document.createElement('nav');
nav.className = 'research-collection-rail';
nav.setAttribute('aria-label', 'Browse research collections');
const links = sections.map(([id, label]) => {
  const a = document.createElement('a');
  a.href = '#' + id;
  a.textContent = label;
  nav.append(a);
  return [document.getElementById(id), a];
});
library.querySelector('.library-entry').after(nav);
library.classList.add('research-gallery');

library.querySelectorAll(cardSelector).forEach(decorateCard);
new MutationObserver(records => {
  for (const record of records) {
    for (const added of record.addedNodes) {
      if (added.nodeType !== 1) continue;
      if (added.matches(cardSelector)) decorateCard(added);
      added.querySelectorAll(cardSelector).forEach(decorateCard);
    }
  }
  onScroll();
}).observe(library, {childList:true, subtree:true});

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const preference = 'market-hub-desk-motion';
let frame = 0;
let currentLink;
function onScroll() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const y = nav.getBoundingClientRect().bottom + 28;
    let active;
    for (const [section, anchor] of links) {
      if (section && !section.hidden && section.getBoundingClientRect().top <= y) active = anchor;
    }
    if (active !== currentLink) {
      currentLink?.removeAttribute('aria-current');
      active?.setAttribute('aria-current', 'location');
      currentLink = active;
      if (active && !nav.matches(':focus-within')) {
        const bar = nav.getBoundingClientRect();
        const link = active.getBoundingClientRect();
        if (link.left < bar.left) nav.scrollLeft += link.left - bar.left - 8;
        else if (link.right > bar.right) nav.scrollLeft += link.right - bar.right + 8;
      }
    }
    const range = document.documentElement.scrollHeight - innerHeight;
    nav.style.setProperty('--research-progress', range > 0 ? Math.min(1, Math.max(0, scrollY / range)) : 0);
  });
}
function syncMotion(event) {
  let motion = true;
  if (event?.type === 'research-motion-change') motion = event.detail;
  else try { motion = localStorage.getItem(preference) !== 'off'; } catch { /* Use the default. */ }
  library.classList.toggle('research-motion', motion && !reduced.matches);
}
window.addEventListener('scroll', onScroll, {passive:true});
window.addEventListener('resize', onScroll, {passive:true});
window.addEventListener('research-motion-change', syncMotion);
window.addEventListener('storage', syncMotion);
reduced.addEventListener('change', syncMotion);
onScroll();
syncMotion();
