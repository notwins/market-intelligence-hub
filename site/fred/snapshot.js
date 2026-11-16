/* Current archive labels and downloads; dated source links remain immutable. */
(() => {
  'use strict';
  FredArchive.catalog().then(catalog => {
    const saved = new Date(catalog.snapshot + 'T00:00:00Z').toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
    document.querySelectorAll('[data-fred-date]').forEach(node => { node.textContent = saved; });
    document.querySelectorAll('[data-fred-count]').forEach(node => { const key=node.dataset.fredCount;node.textContent=(key==='external_count'?catalog.dataset_count-catalog.fred_count:catalog[key])?.toLocaleString('en-US') ?? '—'; });
    document.querySelectorAll('[data-fred-link]').forEach(node => {
      const path = catalog[node.dataset.fredLink];
      if (path) node.href = FredArchive.resolve(path);
    });
    let status = document.getElementById('fred-refresh-status');
    if (!status) {
      status = document.createElement('p'); status.id = 'fred-refresh-status'; status.setAttribute('role','status');
      status.style.cssText = 'font:11px/1.5 system-ui;color:#596f67;padding:8px 22px;margin:0;background:#edf2ed;border-bottom:1px solid #d9e2db';
      const anchor = document.querySelector('.fred-hub-links') || document.querySelector('header');
      anchor?.after(status);
    }
    const summary = catalog.refresh;
    if (summary) {
      const checked = new Date(catalog.checked_at).toLocaleString('en-SG',{timeZone:'Asia/Singapore',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
      status.textContent = summary.kind==='local_import' ? `Shared archive · ${catalog.dataset_count} datasets · ${catalog.record_count.toLocaleString('en-US')} source records · ${summary.imported_count} new files imported ${checked} SGT · monthly overlap refresh on the 1st` : `Monthly refresh · ${checked} SGT · ${summary.checked_count}/${catalog.dataset_count} datasets checked · ${summary.matched ?? '—'} matched · ${summary.added} added · ${summary.revised} revised · 3-month overlap`;
      if (summary.failed_count) {
        status.style.background = '#f7e8d9';
        status.textContent += ` · ${summary.failed_count} source checks failed; previous verified values retained.`;
      }
      if (catalog.refresh_report_url) {
        const link = document.createElement('a'); link.href = FredArchive.resolve(catalog.refresh_report_url); link.textContent = ' Refresh details ↗'; status.append(link);
      }
    } else status.textContent = `Saved ${saved} · monthly source refresh on the 1st · each series keeps its observation date.`;
  }).catch(() => {
    document.querySelectorAll('[data-fred-date]').forEach(node => { node.textContent = 'Archive unavailable'; });
  });
})();
