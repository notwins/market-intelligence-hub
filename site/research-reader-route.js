/* Only public article documents can be opened in the reader. */
const base = new URL('./', import.meta.url);
const independent = new URL('/market-intelligence-content/', base);
const articleFiles = /^[a-z0-9][a-z0-9-]{1,119}(?:\/[a-z0-9][a-z0-9_-]{0,119})*(?:\/|\.html)?$/i;

function publicURL(value, baseURL = base) {
  if (!value) return null;
  try {
    const url = new URL(value, baseURL);
    if (url.origin === base.origin && !url.username && !url.password) return url;
  } catch { /* Ignore non-URL input. */ }
  return null;
}

export function articleURL(value) {
  const url = publicURL(value);
  if (!url || url.search) return null;
  const roots = [
    new URL('research/', base), new URL('market-understanding/', base),
    new URL('research/', independent), new URL('read-ups/', independent)
  ];
  if (roots.some(root => url.pathname.startsWith(root.pathname)
      && articleFiles.test(url.pathname.slice(root.pathname.length))
      && url.pathname !== root.pathname + 'index.html')) return url;
  return /^nvda-history-snapshot-\d{4}-\d{2}-\d{2}\.html$/.test(url.pathname.slice(base.pathname.length))
    && url.pathname.startsWith(base.pathname) ? url : null;
}

export function artworkURL(value, baseURL) {
  const url = publicURL(value, baseURL);
  if (!url || !/\.(?:webp|avif|png|jpe?g|gif|svg)$/i.test(url.pathname)) return null;
  return [base.pathname, independent.pathname].some(root => url.pathname.startsWith(root)) ? url : null;
}

export function readerURL(source, {title, theme, artwork}) {
  const url = new URL('research-reader.html', base);
  url.searchParams.set('article', source.pathname + source.hash);
  url.searchParams.set('title', title);
  url.searchParams.set('theme', theme);
  if (artwork) url.searchParams.set('art', artwork.pathname);
  return url;
}

export function originalArticleURL(value) {
  const url = new URL(value);
  url.searchParams.set('mih-view', 'original');
  return url;
}

export function articleKey(url) {
  return url.pathname.replace(/\/index\.html$/i, '/').replace(/\/$/, '');
}

export function directArticleURL(value) {
  const url = publicURL(value);
  if (!url || url.searchParams.get('mih-view') === 'original') return null;
  const canonical = new URL(url);
  canonical.search = '';
  if (articleURL(canonical)) return url;
  const path = canonical.pathname.slice(base.pathname.length);
  if (!canonical.pathname.startsWith(base.pathname)) return null;
  return /^data\/watchlist\/(?:reports|reviews)\/[a-z0-9-]+\.html$/i.test(path) ? url : null;
}
