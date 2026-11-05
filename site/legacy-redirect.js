/* Retired entry points only. Shared V3 engines and browser research stores stay in place. */
((root) => {
  'use strict';
  const views = new Set(['overview','watchlist','calls','policy','tools','master','history','ust','earnings','credit','reports','hourly','headlines','research','feeds']);
  const tabs = {history: new Set(['yield','fx','curves']), master: new Set(['explore','pivot','watchlists','screens','review'])};
  const aliases = {stocks:'watchlist',bonds:'watchlist',directory:'watchlist',news:'headlines'};
  function validRoute(route) {
    const parts = route.split('/');
    return views.has(parts[0]) && (parts.length === 1 || (parts.length === 2 && tabs[parts[0]]?.has(parts[1])));
  }
  function destination(location) {
    const query = new URLSearchParams(location.search);
    const hash = location.hash.replace(/^#/, '');
    const requested = query.get('view') || hash;
    query.delete('view');
    query.delete('v'); // Expired cache tags are not layout preferences.
    const suffix = () => query.size ? '?' + query.toString() : '';
    if (validRoute(hash)) return 'v4.html' + suffix() + '#' + hash;
    if (requested === 'archive') return 'archive.html' + suffix();
    if (requested === 'saved') return 'saved-securities.html' + suffix();
    const route = aliases[requested] || requested;
    const fallback = /v3-settings-preview\.html$/.test(location.pathname) ? 'feeds' : 'overview';
    return 'v4.html' + suffix() + '#' + (validRoute(route) ? route : fallback);
  }
  function migrate(storage) {
    try { if (['v1','v3'].includes(storage.getItem('market-hub-version'))) storage.setItem('market-hub-version', 'v4'); } catch {}
  }
  if (typeof module === 'object' && module.exports) module.exports = {destination, migrate};
  else {
    try { migrate(root.localStorage); } catch {}
    const next = destination(root.location);
    document.getElementById('open').href = next;
    root.location.replace(next);
  }
})(globalThis);
