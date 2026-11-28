import {icon} from './research-cover.js?v=1';
import {cardCover, publishedCover} from './research-cover-metadata.js?v=1';
import {articleURL} from './research-reader-route.js?v=2';
import {readingCover, readingMotion, readingPreference, readingStyles} from './research-reading.js?v=3';

const mounted = new WeakMap();

function installStyles() {
  if (document.getElementById('quick-preview-styles')) return;
  const reader = readingStyles(document);
  const style = document.createElement('link');
  style.id = 'quick-preview-styles';
  style.rel = 'stylesheet';
  style.href = new URL('research-quick-preview.css?v=3', import.meta.url);
  document.head.append(reader, style);
}

export function quickPreview(dialog, {
  body, original, full, label = 'Quick read', jumpLabel = 'Go to brief',
  sectionIcons = {}, motionTargets
}) {
  if (mounted.has(dialog)) return mounted.get(dialog);
  installStyles();

  const bar = dialog.querySelector('.mu-brief-bar, :scope > header');
  const heading = bar.querySelector('h2');
  const close = bar.querySelector('button');
  const title = document.createElement('span');
  title.className = 'quick-preview-label';
  title.append(icon('book', 'reader-icon'), label);
  title.setAttribute('aria-hidden', 'true');

  const tools = document.createElement('div');
  tools.className = 'quick-preview-tools';
  const jump = document.createElement('a');
  jump.className = 'quick-preview-jump';
  jump.href = '#';
  jump.append(icon('map', 'reader-icon'), jumpLabel);
  jump.addEventListener('click', event => {
    event.preventDefault();
    body.focus({preventScroll: true});
    body.scrollIntoView({block: 'start', behavior: motionAllowed() ? 'smooth' : 'instant'});
  });
  const settings = document.createElement('details');
  settings.className = 'quick-preview-settings';
  settings.innerHTML = `
    <summary aria-label="Reading settings" title="Reading settings"></summary>
    <div class="quick-preview-options">
      <label><span>Interactive scrolling</span><input type="checkbox" role="switch"></label>
      <p></p>
    </div>`;
  const gear = settings.querySelector('summary');
  gear.append(icon('settings', 'reader-icon'));
  settings.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !settings.open) return;
    event.preventDefault();
    event.stopPropagation();
    settings.open = false;
    gear.focus();
  });
  const note = settings.querySelector('p');
  note.id = heading.id + '-motion';
  const toggle = settings.querySelector('input');
  toggle.setAttribute('aria-describedby', note.id);
  close.classList.add('quick-preview-close');
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close ' + label.toLowerCase());
  tools.append(jump, settings, close);
  bar.prepend(title);
  bar.append(tools);
  bar.classList.add('quick-preview-bar');
  (heading.parentElement === bar ? heading : heading.parentElement).classList.add('quick-preview-name');

  const links = document.createElement('div');
  links.className = 'quick-preview-links';
  const download = document.createElement('a');
  download.hidden = true;
  download.download = '';
  download.append(icon('archive', 'reader-icon'), 'Download PDF');
  if (original) {
    const old = original.parentElement;
    links.append(original, download);
    if (old.matches('p') && !old.textContent.trim() && !old.children.length) old.remove();
  }
  if (full) {
    links.append(full);
    full.prepend(icon('report', 'reader-icon'));
  }
  bar.append(links);

  const coverSlot = document.createElement('div');
  coverSlot.className = 'quick-preview-cover';
  bar.after(coverSlot);
  body.classList.add('quick-preview-body');
  body.tabIndex = -1;
  dialog.classList.add('quick-preview');

  let effects;
  function syncMotion() {
    if (!effects) return;
    effects.stop();
    if (dialog.open && motionAllowed()) effects.start();
  }
  const motionAllowed = readingPreference(toggle, note, syncMotion);

  function syncLinks() {
    const hasOriginal = original?.hasAttribute('href') && !original.hidden;
    const source = hasOriginal ? new URL(original.href) : null;
    const pdf = Boolean(source && /\.pdf$/i.test(source.pathname));
    if (hasOriginal) original.replaceChildren(icon(pdf ? 'papers' : 'source', 'reader-icon'), pdf ? 'Open PDF' : 'Open brief');
    download.hidden = !pdf || source.origin !== location.origin;
    if (!download.hidden) download.href = source.href;
    else download.removeAttribute('href');
    links.hidden = !hasOriginal && !full;
  }
  if (original) new MutationObserver(syncLinks).observe(original, {attributes: true, attributeFilter: ['href', 'hidden']});
  syncLinks();

  function syncOpen() {
    if (dialog.open) {
      dialog.scrollTop = 0;
      syncLinks();
    } else {
      settings.open = false;
      effects?.stop();
      effects = undefined;
      coverSlot.replaceChildren();
    }
    syncMotion();
  }
  new MutationObserver(syncOpen).observe(dialog, {attributes: true, attributeFilter: ['open']});

  const controller = {
    cover(meta) {
      effects?.stop();
      effects = undefined;
      const cover = readingCover(document, {...meta, kicker: label});
      if (meta.mark) {
        cover.querySelector('.research-cover-icon').replaceWith(icon(meta.mark, 'research-cover-icon'));
      }
      const intro = cover.querySelector('.research-reading-intro');
      if (meta.byline) {
        const date = document.createElement('p');
        date.className = 'quick-preview-byline';
        date.textContent = meta.byline;
        intro.append(date);
      }
      if (meta.credit) {
        const credit = document.createElement('a');
        credit.href = meta.credit;
        credit.className = 'quick-preview-art-credit';
        credit.textContent = 'Art credit';
        intro.append(credit);
      }
      for (const heading of body.querySelectorAll('h3')) {
        const mark = Object.hasOwn(sectionIcons, heading.textContent) && sectionIcons[heading.textContent];
        if (mark && !heading.querySelector('svg')) heading.prepend(icon(mark, 'reader-icon research-chapter-icon'));
      }
      coverSlot.replaceChildren(cover);
      if (window.IntersectionObserver && window.ResizeObserver && Element.prototype.animate) {
        const targets = motionTargets ? [...body.querySelectorAll(motionTargets)] : [body];
        effects = readingMotion(document, cover, targets, {scroller: dialog, progress: dialog});
        syncMotion();
      }
    }
  };
  mounted.set(dialog, controller);
  if (dialog.open) syncOpen();
  return controller;
}

export function libraryQuickPreviews() {
  for (const [id, trigger, body, original] of [
    ['research-quick-read', '[data-quick-read]', '[data-brief-content]', '[data-open-brief]'],
    ['feed-quick-read', '[data-feed-brief]', '[data-feed-content]', '[data-feed-direct]']
  ]) {
    const dialog = document.getElementById(id);
    if (!dialog || mounted.has(dialog)) continue;
    const preview = quickPreview(dialog, {body: dialog.querySelector(body), original: dialog.querySelector(original)});
    document.addEventListener('click', event => {
      const button = event.target.closest?.(trigger);
      const card = button?.closest('.mu-writeup');
      const title = card?.querySelector('h3')?.textContent.trim();
      if (title && !button.hidden) preview.cover(cardCover(card, title));
    }, true);
  }
}

export async function overviewQuickCover(report) {
  const source = articleURL(new URL(report.href, location.href));
  if (source) {
    const cover = await publishedCover(source);
    if (cover) return cover;
  }
  return {title: report.title};
}
