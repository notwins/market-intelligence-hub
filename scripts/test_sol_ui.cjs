'use strict';

const assert = require('node:assert/strict');
const F = require('../site/feed-freshness.js');
const M = require('../site/search-metadata.js');
const Q = require('../site/search-query.js');
const G = require('../site/global-search.js');

async function main() {
  const feed = F.feeds.find(f => f.id === 'watchlist');
  assert(feed, 'Watchlist feed must exist');

  const original = Object.freeze({
    generated_at: '2026-11-08T00:00:00Z'
  });
  const health = Object.freeze({
    state: 'scheduled_publication_verified',
    checked_at: '2026-11-08T00:12:00Z'
  });
  const offline = async () => {
    throw new Error('Simulated network failure');
  };

  const initial = await F.fetchSavedFeed(
    feed,
    undefined,
    async path => path === feed.file ? original : health
  );

  assert.equal(initial[0], original);
  assert(F.row(feed, ...initial).includes('Publication verified'));

  const retained = await F.fetchSavedFeed(
    feed, initial, offline
  );
  const retainedHTML = F.row(feed, ...retained);

  assert.equal(retained[0], original);
  assert.equal(retained[3], true);
  assert(retainedHTML.includes(
    M.dateHTML(original.generated_at)
  ));
  assert(retainedHTML.includes('Refresh failed'));
  assert(retainedHTML.includes('data-health="unknown"'));
  assert(!retainedHTML.includes('Publication verified'));

  const firstFailure = await F.fetchSavedFeed(
    feed, undefined, offline
  );
  const unavailableHTML = F.row(feed, ...firstFailure);

  assert(unavailableHTML.includes('Prepared at: Unavailable'));
  assert(!unavailableHTML.includes('datetime='));

  const invalid = await F.fetchSavedFeed(
    feed,
    initial,
    async path => path === feed.file ? {} : health
  );
  assert.equal(invalid[0], original);
  assert.equal(invalid[3], true);

  const newer = Object.freeze({
    generated_at: '2026-11-14T00:00:00Z'
  });
  const recovered = await F.fetchSavedFeed(
    feed,
    retained,
    async path => path === feed.file ? newer : health
  );

  assert.equal(recovered[0], newer);
  assert.equal(recovered[3], false);
  assert(!F.row(feed, ...recovered).includes('Refresh failed'));

  // Preserve the research tie-breaker already present in main.
  const entries = [
    {
      id: 'research',
      kind: 'Research edition',
      title: 'DBS outlook',
      href: 'research/dbs-fixture/',
      date: '2026-11-08',
      text: 'DBS report',
      tags: ['DBS']
    },
    {
      id: 'security',
      kind: 'Security master',
      title: 'DBS outlook',
      href: 'v4.html#master',
      date: '2026-11-14',
      text: 'DBS reference',
      tags: ['DBS']
    }
  ];

  assert.equal(Q.search(entries, 'DBS')[0].id, 'research');
  assert.equal(
    G.suggest(G.prepare(entries), 'DBS').entries[0].id,
    'research'
  );

  const catalogue = require('../site/data/site-search.json').entries;
  const suggestions = G.prepare(catalogue);
  const dbs = G.suggest(suggestions, 'DBS').entries[0];
  assert(dbs.kind === 'Research edition' || dbs.kind === 'Page' && dbs.href.startsWith('research/'));
  assert(!G.suggest(suggestions, 'MAS').entries.some(e => e.kind === 'Section' && e.title === 'Security master'));
  assert.equal(G.suggest(suggestions, 'TSMC').entries[0].kind, 'Watchlist research');
  const exact = {kind:'Security master', title:'DBS', href:'v4.html#master', text:'DBS'};
  assert.equal(G.suggest(G.prepare([...entries, exact]), 'DBS').entries[0], exact);

  console.log('PASS: saved-feed retention and search regressions');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
