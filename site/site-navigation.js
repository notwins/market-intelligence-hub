/* The existing public map is the single source of destinations. Load it on demand. */
(() => {
  'use strict';
  if (!document.querySelector('[data-site-map]') || !window.HTMLDialogElement) return;
  const mapURL = new URL('site-map.html', document.currentScript.src);
  const blueprintURL = new URL('blueprint.html', mapURL);
  let dialog, opener, loading, loaded = false, followingLink = false;
  function close() { dialog.close(); }
  function create() {
    dialog = document.createElement('dialog');
    dialog.id = 'hub-map-dialog';
    dialog.setAttribute('aria-labelledby', 'hub-map-title');
    dialog.innerHTML = '<header class="hub-map-head"><div><h2 id="hub-map-title">Where do you want to go?</h2><p>Open a section, or search for a page.</p></div><button type="button" aria-label="Close site map">×</button></header><div class="hub-map-content"><p role="status">Loading the site map…</p></div><footer class="hub-map-foot"><a href="' + mapURL.href + '">Open map as a full page →</a><a class="hub-blueprint-link" href="' + blueprintURL.href + '">Website blueprint →</a></footer>';
    document.body.append(dialog);
    dialog.querySelector('button').addEventListener('click', close);
    dialog.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
      if (e.key === 'Tab') {
        const items = [...dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),summary,[tabindex="0"]')].filter(n => {
          if (n.checkVisibility) return n.checkVisibility({checkVisibilityCSS:true});
          if (!n.getClientRects().length || n.closest('[hidden]')) return false;
          for (let d=n.parentElement; d && d!==dialog; d=d.parentElement) {
            if (d.tagName==='DETAILS' && !d.open && !d.querySelector('summary')?.contains(n)) return false;
          }
          return true;
        });
        const first=items[0], last=items.at(-1);
        if (e.shiftKey && document.activeElement===first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement===last) { e.preventDefault(); first?.focus(); }
      }
    }, true);
    dialog.addEventListener('close', () => {
      document.documentElement.classList.remove('hub-map-open');
      document.querySelectorAll('[data-site-map]').forEach(a => a.setAttribute('aria-expanded', 'false'));
      if (!followingLink && opener?.isConnected) opener.focus({preventScroll:true});
      followingLink = false;
    });
    dialog.addEventListener('click', e => {
      const a = e.target.closest('a[href]');
      if (a && !e.ctrlKey && !e.metaKey && !e.shiftKey && a.target !== '_blank') {
        // A repeated fragment does not emit hashchange. Reopen a collapsed
        // destination explicitly before native anchor navigation takes over.
        const destination = new URL(a.href, location.href);
        if (destination.origin === location.origin && destination.pathname === location.pathname && destination.search === location.search) {
          let target;
          try { target = document.getElementById(decodeURIComponent(destination.hash.slice(1))); } catch {}
          for (let node=target; node; node=node.parentElement) if (node.tagName==='DETAILS') node.open=true;
        }
        followingLink = true;
        close();
      }
    });
  }
  async function load() {
    if (loaded) return;
    if (loading) return loading;
    const content = dialog.querySelector('.hub-map-content');
    const recoverFocus = content.contains(document.activeElement);
    const shouldRecoverFocus = () => recoverFocus && dialog.open &&
      (document.activeElement === document.body || document.activeElement === dialog);
    content.innerHTML = '<p role="status">Loading the site map…</p>';
    loading = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(mapURL.href, {signal:controller.signal,cache:'no-cache'});
        if (!response.ok) throw Error('Map unavailable');
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const controls = doc.querySelector('.map-controls'), tree = doc.querySelector('#site-tree');
        if (!controls || !tree || !window.HubSiteMap) throw Error('Map unavailable');
        const fragment = document.createDocumentFragment();
        for (const source of [controls, tree]) {
          const copy = document.importNode(source, true);
          copy.querySelectorAll('script,iframe,object,embed').forEach(n => n.remove());
          copy.querySelectorAll('*').forEach(n => {
            for (const a of [...n.attributes]) if (a.name.startsWith('on')) n.removeAttribute(a.name);
          });
          copy.querySelectorAll('a[href]').forEach(a => {
            const url = new URL(a.getAttribute('href'), mapURL);
            if (url.origin !== mapURL.origin) a.remove(); else a.href = url.href;
          });
          copy.querySelectorAll('details').forEach(n => { n.open = false; });
          fragment.append(copy);
        }
        content.replaceChildren(fragment);
        HubSiteMap.mount({querySelector:s=>content.querySelector(s),getElementById:id=>content.querySelector('#'+id)});
        loaded = true;
        if (shouldRecoverFocus()) content.querySelector('#map-search').focus();
      } catch {
        content.innerHTML = '<p role="status">The map could not load. Try again, or open the full-page map below.</p><button type="button" class="hub-map-retry">Try again</button>';
        content.querySelector('button').addEventListener('click', () => load());
        if (shouldRecoverFocus()) content.querySelector('button').focus();
      } finally { clearTimeout(timeout); loading = null; }
    })();
    return loading;
  }
  document.querySelectorAll('[data-site-map]').forEach(a => {
    a.setAttribute('aria-haspopup', 'dialog');
    a.setAttribute('aria-controls', 'hub-map-dialog');
    a.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-site-map]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button) return;
    e.preventDefault();
    if (!dialog) create();
    opener = a;
    dialog.showModal();
    document.documentElement.classList.add('hub-map-open');
    a.setAttribute('aria-expanded', 'true');
    // Focus immediately; a late network response must not steal focus.
    (dialog.querySelector('#map-search') || dialog.querySelector('button')).focus();
    load();
  });
})();
