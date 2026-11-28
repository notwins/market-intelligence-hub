(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  function bindNext({ select, button, choices, setValue = value => { select.value = value; } }) {
    const upcoming = () => choices[(choices.findIndex(([value]) => value === select.value) + 1) % choices.length];
    function update() {
      button.title = "Next key ranking metric · " + upcoming()[1];
      button.setAttribute("aria-label", button.title);
    }
    button.addEventListener("click", () => {
      setValue(upcoming()[0]);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    select.addEventListener("change", update);
    update();
  }

  function axis(values) {
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const rough = (max - min || 1) / 4;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const step = (magnitude && [1, 2, 2.5, 5, 10].find(n => n * magnitude >= rough) * magnitude) || rough;
    const low = Math.floor(min / step) * step;
    const ceiling = Math.ceil(max / step) * step;
    const high = Number.isFinite(ceiling) ? (ceiling || (low === 0 ? step : 0)) : max;
    const pct = value => 100 * ((value - low) / (high - low));
    const ticks = [];
    for (let i = 0; i < 8 && low + i * step <= high + step * 0.00001; i++) {
      const tick = low + i * step;
      if (Number.isFinite(tick)) ticks.push(Math.abs(tick / step) < 0.00001 ? 0 : tick);
    }
    return { pct, ticks };
  }

  function mount(prefix, { companyMark, element }) {
    const part = suffix => $(prefix + "-" + suffix);
    const figure = part("chart");
    const content = part("chart-data");
    const viewport = part("window");
    const bars = part("bars");
    const readout = part("readout");
    let groupKey, selectedTicker;
    const updateOverflow = () => figure.classList.toggle("lab-rank-scrollable", viewport.scrollWidth > viewport.clientWidth + 1);
    new ResizeObserver(updateOverflow).observe(viewport);

    function render(entries, { key, label, higher, format, axisFormat = format, onSelect }) {
      part("watermark").textContent = label;
      const fresh = key !== groupKey;
      groupKey = key;
      const oldScroll = viewport.scrollLeft;
      const atRight = oldScroll >= viewport.scrollWidth - viewport.clientWidth - 1;
      const eligible = entries.filter(entry => Number.isFinite(entry.value)).sort((a, b) =>
        (higher ? a.value - b.value : b.value - a.value) || a.company.ticker.localeCompare(b.company.ticker));
      content.hidden = readout.hidden = eligible.length === 0;
      part("empty").hidden = eligible.length > 0;
      if (!eligible.length) {
        bars.replaceChildren();
        return;
      }

      const { pct, ticks } = axis(eligible.map(entry => entry.value));
      const guides = ticks.map(tick => {
        const mark = element("span", "", tick === 0 ? "lab-rank-guide lab-rank-zero" : "lab-rank-guide");
        mark.style.bottom = pct(tick) + "%";
        mark.append(element("span", axisFormat(tick)));
        return mark;
      });
      part("guides").replaceChildren(...guides);

      const buttons = eligible.map((entry, i) => {
        const { company, value, featured } = entry;
        const rank = eligible.length - eligible.findLastIndex(other => other.value === value);
        const button = element("button", "", "lab-rank-company");
        button.type = "button";
        button.dataset.ticker = company.ticker;
        button.classList.toggle("lab-rank-featured", Boolean(featured));
        const title = company.name + " · " + label + " " + format(value) + " · rank " + rank + " of " + eligible.length;
        button.title = title;
        button.setAttribute("aria-label", title);
        const track = element("span", "", "lab-rank-track");
        track.setAttribute("aria-hidden", "true");
        const bar = element("span", "", "lab-rank-bar");
        bar.classList.toggle("lab-rank-negative", value < 0);
        bar.style.bottom = pct(Math.min(0, value)) + "%";
        bar.style.height = Math.abs(pct(value) - pct(0)) + "%";
        const identity = element("span", "", "lab-rank-identity");
        identity.setAttribute("aria-hidden", "true");
        identity.append(companyMark(company), element("span", company.ticker));
        track.append(bar);
        button.append(track, identity);
        const select = () => {
          activate(i);
          onSelect?.(entry);
        };
        button.addEventListener("click", select);
        button.addEventListener("focus", select);
        button.addEventListener("keydown", event => {
          const targets = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: buttons.length - 1 };
          if (!Object.hasOwn(targets, event.key)) return;
          event.preventDefault();
          buttons[Math.min(buttons.length - 1, Math.max(0, targets[event.key]))].focus();
        });
        return button;
      });

      function activate(index) {
        const { company, value, context } = eligible[index];
        selectedTicker = company.ticker;
        buttons.forEach((button, i) => {
          button.tabIndex = i === index ? 0 : -1;
          button.setAttribute("aria-pressed", String(i === index));
        });
        const rank = eligible.length - eligible.findLastIndex(entry => entry.value === value);
        readout.replaceChildren(
          element("span", "#" + rank + " of " + eligible.length, "lab-rank-badge"),
          element("strong", company.name),
          element("span", format(value), "lab-rank-value"),
          element("span", context),
        );
      }

      bars.style.setProperty("--rank-count", eligible.length);
      bars.replaceChildren(...buttons);
      const previous = fresh ? -1 : eligible.findIndex(entry => entry.company.ticker === selectedTicker);
      activate(previous < 0 ? eligible.length - 1 : previous);
      viewport.scrollLeft = fresh || atRight ? viewport.scrollWidth : oldScroll;
      updateOverflow();
    }

    return { render };
  }

  window.NvidiaLogoRanking = { mount, bindNext };
})();

