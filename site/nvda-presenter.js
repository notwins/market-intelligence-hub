/* The narration and action cues live in the collapsed script in nvda-history.html. */
(() => {
  "use strict";

  const byId = id => document.getElementById(id);
  const main = byId("main");
  const launch = byId("nv-presenter-open");
  const panel = byId("nv-presenter");
  const picker = byId("nv-presenter-chapter");
  const caption = byId("nv-presenter-caption");
  const status = byId("nv-presenter-status");
  const progress = byId("nv-presenter-progress");
  const play = byId("nv-presenter-toggle");
  const prev = byId("nv-presenter-prev");
  const next = byId("nv-presenter-next");
  const voice = byId("nv-presenter-voice");
  const close = byId("nv-presenter-close");
  const synth = window.SpeechSynthesisUtterance && window.speechSynthesis;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const desktop = matchMedia("(min-width: 761px)");
  const firstStops = new Map();
  const stopNodes = byId("nv-presenter-script").querySelectorAll("li[data-chapter]");
  const stops = Array.from(stopNodes, (item, index) => {
    const chapter = item.dataset.chapter;
    if (!firstStops.has(chapter)) firstStops.set(chapter, index);
    return {
      chapter,
      title: item.querySelector("h3").textContent.trim(),
      target: item.dataset.target,
      actions: JSON.parse(item.dataset.actions || "[]"),
      cues: Array.from(item.querySelectorAll("p"), paragraph => ({
        words: paragraph.textContent.trim(),
        target: paragraph.dataset.target,
        actions: JSON.parse(paragraph.dataset.actions || "[]"),
      })),
    };
  });
  if (!stops.length) return;

  for (const [chapter, index] of firstStops) picker.add(new Option(chapter, index));
  let index = 0;
  let cueIndex = 0;
  let playing = false;
  let complete = false;
  let highlighted;
  let utterance;
  let generation = 0;
  const timers = new Set();
  voice.disabled = !synth;
  voice.checked = Boolean(synth);
  launch.disabled = false;

  function later(delay, callback) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function stopSpeech() {
    if (!utterance) return;
    utterance.onstart = utterance.onend = utterance.onerror = null;
    utterance = null;
    synth.cancel();
  }

  function stopDelivery() {
    generation++;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    stopSpeech();
  }

  function refresh() {
    panel.dataset.playing = String(playing);
    play.textContent = playing ? "Pause" : complete ? "Replay" : "Play";
    prev.disabled = index === 0;
    next.disabled = index === stops.length - 1;
    panel.dataset.cue = String(cueIndex);
    picker.value = firstStops.get(stops[index].chapter);
    progress.textContent = `${index + 1} of ${stops.length} · ${stops[index].chapter}`;
    caption.setAttribute("aria-live", playing && voice.checked ? "off" : "polite");
  }

  function revealRow(node) {
    if (!node.matches("tr")) return;
    const scroller = node.closest(".nv-table-scroll");
    if (!scroller || scroller.scrollHeight <= scroller.clientHeight) return;
    const row = node.getBoundingClientRect();
    const frame = scroller.getBoundingClientRect();
    const header = node.closest("table").tHead;
    const top = frame.top + (header?.offsetHeight || 0) + 8;
    if (row.top < top || row.bottom > frame.bottom - 8) scroller.scrollTop += row.top - top;
  }

  function revealTableCell(node) {
    const cell = node.closest("th, td");
    const scroller = cell?.closest(".nv-table-scroll");
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    const item = cell.getBoundingClientRect();
    const frame = scroller.getBoundingClientRect();
    if (item.left < frame.left + 12 || item.right > frame.right - 12) {
      scroller.scrollLeft += (item.left + item.right - frame.left - frame.right) / 2;
    }
  }

  function revealRankingBar(node) {
    const scroller = node.closest(".lab-rank-window");
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    const bar = node.getBoundingClientRect();
    const frame = scroller.getBoundingClientRect();
    if (bar.left < frame.left || bar.right > frame.right) {
      scroller.scrollLeft += (bar.left + bar.right - frame.left - frame.right) / 2;
    }
  }

  function spotlight(node) {
    highlighted?.classList.remove("nv-presenter-highlight");
    highlighted = node;
    if (!node) return;
    node.classList.add("nv-presenter-highlight");
    revealRow(node);
    revealTableCell(node);
    // Leave room for the sticky navigation and the dock on a phone.
    const nav = document.querySelector(".nv-jump");
    const navStyle = nav && getComputedStyle(nav);
    let top = (nav ? nav.offsetHeight + Math.max(0, parseFloat(navStyle.top) || 0) : 0) + 24;
    const rect = node.getBoundingClientRect();
    const rightSide = rect.left >= innerWidth * .53 && rect.width <= innerWidth * .45;
    panel.toggleAttribute("data-dock-left", desktop.matches && rightSide);
    const dock = panel.getBoundingClientRect();
    const overlapsDock = rect.right > dock.left && rect.left < dock.right;
    let bottom = innerHeight;
    if (overlapsDock) {
      if (dock.top - top >= 100) bottom = dock.top;
      else if (innerHeight - dock.bottom >= 100) top = dock.bottom + 12;
    }
    const room = Math.max(0, bottom - top - 16);
    const spare = Math.max(0, room - rect.height);
    // Keep the plot above its readout whenever the readout is the focus.
    const inset = node.matches(".nv-chart-values") ? spare : Math.min(32, spare / 2);
    const max = document.documentElement.scrollHeight - innerHeight;
    const y = Math.max(0, Math.min(max, scrollY + rect.top - top - inset));
    const smooth = playing && !reduced.matches && Math.abs(scrollY - y) > 6;
    window.scrollTo({ top: y, behavior: smooth ? "smooth" : "instant" });
    return smooth ? y : null;
  }

  function pointTo(selector) {
    const node = selector && main.querySelector(selector);
    return node?.getClientRects().length ? spotlight(node) : null;
  }

  function afterSpotlight(target, delivery, ready) {
    const timeout = performance.now() + 1050;
    function check(now) {
      if (delivery !== generation) return;
      if (target !== null && Math.abs(scrollY - target) > 5 && now < timeout) {
        requestAnimationFrame(check);
        return;
      }
      const rail = document.querySelector(".nv-jump")?.getBoundingClientRect();
      const anchor = highlighted?.getBoundingClientRect();
      // The shared header can change height as the scroll direction changes.
      if (rail && anchor && rail.top < 150 && rail.top <= anchor.top + 8 && rail.bottom + 12 > anchor.top) {
        window.scrollTo({ top: Math.max(0, scrollY + anchor.top - rail.bottom - 12), behavior: "instant" });
        requestAnimationFrame(() => { if (delivery === generation) ready(); });
      } else ready();
    }
    requestAnimationFrame(check);
  }

  function interact(action) {
    const [kind, selector, value] = action;
    const node = main.querySelector(selector);
    if (!node || node.disabled || node.closest("[hidden]")) return;
    switch (kind) {
      case "click": {
        const focused = panel.contains(document.activeElement) && document.activeElement;
        node.click();
        if (node.matches(".lab-rank-company")) revealRankingBar(node);
        if (focused && document.activeElement !== focused) focused.focus({ preventScroll: true });
        break;
      }
      case "check":
        if (node.checked !== value) node.click();
        break;
      case "choose": {
        const option = Array.from(node.options).find(item => !item.disabled && (item.value === value || item.label === value));
        if (option && node.value !== option.value) {
          node.value = option.value;
          node.dispatchEvent(new Event("change", { bubbles: true }));
        }
        break;
      }
      case "input":
        node.value = value;
        node.dispatchEvent(new Event("input", { bubbles: true }));
        break;
      case "sort": {
        const header = node.closest("th");
        if (header.getAttribute("aria-sort") !== value) node.click();
        if (header.getAttribute("aria-sort") !== value) node.click();
        break;
      }
      case "seek":
        window.NvidiaCharts?.seek(node, value);
        break;
    }
  }

  function scanChart([, selector, values]) {
    const node = main.querySelector(selector);
    if (!node?.getClientRects().length) return 0;
    const fractions = values || [0, .24, .48, .72, 1];
    const seek = fraction => window.NvidiaCharts?.seek(node, fraction);
    if (reduced.matches || !playing) {
      seek(fractions.at(-1));
      return 0;
    }
    seek(fractions[0]);
    fractions.slice(1).forEach((fraction, index) => later((index + 1) * 520, () => seek(fraction)));
    return (fractions.length - 1) * 520;
  }

  function finishCue() {
    if (cueIndex + 1 < stops[index].cues.length) {
      cueIndex++;
      deliverCue();
      return;
    }
    if (index + 1 < stops.length) {
      show(index + 1);
      return;
    }
    stopDelivery();
    playing = false;
    complete = true;
    status.textContent = "Tour complete.";
    refresh();
  }

  function speak(words, scans) {
    const readingTime = Math.max(3500, 800 + words.split(/\s+/).length * 390);
    let visibleUntil;
    // A cue owns one utterance. Hold it long enough for any chart sweep to finish.
    function startVisuals() {
      if (visibleUntil === undefined) visibleUntil = performance.now() + Math.max(0, ...scans.map(scanChart));
    }
    function captionsOnly(message) {
      status.textContent = message;
      startVisuals();
      later(Math.max(readingTime, visibleUntil - performance.now()), finishCue);
    }
    if (!synth || !voice.checked) {
      captionsOnly("Playing with captions.");
      return;
    }
    status.textContent = "";
    const fallback = () => {
      clearTimeout(startWatch);
      clearTimeout(endWatch);
      stopSpeech();
      voice.checked = false;
      refresh();
      captionsOnly("Voice unavailable. The tour will continue with captions.");
    };
    const startWatch = later(4000, fallback);
    const endWatch = later(readingTime * 2 + 7000, fallback);
    try {
      utterance = new SpeechSynthesisUtterance(words.replace(/\bAMD\b/g, "A M D"));
      utterance.lang = "en-US";
      const localVoices = synth.getVoices().filter(item => item.localService && /^en(?:-|$)/i.test(item.lang));
      const local = localVoices.find(item => item.default) || localVoices[0];
      if (local) {
        utterance.voice = local;
        utterance.lang = local.lang;
      }
      utterance.rate = .96;
      utterance.onstart = () => {
        clearTimeout(startWatch);
        startVisuals();
      };
      utterance.onend = () => {
        utterance = null;
        clearTimeout(startWatch);
        clearTimeout(endWatch);
        startVisuals();
        later(Math.max(360, visibleUntil - performance.now() + 260), finishCue);
      };
      utterance.onerror = fallback;
      synth.speak(utterance);
    } catch {
      fallback();
    }
  }

  function deliverCue() {
    stopDelivery();
    const stop = stops[index];
    const cue = stop.cues[cueIndex];
    const delivery = generation;
    refresh();
    const title = document.createElement("h3");
    title.textContent = stop.title;
    const words = document.createElement("p");
    words.textContent = cue.words;
    caption.replaceChildren(title, words);
    caption.scrollTop = 0;
    status.textContent = playing ? "" : "Paused.";
    const begin = performance.now();
    const visualActions = [...(cueIndex === 0 ? stop.actions : []), ...cue.actions];
    const scans = visualActions.filter(action => action[0] === "scan");

    function apply() {
      if (delivery !== generation) return;
      // Interactive views share the same snapshots as the rest of the page.
      if (visualActions.length && document.body.dataset.nvdaHistory !== "ready"
        && byId("nv-retry").hidden && performance.now() - begin < 7000) {
        status.textContent = "Waiting for dashboard data…";
        later(180, apply);
        return;
      }
      if (visualActions.length && document.body.dataset.nvdaHistory !== "ready") {
        pause();
        status.textContent = "Dashboard data unavailable. Load the charts before continuing.";
        return;
      }
      visualActions.filter(action => action[0] !== "scan").forEach(interact);
      requestAnimationFrame(() => {
        if (delivery !== generation) return;
        const target = cue.target || (cueIndex === 0 ? stop.target : null);
        const landing = target ? pointTo(target) : null;
        if (!playing) {
          scans.forEach(scanChart);
          status.textContent = "Paused.";
          return;
        }
        afterSpotlight(landing, delivery, () => speak(cue.words, scans));
      });
    }
    apply();
  }

  function show(position) {
    index = position;
    cueIndex = 0;
    complete = false;
    deliverCue();
  }

  function pause() {
    stopDelivery();
    window.scrollTo({ top: window.scrollY, behavior: "instant" });
    playing = false;
    refresh();
    status.textContent = "Paused. Play resumes here.";
  }

  function closePlayer() {
    stopDelivery();
    playing = false;
    spotlight(null);
    panel.hidden = true;
    launch.setAttribute("aria-expanded", "false");
    launch.focus({ preventScroll: true });
  }

  launch.addEventListener("click", () => {
    if (!panel.hidden) {
      play.focus({ preventScroll: true });
      return;
    }
    panel.hidden = false;
    launch.setAttribute("aria-expanded", "true");
    playing = true;
    show(0);
    play.focus({ preventScroll: true });
  });
  close.addEventListener("click", closePlayer);
  play.addEventListener("click", () => {
    if (playing) pause();
    else {
      playing = true;
      if (complete) show(0);
      else deliverCue();
    }
  });
  prev.addEventListener("click", () => show(index - 1));
  next.addEventListener("click", () => show(index + 1));
  picker.addEventListener("change", () => show(Number(picker.value)));
  voice.addEventListener("change", () => {
    refresh();
    if (playing) deliverCue();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !event.defaultPrevented && !panel.hidden && panel.contains(document.activeElement)) closePlayer();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && playing) pause();
  });

  const handle = panel.querySelector(".nv-presenter-header");
  let drag;
  handle.addEventListener("pointerdown", event => {
    if (!desktop.matches || event.button !== 0 || event.target.closest("button, label")) return;
    const { left, top } = panel.getBoundingClientRect();
    drag = { id: event.pointerId, x: event.clientX - left, y: event.clientY - top };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener("pointermove", event => {
    if (drag?.id !== event.pointerId) return;
    const clamp = (value, max) => Math.max(8, Math.min(max - 8, value));
    panel.style.setProperty("--nv-presenter-left", clamp(event.clientX - drag.x, innerWidth - panel.offsetWidth) + "px");
    panel.style.setProperty("--nv-presenter-top", clamp(event.clientY - drag.y, innerHeight - panel.offsetHeight) + "px");
    panel.style.setProperty("--nv-presenter-right", "auto");
    panel.style.setProperty("--nv-presenter-bottom", "auto");
  });
  handle.addEventListener("lostpointercapture", () => { drag = null; });
  window.addEventListener("resize", () => { panel.removeAttribute("style"); });
})();
