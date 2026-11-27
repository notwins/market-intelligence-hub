/* Local, credited illustrations for public editorial cards. */
(() => {
  'use strict';
  const base = new URL('./', document.currentScript.src);
  const surfaces = [...document.querySelectorAll(
    '#featured-cards, #daily-cards, #archive-cards, [data-feed-cards], #dashboard-report-cards, #news-cards, #view'
  )];
  const selector = 'article:is([data-report-id],[data-feed-report],.dashboard-brief,[data-news-story],.company-news-card)';
  const themes = {macro: 'globe', equities: 'earnings', credit: 'credit'};
  const briefing = {news: 'markets', bonds: 'rates', earnings: 'markets', economy: 'economy'};
  const assetKey = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const allowed = new Set();
  let rules = [], pools = {}, assignments = {}, loaded = false;

  const href = path => new URL(path, base).href;
  function keyFor(identity, signals, fallback = 'markets') {
    if (!allowed.size) return null;
    let topic;
    for (const signal of signals) {
      topic = rules.find(([, rule]) => rule.test(signal || ''))?.[0];
      if (topic) break;
    }
    let value = 2166136261;
    for (const byte of new TextEncoder().encode(identity)) value = Math.imul(value ^ byte, 16777619);
    const pool = pools[topic || fallback];
    return pool?.[(value >>> 0) % pool.length];
  }

  function choices(card) {
    const {topic, artDate, newsStory, reportId, feedReport, mihTickers, cardTopic} = card.dataset;
    const title = card.querySelector('h2, h3')?.textContent || '';
    let fallback = 'macro';
    if (/\b(?:bonds?|credit|treasur\w*|fixed income)\b/i.test(title)) fallback = 'credit';
    else if (/\b(?:earnings|equities|shares|stocks?|company|nvidia)\b/i.test(title)) fallback = 'equities';
    if (topic) {
      const signals = topic === 'news' ? [card.querySelector('.brief-summary')?.textContent] : [];
      const key = assignments.briefings?.[artDate]?.[topic];
      return [allowed.has(key) ? key : keyFor(artDate + ':' + topic, signals, briefing[topic]), topic === 'bonds' ? 'credit' : topic === 'earnings' ? 'equities' : 'macro'];
    }
    const identity = newsStory || reportId || feedReport || mihTickers || title;
    const assigned = newsStory ? assignments.news?.[newsStory] : assignments.reports?.[identity];
    if (allowed.has(assigned)) return [assigned, fallback];
    const signal = cardTopic || card.querySelector('.mu-eyebrow')?.textContent || '';
    const key = keyFor(identity, [title, signal], fallback === 'credit' ? 'rates' : 'markets');
    return [key, Object.hasOwn(themes, assigned) ? assigned : fallback];
  }

  function artCredit(holder, key) {
    let link = holder.querySelector(':scope > .card-artwork-credit');
    if (!key) {
      link?.remove();
      return;
    }
    if (!link) {
      link = document.createElement('a');
      link.className = 'card-artwork-credit';
      link.textContent = 'Art credit';
      holder.append(link);
    }
    link.href = href('card-artwork-credits.html#' + key);
  }

  function applyArtwork(card) {
    const [key, theme] = choices(card);
    const subject = key || theme;
    if (card.dataset.cardArt === subject) return;
    const compact = card.matches('[data-news-story],.company-news-card');
    if (compact && !key) return;
    const identity = card.querySelector('.brief-identity');
    const thumbnail = identity?.querySelector('.brief-illustration');
    const source = key ? 'assets/card-art/library/' + key + '.webp'
      : thumbnail ? 'assets/desk/report-' + card.dataset.topic + '.webp'
        : 'assets/card-art/' + theme + '.jpg';
    if (thumbnail) {
      thumbnail.src = href(source);
      artCredit(identity, key);
      card.dataset.cardArt = subject;
      return;
    }
    let figure = card.querySelector(':scope > .card-artwork');
    if (!figure) {
      figure = document.createElement('div');
      figure.className = compact ? 'card-artwork card-artwork--thumbnail' : 'card-artwork';
      const image = document.createElement('img');
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      figure.append(image);
      card.prepend(figure);
    }
    figure.querySelector('img').src = href(source);
    artCredit(figure, key);
    if (!compact) {
      const ns = 'http://www.w3.org/2000/svg';
      const prior = figure.querySelector('svg');
      const badge = prior || document.createElementNS(ns, 'svg');
      const use = prior?.firstElementChild || document.createElementNS(ns, 'use');
      badge.setAttribute('viewBox', '0 0 32 32');
      badge.setAttribute('aria-hidden', 'true');
      badge.setAttribute('focusable', 'false');
      use.setAttribute('href', href('assets/navigation-atlas.svg?v=menu-art1#' + themes[theme]));
      if (!prior) {
        badge.append(use);
        figure.append(badge);
      }
    }
    card.dataset.cardArt = subject;
  }

  async function json(path) {
    const response = await fetch(href(path), {cache: 'no-cache'});
    if (!response.ok) throw Error('Card artwork data unavailable');
    return response.json();
  }

  async function loadLibrary() {
    const [library, manifest] = await Promise.allSettled([
      json('data/card-artwork-library.json'), json('data/card-artwork.json')
    ]);
    if (library.value?.schema_version === 1) {
      const payload = library.value;
      rules = payload.rules.map(([topic, pattern]) => [topic, new RegExp(pattern, 'i')]);
      pools = payload.pools;
      Object.values(pools).flat().filter(key => assetKey.test(key)).forEach(key => allowed.add(key));
    }
    if (manifest.value?.schema_version === 1) assignments = manifest.value;
    paint();
  }

  function paint() {
    const cards = new Set(surfaces.flatMap(surface => [...surface.querySelectorAll(selector)]));
    if (!cards.size) return;
    if (!loaded) {
      loaded = true;
      const styles = document.createElement('link');
      styles.rel = 'stylesheet';
      styles.href = href('card-artwork.css?v=retro1');
      document.head.append(styles);
      loadLibrary().catch(() => {});
    }
    for (const card of cards) applyArtwork(card);
  }

  const observer = new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node =>
      node.nodeType === 1 && (node.matches(selector) || node.querySelector(selector))))) paint();
  });
  for (const surface of surfaces) observer.observe(surface, {childList: true, subtree: true});
  paint();
})();
