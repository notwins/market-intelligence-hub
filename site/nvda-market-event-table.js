(() => {
  "use strict";
  const body = document.getElementById("nv-market-return-rows");
  const headers = [...body.closest("table").querySelectorAll("[data-event-sort]")];
  const events = window.NvdaMarketEvents;
  const prices = window.NvdaMarketEventPrices;
  const date = window.NvidiaCharts.date;
  const units = ["usd", "rate"];
  let sort = "date", direction = -1, activeRequest;

  function compare(a, b) {
    const newest = b.event.date.localeCompare(a.event.date);
    if (sort === "date") return direction * a.event.date.localeCompare(b.event.date);
    const windowIndex = Math.floor(Number(sort) / units.length);
    const unit = units[Number(sort) % units.length];
    const left = a.windows[windowIndex][unit];
    const right = b.windows[windowIndex][unit];
    if (left === null || right === null) return Number(left === null) - Number(right === null) || newest;
    return direction * (left - right) || newest;
  }

  function render() {
    const rows = events.map(event => ({ event, ...prices.forEvent(event.date) })).sort(compare);
    const nodes = rows.map(({ event, base, windows }) => {
      const row = document.createElement("tr");
      const day = document.createElement("time");
      day.dateTime = event.date;
      day.textContent = date(event.date);
      row.insertCell().append(day);

      const title = document.createElement("th");
      title.scope = "row";
      const source = document.createElement("a");
      source.href = event.url;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.textContent = event.title;
      title.append(source);
      row.append(title);

      for (const interval of windows) {
        for (const unit of units) {
          const cell = row.insertCell();
          if (interval[unit] !== null) {
            cell.textContent = prices.format(unit, interval[unit]);
            cell.dataset.move = interval.direction;
            cell.title = date(base[0]) + " to " + date(interval.point[0]);
          } else {
            cell.textContent = base ? "Pending" : "Unavailable";
            cell.title = "Target " + date(interval.target);
          }
        }
      }
      return row;
    });
    body.replaceChildren(...nodes);
  }

  for (const button of headers) {
    button.addEventListener("click", () => {
      const key = button.dataset.eventSort;
      direction = key === sort ? -direction : -1;
      sort = key;
      for (const heading of headers) {
        if (heading === button) heading.parentElement.setAttribute("aria-sort", direction < 0 ? "descending" : "ascending");
        else heading.parentElement.removeAttribute("aria-sort");
      }
      render();
    });
  }

  function refreshPending() {
    const incomplete = events.find(event => prices.forEvent(event.date).windows.some(interval => interval.usd === null));
    const request = incomplete && prices.refreshFor(incomplete.date);
    if (!request || request === activeRequest) return;
    activeRequest = request;
    request.then(render);
  }

  render();
  refreshPending();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshPending(); });
})();
