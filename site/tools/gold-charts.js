'use strict';
(async () => {
  const target = document.querySelector('#charts');
  try {
    const [spot, gld, index] = await Promise.all(['xau-spot','gld','xau-index'].map(Metals.series));
    const charts = [
      ['Gold bullion · USD', 'USD / troy oz', spot, 'usd_per_oz', '#96701c'],
      ['Gold bullion · SGD', 'SGD / troy oz', spot, 'sgd_per_oz', '#26766e'],
      ['SPDR Gold Shares · GLD', 'USD / ETF share', gld, 'close', '#305b86'],
      ['PHLX Gold/Silver Sector · XAU', 'Index points', index, 'close', '#725c81']
    ];
    const range = document.querySelector('#range');
    function render() {
      const cutoff = new Date(Math.max(...charts.map(c => Date.parse(c[2].at(-1).date))));
      cutoff.setUTCFullYear(cutoff.getUTCFullYear()-Number(range.value || 0));
      target.innerHTML = charts.map(([name,unit,rows,key,color]) => {
        const selected = rows.filter(r => r[key] !== null && (range.value === 'all' || Date.parse(r.date) >= cutoff));
        if (!selected.length) return '<figure><h2>'+name+'</h2><p>No observations in this period.</p></figure>';
        const latest = selected.at(-1);
        return '<figure><h2>'+name+'</h2><p class="quote">'+Metals.format(latest[key])+' <small>'+unit+'</small></p>'+
          Metals.history(selected,key,name,color)+'<figcaption>'+selected[0].date+' to '+latest.date+' · '+selected.length.toLocaleString()+' observations</figcaption></figure>';
      }).join('');
    }
    range.addEventListener('change', render);
    render();
  } catch (error) { target.textContent = error.message; }
})();
