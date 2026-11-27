/* Only public article documents can be opened in the reader. */
const base = new URL('./', import.meta.url);
const independent = new URL('/market-intelligence-content/', base);
const articleFiles = /^[a-z0-9][a-z0-9-]{1,119}(?:\/[a-z0-9][a-z0-9_-]{0,119})*(?:\/|\.html)?$/i;

function publicURL(value) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
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
      && !url.pathname.endsWith('/market-understanding/index.html'))) return url;
  return /^nvda-history-snapshot-\d{4}-\d{2}-\d{2}\.html$/.test(url.pathname.slice(base.pathname.length))
    && url.pathname.startsWith(base.pathname) ? url : null;
}

export function artworkURL(value) {
  const url = publicURL(value);
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
