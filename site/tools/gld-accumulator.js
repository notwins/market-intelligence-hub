'use strict';
(async () => {
  const el = id => document.getElementById(id);
  const form = el('terms'), result = el('result');
  const money = n => 'USD ' + Metals.format(n);
  let history = [];
  function anniversary(day, months) {
    const d = new Date(day+'T00:00:00Z');
    const end = new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+months+1,0));
    end.setUTCDate(Math.min(d.getUTCDate(), end.getUTCDate()));
    return end.toISOString().slice(0,10);
  }
  function monthlyInputs() {
    const count = Number(el('months').value);
    const previous = [...el('month-prices').querySelectorAll('input')].map(input => input.value);
    el('month-prices').replaceChildren();
    for (let m = 0; m < count; m++) {
      const label = document.createElement('label');
      label.textContent = 'Month '+(m+1);
      const input = document.createElement('input');
      Object.assign(input,{type:'number', min:'0', max:'1000000', step:'any', required:true,
        disabled:el('mode').value !== 'scenario', value:previous[m] ?? el('spot').value});
      label.append(input);
      el('month-prices').append(label);
    }
    el('minimum').max = String(count);
  }
  function configure() {
    const scenario = el('mode').value === 'scenario';
    el('start-label').hidden = scenario;
    el('start').disabled = scenario;
    el('spot-label').hidden = !scenario;
    el('spot').disabled = !scenario;
    el('spot').required = scenario;
    el('path').hidden = !scenario;
    monthlyInputs();
    if (!history.length) return;
    const latest = history.at(-1).date;
    const lastStart = history.findLast(r => anniversary(r.date, Number(el('months').value)) <= latest);
    el('start').min = history[0].date;
    el('start').max = lastStart.date;
    if (!el('start').value || el('start').value > lastStart.date) el('start').value = lastStart.date;
  }
  function render() {
    const historical = el('mode').value === 'history';
    el('period').textContent = historical ? 'Replay begins on the first trading close on or after the trade date. Monthly observations end on the last trading close on or before each monthly anniversary.' :
      'The scenario uses the NVDA simulator’s estimated trading-day schedule and linearly interpolates daily closes between your monthly inputs.';
    if (!form.checkValidity()) {
      result.textContent = 'Enter valid capital, strike, knock-out and guaranteed months to see the outcome.';
      return;
    }
    try {
      const months = Number(el('months').value);
      const quote = {months, minimum:el('minimum').valueAsNumber,strike:el('strike').valueAsNumber,ko:el('ko').valueAsNumber};
      let spot, daily, observations;
      if (historical) {
        const first = history.findIndex(r => r.date >= el('start').value);
        if (first < 0) throw Error('Choose a trade date in the downloaded history.');
        const trade = history[first];
        spot = trade.close;
        const lastDay = anniversary(trade.date, months);
        if (lastDay > history.at(-1).date) throw Error('Choose an earlier trade date for a complete tenor.');
        observations = history.slice(first+1).filter(r => r.date <= lastDay);
        quote.knownMonthEnds = Array.from({length:months}, (_,i) =>
          observations.findLastIndex(r => r.date <= anniversary(trade.date,i+1))+1);
        quote.days = observations.length;
        daily = observations.map(r => r.close);
        el('period').textContent += ' Replay: '+trade.date+' ('+money(spot)+') to '+observations.at(-1).date+' · '+daily.length+' trading sessions.';
      } else {
        spot = el('spot').valueAsNumber;
        daily = AccumulatorModel.monthlyPath(quote,spot,[...el('month-prices').querySelectorAll('input')].map(i=>i.valueAsNumber));
      }
      const sim = AccumulatorModel.simulateDaily(quote,spot,el('capital').valueAsNumber,daily);
      const hold = AccumulatorBenchmark.buyAndHold(sim.payment,spot,daily.at(-1));
      const ko = sim.koDay ? (historical ? observations[sim.koDay-1].date : 'Day '+sim.koDay) : 'No knock-out';
      const path = [spot,...daily].map((p,i)=>[i,p]);
      const plot = Metals.chart(path,'GLD share price with strike and knock-out levels',{
        ticks:[[0,'Trade'],[daily.length,'Day '+daily.length]],
        guides:[{name:'Strike',value:sim.strike,color:'#24766b'},{name:'Knock-out',value:sim.ko,color:'#a95634'}]});
      const ledger = sim.rows.map(r => '<tr><td>'+r.month+(historical?' · '+observations[r.day-1].date:'')+'</td><td>'+Metals.format(r.price)+'</td><td>'+r.bought+'</td><td>'+r.shares+'</td><td>'+Metals.format(r.refund)+'</td><td>'+r.status+'</td></tr>').join('');
      result.innerHTML = Metals.metrics([
        ['Initial payment',money(sim.payment)],['Shares per month',String(sim.base)],['Knock-out observation',ko],
        ['GLD shares acquired',String(sim.end.shares)],['Cash refunded',money(sim.end.refunded)],
        ['Final value',money(sim.end.value)],['Accumulator profit / loss',money(sim.profit)],['Buy-and-hold profit / loss',money(hold.pnl)]
      ])+'<h3>GLD path · USD per share</h3>'+plot+'<p class="hint">Strike '+money(sim.strike)+' (teal dashed) · Knock-out '+money(sim.ko)+' (rust dashed)</p>'+
        '<hr class="history-cut"><div class="table-wrap"><table><caption>Monthly share and cash ledger</caption><thead><tr><th>Month</th><th>GLD close</th><th>Acquired</th><th>Total shares</th><th>Refund (USD)</th><th>Event</th></tr></thead><tbody>'+ledger+'</tbody></table></div>';
    } catch(error) { result.textContent = error.message; }
  }
  form.addEventListener('submit', e => e.preventDefault());
  try {
    history = await Metals.series('gld');
    el('spot').value = history.at(-1).close;
    configure();
    form.addEventListener('input', e => {
      if (e.target === el('months') || e.target === el('mode')) configure();
      render();
    });
    render();
  } catch(error) { result.textContent = error.message; }
})();
