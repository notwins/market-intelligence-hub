(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const charts = window.NvidiaCharts;
  const eventPrices = window.NvdaMarketEventPrices;
  const closeFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  const monthName = month => monthFormat.format(new Date(month + "-01"));
  const categories = {
    nvidia: { label: "NVIDIA", mark: "N", color: "#286d42" },
    us: { label: "U.S. & macro", mark: "U", color: "#9a5731" },
    tech: { label: "Breakthroughs", mark: "T", color: "#465e96" },
    mixed: { label: "Multiple categories", color: "#46574b" },
  };

  // The comparison archive starts after the first few months of the price chart.
  const openingQuarters = [
    { end: "2016-10-30", reported: "2016-11-10", revenue: 2.004,
      source: "https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-third-quarter-fiscal-2017" },
    { end: "2017-01-29", reported: "2017-02-09", revenue: 2.173,
      source: "https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-fourth-quarter-and-fiscal-2017" },
  ];

  function renderPriceMoves(container, date, element) {
    const { base, windows } = eventPrices.forEvent(date);
    const levels = element("dl", "", "nv-market-move-grid");
    for (const { months, target, point, usd, rate, direction } of windows) {
      const level = element("div", "", "nv-market-move");
      const value = element("dd");
      level.append(element("dt", months === 1 ? "1 month" : "3 months"), value);
      if (usd !== null) {
        level.dataset.move = direction;
        const signed = element("strong");
        signed.append(element("span", eventPrices.format("usd", usd)), element("span", " / ", "nv-market-move-divider"),
          element("span", eventPrices.format("rate", rate)));
        value.append(signed, element("small", closeFormat.format(point[1]) + " close · " + charts.date(point[0])));
      } else {
        value.append(element("strong", base ? "Pending close" : "Unavailable"),
          element("small", "Target " + charts.date(target)));
      }
      levels.append(level);
    }
    const baseline = base ? closeFormat.format(base[1]) + " baseline · " + charts.date(base[0]) : "Baseline close unavailable";
    container.replaceChildren(element("p", baseline, "nv-market-move-base"), levels);
  }

  function mount({ events, months, quarters, actual, mkt, usd, dollar, marketFormat, element, refresh }) {
    const price = $("nv-market-chart");
    const pe = $("nv-market-pe-chart");
    const revenue = $("nv-market-revenue-chart");
    const overlayNote = $("nv-market-overlay-note");
    const toggles = $("nv-market-overlays");
    const rail = $("nv-market-annotations");
    const filters = $("nv-market-event-filter");
    const eventBox = $("nv-market-events");
    const stack = $("nv-market-stack");
    const eventToggle = $("nv-market-overlay-events");
    const range = $("nv-market-range");
    const eventMonth = $("nv-market-event-month");
    const eventChoice = $("nv-market-event-choice");
    const eventSelect = $("nv-market-event-select");
    const caption = $("nv-market-event-caption");
    const captionText = $("nv-market-event-caption-text");
    const list = $("nv-market-event-list");
    const prev = $("nv-market-event-prev");
    const next = $("nv-market-event-next");
    const eventsByHash = new Map(events.map(event => ["#" + event.id, event]));
    let activeMonth, activeEventMonth, activeEvent;
    const archiveQuarters = quarters.map(period => ({
      reported: actual(period, "Filing or release date"),
      end: actual(period, "Period ending"),
      revenue: usd(period, "Revenue", "Income statement", 0),
    })).filter(row => row.reported && row.end && Number.isFinite(row.revenue));
    const releases = [...openingQuarters, ...archiveQuarters].sort((a, b) => a.end.localeCompare(b.end));

    const availableAt = month => {
      const close = mkt(month, "Close Date");
      return close ? releases.findLast(row => row.reported < close) : undefined;
    };

    toggles.addEventListener("change", refresh);
    filters.addEventListener("change", refresh);

    const besideChart = () => getComputedStyle(stack).display === "grid";

    function openLinkedEvent() {
      const event = eventsByHash.get(window.location.hash);
      if (!event) return;
      const month = event.date.slice(0, 7);
      const index = months.indexOf(month);
      if (index < 0) return;
      const needed = months.length - index;
      if (Number(range.value) < needed) {
        const fitting = [...range.options].find(option => Number(option.value) >= needed);
        if (!fitting) return;
        range.value = fitting.value;
      }
      eventToggle.checked = true;
      filters.querySelector('input[value="' + event.category + '"]').checked = true;
      activeMonth = activeEventMonth = month;
      activeEvent = event;
      refresh();

      const desktop = besideChart();
      const card = $(event.id);
      const destination = desktop ? stack : card;
      const focus = desktop ? rail.querySelector('[aria-pressed="true"]') : card;
      destination?.scrollIntoView({ block: "start", behavior: "instant" });
      focus?.focus({ preventScroll: true });
    }

    window.addEventListener("hashchange", openLinkedEvent);
    $("nv-market-return-rows").addEventListener("click", action => {
      const link = action.target.closest("a");
      if (link?.hash !== window.location.hash || !eventsByHash.has(link.hash)
        || action.button !== 0 || action.ctrlKey || action.metaKey || action.altKey || action.shiftKey) return;
      action.preventDefault();
      openLinkedEvent();
    });
    queueMicrotask(openLinkedEvent);

    function render(model, primaryKey) {
      const { dates } = model;
      const eventsOn = eventToggle.checked;
      const peToggle = $("nv-market-overlay-pe");
      peToggle.disabled = primaryKey === "P/E TTM x";
      peToggle.closest("label").title = peToggle.disabled ? "Trailing P/E is already the main chart." : "";
      const peOn = peToggle.checked && !peToggle.disabled;
      const revOn = $("nv-market-overlay-revenue").checked;
      const visible = [price, ...(peOn ? [pe] : []), ...(revOn ? [revenue] : [])];
      pe.parentElement.hidden = !peOn;
      revenue.parentElement.hidden = !revOn;
      filters.hidden = !eventsOn;
      eventBox.hidden = !eventsOn;
      caption.hidden = !eventsOn;
      overlayNote.hidden = !peOn && !revOn;
      overlayNote.textContent = [
        peOn && "Trailing P/E uses positive trailing earnings in the monthly archive.",
        revOn && "Revenue carries forward the latest quarterly figure reported before each monthly close.",
      ].filter(Boolean).join(" ");
      if (revOn) {
        overlayNote.append(" Opening quarters: ");
        openingQuarters.forEach((row, index) => {
          if (index) overlayNote.append(" · ");
          const link = element("a", "FY2017 Q" + (index + 3));
          link.href = row.source;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          overlayNote.append(link);
        });
      }

      const selected = new Set(Array.from(filters.querySelectorAll("input:checked"), input => input.value));
      const byMonth = new Map();
      const inRange = new Set(dates);
      if (eventsOn) {
        for (const event of events) {
          const month = event.date.slice(0, 7);
          if (!inRange.has(month) || !selected.has(event.category)) continue;
          if (!byMonth.has(month)) byMonth.set(month, []);
          byMonth.get(month).push(event);
        }
      }

      const eventMonths = [...byMonth.keys()];
      const markers = eventMonths.map(month => {
        const entries = byMonth.get(month);
        const category = entries.every(entry => entry.category === entries[0].category) ? entries[0].category : "mixed";
        const button = element("button", entries.length === 1 ? categories[category].mark : String(entries.length), "nv-market-event-dot");
        const index = dates.indexOf(month);
        button.type = "button";
        button.title = entries.map(entry => entry.title).join(" · ");
        button.setAttribute("aria-controls", list.id);
        button.setAttribute("aria-label", monthName(month) + " · " + button.title);
        button.style.setProperty("--event-color", categories[category].color);
        button.addEventListener("focus", () => selectEventMonth(index));
        button.addEventListener("click", event => {
          selectEventMonth(index);
          // Scripted activation leaves scrolling and focus to its caller.
          if (!event.isTrusted || besideChart()) return;
          const moves = list.querySelector("[data-active] .nv-market-move-grid") || eventBox;
          if (moves.getBoundingClientRect().bottom > window.innerHeight - 46) {
            eventBox.scrollIntoView({ block: "start" });
            eventMonth.focus({ preventScroll: true });
          }
        });
        return { month, button, index, color: categories[category].color };
      });
      rail.replaceChildren(...markers.map(marker => marker.button));
      rail.hidden = !markers.length;

      function position({ chartLeft, chartRight }) {
        if (!markers.length) return;
        const lastRight = [];
        const laneHeight = 28;
        const lanes = [];
        for (const { button, index } of markers) {
          const x = chartLeft + index * (chartRight - chartLeft) / Math.max(1, dates.length - 1);
          let lane = lastRight.findIndex(end => end + 30 <= x);
          if (lane < 0) lane = lastRight.length;
          lastRight[lane] = x;
          button.style.left = x + "px";
          button.style.top = (lane * laneHeight + 5) + "px";
          lanes.push([button, lane]);
        }
        const height = lastRight.length * laneHeight + 12;
        rail.style.height = height + "px";
        for (const [button, lane] of lanes) {
          button.style.setProperty("--nv-event-stem", height - lane * laneHeight - 30 + "px");
        }
      }

      function showEvents(month) {
        if (!eventsOn) return;
        activeEventMonth = month;
        for (const marker of markers) marker.button.setAttribute("aria-pressed", String(marker.month === month));
        const earlier = eventMonths.findLast(value => value < month);
        const later = eventMonths.find(value => value > month);
        prev.disabled = !earlier;
        next.disabled = !later;
        prev.onclick = () => { if (earlier) selectEventMonth(dates.indexOf(earlier)); };
        next.onclick = () => { if (later) selectEventMonth(dates.indexOf(later)); };
        eventMonth.textContent = monthName(month);
        const selection = byMonth.get(month) || [];
        eventChoice.hidden = selection.length < 2;
        captionText.textContent = selection.length ? monthName(month) + " · " + selection.map(event => event.title).join(" · ")
          : eventMonths.length ? "Select a marker to read about its events." : "No selected events in this range.";
        if (!selection.length) {
          list.replaceChildren(element("p", eventMonths.length ? "No selected events in this month." : "No selected events in this range.", "nv-muted"));
          return;
        }
        const prior = selection.indexOf(activeEvent);
        const selectedIndex = Math.max(0, prior);
        activeEvent = selection[selectedIndex];
        eventSelect.replaceChildren(...selection.map((event, index) => new Option(event.title, index)));
        eventSelect.value = String(selectedIndex);
        const close = mkt(month, "Close Date");
        list.replaceChildren(...selection.map(event => {
          const topic = categories[event.category];
          const article = element("article", "", "nv-market-event-card");
          article.id = event.id;
          article.tabIndex = -1;
          article.toggleAttribute("data-active", event === activeEvent);
          article.style.setProperty("--event-color", topic.color);
          const metadata = charts.date(event.date) + " · " + topic.label;
          article.append(element("p", metadata, "nv-market-event-meta"), element("h4", event.title), element("p", event.note));
          if (close && event.date > close) article.append(element("p", "After the last plotted close on " + charts.date(close) + ".", "nv-muted"));
          const returns = element("div", "", "nv-market-event-moves");
          renderPriceMoves(returns, event.date, element);
          eventPrices.refreshFor(event.date)?.then(() => {
            if (returns.isConnected) renderPriceMoves(returns, event.date, element);
          });
          article.append(returns);
          const source = element("a", event.source + " ↗");
          source.href = event.url;
          source.target = "_blank";
          source.rel = "noopener noreferrer";
          article.append(source);
          return article;
        }));
        eventSelect.onchange = () => {
          const index = Number(eventSelect.value);
          activeEvent = selection[index];
          [...list.children].forEach((card, item) => card.toggleAttribute("data-active", item === index));
        };
      }

      function setMonth(index) {
        const month = dates[index];
        if (!month || activeMonth === month) return;
        activeMonth = month;
        visible.forEach(chart => charts.select(chart, index));
      }

      function selectEventMonth(index) {
        setMonth(index);
        const month = dates[index];
        if (byMonth.has(month) && month !== activeEventMonth) showEvents(month);
      }

      let active = dates.indexOf(activeMonth);
      if (active < 0) {
        active = model.series[0].values.findLastIndex(Number.isFinite);
        if (active < 0) active = dates.length - 1;
      }
      activeMonth = dates[active];
      const alignment = { dates, active, marketStyle: true, sharedTimeline: eventsOn || peOn || revOn, onSelect: setMonth };
      charts.render(price, { ...model, ...alignment, annotations: markers, onLayout: position });
      if (peOn) {
        const format = n => marketFormat(n, "multiple");
        charts.render(pe, { ...alignment, title: "Trailing P/E", zero: true, format, axis: format,
          series: [{ label: "Trailing P/E", color: "#465e96", values: dates.map(month => mkt(month, "P/E TTM x")) }],
          extra: dates.map(month => {
            const end = mkt(month, "TTM Net Income Period End");
            return end ? "Trailing earnings through " + charts.date(end) : "";
          }),
        });
      }
      if (revOn) {
        const reported = dates.map(availableAt);
        const format = n => dollar(n, 2) + "B";
        charts.render(revenue, { ...alignment, title: "Latest reported quarterly revenue", zero: true, step: true,
          format, axis: n => dollar(n, 1) + "B",
          series: [{ label: "Quarterly revenue", color: "#9a5731", values: reported.map(row => row?.revenue ?? null) }],
          extra: reported.map(row => row ? "Quarter ended " + charts.date(row.end) + " · reported by " + charts.date(row.reported) : ""),
        });
      }
      showEvents(byMonth.has(activeEventMonth) ? activeEventMonth : byMonth.has(activeMonth) ? activeMonth : eventMonths.at(-1) || activeMonth);
    }
    return render;
  }

  window.NvdaMarketTimeline = { mount };
})();
