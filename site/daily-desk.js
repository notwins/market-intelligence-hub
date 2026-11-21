/* Daily reading view built from the existing published hourly editions and market series. */
(function (root) {
  'use strict';

  const status = document.querySelector('#daily-desk-status');
  if (!status) return;

  const headlines = document.querySelector('#daily-desk-headlines');
  const cards = document.querySelector('#daily-desk-editions');
  const dialog = document.querySelector('#daily-desk-dialog');
  const body = document.querySelector('#daily-desk-report');
  const dateLabel = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Singapore'});
  const timeLabel = new Intl.DateTimeFormat('en-GB', {hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Singapore'});
  const stamp = value => dateLabel.format(new Date(value));
  const dayLabel = day => stamp(day + 'T12:00:00+08:00');
  const compactDate = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', timeZone: 'UTC'});
  const sections = [
    ['economy', 'Economy'],
    ['credit', 'Bonds & credit'],
    ['shares', 'Shares & earnings'],
    ['news', 'Daily news']
  ];
  let opener, marketSeries;

  function topicFor(story) {
    const tag = String(story.topic || '');
    if (/\b(bonds?|credit|treasur(?:y|ies)|fixed income|borrowing|debt|yields?)\b/i.test(tag)) return 'credit';
    if (/\b(earnings|shares?|equities|stocks?|semiconductors?|corporate ownership|ipo|buybacks?|capital markets)\b/i.test(tag)) return 'shares';
    if (/\b(economy|economic|macro|inflation|trade|tariffs?|labour|jobs|central banks?|fed|monetary|regulation|infrastructure|capital flows|gdp)\b/i.test(tag)) return 'economy';
    return 'news';
  }

  function storiesFor(editions) {
    const stories = new Map();
    for (const edition of editions) {
      for (const story of edition.stories) {
        const href = story.source_urls?.find(url => typeof url === 'string' && url.startsWith('https://') && root.Desk.safeHref(url));
        if (!href || typeof story.headline !== 'string' || !story.story_id) continue;
        const saved = stories.get(story.story_id);
        if (!saved || (story.version || 0) > (saved.version || 0)) {
          const original = edition.sources?.find(s => root.Desk.canonical(s.url) === root.Desk.canonical(href));
          stories.set(story.story_id, {...story, href, category: topicFor(story), published: original?.published_at || original?.published_date});
        }
      }
    }
    const urls = new Set();
    return [...stories.values()].filter(story => {
      const url = root.Desk.canonical(story.href);
      if (urls.has(url)) return false;
      urls.add(url);
      return true;
    });
  }

  function groupDays(feed) {
    const byDay = new Map();
    for (const edition of feed?.editions || []) {
      if (!Array.isArray(edition.stories) || !Number.isFinite(Date.parse(edition.cutoff))) continue;
      const day = new Date(edition.cutoff).toLocaleDateString('sv-SE', {timeZone: 'Asia/Singapore'});
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(edition);
    }
    return new Map([...byDay].sort(([a], [b]) => b.localeCompare(a)).map(([day, editions]) => {
      const sorted = editions.sort((a, b) => Date.parse(b.cutoff) - Date.parse(a.cutoff));
      return [day, {
        day, cutoff: sorted[0].cutoff, stories: storiesFor(sorted),
        hasPartialCoverage: sorted.some(e => e.coverage !== 'complete')
      }];
    }));
  }

  function button(text, style, open, label) {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = style;
    control.textContent = text;
    if (label) control.setAttribute('aria-label', label);
    control.addEventListener('click', () => open(control));
    return control;
  }

  function editionCard(label, day, edition) {
    const article = document.createElement('article');
    article.className = 'daily-edition';
    const {E} = root.Desk;
    article.innerHTML = `<p class="daily-edition-label">${label}</p>
      <h3>${day ? dayLabel(day) : 'Edition unavailable'}</h3>
      <p class="fine">${edition ? `Cutoff ${timeLabel.format(new Date(edition.cutoff))} SGT · ${edition.stories.length} sourced stories` : 'No saved briefing for this date.'}</p>`;
    if (edition) {
      const summary = document.createElement('p');
      summary.className = 'daily-edition-summary';
      summary.textContent = edition.stories[0]?.headline || 'No sourced headlines in this edition.';
      article.append(summary, button('View report', 'outline', trigger => openEdition(edition, trigger), `View ${label.toLowerCase()} report for ${E(dayLabel(day))}`));
    }
    return article;
  }

  function render(feed) {
    const days = groupDays(feed);
    const day = days.keys().next().value;
    if (!day) {
      status.textContent = 'Published daily briefings are temporarily unavailable.';
      return;
    }
    const latest = days.get(day);
    const previousDay = new Date(Date.parse(day) - 86400000).toISOString().slice(0, 10);
    status.textContent = `Latest cutoff ${dayLabel(day)} · ${timeLabel.format(new Date(latest.cutoff))} SGT${feed.delivery_error ? ' · showing the saved feed' : ''}`;
    const list = document.createElement('ol');
    list.className = 'daily-headlines';
    for (const [index, story] of latest.stories.slice(0, 4).entries()) {
      const row = document.createElement('li');
      if (!index) row.className = 'daily-headline-lead';
      row.append(button(story.headline, 'daily-headline-button', trigger => openEdition(latest, trigger, story)));
      list.append(row);
    }
    headlines.replaceChildren(list);
    cards.replaceChildren(editionCard('Latest', day, latest), editionCard('Yesterday', previousDay, days.get(previousDay)));
  }

  function pointsPanel(name, points, suffix, source, sourceName) {
    const {E} = root.Desk;
    const latest = points.at(-1);
    if (!latest) return `<div class="daily-indicator"><h4>${name}</h4><p>No saved observations before this cutoff.</p></div>`;
    const min = Math.min(...points.map(point => point[1])), max = Math.max(...points.map(point => point[1]));
    const start = Date.parse(points[0][0]), end = Date.parse(latest[0]);
    const x = day => start === end ? 150 : 10 + 280 * (Date.parse(day) - start) / (end - start);
    const y = value => min === max ? 35 : 60 - 50 * (value - min) / (max - min);
    const coordinates = points.map(([day, value]) => `${x(day)},${y(value)}`).join(' ');
    const value = n => n.toLocaleString('en-US', {maximumFractionDigits: 4}) + suffix;
    return `<figure class="daily-indicator">
      <figcaption><span>${name}</span><strong>${value(latest[1])}</strong></figcaption>
      <svg viewBox="0 0 300 74" role="img" aria-label="${name} from ${points[0][0]} through ${latest[0]}. Low ${value(min)}. High ${value(max)}.">
        <line x1="10" x2="290" y1="64" y2="64"/>
        ${points.length > 1 ? `<polyline points="${coordinates}"/>` : ''}
        <circle cx="${x(latest[0])}" cy="${y(latest[1])}" r="4"/>
      </svg>
      <p>${compactDate.format(start)}–${compactDate.format(end)} · ${source ? `<a href="${E(source)}">${sourceName}</a>` : sourceName}</p>
    </figure>`;
  }

  function readMarketSeries() {
    marketSeries ??= Promise.allSettled([
      fetch('data/fred-daily.json', {signal: AbortSignal.timeout(10000)}).then(response => {
        if (!response.ok) throw new Error('FRED data unavailable');
        return response.json();
      }),
      root.MarketPrices.series('SPY')
    ]);
    return marketSeries;
  }

  async function drawIndicators(edition) {
    const [fed, benchmark] = (await readMarketSeries()).map(result => result.value);
    const cutoff = edition.day;
    // Date-only series may contain that day's close after the briefing cutoff.
    const before = (points = []) => points.filter(([day, value]) => day < cutoff && Number.isFinite(value)).slice(-20);
    const get = id => before(fed?.series?.find(s => s.id === id)?.points);
    return {
      economy: pointsPanel('USD/SGD · daily', get('USD/SGD'), '', 'https://fred.stlouisfed.org/series/DEXSIUS', 'FRED'),
      credit: pointsPanel('US Treasury 2-year yield', get('UST 2Y'), '%', 'https://fred.stlouisfed.org/series/DGS2', 'FRED') +
        pointsPanel('US Treasury 10-year yield', get('UST 10Y'), '%', 'https://fred.stlouisfed.org/series/DGS10', 'FRED'),
      shares: pointsPanel('SPY · daily close', before(benchmark?.daily), ' USD',
        root.Desk.safeHref(benchmark?.item?.history_url), 'Price history')
    };
  }

  function evidence(story) {
    const {E} = root.Desk;
    const published = typeof story.published === 'string' && Number.isFinite(Date.parse(story.published))
      ? ` <span class="daily-source-date">· Published ${stamp(story.published)}</span>` : '';
    return `<li><h4>${E(story.headline)}</h4>${story.body ? `<p>${E(story.body)}</p>` : ''}
      <a href="${E(story.href)}">Read source</a>${published}</li>`;
  }

  function openEdition(edition, trigger, selected) {
    opener = trigger;
    const {E} = root.Desk;
    dialog.querySelector('#daily-desk-dialog-title').textContent = 'Daily briefing';
    dialog.querySelector('#daily-desk-dialog-date').textContent = `${dayLabel(edition.day)} · Cutoff ${timeLabel.format(new Date(edition.cutoff))} SGT`;
    const grouped = Object.fromEntries(sections.map(([key]) => [key, edition.stories.filter(s => s.category === key)]));
    const count = edition.stories.length;
    const storyCount = key => grouped[key].length;
    const coverage = `<div class="briefing-coverage">
      <p><strong>${count} sourced stories</strong>${edition.hasPartialCoverage ? ' · Partial news coverage' : ''}</p>
      ${count ? `<div class="coverage-bar" aria-hidden="true">${sections.filter(([key]) => storyCount(key)).map(([key]) => `<span class="briefing-${key}" style="flex:${storyCount(key)}"></span>`).join('')}</div>
      <ul>${sections.map(([key, label]) => `<li class="briefing-${key}">${label} ${storyCount(key)}</li>`).join('')}</ul>` : ''}
    </div>`;
    const news = [...grouped.news, ...edition.stories.filter(story => story.category !== 'news')].slice(0, 4);
    body.innerHTML = `${selected ? `<aside class="briefing-selected"><h3>${E(selected.headline)}</h3>${selected.body ? `<p>${E(selected.body)}</p>` : ''}<a href="${E(selected.href)}">Read source</a></aside>` : ''}
      ${coverage}${sections.map(([key, label]) => {
        const stories = key === 'news' ? news : grouped[key].slice(0, 2);
        return `<section class="briefing-section briefing-${key}">
          <h3>${label}</h3>
          ${key !== 'news' ? `<div class="briefing-indicators" data-briefing-indicators="${key}"><p>Loading dated observations…</p></div>` : ''}
          ${stories.length ? `<ul class="briefing-stories">${stories.map(evidence).join('')}</ul>` : '<p>No matching stories in the available hourly editions.</p>'}
        </section>`;
      }).join('')}`;
    dialog.showModal();
    dialog.scrollTop = 0;
    const slots = [...body.querySelectorAll('[data-briefing-indicators]')];
    drawIndicators(edition).then(indicators => {
      for (const slot of slots) slot.innerHTML = indicators[slot.dataset.briefingIndicators];
    }).catch(() => {
      for (const slot of slots) slot.textContent = 'Dated market observations unavailable.';
    });
  }

  dialog.querySelector('[data-briefing-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => opener?.focus());
  root.DailyDesk = {render};
})(window);
