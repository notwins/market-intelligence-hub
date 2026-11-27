(() => {
  "use strict";

  function mount(id, families, initial) {
    const select = document.getElementById(id);
    const root = select.closest("[data-metric-controls]");
    const tabs = root.querySelector("[data-metric-families]");
    const subgroup = root.querySelector("[data-metric-subgroup]");
    const next = root.querySelector("[data-metric-next]");
    const last = new Map();
    let enabled = () => true;
    let activeFamily, activeGroup;

    function choices(group) {
      return group.items.filter(([value]) => enabled(value));
    }

    function quickChoices() {
      const available = Array.from(select.options, option => option.value);
      return activeGroup.quick.filter(value => available.includes(value));
    }

    function updateNext() {
      const quick = quickChoices();
      const upcoming = quick[(quick.indexOf(select.value) + 1) % quick.length];
      next.hidden = select.options.length < 4 || quick.length < 2;
      const option = Array.from(select.options).find(metric => metric.value === upcoming);
      next.title = option ? "Next key metric · " + option.label : "";
      next.setAttribute("aria-label", next.title || "Next key metric");
    }

    function refresh(value) {
      const candidate = families.find(family => family.groups.some(group => choices(group).some(([key]) => key === value)));
      if (candidate) {
        activeFamily = candidate;
        activeGroup = candidate.groups.find(group => choices(group).some(([key]) => key === value));
      } else {
        activeFamily = families.find(family => family.groups.some(group => choices(group).length));
        activeGroup = activeFamily.groups.find(group => choices(group).length);
      }
      render(value);
    }

    function render(value) {
      for (const [index, button] of Array.from(tabs.children).entries()) {
        const family = families[index];
        button.setAttribute("aria-pressed", String(family === activeFamily));
        button.hidden = !family.groups.some(group => choices(group).length);
      }
      const visibleGroups = activeFamily.groups.filter(group => choices(group).length);
      subgroup.replaceChildren(...visibleGroups.map(group => new Option(group.label)));
      subgroup.value = activeGroup.label;
      subgroup.closest("label").hidden = visibleGroups.length <= 1;
      const metrics = choices(activeGroup);
      select.replaceChildren(...metrics.map(([key, label]) => new Option(label, key)));
      const preferred = value ?? last.get(activeGroup);
      if (metrics.some(([key]) => key === preferred)) select.value = preferred;
      last.set(activeGroup, select.value);
      updateNext();
    }

    function change() {
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    tabs.replaceChildren(...families.map(family => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = family.label;
      button.addEventListener("click", () => {
        if (family === activeFamily) return;
        activeFamily = family;
        activeGroup = family.groups.find(group => choices(group).length);
        render();
        change();
      });
      return button;
    }));
    subgroup.addEventListener("change", () => {
      activeGroup = activeFamily.groups.find(group => group.label === subgroup.value);
      render();
      change();
    });
    select.addEventListener("change", () => {
      last.set(activeGroup, select.value);
      updateNext();
    });
    next.addEventListener("click", () => {
      const quick = quickChoices();
      select.value = quick[(quick.indexOf(select.value) + 1) % quick.length];
      change();
    });
    refresh(initial);
    return {
      setValue: refresh,
      setFilter(filter) {
        const before = select.value;
        enabled = filter;
        refresh(before);
        return select.value !== before;
      },
    };
  }

  function expandable(card, label, mountPoint) {
    if (!card || card.classList.contains("nv-expandable")) return;
    card.classList.add("nv-expandable");
    let toolbar = mountPoint || card.querySelector(":scope > .nv-panel-head, :scope > .nv-fin-history-toolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.className = "nv-expand-toolbar";
      card.prepend(toolbar);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nv-layout-button";
    button.textContent = "Expand";
    button.setAttribute("aria-label", "Expand " + label);
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => {
      const expanded = card.classList.toggle("nv-expanded");
      button.textContent = expanded ? "Collapse" : "Expand";
      button.setAttribute("aria-label", button.textContent + " " + label);
      button.setAttribute("aria-expanded", String(expanded));
    });
    toolbar.append(button);
  }

  window.NvdaChartControls = { mount, expandable };
})();
