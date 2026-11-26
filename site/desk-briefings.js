/* Public Daily Desk editions and progressively enhanced briefing card navigation. */
(() => {
  'use strict';
  const topics = [
    ['news', 'Daily News', 'news'], ['bonds', 'Bonds & Credit', 'credit'],
    ['earnings', 'Earnings', 'earnings'], ['economy', 'Economy & Economic News', 'globe']
  ];
  const date = new Intl.DateTimeFormat('en-SG', {dateStyle: 'long', timeZone: 'Asia/Singapore'});
  const time = new Intl.DateTimeFormat('en-GB', {hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore'});
  const dateText = day => date.format(new Date(day + 'T12:00:00+08:00'));
  const cutoffText = e => dateText(e.date) + ' · ' + time.format(new Date(e.cutoff)) + ' SGT';
  const node = (tag, text, cls) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  const list = document.getElementById('dashboard-report-cards');
  const picker = document.getElementById('dashboard-edition');
  const status = document.getElementById('dashboard-edition-status');
  const retry = document.getElementById('dashboard-retry');
  const dialog = document.getElementById('dashboard-report-dialog');
  let editions = [], requestActive = false, lastAttempt = 0, previousBytes = '';

  function openReport(edition, key, title) {
    const report = edition.reports[key];
    document.getElementById('dashboard-report-date').textContent = cutoffText(edition);
    document.getElementById('dashboard-report-title').textContent = title;
    const body = document.getElementById('dashboard-report-body');
    body.replaceChildren(node('p', report.summary, 'briefing-standfirst'));
    for (const [field, label] of [['happened','What happened'],['key_points','Key things to note'],['watch','What to watch']]) {
      if (!report[field].length) continue;
      const ul = node('ul');
      report[field].forEach(point => ul.append(node('li', point)));
      body.append(node('h3', label), ul);
    }
    body.append(node('h3','Coverage'), node('p',report.coverage));
    if (report.sources.length) {
      const sources = node('ul', undefined, 'briefing-source-list');
      for (const source of report.sources) {
        const li = node('li'), a = node('a',source.title);
        a.href = source.url;
        li.append(a);
        sources.append(li);
      }
      body.append(node('h3','Sources'), sources);
    }
    dialog.showModal();
    document.dispatchEvent(new CustomEvent('hub-report-open', {detail: key}));
    window.HubUsage?.dailyReport(key);
    body.parentElement.scrollTop = 0;
  }
  dialog.querySelector('[data-close-dashboard]').addEventListener('click', () => dialog.close());
  function draw() {
    const edition = editions.find(e => e.date === picker.value) || editions[0];
    if (!edition) return;
    status.textContent = (edition === editions[0] ? 'Latest published cutoff · ' : 'Published cutoff · ') + cutoffText(edition);
    list.replaceChildren(...topics.map(([key,title,icon]) => {
      const report = edition.reports[key];
      const card = node('article', undefined, 'dashboard-brief');
      card.dataset.topic = key;
      const identity = node('div', undefined, 'brief-identity');
      const emblem = node('span', undefined, 'brief-emblem');
      emblem.setAttribute('aria-hidden', 'true');
      emblem.innerHTML = window.HistoryNavigation.icon(icon);
      identity.append(emblem, node('h3',title), node('p',dateText(edition.date)));
      const story = node('div', undefined, 'brief-story');
      story.append(node('p',report.summary,'brief-summary'));
      if (report.watch.length) {
        const watch = node('div',undefined,'brief-watch');
        watch.append(node('strong','What to watch'),node('p', report.watch[0]));
        story.append(watch);
      }
      const action = node('button','Read report');
      action.type = 'button';
      action.setAttribute('aria-label','Read ' + title + ' report');
      action.addEventListener('click',() => openReport(edition,key,title));
      story.append(action);
      card.append(identity,story);
      return card;
    }));
  }
  function validEdition(e) {
    const text = s => typeof s === 'string' && s.trim().length > 0;
    return e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.cutoff === 'string'
      && e.cutoff.startsWith(e.date + 'T') && e.cutoff.endsWith('+08:00') && Number.isFinite(Date.parse(e.cutoff))
      && topics.every(([key]) => {
        const r = e.reports?.[key];
        return r && text(r.summary) && text(r.coverage)
          && ['happened','key_points','watch'].every(f => Array.isArray(r[f]) && r[f].every(text))
          && Array.isArray(r.sources) && r.sources.every(s => s && text(s.title) && typeof s.url === 'string'
              && s.url.startsWith('https://') && window.Desk.safeHref(s.url));
      });
  }
  async function refresh() {
    if (requestActive) return;
    requestActive = true;
    lastAttempt = Date.now();
    try {
      const url = new URL('data/daily-desk.json', window.ContentDelivery.CONTENT);
      const response = await fetch(url, {cache: 'no-store', signal: AbortSignal.timeout(15000)});
      if (!response.ok) throw Error('Report feed unavailable');
      const payload = await response.json();
      if (payload.schema_version !== 1 || !Array.isArray(payload.editions) || !payload.editions.length
          || !payload.editions.every(validEdition)) throw Error('Invalid report feed');
      const incoming = [...payload.editions].sort((a,b) => b.date.localeCompare(a.date));
      if (editions.length && incoming[0].cutoff < editions[0].cutoff) throw Error('Older snapshot');
      const bytes = JSON.stringify(incoming);
      if (bytes !== previousBytes) {
        const olderChoice = picker.value && picker.value !== editions[0]?.date ? picker.value : null;
        editions = incoming;
        picker.replaceChildren(...editions.map((e,i) => new Option((i ? '' : 'Latest · ') + dateText(e.date), e.date)));
        if (editions.some(e => e.date === olderChoice)) picker.value = olderChoice;
        picker.parentElement.hidden = editions.length < 2;
        draw();
        previousBytes = bytes;
      } else if (!retry.hidden) {
        const selected = editions.find(e => e.date === picker.value) || editions[0];
        status.textContent = 'Published cutoff · ' + cutoffText(selected);
      }
      retry.hidden = true;
    } catch {
      const selected = editions.find(e => e.date === picker.value) || editions[0];
      status.textContent = selected ? 'Refresh unavailable · Showing published cutoff ' + cutoffText(selected)
        : 'The published dashboard reports could not be loaded.';
      retry.hidden = false;
    } finally { requestActive = false; }
  }
  picker.addEventListener('change', draw);
  retry.addEventListener('click', refresh);
  function refreshIfDue() {
    if (!document.hidden && Date.now() - lastAttempt >= 15 * 60 * 1000) refresh();
  }
  document.addEventListener('visibilitychange', refreshIfDue);
  window.setInterval(refreshIfDue, 15 * 60 * 1000);
  refresh();

  const desktop = matchMedia('(min-width: 761px) and (hover: hover) and (pointer: fine)');
  const tabbar = document.querySelector('.modebar');
  function mountSequence(section) {
    const sticky = section.querySelector('.briefing-sticky');
    const track = section.querySelector('.briefing-track');
    const pager = section.querySelector('.briefing-pager');
    const [prev,next] = pager.querySelectorAll('button');
    let index = 0, mode = 'grid', stride = 0, top = 0, frame = 0;
    let cards = [];
    function select(i) {
      index = Math.max(0, Math.min(cards.length - 1, i));
      pager.querySelector('output').textContent = (index + 1) + ' / ' + cards.length;
      prev.disabled = index === 0;
      next.disabled = index >= cards.length - 1;
      cards.forEach((card,n) => { card.inert = mode !== 'grid' && n !== index; });
    }
    function left(i) { return cards[i].offsetLeft - cards[0].offsetLeft; }
    function updateFromPage(instant = false) {
      if (mode !== 'pinned') return;
      const travelled = top - section.getBoundingClientRect().top;
      const i = Math.min(cards.length - 1, Math.max(0, Math.floor(travelled / stride + .35)));
      if (!instant && i === index) return;
      select(i);
      track.style.setProperty('--brief-offset', (-100 * i) + '%');
    }
    function onScroll() {
      if (frame || mode !== 'pinned') return;
      frame = requestAnimationFrame(() => { frame = 0; updateFromPage(); });
    }
    function layout() {
      cards = [...track.children];
      const enhanced = document.documentElement.classList.contains('desk-motion') && cards.length > 1;
      section.classList.toggle('briefing-deck', enhanced);
      pager.hidden = !enhanced;
      top = Math.max(0, parseFloat(getComputedStyle(tabbar).top) || 0) + tabbar.offsetHeight + 8;
      const height = sticky.offsetHeight;
      const pinned = enhanced && desktop.matches && height > 0 && height + top + 12 <= innerHeight;
      mode = pinned ? 'pinned' : enhanced ? 'swipe' : 'grid';
      section.classList.toggle('briefing-pinned', pinned);
      stride = Math.max(210,Math.min(380,innerHeight * .36));
      section.style.setProperty('--brief-top', top + 'px');
      section.style.setProperty('--brief-height', (height + stride * (cards.length - .55)) + 'px');
      select(index);
      if (pinned) updateFromPage(true);
      else if (cards.length) track.scrollTo({left: enhanced ? left(index) : 0, behavior:'instant'});
    }
    function go(i) {
      if (mode === 'grid' || i < 0 || i >= cards.length) return;
      if (mode === 'pinned') {
        window.scrollBy({top: section.getBoundingClientRect().top - top + i * stride, behavior:'instant'});
        updateFromPage();
      } else {
        track.scrollTo({left:left(i), behavior:'smooth'});
      }
    }
    prev.addEventListener('click', () => go(index - 1));
    next.addEventListener('click', () => go(index + 1));
    track.addEventListener('keydown', e => {
      if (mode === 'grid' || !['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
      e.preventDefault();
      track.focus({preventScroll:true});
      go(e.key === 'Home' ? 0 : e.key === 'End' ? cards.length - 1 : index + (e.key === 'ArrowRight' ? 1 : -1));
    });
    track.addEventListener('scroll', () => {
      if (mode === 'swipe' && cards.length > 1) select(Math.round(track.scrollLeft / Math.max(1, left(1))));
    }, {passive:true});
    new MutationObserver(layout).observe(track, {childList:true});
    const ro = new ResizeObserver(layout);
    ro.observe(sticky);
    ro.observe(tabbar);
    desktop.addEventListener('change', layout);
    window.addEventListener('resize', layout);
    window.addEventListener('desk-motion-change', layout);
    window.addEventListener('scroll', onScroll, {passive:true});
    layout();
  }
  document.querySelectorAll('[data-briefing-sequence]').forEach(mountSequence);
})();
