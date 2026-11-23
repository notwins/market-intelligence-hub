(() => {
  const guide = document.getElementById('accumulator-guide');
  if (!guide) return;

  const steps = [
    {
      title: 'Pick the two strikes', image: 'strikes', width: 604, height: 452,
      copy: 'Under <a href="#setup">Pricing &amp; capital</a>, enter a $100.00 trade-day price and $300,000 target. Choose <b>Clear selection</b> in Compare. In the <a href="#library">pricing tables</a>, find the six-month quotes and click <b>98.05%</b> under OCBC SI, then <b>95.12%</b> under JPM SN. Both have a two-month guarantee.',
      alt: 'Six-month OCBC SI and JPM SN pricing tables. Outlines mark the 98.05% and 95.12% strike buttons.'
    },
    {
      title: 'Test an early knock-out', image: 'payout', width: 1148, height: 532,
      copy: 'Open <a href="#compare">View comparison</a>. In <b>Scenario prices &amp; observation days</b>, set the early rally to day 1 and $120. Select <b>KO within guarantee</b>. The two guaranteed months buy 1,020 SI shares or 1,052 SN shares. The example assumes you sell them at $120.',
      alt: 'Day-one payout comparison. OCBC SI refunds $200,022 and earns $22,389. JPM SN refunds $200,133 and earns $26,174.'
    },
    {
      title: 'See when shares were bought', image: 'chart', width: 1135, height: 406,
      copy: 'Click <b>$95.12</b> in the comparison funding table to plot the JPM scenario. Turn on <b>Show 80% probability cone</b>. The +1,052 label marks the shares bought. Shading shows a modelled range of future NVDA prices. To try a new path, choose a month, change its price and click <b>Apply price</b>.',
      alt: 'JPM SN chart showing the day-one knock-out, 1,052 purchased shares, strike, knock-out level and shaded NVDA price cone.'
    },
    {
      title: 'Download the scenario report', image: 'download', width: 755, height: 74,
      copy: 'Click <a href="#generate-report">Download scenario PDF</a> below the comparison. The report uses your selected structures, target capital, prices and assumptions. In this example the JPM note returns $200,133 of unused cash. Adding $126,240 of share-sale proceeds gives a total of $326,373 and a gain of $26,174.',
      alt: 'The Download scenario PDF button and the confirmation that a four-page PDF was generated.'
    }
  ];

  guide.innerHTML = `<details class="walkthrough"><summary><span>Step-by-step guide</span><small>Try a $300,000 example with OCBC SI and JPM SN</small></summary>
    <ol>${steps.map((step, index) => `<li><h3>${step.title}</h3><p>${step.copy}</p>
      <details class="walk-image"><summary>See screenshot ${index + 1}</summary><a href="accumulator-guide/${step.image}.webp" target="_blank" rel="noopener"><img src="accumulator-guide/${step.image}.webp" alt="${step.alt}" width="${step.width}" height="${step.height}" loading="lazy"></a></details></li>`).join('')}</ol></details>`;
})();
