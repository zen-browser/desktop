/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  AppConstants: "resource://gre/modules/AppConstants.sys.mjs",
});

const kUnfilteredPanes = new Set(["shortcuts"]);
const kMissAttribute = "data-filter-miss";

export class ZenSettingsFilter {
  #input = document.getElementById("zen-settings-filter");

  constructor(settings) {
    this.settings = settings;
    this.#input.addEventListener("input", () => this.#onInput());
    this.#input.addEventListener("keydown", event => {
      if (event.key == "Escape" && this.#input.value) {
        event.preventDefault();
        this.#input.value = "";
        this.#onInput();
      }
    });
    window.addEventListener("keydown", event => {
      const accel =
        lazy.AppConstants.platform == "macosx" ? event.metaKey : event.ctrlKey;
      if (accel && !event.altKey && event.key.toLowerCase() == "f") {
        event.preventDefault();
        this.#input.focus();
        this.#input.select();
      }
    });
  }

  get isActive() {
    return document.documentElement.hasAttribute("data-filtering");
  }

  get #words() {
    return this.#input.value.toLowerCase().split(/\s+/).filter(Boolean);
  }

  clear() {
    this.#input.value = "";
    document.documentElement.removeAttribute("data-filtering");
    for (const element of document.querySelectorAll(`[${kMissAttribute}]`)) {
      element.removeAttribute(kMissAttribute);
    }
    document.getElementById("zen-settings-filter-empty").hidden = true;
  }

  #onInput() {
    const words = this.#words;
    if (!words.length) {
      if (this.isActive) {
        this.settings.showPane(this.settings.currentPane);
      }
      return;
    }
    if (!this.isActive) {
      document.documentElement.setAttribute("data-filtering", "");
      for (const section of Object.values(this.settings.sections)) {
        for (const pane of this.#panes) {
          section.onPaneShown?.(pane.dataset.pane);
        }
      }
      document.l10n.setAttributes(
        document.getElementById("zen-settings-title"),
        "zen-settings-window-filter-results"
      );
    }
    this.#filter(words);
  }

  get #panes() {
    return [...document.querySelectorAll(".zen-settings-pane")].filter(
      pane => !kUnfilteredPanes.has(pane.dataset.pane)
    );
  }

  #filter(words) {
    let anyMatch = false;
    for (const category of document.querySelectorAll(
      ".zen-settings-category[data-pane]"
    )) {
      // eslint-disable-next-line no-shadow
      const name = category.dataset.pane;
      const pane = document.getElementById(`zen-settings-pane-${name}`);
      const label = category.textContent.trim();
      const labelMatches = matches(label.toLowerCase(), words);
      let paneMatches = false;
      if (category.hidden || kUnfilteredPanes.has(name)) {
        pane.hidden = true;
      } else {
        pane.dataset.filterTitle = label;
        paneMatches = this.#filterPane(pane, labelMatches ? [] : words);
        pane.hidden = !paneMatches;
      }
      category.toggleAttribute(kMissAttribute, !paneMatches && !labelMatches);
      anyMatch ||= paneMatches;
    }
    document.getElementById("zen-settings-filter-empty").hidden = anyMatch;
    document.getElementById("zen-settings-panes").scrollTop = 0;
  }

  #filterPane(pane, words) {
    const groups = new Set(pane.querySelectorAll(".zen-settings-group"));
    let paneMatches = false;
    for (const group of groups) {
      const groupMatches =
        !isHiddenWithin(group, pane) && this.#filterGroup(group, words);
      group.toggleAttribute(kMissAttribute, !groupMatches);
      paneMatches ||= groupMatches;
    }
    for (const child of pane.children) {
      if (!groups.has(child) && !child.querySelector(".zen-settings-group")) {
        child.toggleAttribute(kMissAttribute, !!words.length);
      }
    }
    return paneMatches;
  }

  #filterGroup(group, words) {
    const rows = [...group.querySelectorAll(".zen-settings-row")];
    const heading = group.querySelector("h2");
    const showAll =
      !rows.length || (heading && matches(textOf(heading), words));
    let groupMatches = showAll && matches(textOf(group), words);
    for (const row of rows) {
      const rowMatches =
        !isHiddenWithin(row, group) && (showAll || matches(textOf(row), words));
      row.toggleAttribute(kMissAttribute, !rowMatches);
      groupMatches ||= rowMatches;
    }
    return groupMatches;
  }
}

function matches(text, words) {
  return words.every(word => text.includes(word));
}

function textOf(element) {
  const labels = [...element.querySelectorAll("[label]")].map(labelled =>
    labelled.getAttribute("label")
  );
  return [element.textContent, ...labels].join(" ").toLowerCase();
}

function isHiddenWithin(element, ancestor) {
  for (let node = element; node && node != ancestor; node = node.parentNode) {
    if (node.hidden) {
      return true;
    }
  }
  return false;
}
