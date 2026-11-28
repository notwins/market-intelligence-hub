'use strict';
(() => {
  const el = id => document.getElementById(id);
  const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const create = (tag, label, className) => {
    const node = document.createElement(tag);
    if (label) node.textContent = label;
    if (className) node.className = className;
    return node;
  };
  const link = (label, url) => {
    const anchor = create('a', label);
    anchor.href = url;
    return anchor;
  };
  const byLabel = (a, b) => a.localeCompare(b);
  const coverage = (date, frequency) => date ? date.slice(0, frequency === 'Annual' ? 4 : 7) : '—';
  const topics = (id, values) => el(id).replaceChildren(new Option('All topics', ''), ...[...new Set(values)].sort(byLabel).map(s => new Option(s,s)));

  function parseCsv(input) {
    const lines = [];
    const text = input.replace(/^\uFEFF/, '');
    const field = /(?:"((?:[^"]|"")*)"|([^",\r\n]*))(,|\r\n|\n|\r|$)/gy;
    let row = [];
    while (field.lastIndex < text.length) {
      const match = field.exec(text);
      if (!match) throw Error('The file contains an invalid CSV field.');
      row.push(match[1]?.replaceAll('""','"') ?? match[2]);
      if (match[3] === ',') continue;
      lines.push(row);
      row = [];
    }
    if (row.length) lines.push([...row, '']);
    const [columns, ...body] = lines;
    if (!columns) throw Error('The file is empty.');
    return {columns, body};
  }

  function period(raw, frequency) {
    if (!/^\d{4}(-(?:0[1-9]|1[0-2])(?:-\d{2})?)?$/.test(raw ?? '')) return '';
    if (frequency === 'Annual') return raw.slice(0, 4) + '-12-31';
    if (raw.length < 7) return '';
    if (frequency === 'Monthly') return raw.slice(0, 7) + '-01';
    const quarterMonth = Math.ceil(Number(raw.slice(5, 7)) / 3) * 3;
    return new Date(Date.UTC(Number(raw.slice(0, 4)), quarterMonth, 0)).toISOString().slice(0, 10);
  }

  function study({library, summaries, reference, select, sync}) {
    if (library.schema !== 1) throw Error('Unexpected research catalogue format.');
    const entries = [...Object.entries(summaries), ...Object.entries(library.series)]
      .sort(([,a], [,b]) => byLabel(a.group,b.group) || byLabel(a.label,b.label));
    const imported = new Map();
    const fileIds = new Map(Object.entries(library.tables).map(([key, f]) => [f.name.toLowerCase(), key]));
    const values = (id, series) => imported.get(id) ?? series.points;
    const keywordsMatch = (query, value) => query.toLowerCase().trim().split(/\s+/).every(token => value.includes(token));
    const source = series => series.source ? link(series.provider, series.source) : create('span', series.provider);

    function name(id, series, points) {
      const div = create('div');
      if (id === 'reference') {
        div.append(create('strong', series.label));
      } else if (points.length) {
        const action = create('button', series.label, 'series-pick');
        action.type = 'button';
        action.title = 'Compare ' + series.label + ' with gold';
        action.addEventListener('click', () => select(id));
        div.append(action);
      } else {
        div.append(create('strong', series.label));
      }
      const detail = create('small');
      detail.append(document.createTextNode(series.group + ' · '), source(series));
      div.append(detail);
      if (series.basis) div.title = series.basis;
      return div;
    }

    function row(body, id, series, years, showStatus = true) {
      const points = values(id, series);
      const lookup = new Map(points.map(([d,v]) => [Number(d.slice(0,4)), v]));
      const tr = body.insertRow();
      const heading = create('th');
      heading.scope = 'row';
      heading.append(name(id, series, points));
      tr.append(heading);
      const mark = showStatus ? imported.has(id) ? 'Imported' : points.length ? 'Chart ready' : 'Local CSV' : 'Benchmark';
      const last = points.at(-1);
      const startDate = points[0]?.[0] ?? series.start;
      const endDate = last?.[0] ?? series.end;
      for (const display of [
        [series.unit + ' · ' + series.frequency, mark],
        [coverage(startDate,series.frequency) + ' → ' + coverage(endDate,series.frequency), (points.length || series.length) + ' observations'],
        last ? [format.format(last[1]), coverage(last[0],series.frequency)] : ['—'],
        ...years.map(y => [lookup.has(y) ? format.format(lookup.get(y)) : '—'])
      ]) {
        const td = tr.insertCell();
        td.textContent = display[0];
        if (display[1]) td.append(create('small', display[1]));
      }
    }

    function render() {
      const topic = el('library-topic').value, access = el('library-access').value, query = el('library-search').value;
      const end = Number(library.asOf.slice(0,4));
      const step = Number(el('library-years').value);
      const years = Array.from({length: 30}, (_,i) => end - i).filter((year,i) => i === 0 || i === 29 || year % step === 0);
      const list = entries.filter(([id,s]) =>
        (!topic || s.group === topic) &&
        (access === 'all' || (access === 'chart' ? values(id,s).length : s.local && !s.points.length)) &&
        keywordsMatch(query, [id, s.label, s.group, s.provider].join(' ').toLowerCase()));
      const numReady = entries.filter(([id, series]) => values(id, series).length).length;
      el('library-status').textContent = list.length + ' of ' + entries.length + ' series shown · ' + numReady + ' chart ready';
      const table = create('table');
      const header = table.createTHead().insertRow();
      for (const label of ['Series', 'Unit and frequency', 'Coverage', 'Latest', ...years.map(String)]) {
        const th = create('th', label);
        th.scope = 'col';
        header.append(th);
      }
      const body = table.createTBody();
      row(body, 'reference', reference, years, false);
      for (const [id,series] of list) row(body,id,series,years);
      el('library-table').replaceChildren(table);
    }

    function unitMultiplier(key, column) {
      return key === 'holdings' && column.endsWith('gold share') ? 100 : 1;
    }

    async function importFiles(files) {
      const matched = new Map([...files].filter(f => fileIds.has(f.name.toLowerCase())).map(f => [fileIds.get(f.name.toLowerCase()), f]));
      const counter = new Set();
      const errors = [];
      for (const [key, file] of matched) {
        try {
          const {columns, body} = parseCsv(await file.text());
          const dateIndex = columns.indexOf(library.tables[key].date);
          if (dateIndex < 0) throw Error('missing period column');
          for (const [id, series] of Object.entries(library.series)) {
            if (series.local?.[0] !== key || series.points.length) continue;
            const column = series.local[1], index = columns.indexOf(column);
            if (index < 0) continue;
            const output = new Map();
            for (const record of body) {
              const observation = record[index]?.trim();
              if (!observation || !Number.isFinite(Number(observation))) continue;
              const date = period(record[dateIndex], series.frequency);
              if (date) output.set(date, unitMultiplier(key, column) * Number(observation));
            }
            if (output.size) {
              imported.set(id, [...output].sort(([a], [b]) => byLabel(a, b)));
              counter.add(id);
            }
          }
        } catch (error) {
          errors.push(file.name + ' (' + error.message + ')');
        }
      }
      sync(imported);
      render();
      el('clear-import').disabled = imported.size === 0;
      el('import-status').textContent = (matched.size ?
        counter.size + ' series loaded from ' + matched.size + ' catalogue CSVs. ' + imported.size + ' imported series in this tab.' :
        'No catalogued CSV filenames were found.') + (errors.length ? ' Review ' + errors.join(', ') + '.' : '');
    }

    function renderPapers() {
      const query = el('paper-search').value, topic = el('paper-topic').value;
      const papers = library.papers.filter(p => (!topic || p.group === topic) &&
        keywordsMatch(query, [p.title, p.group, p.note, p.year].join(' ').toLowerCase()));
      el('paper-status').textContent = papers.length + ' of ' + library.papers.length + ' publications shown';
      el('paper-list').replaceChildren(...papers.map(p => {
        const article = create('article');
        article.append(create('p', p.group + ' · ' + p.year, 'chapter'), create('h3', p.title), create('p', p.note), link('Open publication ↗', p.url));
        return article;
      }));
    }

    topics('library-topic', entries.map(([,s]) => s.group));
    topics('paper-topic', library.papers.map(p => p.group));
    for (const id of ['library-search','library-topic','library-access','library-years']) el(id).addEventListener('input', render);
    for (const id of ['paper-search','paper-topic']) el(id).addEventListener('input', renderPapers);
    el('choose-folder').hidden = !('webkitdirectory' in el('library-folder'));
    for (const [button, input] of [['choose-folder','library-folder'], ['choose-files','library-files']]) {
      el(button).addEventListener('click', () => el(input).click());
      el(input).addEventListener('change', event => {
        if (event.target.files.length) importFiles([...event.target.files]);
        event.target.value = '';
      });
    }
    el('clear-import').addEventListener('click', () => {
      imported.clear();
      sync(imported);
      render();
      el('clear-import').disabled = true;
      el('import-status').textContent = 'Imported observations cleared.';
    });
    el('import-files').replaceChildren(...[...fileIds.keys()].map(name =>
      create('li', library.tables[fileIds.get(name)].name)));
    render();
    renderPapers();
  }

  window.XauLibrary = {study};
})();
