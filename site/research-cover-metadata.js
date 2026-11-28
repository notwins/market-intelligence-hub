import {pickTheme} from './research-cover.js?v=1';
import {articleKey, articleURL, artworkURL} from './research-reader-route.js?v=2';

const base = new URL('./', import.meta.url);
const gallery = new URL('market-understanding/', base);

export function cardCover(card, title, baseURL = card.ownerDocument.baseURI) {
  const context = [...card.querySelectorAll('.mu-eyebrow, .mu-card-tags, .rr-tags')].map(node => node.textContent).join(' ');
  const image = card.querySelector('figure img, img:not([class*="logo"]):not([class*="flag"])');
  const src = image?.currentSrc || image?.getAttribute('src');
  return {title, theme: pickTheme(title, context), artwork: artworkURL(src, baseURL)?.href};
}

export function cardArticleLinks(card) {
  return [...card.querySelectorAll('a[href]:not([download])')].filter(link =>
    !link.matches('.mu-open-brief') && !/^open brief\b/i.test(link.textContent.trim()));
}

async function get(url, type) {
  const response = await fetch(url);
  if (response.ok) return response[type]();
}

async function tagContext(ids) {
  const standard = await get(new URL('data/external-source-standard.json', base), 'json').catch(() => undefined);
  const labels = new Map((standard?.tags || []).map(tag => [tag.id, tag.label]));
  return (ids || []).map(id => labels.get(id) || id.replace(/[._-]/g, ' ')).join(' ');
}

async function legacyCover(source) {
  const key = articleKey(source);
  const html = await get(gallery, 'text').catch(() => undefined);
  if (html) {
    const catalogue = new DOMParser().parseFromString(html, 'text/html');
    for (const card of catalogue.querySelectorAll('.mu-writeup')) {
      const title = card.querySelector('h3')?.textContent.trim();
      if (!title) continue;
      const primary = cardArticleLinks(card).map(link => articleURL(new URL(link.getAttribute('href'), gallery)))
        .find(url => url && !url.hash);
      if (primary && articleKey(primary) === key) return cardCover(card, title, gallery);
    }
  }
  const register = await get(new URL('data/research-register.json', base), 'json').catch(() => undefined);
  const match = register?.entries?.find(entry => {
    const url = entry.href && articleURL(new URL(entry.href, base));
    return url && articleKey(url) === key && entry.state === 'published';
  });
  if (match?.title) {
    return {title: match.title, theme: pickTheme(match.title, await tagContext(match.tags))};
  }
}

export async function publishedCover(source) {
  const independent = /^\/market-intelligence-content\/research\/([a-z0-9-]+)$/.exec(articleKey(source));
  if (independent) {
    const recordURL = new URL('/market-intelligence-content/data/research-records/' + independent[1] + '.json', base);
    const payload = await get(recordURL, 'json').catch(() => undefined);
    const record = payload?.record;
    if (record?.id === independent[1] && typeof record.title === 'string') {
      const context = [record.category, await tagContext(record.tags)].join(' ');
      return {title: record.title, theme: pickTheme(record.title, context)};
    }
    return;
  }
  if (source.pathname.startsWith(base.pathname + 'market-understanding/') || source.pathname.startsWith(base.pathname + 'research/')) {
    return legacyCover(source);
  }
}
