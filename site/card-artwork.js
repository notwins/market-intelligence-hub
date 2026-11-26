/* Decorative local artwork for public editorial cards. Published reports remain the source of content. */
(() => {
  'use strict';
  const base = new URL('./', document.currentScript.src);
  const selectors = '#featured-cards, #daily-cards, #archive-cards, [data-feed-cards], #dashboard-report-cards';
  const surfaces = [...document.querySelectorAll(selectors)];
  if (!surfaces.length) return;
  const styles = document.createElement('link');
  styles.rel = 'stylesheet';
  styles.href = new URL('card-artwork.css?v=1', base);
  document.head.append(styles);

  const themes = {macro: 'globe', equities: 'earnings', credit: 'credit'};
  const briefing = {news: 'macro', bonds: 'credit', earnings: 'equities', economy: 'macro'};
  const cards = 'article:is([data-report-id],[data-feed-report],.dashboard-brief)';
  let assignments = {};
  function themeFor(card) {
    if (card.dataset.topic) {
      const day = card.dataset.artDate;
      return assignments.briefings?.[day]?.[card.dataset.topic] ?? briefing[card.dataset.topic];
    }
    const id = card.dataset.reportId || card.dataset.feedReport;
    if (assignments.reports?.[id]) return assignments.reports[id];
    const title = card.querySelector('h3')?.textContent || '';
    if (/bond|credit|treasur|fixed income/i.test(title)) return 'credit';
    if (/earnings|equity|shares|stock|company|Nvidia/i.test(title)) return 'equities';
    return 'macro';
  }
  function applyArtwork(card) {
    const theme = themeFor(card);
    if (!Object.hasOwn(themes, theme) || card.dataset.cardArt === theme) return;
    const identity = card.querySelector('.brief-identity');
    const host = identity || card;
    let figure = host.querySelector(':scope > .card-artwork');
    if (!figure) {
      figure = document.createElement('div');
      figure.className = 'card-artwork';
      figure.setAttribute('aria-hidden', 'true');
      const image = document.createElement('img');
      image.alt = '';
      image.width = 720;
      image.height = 480;
      image.loading = 'lazy';
      image.decoding = 'async';
      figure.append(image);
      if (identity) identity.append(figure);
      else host.prepend(figure);
    }
    figure.querySelector('img').src = new URL('assets/card-art/' + theme + '.jpg', base);
    if (!identity) {
      const prior = figure.querySelector('svg');
      const ns = 'http://www.w3.org/2000/svg';
      const badge = prior || document.createElementNS(ns, 'svg');
      const use = prior?.firstElementChild || document.createElementNS(ns, 'use');
      badge.setAttribute('viewBox', '0 0 32 32');
      badge.setAttribute('focusable', 'false');
      use.setAttribute('href', new URL('assets/navigation-atlas.svg?v=menu-art1#' + themes[theme], base));
      if (!prior) { badge.append(use); figure.append(badge); }
    }
    card.dataset.cardArt = theme;
  }
  function paint() {
    for (const surface of surfaces) surface.querySelectorAll(cards).forEach(applyArtwork);
  }
  const observer = new MutationObserver(paint);
  for (const surface of surfaces) observer.observe(surface, {childList: true});
  paint();
  fetch(new URL('data/card-artwork.json', base), {cache: 'no-cache'})
    .then(response => response.ok ? response.json() : {})
    .then(manifest => {
      if (manifest.schema_version === 1) {
        assignments = manifest;
        paint();
      }
    }).catch(() => {});
})();
