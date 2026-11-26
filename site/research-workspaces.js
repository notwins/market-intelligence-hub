/* Editorial workspace presentation. Data rendering stays with the page owners. */
const sheet = document.createElement('link');
sheet.rel = 'stylesheet';
sheet.href = new URL('./research-workspaces.css?v=2', import.meta.url).href;
document.head.append(sheet);

const html = document.documentElement;
const view = document.getElementById('view');
const library = document.querySelector('[data-library-ready]');
const preference = 'market-hub-desk-motion';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let enabled = true;
try { enabled = localStorage.getItem(preference) !== 'off'; } catch { /* Tab-only setting. */ }

const gear = document.createElement('button');
gear.type = 'button';
gear.className = 'ws-settings';
gear.setAttribute('aria-label', 'Reading settings');
gear.setAttribute('aria-haspopup', 'dialog');
gear.title = 'Reading settings';
gear.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 3-.5 2.1-2 .9-2-.7-2 3.4 1.6 1.5v2.3l-1.6 1.5 2 3.4 2.1-.6 2 .9.5 2.1h4l.5-2.1 2-.9 2.1.6 2-3.4-1.6-1.5v-2.3l1.6-1.5-2-3.4-2.1.7-2-.9L14 3z"/><circle cx="12" cy="12" r="3"/></svg>';
const option = document.createElement('section');
option.className = 'ws-motion-option';
option.innerHTML = '<label><span>Interactive scrolling</span><input type="checkbox" role="switch" aria-describedby="ws-motion-note"></label><p id="ws-motion-note"></p>';
const toggle = option.querySelector('input');
const note = option.querySelector('p');
let page;
let settings;
let settingsObserver;
function mountOption() {
  if (!page || !settings || settings.contains(option)) return;
  const head = settings.querySelector('.display-heading,header');
  if (head) head.after(option);
}
function mountChrome() {
  if (!page) return;
  const jump = document.querySelector('.hub-primary-more');
  if (jump && jump.nextElementSibling !== gear) jump.after(gear);
  const next = document.querySelector('#display-settings, #hub-site-settings');
  if (next === settings) return;
  settingsObserver?.disconnect();
  settings = next;
  if (!settings) return;
  gear.setAttribute('aria-controls', settings.id);
  gear.toggleAttribute('data-display-open', settings.id === 'display-settings');
  settingsObserver = new MutationObserver(mountOption);
  settingsObserver.observe(settings, {childList:true});
  mountOption();
}
gear.addEventListener('click', () => {
  mountChrome();
  if (settings?.id !== 'hub-site-settings') return;
  document.querySelector('[data-site-settings-open]')?.click();
  if (settings.open) settings.addEventListener('close', () => gear.focus({preventScroll:true}), {once:true});
});

const targets = [
  '.ws-intro', '.ws-plate', '.library-choices a', '.mu-writeups-heading h2',
  '.mu-writeups-grid > article', '.library-group > summary', '.rr-results > li',
  '.calls-companies > h3', '.calls-ledger > h3', '.calls-edition .watchlist-card',
  '.featured-research', '.cd-heading h2', '.cd-card', '.publication-heading h2',
  '.briefing-lead > article', '.market-snapshot h2', '.overview-card-grid > *',
  '.latest-quick-reads h2', '.latest-quick-card', '#view > .section .section-title h2'
].join(',');
const seen = new Set();
const running = new Set();
let entryObserver;
let dataObserver;
function stopEffects() {
  entryObserver?.disconnect();
  dataObserver?.disconnect();
  running.forEach(animation => animation.cancel());
  running.clear();
}
function observePage() {
  if (!page || !enabled || reduced.matches || !window.IntersectionObserver || !Element.prototype.animate) return;
  entryObserver = new IntersectionObserver(entries => {
    for (const {target, isIntersecting} of entries) {
      if (!isIntersecting) continue;
      entryObserver.unobserve(target);
      const heading = target.querySelector('h2,h3,h4,b');
      const id = target.id || heading?.textContent || target.querySelector('img')?.src || target.textContent;
      const identity = target.className + ':' + id.trim().slice(0,160);
      if (seen.has(identity) || target.matches(':focus-within')) continue;
      seen.add(identity);
      const card = target.matches('.ws-plate, article, li, .library-choices a, .latest-quick-card, .overview-card-grid > *');
      const step = Math.min(28, Math.max(8, innerWidth * .023));
      const x = card ? step * (target.matches(':nth-child(even)') ? -1 : 1) : 0;
      const animation = target.animate([
        {opacity:.35, transform:'translate(' + x + 'px,' + (card ? 0 : 10) + 'px)'},
        {opacity:1, transform:'none'}
      ], {duration:510,easing:'cubic-bezier(.2,.7,.25,1)'});
      running.add(animation);
      animation.finished.catch(() => {}).finally(() => running.delete(animation));
    }
  }, {rootMargin:'0px 0px -3% 0px'});
  function visit(node, action) {
    if (node.nodeType !== 1) return;
    if (node.matches(targets)) action(node);
    if (node.childElementCount) node.querySelectorAll(targets).forEach(action);
  }
  const register = node => entryObserver.observe(node);
  const unregister = node => entryObserver.unobserve(node);
  page.querySelectorAll(targets).forEach(register);
  dataObserver = new MutationObserver(records => {
    for (const record of records) {
      record.removedNodes.forEach(node => visit(node, unregister));
      record.addedNodes.forEach(node => visit(node, register));
    }
  });
  dataObserver.observe(page, {childList:true, subtree:true});
}
function applyPreference() {
  stopEffects();
  toggle.checked = enabled && !reduced.matches;
  toggle.disabled = reduced.matches;
  note.textContent = reduced.matches ? 'Your device’s reduced-motion setting pauses the effects.' : 'Fade headings and slide selected cards into view. This choice also applies to the main desk.';
  observePage();
}
toggle.addEventListener('change', () => {
  enabled = toggle.checked;
  try { localStorage.setItem(preference, enabled ? 'on' : 'off'); } catch { /* Keep this tab's choice. */ }
  applyPreference();
});
reduced.addEventListener('change', applyPreference);
window.addEventListener('storage', event => {
  if (event.key === preference || event.key === null) {
    enabled = event.newValue !== 'off';
    applyPreference();
  }
});

function syncPage() {
  const calls = view?.querySelector('.calls-edition');
  const briefing = Boolean(view?.querySelector('.briefing-masthead'));
  const next = library || calls || (briefing ? view : null);
  if (next === page) return;
  if (!calls || !html.classList.contains('ws-calls')) seen.clear();
  page = next;
  html.classList.toggle('ws-blog', Boolean(library));
  html.classList.toggle('ws-calls', Boolean(calls));
  html.classList.toggle('ws-briefing', briefing);
  if (page) mountChrome();
  else {
    gear.remove();
    option.remove();
    settingsObserver?.disconnect();
    settings = undefined;
  }
  applyPreference();
}
if (view) new MutationObserver(syncPage).observe(view, {childList:true});
// The library's existing site loader mounts its navigation and Settings asynchronously.
new MutationObserver(mountChrome).observe(document.body, {childList:true});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-ws-jump]');
  if (!button || !page?.contains(button)) return;
  const target = document.getElementById(button.dataset.wsJump);
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
  target.focus({preventScroll:true});
  target.scrollIntoView({block:'start',behavior:'instant'});
});
syncPage();
