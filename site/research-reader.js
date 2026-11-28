import {presentArticle, readingControls, readingStyles, restoreArticleAnchor} from './research-reading.js?v=1';
import {articleURL, artworkURL, originalArticleURL} from './research-reader-route.js?v=2';

const args = new URLSearchParams(location.search);
const source = articleURL(args.get('article'));
const artwork = artworkURL(args.get('art'))?.href;
const title = args.get('title')?.trim().slice(0, 240);
const theme = args.get('theme');
const frame = document.querySelector('.reader-frame');
const original = document.querySelector('.reader-original');
const bar = document.querySelector('.reader-bar');
const dialog = document.querySelector('.reader-dialog');
const controls = readingControls(bar, dialog);
const footer = document.querySelector('.mih-legal-footer');
if (footer) {
  const legal = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Legal & transparency';
  legal.append(summary, footer);
  dialog.append(legal);
}
const status = document.querySelector('.reader-status');

function mountArticle() {
  controls.reset();
  const doc = frame.contentDocument;
  if (!doc?.body || doc.URL === 'about:blank') return;
  status.hidden = true;
  if (!articleURL(doc.URL)) return;
  if (!doc.querySelector('h1, main, article') || doc.querySelector('h1')?.textContent.trim() === '404') return;

  const articleTitle = title || doc.querySelector('h1')?.textContent.trim() || doc.title;
  const style = readingStyles(doc);
  presentArticle(doc.body, controls, {title:articleTitle, theme, artwork});
  style.addEventListener('load', () => restoreArticleAnchor(doc, source.hash), {once:true});
  doc.head.append(style);
  doc.addEventListener('click', event => {
    if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname === new URL(doc.URL).pathname) return;
    // Keep site and report navigation outside the reading pane.
    if (!articleURL(url.href) && !/\/(?:market-understanding\/?|v4\.html|desk\.html|index\.html)$/.test(url.pathname)) return;
    event.preventDefault();
    location.assign(url);
  });
}

if (source) {
  original.href = originalArticleURL(source);
  original.hidden = false;
  if (title) document.title = title + ' | Market Intelligence Hub';
  frame.title = title || 'Research article';
  frame.addEventListener('load', mountArticle);
  frame.hidden = false;
  frame.src = source;
} else {
  status.textContent = 'Choose an article from the research library.';
}
