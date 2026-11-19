/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ZenSettingsAppearance } from "./sections/ZenSettingsAppearance.mjs";
import { ZenSettingsContainers } from "./sections/ZenSettingsContainers.mjs";
import { ZenSettingsGeneral } from "./sections/ZenSettingsGeneral.mjs";
import { ZenSettingsLanguage } from "./sections/ZenSettingsLanguage.mjs";
import { ZenSettingsLinks } from "./sections/ZenSettingsLinks.mjs";
import { ZenSettingsSearch } from "./sections/ZenSettingsSearch.mjs";
import { ZenSettingsShortcuts } from "./sections/ZenSettingsShortcuts.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  SubDialogManager: "resource://gre/modules/SubDialog.sys.mjs",
});

const kDefaultPane = "general";
const kDonateURL = "https://www.zen-browser.app/donate";
const kSubDialogStyleSheets = [
  "chrome://browser/skin/preferences/dialog.css",
  "chrome://browser/skin/preferences/preferences.css",
  "chrome://browser/skin/preferences/zen-preferences.css",
  "chrome://browser/content/zen-styles/zen-settings-subdialog.css",
];

class ZenSettingsPref {
  constructor(element) {
    this.element = element;
    this.name = element.dataset.pref;
    this.type = Services.prefs.getPrefType(this.name);
  }

  get isToggle() {
    return this.element.localName == "moz-toggle";
  }

  get value() {
    switch (this.type) {
      case Services.prefs.PREF_BOOL:
        return Services.prefs.getBoolPref(this.name);
      case Services.prefs.PREF_INT:
        return Services.prefs.getIntPref(this.name);
      case Services.prefs.PREF_STRING:
        return Services.prefs.getStringPref(this.name);
    }
    return null;
  }

  set value(value) {
    switch (this.type) {
      case Services.prefs.PREF_BOOL:
        Services.prefs.setBoolPref(
          this.name,
          value === true || value == "true"
        );
        break;
      case Services.prefs.PREF_INT:
        Services.prefs.setIntPref(this.name, parseInt(value, 10));
        break;
      case Services.prefs.PREF_STRING:
        Services.prefs.setStringPref(this.name, String(value));
        break;
    }
  }

  /** Shows the pref's current value in the control. */
  render() {
    const { element } = this;
    element.disabled =
      this.type == Services.prefs.PREF_INVALID ||
      Services.prefs.prefIsLocked(this.name);
    if (this.type == Services.prefs.PREF_INVALID) {
      return;
    }
    const value = this.value;
    if (!this.isToggle) {
      element.value = String(value);
      return;
    }
    if ("prefOn" in element.dataset) {
      element.pressed = String(value) == element.dataset.prefOn;
    } else {
      element.pressed = !!value;
    }
  }

  /** Stores what the control shows in the pref. */
  commit() {
    const { element } = this;
    if (!this.isToggle) {
      this.value = element.value;
    } else if ("prefOn" in element.dataset) {
      this.value = element.pressed
        ? element.dataset.prefOn
        : element.dataset.prefOff;
    } else {
      this.value = element.pressed;
    }
  }
}

class nsZenSettingsWindow {
  #prefObservers = new Map();
  #topicObservers = new Map();
  #subDialogs = null;
  #observer = {
    QueryInterface: ChromeUtils.generateQI([
      "nsIObserver",
      "nsISupportsWeakReference",
    ]),
    observe: (subject, topic, data) => this.#observe(topic, data),
  };

  constructor() {
    this.#initWindowControls();
    this.#initNavigation();
    this.#initPrefs();
    this.#initToggleRows();
    this.#initDependencies();

    this.sections = {
      general: new ZenSettingsGeneral(this),
      appearance: new ZenSettingsAppearance(this),
      containers: new ZenSettingsContainers(this),
      links: new ZenSettingsLinks(this),
      search: new ZenSettingsSearch(this),
      language: new ZenSettingsLanguage(this),
      shortcuts: new ZenSettingsShortcuts(this),
    };
    this.#initActions();

    window.addEventListener("unload", () => this.destroy(), { once: true });

    const pane = window.arguments?.[0];
    this.showPane(typeof pane == "string" ? pane : kDefaultPane);
  }

  destroy() {
    for (const pref of this.#prefObservers.keys()) {
      Services.prefs.removeObserver(pref, this.#observer);
    }
    this.#prefObservers.clear();
    for (const topic of this.#topicObservers.keys()) {
      Services.obs.removeObserver(this.#observer, topic);
    }
    this.#topicObservers.clear();
  }

  #observe(topic, data) {
    const callbacks =
      topic == "nsPref:changed"
        ? this.#prefObservers.get(data)
        : this.#topicObservers.get(topic);
    for (const callback of callbacks ?? []) {
      callback();
    }
  }

  /**
   * Runs a callback whenever one of the observer topics is notified.
   *
   * @param {string[]} topics
   * @param {Function} callback
   */
  watchTopics(topics, callback) {
    for (const topic of topics) {
      if (!this.#topicObservers.has(topic)) {
        this.#topicObservers.set(topic, new Set());
        Services.obs.addObserver(this.#observer, topic, true);
      }
      this.#topicObservers.get(topic).add(callback);
    }
  }

  /**
   * Runs a callback now and again whenever one of the prefs changes.
   *
   * @param {string[]} prefs
   * @param {Function} callback
   */
  watchPrefs(prefs, callback) {
    for (const pref of prefs) {
      if (!this.#prefObservers.has(pref)) {
        this.#prefObservers.set(pref, new Set());
        Services.prefs.addObserver(pref, this.#observer, true);
      }
      this.#prefObservers.get(pref).add(callback);
    }
    callback();
  }

  #initWindowControls() {
    document
      .getElementById("cmd_closeWindow")
      ?.addEventListener("command", () => window.close());
  }

  /* Navigation */

  get #categories() {
    return document.querySelectorAll(".zen-settings-category[data-pane]");
  }

  get currentPane() {
    return document.documentElement.getAttribute("data-pane");
  }

  #initNavigation() {
    const list = document.getElementById("zen-settings-categories");
    list.addEventListener("click", event => {
      const category = event.target.closest(".zen-settings-category");
      if (category) {
        this.showPane(category.dataset.pane);
      }
    });
    list.addEventListener("keydown", event => {
      const offset = { ArrowDown: 1, ArrowUp: -1 }[event.key];
      if (!offset) {
        return;
      }
      const categories = [...this.#categories].filter(c => !c.hidden);
      const index = categories.indexOf(document.activeElement);
      const next = categories[index + offset];
      if (next) {
        event.preventDefault();
        next.focus();
        this.showPane(next.dataset.pane);
      }
    });
  }

  /**
   * @param {string} [pane] The pane to show, e.g. "links". Without one, or
   *   with an unknown or hidden one, the first pane is shown.
   */
  showPane(pane) {
    let selected = null;
    for (const category of this.#categories) {
      if (category.dataset.pane == pane && !category.hidden) {
        selected = category;
      }
    }
    selected ??= this.#categories[0];
    pane = selected.dataset.pane;

    for (const category of this.#categories) {
      const isSelected = category == selected;
      category.setAttribute("aria-selected", isSelected);
      category.tabIndex = isSelected ? 0 : -1;
    }
    for (const section of document.querySelectorAll(".zen-settings-pane")) {
      section.hidden = section.dataset.pane != pane;
    }
    document.l10n.setAttributes(
      document.getElementById("zen-settings-title"),
      selected.querySelector("[data-l10n-id]").dataset.l10nId
    );
    document.documentElement.setAttribute("data-pane", pane);
    document.getElementById("zen-settings-panes").scrollTop = 0;
    for (const section of Object.values(this.sections)) {
      section.onPaneShown?.(pane);
    }
  }

  /* Preference controls */

  #initPrefs() {
    for (const element of document.querySelectorAll("[data-pref]")) {
      const pref = new ZenSettingsPref(element);
      this.watchPrefs([pref.name], () => pref.render());
      element.addEventListener(pref.isToggle ? "toggle" : "command", () =>
        pref.commit()
      );
    }
  }

  #initToggleRows() {
    const root = document.getElementById("zen-settings-root");
    const nameToggles = () => {
      for (const row of root.querySelectorAll(".zen-settings-toggle-row")) {
        const text = row.querySelector(".zen-settings-row-text");
        const label = text.firstElementChild ?? text;
        row.querySelector("moz-toggle").ariaLabel = label.textContent.trim();
      }
    };
    new MutationObserver(nameToggles).observe(root, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    nameToggles();

    root.addEventListener("click", event => {
      const text = event.target.closest(
        ".zen-settings-toggle-row > .zen-settings-row-text"
      );
      text?.parentElement.querySelector("moz-toggle").click();
    });
  }

  #initDependencies() {
    for (const row of document.querySelectorAll("[data-depends-on]")) {
      this.watchPrefs([row.dataset.dependsOn], () => {
        const enabled = Services.prefs.getBoolPref(
          row.dataset.dependsOn,
          false
        );
        row.inert = !enabled;
      });
    }
  }

  /* Helpers shared with the sections */

  createIconButton(icon, l10nId) {
    const button = document.createElement("button");
    button.className = "zen-settings-icon-button";
    document.l10n.setAttributes(button, l10nId);
    const image = document.createElement("img");
    image.src = `chrome://browser/skin/zen-icons/${icon}.svg`;
    image.alt = "";
    button.append(image);
    return button;
  }

  openDialog(url, ...args) {
    this.#subDialogs ??= new lazy.SubDialogManager({
      dialogStack: document.getElementById("zen-settings-dialog-stack"),
      dialogTemplate: document.getElementById("zen-settings-dialog-template"),
      dialogOptions: { styleSheets: kSubDialogStyleSheets },
    });
    this.#subDialogs.open(url, { features: "resizable=no" }, ...args);
  }

  confirm(title, body, confirmLabel, cancelLabel) {
    const prompts = Services.prompt;
    const flags =
      prompts.BUTTON_POS_0 * prompts.BUTTON_TITLE_IS_STRING +
      prompts.BUTTON_POS_1 * prompts.BUTTON_TITLE_IS_STRING +
      prompts.BUTTON_POS_0_DEFAULT;
    return (
      prompts.confirmEx(
        window,
        title,
        body,
        flags,
        confirmLabel,
        cancelLabel,
        null,
        null,
        {}
      ) == 0
    );
  }

  /* Actions */

  #initActions() {
    const leaveFor = pane => {
      window.openPreferences(pane);
      window.close();
    };
    const actions = {
      "open-mods": () => leaveFor("paneZenMarketplace"),
      "open-more-settings": () => leaveFor("paneGeneral"),
      "open-about": () => window.openAboutDialog(),
      "open-donate": () => window.openTrustedLinkIn(kDonateURL, "tab"),
      "open-privacy-settings": () => leaveFor("panePrivacy"),
      "open-accessibility-settings": () => leaveFor("paneAccessibility"),
      "open-sync-settings": () => window.openPreferences("paneSync"),
    };
    for (const section of Object.values(this.sections)) {
      Object.assign(actions, section.actions);
    }
    document.addEventListener("click", event => {
      const target = event.target.closest("[data-action]");
      actions[target?.dataset.action]?.();
    });
  }
}

window.gZenSettingsWindow = new nsZenSettingsWindow();
