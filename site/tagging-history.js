(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const run = byId('run');
  const section = byId('section');
  const query = byId('query');
  const status = byId('status');
  const more = byId('more');
  const base = 'data/tagging-history/';
  const batch = 50;
  let report;
  let limit = batch;

  const el = (name, text, className = '') => {
    const node = document.createElement(name);
    if (className) node.className = className;
    node.textContent = text;
    return node;
  };

  function fetchJSON(file) {
    return fetch(base + file).then(response => {
      if (!response.ok) throw new Error('Sweep report unavailable');
      return response.json();
    });
  }

  function stateCell(state) {
    const cell = document.createElement('td');
    cell.append(el('span', 'Tags · ' + (state.tags.join(', ') || 'None'), 'state'));
    const colour = el('span', '', 'state');
    if (state.colour && /^#[0-9a-f]{6}$/i.test(state.colour.light)) {
      const swatch = el('span', '', 'swatch');
      swatch.style.backgroundColor = state.colour.light;
      swatch.setAttribute('aria-hidden', 'true');
      colour.append(swatch);
    }
    colour.append('Colour · ' + (state.colour ? state.colour.light + ' light / ' + state.colour.dark + ' dark' : 'None'));
    cell.append(colour);
    if (state.colour?.chips) {
      const palettes = document.createElement('details');
      palettes.append(el('summary', 'Tag colours'));
      for (const [id, chip] of Object.entries(state.colour.chips)) {
        palettes.append(el('span', id + ' · ' + chip.text + ' on ' + chip.background +
          ' / ' + chip.dark_text + ' on ' + chip.dark_background, 'state'));
      }
      cell.append(palettes);
    }
    cell.append(el('span', 'Logos · ' + (state.logos.join(', ') || 'None'), 'state'));
    return cell;
  }

  function safeLink(href) {
    try {
      const url = new URL(href);
      return url.origin === 'https://notwins.github.io' && /^\/market-intelligence-(hub|content)\//.test(url.pathname) ? url.href : null;
    } catch {
      return null;
    }
  }

  function articles() {
    if (!report) return;
    const filter = query.value.trim().toLowerCase();
    const rows = report.changes.filter(row => (!section.value || row.section === section.value) &&
      (!filter || JSON.stringify(row).toLowerCase().includes(filter)));
    const fragment = document.createDocumentFragment();
    for (const row of rows.slice(0, limit)) {
      const tr = document.createElement('tr');
      const article = document.createElement('td');
      const href = safeLink(row.href);
      if (href) {
        const a = el('a', row.title);
        a.href = href;
        article.append(a);
      } else {
        article.append(row.title);
      }
      article.append(el('code', row.key, 'key'));
      tr.append(el('td', row.section), el('td', row.subsection), article, stateCell(row.before), stateCell(row.after));
      fragment.append(tr);
    }
    byId('articles').replaceChildren(fragment);
    byId('article-count').textContent = rows.length
      ? 'Showing ' + Math.min(rows.length, limit) + ' of ' + rows.length + ' articles'
      : 'No article changes match this view.';
    more.hidden = rows.length <= limit;
  }

  async function selectRun() {
    const id = run.value;
    if (!/^\d{8}T\d{6}SGT$/.test(id)) return;
    status.textContent = 'Loading sweep…';
    byId('csv').disabled = true;
    try {
      const next = await fetchJSON(id + '.json');
      if (id !== run.value) return;
      report = next;
      const linkToRun = new URL(location.href);
      linkToRun.searchParams.set('run', id);
      history.replaceState(null, '', linkToRun);
      limit = batch;
      status.textContent = next.checkedAt.replace('T',' ').replace('+08:00',' SGT') + ' · ' +
        next.checked + ' checked · ' + next.changes.length + ' changed · ' + next.comparison;
      byId('download').href = base + id + '.json';
      byId('download').download = id + '-tagging-report.json';
      byId('download').hidden = false;
      byId('csv').disabled = false;
      const ordered = [...next.sections].sort((a, b) =>
        a.section.localeCompare(b.section) || a.subsection.localeCompare(b.subsection));
      const totals = ordered.map(row => {
        const tr = document.createElement('tr');
        for (const key of ['section', 'subsection', 'checked', 'changed', 'tags', 'colour', 'logos']) tr.append(el('td', row[key]));
        return tr;
      });
      byId('summary').replaceChildren(...totals);
      const all = el('option', 'All sections');
      all.value = '';
      section.replaceChildren(all, ...[...new Set(ordered.map(row => row.section))].map(name => {
        const option = el('option', name);
        option.value = name;
        return option;
      }));
      const revert = byId('revert');
      revert.textContent = 'Baseline ' + next.baseline + '. ';
      if (/^[0-9a-f]{40}$/.test(next.rollbackCommit || '')) {
        const link = el('a', 'View the release and its changed files');
        link.href = 'https://github.com/notwins/market-intelligence-hub/commit/' + next.rollbackCommit;
        revert.append('For a full renderer rollback, revert this release on the current branch. ', link);
      }
      articles();
    } catch {
      if (id !== run.value) return;
      report = undefined;
      byId('download').hidden = true;
      byId('summary').replaceChildren();
      byId('articles').replaceChildren();
      byId('article-count').textContent = '';
      byId('revert').textContent = '';
      more.hidden = true;
      status.textContent = 'This sweep report could not load. Choose another sweep or refresh.';
    }
  }

  function exportCSV() {
    if (!report) return;
    const values = (value) => {
      const string = String(value ?? '');
      const clean = /^\s*[=+@-]/.test(string) ? "'" + string : string;
      return '"' + clean.replaceAll('"', '""') + '"';
    };
    const colour = state => state.colour ? state.colour.light + ' / ' + state.colour.dark : '';
    const rows = [
      ['Section','Subsection','Article','Article key','Before tags','After tags','Before colour','After colour','Before logos','After logos'],
      ...report.changes.map(row => [row.section,row.subsection,row.title,row.key,row.before.tags.join(', '),
        row.after.tags.join(', '),colour(row.before),colour(row.after),row.before.logos.join(', '),row.after.logos.join(', ')])
    ];
    const objectUrl = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(values).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = report.id + '-tagging-report.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  function filterArticles() {
    limit = batch;
    articles();
  }

  run.addEventListener('change', selectRun);
  section.addEventListener('change', filterArticles);
  query.addEventListener('input', filterArticles);
  more.addEventListener('click', () => { limit += batch; articles(); });
  byId('csv').addEventListener('click', exportCSV);

  fetchJSON('index.json').then(index => {
    if (!index.runs.length) {
      status.textContent = 'No sweep reports yet.';
      return;
    }
    for (const item of index.runs) {
      const option = el('option', item.checkedAt.replace('T',' ').replace('+08:00',' SGT') + ' · ' + item.changed + ' changed');
      option.value = item.id;
      run.append(option);
    }
    const requested = new URLSearchParams(location.search).get('run');
    if (index.runs.some(item => item.id === requested)) run.value = requested;
    run.disabled = false;
    selectRun();
  }).catch(() => { status.textContent = 'Sweep history could not load. Refresh to try again.'; });
})();
