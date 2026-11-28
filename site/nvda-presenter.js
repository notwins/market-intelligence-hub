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
      words: item.querySelector("p").textContent.trim(),
      target: item.dataset.target,
      actions: JSON.parse(item.dataset.actions || "[]"),
    };
  });
  if (!stops.length) return;

  for (const [chapter, index] of firstStops) picker.add(new Option(chapter, index));
  let index = 0;
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
    picker.value = firstStops.get(stops[index].chapter);
    progress.textContent = `${index + 1} of ${stops.length} · ${stops[index].chapter}`;
    caption.setAttribute("aria-live", playing && voice.checked ? "off" : "polite");
  }

  function spotlight(node) {
    highlighted?.classList.remove("nv-presenter-highlight");
    highlighted = node;
    if (!node) return;
    node.classList.add("nv-presenter-highlight");
    // Leave room for the sticky navigation and the dock on a phone.
    const nav = document.querySelector(".nv-jump");
    const navStyle = nav && getComputedStyle(nav);
    const top = (nav ? nav.offsetHeight + Math.max(0, parseFloat(navStyle.top) || 0) : 0) + 24;
    const rect = node.getBoundingClientRect();
    const dock = panel.getBoundingClientRect();
    const overlapsDock = rect.right > dock.left && rect.left < dock.right && dock.top > top;
    const bottom = overlapsDock ? dock.top : innerHeight;
    const room = Math.max(0, bottom - top - 16);
    const inset = Math.min(32, Math.max(0, (room - rect.height) / 2));
    window.scrollTo({
      top: window.scrollY + rect.top - top - inset,
      behavior: reduced.matches ? "instant" : "smooth",
    });
  }

  function pointTo(selector) {
    const node = selector && main.querySelector(selector);
    if (node && node.getClientRects().length) spotlight(node);
  }

  function interact(action) {
    const [kind, selector, value] = action;
    const node = main.querySelector(selector);
    if (!node || node.disabled || node.closest("[hidden]")) return;
    switch (kind) {
      case "click": {
        const focused = panel.contains(document.activeElement) && document.activeElement;
        node.click();
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
      case "scan": {
        const charts = window.NvidiaCharts;
        const fractions = value || [0, .24, .48, .72, 1];
        if (reduced.matches || !playing) {
          charts?.seek(node, fractions.at(-1));
          break;
        }
        fractions.forEach((fraction, step) => later(350 + step * 620, () => charts?.seek(node, fraction)));
        break;
      }
      case "point":
        pointTo(selector);
        break;
    }
  }

  function finish() {
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

  function speak(words) {
    const readingTime = Math.max(5200, 1000 + words.split(/\s+/).length * 395);
    if (!synth || !voice.checked) {
      status.textContent = "Playing with captions.";
      later(readingTime, finish);
      return;
    }
    status.textContent = "";
    const fallback = () => {
      clearTimeout(startWatch);
      clearTimeout(endWatch);
      stopSpeech();
      voice.checked = false;
      refresh();
      status.textContent = "Voice unavailable. The tour will continue with captions.";
      later(readingTime, finish);
    };
    const startWatch = later(4000, fallback);
    const endWatch = later(readingTime * 2 + 7000, fallback);
    try {
      utterance = new SpeechSynthesisUtterance(words);
      utterance.lang = "en-US";
      const localVoices = synth.getVoices().filter(item => item.localService && /^en(?:-|$)/i.test(item.lang));
      const local = localVoices.find(item => item.default) || localVoices[0];
      if (local) {
        utterance.voice = local;
        utterance.lang = local.lang;
      }
      utterance.rate = .96;
      utterance.onstart = () => clearTimeout(startWatch);
      utterance.onend = () => {
        utterance = null;
        clearTimeout(startWatch);
        clearTimeout(endWatch);
        later(650, finish);
      };
      utterance.onerror = fallback;
      synth.speak(utterance);
    } catch {
      fallback();
    }
  }

  function show(position) {
    stopDelivery();
    index = position;
    complete = false;
    const stop = stops[index];
    const delivery = generation;
    refresh();
    const title = document.createElement("h3");
    title.textContent = stop.title;
    const words = document.createElement("p");
    words.textContent = stop.words;
    caption.replaceChildren(title, words);
    caption.scrollTop = 0;
    status.textContent = playing ? "" : "Paused.";
    const begin = performance.now();

    function apply() {
      if (delivery !== generation) return;
      // Interactive tabs depend on the same snapshots as the page itself.
      if (stop.actions.length && document.body.dataset.nvdaHistory !== "ready"
        && byId("nv-retry").hidden && performance.now() - begin < 7000) {
        status.textContent = "Waiting for dashboard data…";
        later(180, apply);
        return;
      }
      const after = [];
      for (const action of stop.actions) {
        if (action[0] === "after") after.push(action);
        else if (action[0] !== "scan") interact(action);
      }
      requestAnimationFrame(() => {
        if (delivery !== generation) return;
        pointTo(stop.target);
        for (const action of stop.actions) if (action[0] === "scan") interact(action);
        if (playing) for (const [, delay, ...action] of after) later(delay, () => interact(action));
      });
      if (playing) speak(stop.words);
      else status.textContent = "Paused.";
    }
    apply();
  }

  function pause() {
    stopDelivery();
    window.scrollTo({ top: window.scrollY, behavior: "instant" });
    playing = false;
    refresh();
    status.textContent = "Paused. Play restarts this stop.";
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
      show(complete ? 0 : index);
    }
  });
  prev.addEventListener("click", () => show(index - 1));
  next.addEventListener("click", () => show(index + 1));
  picker.addEventListener("change", () => show(Number(picker.value)));
  voice.addEventListener("change", () => {
    refresh();
    if (playing) show(index);
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
    if (!desktop.matches || event.button !== 0 || event.target.closest("button")) return;
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
