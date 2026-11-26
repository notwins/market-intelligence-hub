/* Illustrated research cards and scroll position for the Research Explained landing. */
const library = document.querySelector('[data-library-ready]');
const base = new URL('./', import.meta.url);
const style = document.createElement('link');
style.rel = 'stylesheet';
style.href = new URL('research-editorial-gallery.css?v=1', base);
document.head.append(style);
const sections = [
  ['main-published-research', 'Latest reports', 'briefing'],
  ['my-thoughts', 'My thoughts', 'pen'],
  ['library-all', 'All editions', 'archive'],
  ['library-news', 'Reuters briefs', 'wire'],
  ['library-older', 'Earlier research', 'folio'],
  ['library-basics', 'Market basics', 'book']
];

const themes = [
  ['markets', 'markets', '#784b37', '#efd9cb'],
  ['rates', 'yield', '#36564a', '#dee8d8'],
  ['chips', 'shares', '#436070', '#dce7eb'],
  ['risk', 'review', '#5b4b6c', '#ebe4ee'],
  ['gold', 'gold', '#704d1f', '#f0dfb6'],
  ['global', 'map', '#28555b', '#d3e8e3'],
  ['credit', 'credit', '#713e31', '#efddd4'],
  ['savings', 'cashflow', '#466143', '#e8ebd7'],
  ['notes', 'pen', '#6d4a49', '#f0e1d9'],
  ['infrastructure', 'tools', '#43536c', '#d9e1e9'],
  ['fx', 'fx', '#2d5d58', '#dcebe1'],
  ['portfolio', 'pivot', '#65536a', '#ece3e5']
];
const byTheme = Object.fromEntries(themes.map(([key], index) => [key, index]));

// Ordered from specific subjects to broad beats. The title has priority over tags.
const subjects = [
  ['savings', /\b(?:cpf(?: life| oa)?|temasek 2070|payout|retirement|annuit|pension|savings)/i],
  ['infrastructure', /\b(?:data[ -]?cent(?:er|re)|electricity|power grid|power supply|infrastructure|energy|lng)\b/i],
  ['gold', /\b(?:gold|bullion|precious metal|xau|gld)\b/i],
  ['risk', /\b(?:collars?|sharpe|hedg\w*|option\w*|floor and cap|price of conviction)\b/i],
  ['chips', /\b(?:nvidia|nvda|tsmc|foundry|amd|chips?|semiconductor\w*|alphabet|anthropic|ai|technology)\b/i],
  ['notes', /\b(?:howard marks|personal reading|my thoughts|journal|conviction)\b/i],
  ['fx', /\b(?:[a-z]{3}\s*[\/-]\s*[a-z]{3}|franc|currency|currencies|forex|exchange rate|fx)\b/i],
  ['credit', /\b(?:credit|refinanc\w*|borrowing|cash.flow|liquidity|pimco|private debt|cre)\b/i],
  ['rates', /\b(?:bonds?|treasur\w*|yield\w*|rate\w*|monetary|snb|mas|t-bills|interest|bank\w*)\b/i],
  ['portfolio', /\b(?:diversif\w*|allocation|portfoli\w*|alternatives|concentration|asset|structured investment)\b/i],
  ['global', /\b(?:global|trade|shipping|tariff|macro|econom\w*|growth|inflation|singapore|gic)\b/i],
  ['markets', /\b(?:market|markets|earnings|valuation|stocks?|shares?|index)\b/i]
];
function pickTheme(title, context) {
  return subjects.find(([, match]) => match.test(title))?.[0]
    || subjects.find(([, match]) => match.test(context))?.[0] || 'notes';
}
function hashTitle(text) {
  let hash = 2166136261;
  for (const char of text.toLowerCase()) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
function icon(name, className) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const use = document.createElementNS(ns, 'use');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  use.setAttribute('href', new URL('assets/navigation-atlas.svg?v=2#' + name, base));
  svg.append(use);
  return svg;
}

const cardSelector = '.mu-writeup, #my-research .rr-item';
function decorateCard(card) {
  if (card.dataset.coverDesign) return;
  const title = card.querySelector('h3')?.textContent.trim();
  if (!title) return;
  const context = [...card.querySelectorAll('.mu-eyebrow, .mu-card-tags, .rr-tags')].map(node => node.textContent).join(' ');
  const key = pickTheme(title, context);
  const panel = byTheme[key];
  const [, mark, ink, tint] = themes[panel];
  const hash = hashTitle(title);
  const hasOriginal = Boolean(card.querySelector('figure img, img:not([class*="logo"]):not([class*="flag"])'));
  const cover = document.createElement('div');
  cover.className = 'research-cover';
  cover.setAttribute('aria-hidden', 'true');
  cover.style.setProperty('--cover-x', 100 * (panel % 4) / 3 + '%');
  cover.style.setProperty('--cover-y', 50 * Math.floor(panel / 4) + '%');
  cover.dataset.crop = String(hash % 4);
  const art = document.createElement('span');
  art.className = 'research-cover-art';
  cover.append(art, icon(mark, 'research-cover-icon'));
  card.dataset.coverDesign = hasOriginal ? 'existing' : key;
  card.dataset.coverFrame = String(Math.floor(hash / 13) % 3);
  card.style.setProperty('--research-ink', ink);
  card.style.setProperty('--research-tint', tint);
  if (!hasOriginal) card.prepend(cover);
  else card.querySelector('h3').prepend(icon(mark, 'research-existing-icon'));
}

const nav = document.createElement('nav');
nav.className = 'research-collection-rail';
nav.setAttribute('aria-label', 'Browse research collections');
const links = sections.map(([id, label, symbol]) => {
  const a = document.createElement('a');
  a.href = '#' + id;
  a.append(icon(symbol, 'research-rail-icon'), document.createTextNode(label));
  nav.append(a);
  return [document.getElementById(id), a];
});
library.querySelector('.library-entry').after(nav);
library.classList.add('research-gallery');

for (const [id, , symbol] of sections) {
  const heading = document.querySelector('#' + id + ' > summary, #' + id + ' > .mu-writeups-heading h2');
  if (heading) heading.prepend(icon(symbol, 'research-heading-icon'));
}

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
