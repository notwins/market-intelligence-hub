(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const charts = window.NvidiaCharts;
  const defaultPeers = ["AMD", "INTC", "QCOM"];
  const windows = { quarterly: 45, annual: 125 };
  const day = 86_400_000;
  const green = "#267044";
  const blue = "#416e9b";
  const peerColors = [blue, "#946241", "#7b568c", "#237c84"];
  const group = "Income statement";

  function mount({ financial, companies, nvidiaPeriods, groups, usd, fmt, dollar, companyCell, element, options }) {
    const periods = financial.periods;
    const dateKey = "Period ending";
    const get = (period, key, i) => periods[period][key]?.[i] ?? null;
    const fig = value => Number.isFinite(value) ? dollar(value, 3) + "B" : "—";
    const pct = value => Number.isFinite(value) ? fmt(value, 2) + "%" : "—";
    const growthPct = value => (value > 0 ? "+" : "") + pct(value);
    const compare = $("nv-fin-compare");
    const chooser = $("nv-revenue-period");
    const basis = $("nv-revenue-growth-basis");
    const lookback = $("nv-revenue-range");
    const units = $("nv-revenue-units");
    const chart = $("nv-revenue-scale-chart");
    const tableRows = $("nv-revenue-rows");
    const companyChoices = $("nv-revenue-peer-options");
    const selected = new Set(defaultPeers);
    const inputs = [];
    const activePeriods = {};
    let isComparing = false;
    let activeCompany = 0;

    function closest(candidates, target, maxDays) {
      let match = null;
      let best = maxDays * day;
      for (const candidate of candidates) {
        const gap = Math.abs(candidate.time - target);
        if (gap < best || (gap === best && (!match || candidate.time < match.time))) {
          match = candidate;
          best = gap;
        }
      }
      return match;
    }

    const statements = Object.fromEntries(Object.keys(windows).map(frequency => {
      const prefix = frequency === "annual" ? "Annual " : "Quarterly ";
      const keys = Object.keys(periods).filter(key => key.startsWith(prefix));
      const indexed = (list, i) => list.map(key => {
        const end = get(key, dateKey, i);
        return { key, end, time: Date.parse(end) };
      }).filter(row => Number.isFinite(row.time));
      const references = indexed(nvidiaPeriods[frequency], 0);
      const matched = companies.map((_, i) => {
        if (i === 0) return new Map(references.map(reference => [reference.key, reference]));
        const matches = new Map();
        // Assign each peer filing to a single NVIDIA period before choosing the closest filing for that period.
        for (const candidate of indexed(keys, i)) {
          const reference = closest(references, candidate.time, windows[frequency]);
          if (!reference) continue;
          const prior = matches.get(reference.key);
          const match = closest(prior ? [prior, candidate] : [candidate], reference.time, windows[frequency]);
          matches.set(reference.key, match);
        }
        return matches;
      });
      return [frequency, matched];
    }));

    function comparison(period, peers, frequency, growthBasis) {
      const end = get(period, dateKey, 0);
      const rows = [0, ...peers].map(i => {
        const match = statements[frequency][i].get(period);
        if (!match) return { i, revenue: null, growth: null, end: null, source: null };
        const key = match.key;
        return {
          i, end: match.end, revenue: usd(key, "Revenue", group, i),
          growth: get(key, growthBasis + " / Revenue growth (%)", i),
          source: get(key, "Source document", i),
        };
      });
      const reported = rows.slice(1).filter(row => Number.isFinite(row.revenue) && row.revenue >= 0);
      const peerRevenue = reported.length ? reported.reduce((sum, row) => sum + row.revenue, 0) : null;
      const ownRevenue = rows[0].revenue;
      const total = Number.isFinite(ownRevenue) && ownRevenue >= 0 && peers.length && reported.length === peers.length
        ? ownRevenue + peerRevenue : null;
      return { period, end, rows, ownRevenue, peerRevenue, coverage: reported.length, total: total > 0 ? total : null };
    }

    function showCompany(index) {
      activeCompany = index;
      for (const row of tableRows.rows) row.classList.toggle("nv-statement-selected", Number(row.dataset.company) === index);
      $("nv-revenue-growth-bars").querySelectorAll("button").forEach(button => {
        button.setAttribute("aria-pressed", String(Number(button.dataset.company) === index));
      });
    }

    function drawGrowth(rows) {
      const bars = $("nv-revenue-growth-bars");
      const present = rows.filter(row => Number.isFinite(row.growth));
      const maxUp = Math.max(0, ...present.map(row => row.growth));
      const maxDown = Math.max(0, ...present.map(row => -row.growth));
      const span = maxUp + maxDown || 1;
      bars.style.setProperty("--bar-zero", 100 * maxDown / span + "%");
      bars.replaceChildren(...rows.map(({ i, growth }) => {
        const company = companies[i];
        const button = element("button", "", "nv-statement-bar-row");
        const label = element("span", company.ticker);
        const track = element("span", "", "nv-statement-bar-track");
        track.setAttribute("aria-hidden", "true");
        const value = element("span", growthPct(growth), "nv-revenue-bar-value");
        button.type = "button";
        button.dataset.company = i;
        button.setAttribute("aria-label", company.name + ", revenue growth " + (Number.isFinite(growth) ? growthPct(growth) : "unavailable"));
        if (Number.isFinite(growth)) {
          const bar = element("i", "", growth === 0 ? "nv-statement-bar-zero" : "");
          bar.style.left = 100 * (maxDown + Math.min(0, growth)) / span + "%";
          bar.style.width = 100 * Math.abs(growth) / span + "%";
          bar.style.backgroundColor = growth < 0 ? "#933e44" : i === 0 ? green : blue;
          track.append(bar);
        }
        button.append(label, track, value);
        button.addEventListener("click", () => showCompany(i));
        return button;
      }));
    }

    function drawTable(snapshot) {
      tableRows.replaceChildren(...snapshot.rows.map(item => {
        const { i, end, revenue, growth, source } = item;
        const row = element("tr");
        row.dataset.company = i;
        if (i === 0) row.classList.add("nv-focus");
        const filing = element("td");
        const filingDate = charts.date(end);
        if (end && /^https:\/\//.test(source)) {
          const link = element("a", filingDate);
          link.href = source;
          link.target = "_blank";
          link.rel = "noopener";
          link.setAttribute("aria-label", companies[i].name + " filing for the period ended " + filingDate);
          filing.append(link);
        } else {
          filing.textContent = filingDate;
        }
        const share = snapshot.total && Number.isFinite(revenue) ? revenue / snapshot.total * 100 : null;
        row.append(companyCell(companies[i]), filing, element("td", fig(revenue)),
          element("td", growthPct(growth), growth < 0 ? "nv-neg" : growth > 0 ? "nv-pos" : ""),
          element("td", pct(share)));
        return row;
      }));
    }

    function render() {
      if (!isComparing) return;
      const frequency = $("nv-frequency").value;
      const annual = frequency === "annual";
      basis.querySelector('[value="QoQ"]').disabled = annual;
      if (annual) basis.value = "YoY";
      const dates = nvidiaPeriods[frequency].slice(-Number(lookback.value));
      const peers = companies.map((_, i) => i).filter(i => i > 0 && selected.has(companies[i].ticker));
      const snapshots = dates.map(period => comparison(period, peers, frequency, basis.value));
      const labels = dates.map(period => period.split(" ")[1]);
      const asShare = units.value === "share";
      const plottedValue = (item, value) => {
        if (!asShare) return value;
        return item.total && Number.isFinite(value) ? 100 * value / item.total : null;
      };
      const series = [{ label: "NVIDIA", color: green, values: snapshots.map(item => plottedValue(item, item.ownRevenue)) }];
      if (peers.length <= peerColors.length) {
        peers.forEach((company, index) => {
          series.push({ label: companies[company].ticker, color: peerColors[index],
            values: snapshots.map(item => plottedValue(item, item.rows[index + 1].revenue)) });
        });
      } else {
        series.push({ label: "Matched peers", color: blue, values: snapshots.map(item => plottedValue(item, item.peerRevenue)) });
      }
      const hasPlot = series.some(line => line.values.some(Number.isFinite));
      if (!peers.includes(activeCompany)) activeCompany = 0;
      $("nv-revenue-peer-count").textContent = peers.length + " of " + (companies.length - 1);
      options(chooser, [...snapshots].reverse().map(({ period, end }) => [period, charts.date(end)]), activePeriods[frequency]);
      let initial = dates.indexOf(chooser.value);
      if (initial < 0) initial = dates.length - 1;
      const inspect = index => {
        const snapshot = snapshots[index];
        activePeriods[frequency] = snapshot.period;
        chooser.value = snapshot.period;
        $("nv-revenue-growth-detail").textContent = basis.value + " · NVIDIA period ended " + charts.date(snapshot.end);
        $("nv-revenue-growth-column").textContent = basis.value + " growth";
        $("nv-revenue-share-value").textContent = pct(snapshot.total ? snapshot.ownRevenue / snapshot.total * 100 : null);
        const coverage = snapshot.coverage + " of " + peers.length + " peers with matched revenue";
        $("nv-revenue-share-coverage").textContent = peers.length === 0 ? "Select a peer to calculate NVIDIA’s share."
          : snapshot.total ? coverage + " · " + fig(snapshot.total) + " combined"
            : coverage + " · a complete set is required to calculate share";
        drawGrowth(snapshot.rows);
        drawTable(snapshot);
        showCompany(activeCompany);
      };
      chooser.onchange = () => {
        const index = dates.indexOf(chooser.value);
        if (index < 0) return;
        if (hasPlot) charts.select(chart, index);
        else inspect(index);
      };
      if (!hasPlot) inspect(initial);
      charts.render(chart, {
        title: asShare ? "Share of selected revenue by company" : "Revenue in US dollars, NVIDIA and matched peers",
        dates: snapshots.map(item => item.end),
        axisLabels: labels, selectionLabels: snapshots.map(item => charts.date(item.end)),
        domain: asShare ? { floor: 0, ceil: 100, step: 25 } : undefined,
        axis: asShare ? pct : value => dollar(value, 1) + "B", format: asShare ? pct : fig,
        bars: true, stacked: true, active: initial, onSelect: inspect, series,
      });
    }

    function show(value) {
      isComparing = value;
      $("nv-fin-solo").hidden = value;
      compare.hidden = !value;
      $("nv-fin-solo-toggle").setAttribute("aria-pressed", String(!value));
      $("nv-fin-peer-toggle").setAttribute("aria-pressed", String(value));
      render();
    }

    $("nv-fin-solo-toggle").onclick = () => show(false);
    $("nv-fin-peer-toggle").onclick = () => show(true);
    [$("nv-frequency"), basis, lookback, units].forEach(control => control.addEventListener("change", render));

    const preset = $("nv-revenue-peer-preset");
    options(preset, [["", "Choose a peer set"], ["direct", "AMD, Intel and Qualcomm"],
      ...Object.keys(groups).map(name => [name, name]), ["all", "All 30 peers"], ["none", "Clear selection"]], "");
    preset.onchange = () => {
      const tickers = preset.value === "all" ? companies.slice(1).map(company => company.ticker)
        : preset.value === "direct" ? defaultPeers : groups[preset.value] || [];
      selected.clear();
      for (const ticker of tickers) selected.add(ticker);
      for (const box of inputs) box.checked = selected.has(box.value);
      preset.value = "";
      render();
    };
    companyChoices.replaceChildren();
    for (const company of companies.slice(1)) {
      const label = element("label", "", "nv-statement-peer-option");
      const box = element("input");
      box.type = "checkbox";
      box.value = company.ticker;
      box.checked = selected.has(company.ticker);
      box.onchange = () => {
        if (box.checked) selected.add(box.value);
        else selected.delete(box.value);
        render();
      };
      inputs.push(box);
      label.append(box, element("span", company.name + " · " + company.ticker));
      companyChoices.append(label);
    }
    show(false);
    return show;
  }

  window.NvidiaRevenuePeerHistory = { mount };
})();
