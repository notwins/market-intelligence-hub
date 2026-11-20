(function (root) {
  'use strict';

  const url = 'https://the-risk-inside-the-jacket.winstonnggw.chatgpt.site/';
  const title = 'The risk inside the jacket';

  function link(ticker) {
    if (ticker !== 'NVDA' && ticker !== 'NVDA US') return '';
    return `<p class="nvda-article-related"><a href="${url}">Read “${title}”</a> <small>Restricted ChatGPT Site</small></p>`;
  }

  root.NvdaArticle = { link };
})(typeof window !== 'undefined' ? window : globalThis);
