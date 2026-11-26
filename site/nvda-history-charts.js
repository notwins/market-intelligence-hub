(() => {
  "use strict";
  const plots = new WeakMap();
  const fmtDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const compactDate = new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
  function date(value, compact = false) {
    if (!value) return "—";
    const when = new Date(value.length === 7 ? value + "-01" : value);
    return (value.length === 7 || compact ? compactDate : fmtDate).format(when);
  }

  function tickSize(value) {
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const fraction = value / magnitude;
    const step = [1, 2, 2.5, 5, 10].find(n => n >= fraction) || 10;
    return step * magnitude;
  }

  function scale(series, includeZero) {
    const values = series.flatMap(s => s.values.filter(Number.isFinite));
    if (!values.length) return null;
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (includeZero || min < 0) {
      min = Math.min(0, min);
      max = Math.max(0, max);
    }
    const step = tickSize((max - min || Math.max(Math.abs(max) * .25, 1)) / 4);
    let floor = Math.floor(min / step) * step;
    let ceil = Math.ceil(max / step) * step;
    if (floor === ceil) ceil += step;
    return { floor, ceil, step };
  }

  function redraw(plot) {
    const { canvas, model } = plot;
    if (!model || canvas.hidden) return;
    const box = canvas.getBoundingClientRect();
    const width = Math.round(box.width), height = Math.round(box.height);
    if (width < 10 || height < 10) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const fullWidth = Math.round(width * ratio), fullHeight = Math.round(height * ratio);
    if (canvas.width !== fullWidth || canvas.height !== fullHeight) {
      canvas.width = fullWidth;
      canvas.height = fullHeight;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const { dates, series, axis, bars, limits } = model;
    const { floor, ceil, step } = limits;
    const left = width < 430 ? 51 : 69;
    const right = width - 18, top = 18, bottom = height - 37;
    if (right <= left || bottom <= top) return;
    const count = dates.length;
    const gutter = bars ? Math.min((right - left) / (count + 1) / 2, 14) : 0;
    const chartLeft = left + gutter, chartRight = right - gutter;
    const x = i => count === 1 ? (left + right) / 2 : chartLeft + i * (chartRight - chartLeft) / (count - 1);
    const y = value => bottom - (value - floor) * (bottom - top) / (ceil - floor);
    plot.position = { chartLeft, chartRight };
    ctx.font = (width < 430 ? "10" : "11") + "px Segoe UI, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    for (let n = 0; floor + n * step <= ceil + step * .01 && n < 12; n++) {
      const value = +(floor + n * step).toPrecision(10);
      const lineY = y(value);
      ctx.strokeStyle = value === 0 ? "#a2afa3" : "#e0e8dd";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, lineY);
      ctx.lineTo(right, lineY);
      ctx.stroke();
      ctx.fillStyle = "#536257";
      ctx.fillText(axis(value), left - 8, lineY);
    }
    const labelCount = Math.min(count, width < 480 ? 4 : width < 800 ? 6 : 8);
    ctx.fillStyle = "#536257";
    for (let i = 0; i < labelCount; i++) {
      const index = labelCount === 1 ? 0 : Math.round(i * (count - 1) / (labelCount - 1));
      ctx.textAlign = i === 0 ? "left" : i === labelCount - 1 ? "right" : "center";
      ctx.fillText(model.axisLabels?.[index] ?? date(dates[index], true), x(index), bottom + 19);
    }
    for (const s of series) {
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = 2.25;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.setLineDash(s.dash || []);
      if (bars) {
        const bar = Math.min((right - left) / Math.max(count, 1) * .64, 25);
        const baseline = y(Math.max(floor, Math.min(0, ceil)));
        for (const [i, point] of s.values.entries()) {
          if (!Number.isFinite(point)) continue;
          ctx.fillRect(x(i) - bar / 2, Math.min(baseline, y(point)), bar, Math.max(1, Math.abs(baseline - y(point))));
        }
      } else {
        ctx.beginPath();
        let previous = false;
        for (const [i, point] of s.values.entries()) {
          if (Number.isFinite(point)) {
            if (previous) ctx.lineTo(x(i), y(point));
            else ctx.moveTo(x(i), y(point));
          }
          previous = Number.isFinite(point);
        }
        ctx.stroke();
        // Points next to missing observations still have a visible mark.
        if (count > 1) s.values.forEach((point, index) => {
          if (Number.isFinite(point) && !Number.isFinite(s.values[index - 1]) && !Number.isFinite(s.values[index + 1])) {
            ctx.beginPath();
            ctx.arc(x(index), y(point), 2.6, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }
    }
    const cursor = x(plot.active);
    ctx.strokeStyle = "#6a7d69";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(cursor, top);
    ctx.lineTo(cursor, bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const s of series) {
      const selected = s.values[plot.active];
      if (!Number.isFinite(selected)) continue;
      ctx.beginPath();
      ctx.arc(cursor, y(selected), 4, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.strokeStyle = "#fffefa";
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }
  }

  function span(text, tag = "span") {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  }

  function updateSelection(plot, active) {
    plot.active = Math.min(plot.model.dates.length - 1, Math.max(0, active));
    const selected = plot.model.dates[plot.active];
    const period = span(plot.model.selectionLabels?.[plot.active] ?? date(selected), "strong");
    plot.summary.replaceChildren(period);
    for (const s of plot.model.series) {
      const row = span("");
      const mark = document.createElement("i");
      mark.style.setProperty("--series-color", s.color);
      mark.setAttribute("aria-hidden", "true");
      row.append(mark, document.createTextNode(s.label + " "), span(Number.isFinite(s.values[plot.active]) ? plot.model.format(s.values[plot.active]) : "—", "b"));
      plot.summary.append(row);
    }
    const extra = plot.model.extra?.[plot.active];
    if (extra) plot.summary.append(span(extra));
    redraw(plot);
    plot.model.onSelect?.(plot.active);
  }

  function createPlot(container) {
    const canvas = document.createElement("canvas");
    canvas.tabIndex = 0;
    const summary = document.createElement("div");
    summary.className = "nv-chart-values";
    summary.id = container.id + "-values";
    summary.setAttribute("role", "status");
    canvas.setAttribute("aria-describedby", summary.id);
    const placeholder = span("No data for this selection.", "p");
    placeholder.className = "nv-chart-empty";
    container.replaceChildren(canvas, summary, placeholder);
    const plot = { canvas, summary, placeholder, active: 0 };
    const point = event => {
      if (!plot.position) return;
      const { chartLeft, chartRight } = plot.position;
      const last = plot.model.dates.length - 1;
      const relative = event.clientX - canvas.getBoundingClientRect().left;
      const index = Math.max(0, Math.min(last, Math.round((relative - chartLeft) / (chartRight - chartLeft) * last)));
      if (index !== plot.active) updateSelection(plot, index);
    };
    canvas.addEventListener("pointermove", event => { if (event.pointerType === "mouse") point(event); });
    canvas.addEventListener("pointerup", point);
    canvas.addEventListener("keydown", event => {
      const offsets = { ArrowLeft: -1, ArrowRight: 1, PageUp: -4, PageDown: 4 };
      let index = plot.active + (offsets[event.key] ?? 0);
      if (event.key === "Home") index = 0;
      if (event.key === "End") index = plot.model.dates.length - 1;
      if (!Object.hasOwn(offsets, event.key) && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      updateSelection(plot, index);
    });
    new ResizeObserver(() => redraw(plot)).observe(container);
    plots.set(container, plot);
    return plot;
  }

  function render(container, model) {
    const plot = plots.get(container) || createPlot(container);
    const limits = scale(model.series, model.zero || model.bars);
    plot.canvas.hidden = !limits;
    plot.summary.hidden = !limits;
    plot.placeholder.hidden = Boolean(limits);
    plot.model = { ...model, limits };
    if (!limits) return;
    plot.canvas.setAttribute("aria-label", model.title + ". Use the left and right arrow keys to review dates.");
    const last = model.dates.findLastIndex((_, index) => model.series.some(s => Number.isFinite(s.values[index])));
    updateSelection(plot, model.active ?? last);
  }

  window.NvidiaCharts = { render, date };
})();
