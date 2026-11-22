(function (root) {
  'use strict';

  const archive = 'https://market-intel-fundamentals-vault.vercel.app/bos-research.bin';
  const maxSize = 1500000;
  const id = 'bos-research';
  const doc = root.document;
  let databaseRequest;

  function database() {
    return databaseRequest ??= new Promise((resolve, reject) => {
      const request = root.indexedDB.open('market-intel-private-research', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('access');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function stored(action, key) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('access', action === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('access');
      const request = action === 'put' ? store.put(key, id) : store[action](id);
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function openArchive(key) {
    const response = await root.fetch(archive, {
      credentials: 'omit', cache: 'no-cache', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('The private library could not load. Refresh to try again.');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength < 29 || bytes.byteLength > maxSize) throw new Error('Invalid encrypted library.');
    const compressed = await root.crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let size = 0, raw = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxSize) {
        await reader.cancel();
        throw new Error('The private library exceeds the expected size.');
      }
      raw += decoder.decode(value, { stream: true });
    }
    return raw + decoder.decode();
  }

  async function read() {
    const key = await stored('get');
    return key ? openArchive(key) : null;
  }

  root.StocksBeta2PrivateResearch = { read, forget: () => stored('delete') };
  const setup = doc.getElementById('sb2-private-research-activation');
  if (!setup) return;

  const fragment = root.location.hash.slice(1);
  if (fragment) root.history.replaceState(null, '', root.location.pathname);
  const activate = doc.getElementById('sb2-private-research-connect');
  if (!/^[A-Za-z0-9_-]{43}$/.test(fragment)) {
    setup.textContent = 'Open the activation link in your private OneDrive copy.';
    return;
  }

  activate.hidden = false;
  setup.textContent = 'Connect this browser to the private BOS research library.';
  activate.addEventListener('click', async () => {
    activate.disabled = true;
    setup.textContent = 'Checking private access…';
    try {
      const secret = Uint8Array.from(root.atob(fragment.replace(/-/g, '+').replace(/_/g, '/') + '='), char => char.charCodeAt(0));
      const key = await root.crypto.subtle.importKey('raw', secret, 'AES-GCM', false, ['decrypt']);
      secret.fill(0);
      const data = JSON.parse(await openArchive(key));
      if (data?.format !== 'stocks-beta2-bos-library' || data.version !== 1 || !Object.keys(data.listings ?? {}).length) {
        throw new Error('Invalid research format.');
      }
      await stored('put', key);
      root.location.replace('stocks-beta2.html?research=1');
    } catch {
      setup.textContent = 'Private access could not be saved. Try again in the browser you use for Beta 2.';
      activate.disabled = false;
    }
  });
})(window);
