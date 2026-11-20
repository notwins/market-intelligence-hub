'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseArgs } = require('node:util');

const repo = path.resolve(__dirname, '..');
const site = path.join(repo, 'site');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
const files = (dir, match = () => true) => fs.readdirSync(dir).filter(match).sort().map(file => read(path.join(dir, file)));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

function loadRules(root) {
  const logos = require(path.join(root, 'company-logos.js'));
  logos.data = read(path.join(root, 'assets/company-logos/company-logos.json'));
  global.CompanyLogos = logos;
  const pivot = require(path.join(root, 'news-tag-pivot.js'));
  pivot.setStandard(read(path.join(root, 'data/keyword-colour-standard.json')));
  const colour = require(path.join(root, 'publication-colour-core.js'));
  const catalogue = read(path.join(root, 'data/publication-colour-catalogue.json'));
  const colours = colour.index(catalogue);
  return item => {
    global.CompanyLogos = logos;
    const labels = pivot.canonicalTags(item).filter(tag => tag.group !== 'status');
    const explicit = item.tags.map(tag => colours[tag] ? tag : Object.keys(colours).find(id => colours[id].label === tag));
    const colourIds = colour.infer(item.title + ' ' + item.summary, catalogue, explicit);
    const tags = [...new Set([...colourIds, ...labels.map(tag => tag.id)])].sort();
    const ids = logos.infer({ title: item.title, tickers: item.tickers, tags: item.tags, article: true }, logos.data);
    const primary = colours[colourIds[0]];
    const chips = Object.fromEntries([...colourIds].sort().map(id => {
      const { text, background, dark_text, dark_background } = colours[id];
      return [id, { text, background, dark_text, dark_background }];
    }));
    return {
      tags,
      colour: primary ? { tag: colourIds[0], light: primary.text, dark: primary.dark_text, chips } : null,
      logos: [...new Set(ids)].sort()
    };
  };
}

function safeReportLink(href, fallback) {
  if (typeof href !== 'string') return fallback;
  const link = new URL(href, 'https://notwins.github.io/market-intelligence-hub/');
  if (link.origin !== 'https://notwins.github.io' ||
      !/^\/market-intelligence-(hub|content)\//.test(link.pathname)) return fallback;
  return link.href;
}

function inventory(content, deskFile) {
  const items = new Map();
  function add(source, section, subsection, record, fallback) {
    const id = record.story_id || record.id;
    const title = record.headline || record.title;
    if (typeof id !== 'string' || !id || typeof title !== 'string' || !title.trim()) return;
    const key = source + ':' + id;
    items.set(key, {
      key, section, subsection, title,
      href: safeReportLink(record.href, fallback),
      tickers: record.tickers || [],
      tags: (record.tags || []).map(tag => typeof tag === 'string' ? tag : tag.id).filter(Boolean),
      category: record.category || record.topic,
      summary: record.summary || record.body || ''
    });
  }
  const archive = 'https://notwins.github.io/market-intelligence-hub/archive.html';
  for (const snapshot of files(path.join(site, 'data/archive'), n => /^\d{4}-\d{2}-\d{2}\.json$/.test(n))) {
    for (const item of snapshot.items || []) add('daily', 'Archive', 'Daily headlines', item, archive);
  }
  for (const item of read(path.join(site, 'data/news.json')).items) {
    add('daily', 'Archive', 'Daily headlines', item, archive);
  }
  const desk = read(deskFile || path.join(site, 'data/desk-data.json'));
  for (const item of desk.news) {
    add('company', 'Archive', 'Company news cards', item, 'https://notwins.github.io/market-intelligence-hub/desk.html#archive');
  }
  const hourly = read(path.join(content, 'data/hourly-news.json'));
  for (const edition of [...hourly.editions].reverse()) {
    for (const item of edition.stories) {
      add('reuters', 'Reuters News', 'Hourly timeline', item, 'https://notwins.github.io/market-intelligence-hub/v4.html#hourly');
    }
  }
  for (const item of read(path.join(site, 'data/research-register.json')).entries) {
    const area = (item.section || '').toLowerCase();
    const subsection = area === 'market understanding' ? 'Market Understanding' :
      area === 'calls' ? 'Calls' : 'Research archive';
    add('hub', 'Research', subsection, item, archive);
  }
  for (const { record: item } of files(path.join(content, 'data/research-records'), n => n.endsWith('.json'))) {
    const href = 'https://notwins.github.io/market-intelligence-content/research/' + encodeURIComponent(item.id) + '/index.html';
    add('content', 'Research', 'Independent reports', { ...item, href }, archive);
  }
  return [...items.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function historicalRules(ref) {
  const revision = git(repo, 'rev-parse', '--verify', ref + '^{commit}');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mih-tag-rules-'));
  for (const name of ['company-logos.js', 'news-tag-pivot.js', 'publication-colour-core.js',
    'assets/company-logos/company-logos.json', 'data/keyword-colour-standard.json',
    'data/publication-colour-catalogue.json']) {
    const file = path.join(folder, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, git(repo, 'show', revision + ':site/' + name));
  }
  return { revision, classify: loadRules(folder) };
}

const empty = { tags: [], colour: null, logos: [] };

function run() {
  const { values: args } = parseArgs({ options: {
    'content-site': { type: 'string' },
    'desk-data': { type: 'string' },
    'baseline-ref': { type: 'string' },
    'baseline-snapshot': { type: 'string' },
    'rollback-commit': { type: 'string' },
    output: { type: 'string' },
    publish: { type: 'boolean', default: false }
  }});
  if (!args['content-site'] || !args.output || (!!args['baseline-ref'] === !!args['baseline-snapshot'])) {
    throw new Error('Supply --content-site, --output and exactly one of --baseline-ref or --baseline-snapshot.');
  }
  const content = path.resolve(args['content-site']);
  const classify = loadRules(site);
  const items = inventory(content, args['desk-data']);
  const previous = args['baseline-ref'] ? historicalRules(args['baseline-ref']) : read(path.resolve(args['baseline-snapshot']));
  const old = previous.classify
    ? new Map(items.map(item => [item.key, previous.classify(item)]))
    : new Map(previous.items.map(item => [item.key, item.state]));
  const now = new Date();
  const sgTime = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19);
  const runId = sgTime.replace(/[-:]/g, '') + 'SGT';
  const sources = { hub: git(repo, 'rev-parse', 'HEAD'), content: git(content, 'rev-parse', 'HEAD') };
  const snapshot = { schema: 1, id: runId, sources, items: [] };
  const totals = new Map();
  const changes = [];

  for (const { tickers, tags, category, summary, ...row } of items) {
    const state = classify({ ...row, tickers, tags, category, summary });
    snapshot.items.push({ ...row, state });
    const before = old.get(row.key) || empty;
    const kinds = Object.keys(empty).filter(key => JSON.stringify(before[key]) !== JSON.stringify(state[key]));
    const groupKey = row.section + '|' + row.subsection;
    if (!totals.has(groupKey)) totals.set(groupKey, { section: row.section, subsection: row.subsection,
      checked: 0, changed: 0, tags: 0, colour: 0, logos: 0 });
    const total = totals.get(groupKey);
    total.checked++;
    if (kinds.length) {
      total.changed++;
      for (const kind of kinds) total[kind]++;
      changes.push({ ...row, before, after: state, kinds });
    }
  }
  const report = { schema: 1, id: runId, checkedAt: sgTime + '+08:00', sources,
    baseline: previous.revision || previous.id,
    rollbackCommit: args['rollback-commit'] ? git(repo, 'rev-parse', '--verify', args['rollback-commit'] + '^{commit}') : null,
    comparison: previous.classify ? 'Earlier rules on the same article inventory' : 'Previous sweep snapshot',
    checked: items.length, sections: [...totals.values()], changes };

  const output = path.resolve(args.output);
  fs.mkdirSync(output, { recursive: true });
  write(path.join(output, runId + '-snapshot.json'), snapshot);
  write(path.join(output, runId + '-report.json'), report);
  if (args.publish) {
    const history = path.join(site, 'data/tagging-history');
    fs.mkdirSync(history, { recursive: true });
    const index = path.join(history, 'index.json');
    const indexData = fs.existsSync(index) ? read(index) : { schema: 1, runs: [] };
    write(path.join(history, runId + '.json'), report);
    indexData.runs.unshift({ id: runId, checkedAt: report.checkedAt, checked: items.length, changed: changes.length });
    fs.writeFileSync(index, JSON.stringify(indexData, null, 2) + '\n');
  }
  console.log(JSON.stringify({ id: runId, checked: report.checked, changed: changes.length, sections: report.sections }));
}

run();
