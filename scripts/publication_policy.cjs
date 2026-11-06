'use strict';
// Public archive namespaces are sealed, including HTML without a receipt yet.
// See docs/pages-publication-integrity.md. Never classify by a dated filename.
const fs = require('node:fs');
const path = require('node:path');

function walk(root) {
  return fs.readdirSync(root, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const filename = path.join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Publication tree contains a symlink: ' + filename);
    return entry.isDirectory() ? walk(filename) : entry.isFile() ? [filename] : [];
  });
}

function protectedHtml(root, repo = path.resolve(__dirname, '..')) {
  const protectedPaths = new Set();
  function add(relative) {
    if (typeof relative !== 'string' || relative.includes('\\') || path.posix.isAbsolute(relative) ||
        relative.split('/').some(part => part === '..' || part === '.') || /[:?#]/.test(relative)) {
      throw new Error('Unsafe publication path: ' + relative);
    }
    if (relative.toLowerCase().endsWith('.html')) protectedPaths.add(relative);
  }
  const files = walk(root);
  for (const filename of files) {
    const relative = path.relative(root, filename).split(path.sep).join('/');
    if (/^(data|research|market-understanding)\//.test(relative)) add(relative);
    if (path.basename(filename) !== 'publication.json') continue;
    const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
    // Older presentation manifests are stored one directory below their report.
    const folder = path.dirname(filename);
    const base = path.basename(folder) === 'presentations' ? path.dirname(folder) : folder;
    const baseRelative = path.relative(root, base).split(path.sep).join('/');
    add(baseRelative + '/index.html');
    if (manifest.sharpe_sha256_before_download_link) add(baseRelative + '/sharpe.html');
    function visit(value) {
      if (!value || typeof value !== 'object') return;
      if (value.path && value.sha256) add(baseRelative + '/' + value.path);
      if (value.preserved_source_files) {
        for (const name of Object.keys(value.preserved_source_files)) add(baseRelative + '/' + name);
      }
      for (const child of Object.values(value)) visit(child);
    }
    visit(manifest);
  }
  const reports = JSON.parse(fs.readFileSync(path.join(root, 'data/watchlist/report-index.json'), 'utf8'));
  for (const report of reports.reports) add(report.path);
  const calls = JSON.parse(fs.readFileSync(path.join(root, 'data/watchlist/calls.json'), 'utf8'));
  for (const call of calls.calls) if (call.report.html_path) add(call.report.html_path);
  const baseline = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/report_additions_manifest.json'), 'utf8'));
  for (const relative of Object.keys(baseline.reports)) add(relative);
  for (const relative of protectedPaths) {
    if (!fs.statSync(path.join(root, relative)).isFile()) throw new Error('Missing protected HTML: ' + relative);
  }
  return protectedPaths;
}

module.exports = {walk, protectedHtml};
