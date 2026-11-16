/* Shared, read-only data access for present and future FRED visualisations. */
(() => {
  'use strict';
  const base = new URL('../data/fred/', document.currentScript.src);
  let pending;
  async function json(url) {
    const response = await fetch(url,{cache:'no-store'});
    if (!response.ok) throw Error('Archive HTTP ' + response.status);
    return response.json();
  }
  function resolve(relative) {
    const url = new URL(relative, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw Error('Invalid archive path');
    return url.href;
  }
  async function catalog() {
    if (!pending) pending = json(new URL('catalog.json', base)).then(data => {
      if (data.schema_version !== 1 || !Array.isArray(data.datasets)) throw Error('Unsupported archive schema');
      return data;
    }).catch(error => { pending = null; throw error; });
    return pending;
  }
  async function metadata(id) {
    const data = await catalog(), entry = data.datasets.find(row => row.id === id);
    if (!entry) throw Error('Unknown FRED archive dataset: ' + id);
    return entry;
  }
  window.FredArchive = Object.freeze({catalog, resolve, metadata,
    load: async id => json(resolve((await metadata(id)).json_url)),
    csvURL: async id => resolve((await metadata(id)).csv_url)});
})();
