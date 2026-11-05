((root) => {
  'use strict';
  const key = 'market-intelligence-shortlist-v1';
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function rows(keys, data) {
    return keys.map(saved => {
      const [type, ...parts] = String(saved).split(':'), identifier = parts.join(':');
      const record = type === 'stock' ? (data.stocks || []).find(x => x.ticker === identifier) : type === 'bond' ? (data.bonds || []).find(x => x.id === identifier) : null;
      return {key:saved,type,identifier,description:record?.name || 'Reference not found in the current directory',url:record?.url || ''};
    });
  }
  function csv(rows) {
    const cell = value => '"' + String(value ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g,'""') + '"';
    return '\ufeff' + [['Type','Identifier','Description','Research URL','Saved key'],...rows.map(x => [x.type,x.identifier,x.description,x.url,x.key])].map(r => r.map(cell).join(',')).join('\r\n');
  }
  if (typeof module === 'object' && module.exports) { module.exports = {rows,csv}; return; }
  const $ = id => document.getElementById(id);
  function download(name,content,type) {
    const url = URL.createObjectURL(new Blob([content],{type})), anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),4000);
  }
  async function start() {
    let keys;
    try { keys = JSON.parse(localStorage.getItem(key) || '[]'); if (!Array.isArray(keys)) throw Error(); }
    catch { $('saved-status').textContent = 'The saved list could not be read in this browser. Its stored data has not been changed.'; return; }
    $('export-keys').disabled = false;
    $('export-keys').addEventListener('click',() => download('market-research-saved-keys.json',JSON.stringify(keys,null,2),'application/json'));
    let data = {}, available = true;
    try { const response = await fetch('data/securities.json',{cache:'no-store'}); if (!response.ok) throw Error(); data = await response.json(); }
    catch { available = false; }
    const items = rows(keys,data);
    $('saved-status').textContent = `${items.length} saved securities.` + (!available ? ' The directory could not load; saved keys are still available for export.' : items.length ? ' Original reference links are shown below.' : ' Save stocks or bonds in the research directory to build a shortlist.');
    $('saved-list').innerHTML = items.length ? '<div class="table-wrap"><table><thead><tr><th>Type / identifier</th><th>Description</th><th>Research</th></tr></thead><tbody>' + items.map(x => `<tr><td>${esc(x.type)} · ${esc(x.identifier || x.key)}</td><td>${esc(x.description)}</td><td>${/^https?:\/\//.test(x.url) ? `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Original reference</a>` : 'Reference unavailable'}</td></tr>`).join('') + '</tbody></table></div>' : '';
    $('export-shortlist').disabled = false;
    $('export-shortlist').addEventListener('click',() => download('my-market-research-shortlist.csv',csv(items),'text/csv;charset=utf-8'));
  }
  start();
})(globalThis);
