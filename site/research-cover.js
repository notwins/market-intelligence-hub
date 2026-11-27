/* Shared cover art for the gallery and article reader. */
const base = new URL('./', import.meta.url);

const themes = [
  ['markets', 'markets', '#784b37', '#efd9cb'],
  ['rates', 'yield', '#36564a', '#dee8d8'],
  ['chips', 'shares', '#436070', '#dce7eb'],
  ['risk', 'review', '#5b4b6c', '#ebe4ee'],
  ['gold', 'gold', '#704d1f', '#f0dfb6'],
  ['global', 'map', '#28555b', '#d3e8e3'],
  ['credit', 'credit', '#713e31', '#efddd4'],
  ['savings', 'cashflow', '#466143', '#e8ebd7'],
  ['notes', 'pen', '#6d4a49', '#f0e1d9'],
  ['infrastructure', 'tools', '#43536c', '#d9e1e9'],
  ['fx', 'fx', '#2d5d58', '#dcebe1'],
  ['portfolio', 'pivot', '#65536a', '#ece3e5']
];
const byTheme = Object.fromEntries(themes.map(([key], index) => [key, index]));

// Ordered from specific subjects to broad beats. The title has priority over tags.
const subjects = [
  ['savings', /\b(?:cpf(?: life| oa)?|temasek 2070|payout|retirement|annuit|pension|savings)/i],
  ['infrastructure', /\b(?:data[ -]?cent(?:er|re)|electricity|power grid|power supply|infrastructure|energy|lng)\b/i],
  ['gold', /\b(?:gold|bullion|precious metal|xau|gld)\b/i],
  ['risk', /\b(?:collars?|sharpe|hedg\w*|option\w*|floor and cap|price of conviction)\b/i],
  ['chips', /\b(?:nvidia|nvda|tsmc|foundry|amd|chips?|semiconductor\w*|alphabet|anthropic|ai|technology)\b/i],
  ['notes', /\b(?:howard marks|personal reading|my thoughts|journal|conviction)\b/i],
  ['fx', /\b(?:[a-z]{3}\s*[\/-]\s*[a-z]{3}|franc|currency|currencies|forex|exchange rate|fx)\b/i],
  ['credit', /\b(?:credit|refinanc\w*|borrowing|cash.flow|liquidity|pimco|private debt|cre)\b/i],
  ['rates', /\b(?:bonds?|treasur\w*|yield\w*|rate\w*|monetary|snb|mas|t-bills|interest|bank\w*)\b/i],
  ['portfolio', /\b(?:diversif\w*|allocation|portfoli\w*|alternatives|concentration|asset|structured investment)\b/i],
  ['global', /\b(?:global|trade|shipping|tariff|macro|econom\w*|growth|inflation|singapore|gic)\b/i],
  ['markets', /\b(?:market|markets|earnings|valuation|stocks?|shares?|index)\b/i]
];
export function pickTheme(title, context) {
  return subjects.find(([, match]) => match.test(title))?.[0]
    || subjects.find(([, match]) => match.test(context))?.[0] || 'notes';
}
function hashTitle(text) {
  let hash = 2166136261;
  for (const char of text.toLowerCase()) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
export function icon(name, className, doc = document) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg');
  const use = doc.createElementNS(ns, 'use');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  use.setAttribute('href', new URL('assets/navigation-atlas.svg?v=2#' + name, base));
  svg.append(use);
  return svg;
}

export function createCover(host, title, key, artwork, destination) {
  const doc = host.ownerDocument;
  const panel = Object.hasOwn(byTheme, key) ? byTheme[key] : byTheme.notes;
  const [, mark, ink, tint] = themes[panel];
  const hash = hashTitle(title);
  const cover = doc.createElement(destination ? 'a' : 'div');
  cover.className = 'research-cover';
  if (destination) {
    cover.href = destination.href;
    cover.target = destination.target;
    cover.rel = destination.rel;
    cover.dataset.researchSource = destination.dataset.researchSource;
    cover.setAttribute('aria-label', 'Read ' + title);
  } else cover.setAttribute('aria-hidden', 'true');
  cover.style.setProperty('--cover-x', 100 * (panel % 4) / 3 + '%');
  cover.style.setProperty('--cover-y', 50 * Math.floor(panel / 4) + '%');
  cover.dataset.crop = String(hash % 4);
  const art = doc.createElement(artwork ? 'img' : 'span');
  art.className = artwork ? 'research-cover-image' : 'research-cover-art';
  if (artwork) {
    art.src = artwork;
    art.alt = '';
  }
  cover.append(art, icon(mark, 'research-cover-icon', doc));
  host.dataset.coverFrame = String(Math.floor(hash / 13) % 3);
  host.style.setProperty('--research-ink', ink);
  host.style.setProperty('--research-tint', tint);
  return cover;
}
