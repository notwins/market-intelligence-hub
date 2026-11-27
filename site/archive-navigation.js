/* Load the Hub banner on direct archive pages. Embedded previews keep the article-only view. */
(() => {
  'use strict';
  if (window.self !== window.top || document.getElementById('hub-primary-assets')) return;
  const base = new URL('./', document.currentScript.src);
  const version = '?v=20261127.archive1';
  const css = document.createElement('link');
  css.id = 'hub-primary-assets';
  css.rel = 'stylesheet';
  css.href = new URL('Primary Navigation - Type CSS - 16-Nov-16.06.css' + version, base);
  const script = document.createElement('script');
  script.src = new URL('Primary Navigation - Type JS - 16-Nov-16.06.js' + version, base);
  script.dataset.archiveNavigation = '';
  document.head.append(css, script);
})();
