(() => {
  'use strict';
  const E = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const search = document.getElementById('dataset-search'), source = document.getElementById('dataset-source'), group = document.getElementById('dataset-group');
  const status = document.getElementById('catalog-status'), body = document.getElementById('dataset-rows');
  let rows = [];
  function render() {
    const words = search.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const shown = rows.filter(row => (!source.value || row.provider === source.value) && (!group.value || row.group === group.value) && words.every(word => [row.id,row.title,row.group,row.provider,row.unit].join(' ').toLocaleLowerCase().includes(word)));
    body.innerHTML = shown.map(row => `<tr id="${E(row.id)}"><td><b>${E(row.name)}</b><small>${E(row.id)} · ${E(row.provider)} · ${E(row.group)}</small><a href="${E(row.source_url)}" target="_blank" rel="noopener noreferrer">Original source ↗</a><details><summary>Definition &amp; checksum</summary><p>${E(row.title)}</p><small>${E(row.adjustment)}<br>Source update: ${E(row.source_updated)}<br>Retrieved: ${E(row.retrieved_at)}<br>SHA-256: <span style="overflow-wrap:anywhere">${E(row.sha256)}</span></small></details></td><td>${E(row.unit)}<small>${E(row.frequency)}</small></td><td>${E(row.first)}<br>to ${E(row.last)}</td><td>${row.rows.toLocaleString('en-US')}<small>${row.observations.toLocaleString('en-US')} nonmissing records</small></td><td><a download href="${E(FredArchive.resolve(row.csv_url))}">CSV ↓</a><a href="${E(FredArchive.resolve(row.json_url))}">JSON ↗</a><button type="button" data-cite="${E(row.id)}">Copy citation</button></td></tr>`).join('');
    status.textContent = `${shown.length} of ${rows.length} datasets · saved 16 Nov 2026 · dates are source observation periods`;
  }
  for (const control of [search,source,group]) control.addEventListener('input',render);
  body.addEventListener('click',async event => {
    const button = event.target.closest('[data-cite]');
    if (!button) return;
    const row = rows.find(row => row.id === button.dataset.cite), message = document.getElementById('copy-status');
    const citation = row.citation + ' Archived CSV: ' + FredArchive.resolve(row.csv_url);
    try { await navigator.clipboard.writeText(citation); message.textContent = 'Copied citation for ' + row.id + '.'; }
    catch { message.textContent = citation; }
  });
  FredArchive.catalog().then(data => {
    rows = data.datasets;
    [...new Set(rows.map(row => row.group))].sort().forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = value; group.append(option); });
    render();
    const id = decodeURIComponent(location.hash.slice(1));
    if (id && rows.some(row => row.id === id)) { search.value = id; render(); }
  }).catch(error => { status.textContent = 'The catalogue could not load. Use the ZIP and inventories above, or reload. ' + error.message; status.setAttribute('role','alert'); });
})();
