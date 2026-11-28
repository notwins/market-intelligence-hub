import {pickTheme} from './research-cover.js?v=1';
import {publishedCover} from './research-cover-metadata.js?v=1';
import {directArticleURL, originalArticleURL} from './research-reader-route.js?v=2';
import {presentArticle, readingControls, readingStyles, restoreArticleAnchor} from './research-reading.js?v=2';

const base = new URL('./', import.meta.url);

export async function openDirectReader(scope = document.body, options = {}) {
  const source = new URL(location.href);
  if (window.self !== window.top || source.searchParams.get('mih-view') === 'original'
      || document.querySelector('.research-direct-bar')) return;
  const published = directArticleURL(source);
  if (!published && !options.title) return;
  const heading = scope.querySelector('h1');
  if (!options.title && (!scope.querySelector('h1, main, article') || heading?.textContent.trim() === '404')) return;

  const sheet = readingStyles(document);
  const styled = new Promise(resolve => {
    sheet.addEventListener('load', () => resolve(true), {once:true});
    sheet.addEventListener('error', () => resolve(false), {once:true});
  });
  document.head.append(sheet);
  const [ready, metadata] = await Promise.all([
    styled, published ? publishedCover(published).catch(() => undefined) : Promise.resolve()
  ]);
  if (!ready || !scope.isConnected || document.querySelector('.research-direct-bar')) return;

  const bar = document.createElement('div');
  bar.className = 'reader-bar research-direct-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Article reader');
  bar.innerHTML = `
    <a class="reader-library" data-icon="library">Research library</a>
    <div class="reader-actions">
      <a class="reader-original" target="_blank" rel="noopener" data-icon="source">Original<span> article</span></a>
      <details class="reader-jump" hidden>
        <summary data-icon="map">Jump to</summary>
        <nav aria-label="Article sections"></nav>
      </details>
      <button type="button" class="reader-settings" aria-label="Reading settings" title="Reading settings" data-icon="settings"></button>
    </div>`;
  bar.querySelector('.reader-library').href = new URL('market-understanding/', base);
  bar.querySelector('.reader-original').href = originalArticleURL(source);
  const dialog = document.createElement('dialog');
  dialog.className = 'reader-dialog research-direct-dialog';
  dialog.setAttribute('aria-labelledby', 'direct-reading-settings');
  dialog.innerHTML = `
    <form method="dialog">
      <h2 id="direct-reading-settings">Reading settings</h2>
      <button type="submit" aria-label="Close settings">×</button>
    </form>
    <label><span>Interactive scrolling</span><input type="checkbox" role="switch" aria-describedby="direct-motion-note"></label>
    <p id="direct-motion-note"></p>`;

  const controls = readingControls(bar, dialog);
  const mountPoint = document.querySelector('body > .hub-archive-spacer') || document.querySelector('body > .hub-primary');
  if (mountPoint) mountPoint.after(bar);
  else document.body.prepend(bar);
  document.body.append(dialog);
  document.documentElement.classList.add('research-direct-active');
  const snapshot = /^nvda-history-snapshot-/.test(source.pathname.split('/').at(-1));
  const title = options.title || metadata?.title || (snapshot ? 'NVIDIA Historical' : heading?.textContent.trim()) || document.title;
  const theme = metadata?.theme || pickTheme(title, [
    document.querySelector('meta[name="description"]')?.content, source.pathname.split('/').slice(2).join(' ').replaceAll('-', ' ')
  ].join(' '));
  presentArticle(scope, controls, {
    ...metadata, title, theme, headings: options.headings, before: scope === document.body ? bar : undefined
  });
  restoreArticleAnchor(document, source.hash);
}
