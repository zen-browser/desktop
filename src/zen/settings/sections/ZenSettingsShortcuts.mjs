/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.sys.mjs",
  CustomKeys: "moz-src:///browser/components/customkeys/CustomKeys.sys.mjs",
  ZenKeyboardShortcuts:
    "resource:///modules/zen/kbs/ZenKeyboardShortcuts.sys.mjs",
  gZenSpaceRoutingManager:
    "resource:///modules/zen/spacerouting/ZenSpaceRoutingManager.sys.mjs",
});

const kInvalidKeyMs = 900;
const kSitePermissionPref = "permissions.default.shortcuts";
const kOverridePref = "zen.keyboard.shortcuts.override-page-shortcuts";
const kDeny = Ci.nsIPermissionManager.DENY_ACTION;
const kLittleWindowKey = "zen-new-little-window";
const kGlobalShortcutsPref = "zen.keyboard.global-shortcuts.enabled";
const kLittleWindowRoute = "little-window";
const kMostRecentSpaceRoute = "most-recent-space";
const kModifierSymbols = "⌃⌥⇧⌘";

const kFaceReachPx = 5;
const kFaceHalfReachDistancePx = 90;

export class ZenSettingsShortcuts {
  #recording = null;
  #shortcutsBuild = 0;
  #selectedShortcut = null;

  constructor(settings) {
    this.settings = settings;
    this.#initShortcuts();
    this.#initConflicts();
    this.#initLittleWindow();
  }

  #initLittleWindow() {
    const global = document.getElementById(
      "zen-settings-shortcuts-little-global"
    );
    const links = document.getElementById(
      "zen-settings-shortcuts-little-links"
    );
    global?.addEventListener("change", () => {
      Services.prefs.setBoolPref(kGlobalShortcutsPref, global.checked);
    });
    links.addEventListener("change", () => {
      const manager = lazy.gZenSpaceRoutingManager;
      manager.setDefaultExternalRoute(
        links.checked ? kLittleWindowRoute : kMostRecentSpaceRoute
      );
      manager.saveRoutes();
    });
    this.settings.watchPrefs([kGlobalShortcutsPref], () =>
      this.#updateLittleWindow()
    );
  }

  #updateLittleWindow() {
    const row = this.#selectedShortcutRow;
    const box = document.getElementById("zen-settings-shortcuts-little");
    box.hidden = row?.dataset.id != kLittleWindowKey;
    if (box.hidden) {
      return;
    }
    const links = document.getElementById(
      "zen-settings-shortcuts-little-links"
    );
    links.checked =
      lazy.gZenSpaceRoutingManager.getDefaultExternalRoute() ==
      kLittleWindowRoute;

    const global = document.getElementById(
      "zen-settings-shortcuts-little-global"
    );
    if (!global) {
      return;
    }
    const { shortcut } = row.dataset;
    global.disabled =
      !shortcut || Services.prefs.prefIsLocked(kGlobalShortcutsPref);
    global.checked =
      !!shortcut && Services.prefs.getBoolPref(kGlobalShortcutsPref, false);
    const label = document.getElementById(
      "zen-settings-shortcuts-little-global-label"
    );
    if (shortcut) {
      document.l10n.setAttributes(
        label,
        "zen-settings-window-little-global-shortcut-key",
        { shortcut }
      );
    } else {
      document.l10n.setAttributes(
        label,
        "zen-settings-window-little-global-shortcut"
      );
    }
  }

  #initConflicts() {
    const list = document.getElementById(
      "zen-settings-shortcuts-conflict-list"
    );
    this.settings.watchPrefs([kSitePermissionPref, kOverridePref], () =>
      this.#updateConflict()
    );
    list.addEventListener("command", () => {
      const id = this.#selectedShortcutRow?.dataset.id;
      if (id) {
        lazy.ZenKeyboardShortcuts.setConflict(id, list.value);
      }
      this.#updateConflict();
    });
  }

  #updateConflict() {
    const box = document.getElementById("zen-settings-shortcuts-conflict");
    const list = document.getElementById(
      "zen-settings-shortcuts-conflict-list"
    );
    const row = this.#selectedShortcutRow;
    const win = this.#shortcutsWindow;
    box.hidden =
      !row ||
      !win ||
      !row.dataset.shortcut ||
      row.hasAttribute("data-internal");
    if (box.hidden) {
      return;
    }
    const { id } = row.dataset;
    const enabled = lazy.ZenKeyboardShortcuts.conflictsEnabled;
    const forced =
      Services.prefs.getIntPref(kSitePermissionPref, 0) == kDeny ||
      lazy.ZenKeyboardShortcuts.isConflictLocked(win, id);
    if (forced) {
      list.value = "zen";
    } else if (!enabled) {
      list.value = "website";
    } else {
      list.value = lazy.ZenKeyboardShortcuts.getConflict(id);
    }
    list.disabled = forced || !enabled;
    const choice = list.value == "ask" ? "both" : list.value;
    document.l10n.setAttributes(
      document.getElementById("zen-settings-shortcuts-conflict-description"),
      forced
        ? "zen-settings-window-shortcuts-conflict-reserved-description"
        : `zen-settings-window-shortcuts-conflict-${choice}-description`
    );
  }

  onPaneShown(pane) {
    this.#stopRecording();
    if (pane == "shortcuts") {
      this.#buildShortcuts();
    }
  }

  get #shortcutsList() {
    return document.getElementById("zen-settings-shortcuts-list");
  }

  get #shortcutRows() {
    return this.#shortcutsList.querySelectorAll(".zen-settings-shortcut");
  }

  get #selectedShortcutRow() {
    return this.#shortcutsList.querySelector(
      '.zen-settings-shortcut[aria-selected="true"]'
    );
  }

  get #shortcutsWindow() {
    return lazy.BrowserWindowTracker.getTopWindow();
  }

  #initShortcuts() {
    const list = this.#shortcutsList;
    list.addEventListener("click", event => {
      const row = event.target.closest(".zen-settings-shortcut");
      if (!row) {
        return;
      }
      this.#selectShortcut(row.dataset.id);
      if (event.target.closest(".zen-settings-keycap")) {
        this.#startRecording(row);
      }
    });
    list.addEventListener("focusout", event => {
      if (event.target == this.#recording?.keycap) {
        this.#stopRecording();
      }
    });
    window.addEventListener("keydown", event => this.#onRecordedKey(event), {
      capture: true,
    });
    document
      .getElementById("zen-settings-shortcuts-search")
      .addEventListener("input", () => this.#filterShortcuts());
    document.addEventListener("mousemove", event => this.#followPointer(event));
    document.documentElement.addEventListener("mouseleave", () => {
      document.getElementById("zen-settings-shortcuts-face").style.translate =
        "";
    });

    document
      .getElementById("zen-settings-shortcuts-reset")
      .addEventListener("click", () => {
        if (this.#selectedShortcut) {
          this.#resetShortcut(this.#selectedShortcut);
        }
      });
    const menu = document.getElementById("zen-settings-shortcuts-menu");
    document
      .getElementById("zen-settings-shortcuts-more")
      .addEventListener("click", event => {
        menu.openPopup(event.currentTarget, "after_end");
      });
    menu.addEventListener("command", event => {
      switch (event.target.dataset.command) {
        case "remove":
          this.#removeShortcut(this.#selectedShortcut);
          break;
        case "reset-all":
          this.#resetAllShortcuts();
          break;
        case "extensions":
          this.#openExtensionShortcuts();
          break;
      }
    });
  }

  #setShortcutsMessage(l10nId) {
    const message = document.getElementById("zen-settings-shortcuts-empty");
    message.hidden = !l10nId;
    if (l10nId) {
      document.l10n.setAttributes(message, l10nId);
    }
  }

  async #buildShortcuts() {
    const build = ++this.#shortcutsBuild;
    const list = this.#shortcutsList;
    const win = this.#shortcutsWindow;
    if (!win) {
      list.replaceChildren();
      this.#setShortcutsMessage("zen-settings-window-shortcuts-no-window");
      this.#updateShortcutDetails();
      return;
    }
    const categories = await lazy.ZenKeyboardShortcuts.getShortcuts(win);
    if (build != this.#shortcutsBuild || window.closed) {
      return;
    }

    const customized = categories.flatMap(category =>
      category.keys.filter(key => key.isCustomized)
    );
    const sections = [
      { l10nId: "zen-settings-window-shortcuts-customized", keys: customized },
      ...categories.map(category => ({
        label: category.label,
        keys: category.keys.filter(key => !key.isCustomized),
      })),
    ];

    const scrollTop = list.scrollTop;
    const wasInView = this.#isShortcutInView(this.#selectedShortcutRow);
    const fragment = document.createDocumentFragment();
    for (const { l10nId, label, keys } of sections) {
      if (!keys.length) {
        continue;
      }
      const section = document.createElement("section");
      section.className = "zen-settings-shortcut-category";
      const heading = document.createElement("h3");
      if (l10nId) {
        document.l10n.setAttributes(heading, l10nId);
      } else {
        heading.textContent = label;
      }
      section.append(heading);
      for (const key of keys) {
        section.append(this.#createShortcutRow(key));
      }
      fragment.append(section);
    }
    list.replaceChildren(fragment);
    list.scrollTop = scrollTop;
    this.#filterShortcuts();
    this.#selectShortcut(this.#selectedShortcut);
    const row = this.#selectedShortcutRow;
    if (wasInView && !this.#isShortcutInView(row)) {
      row?.scrollIntoView({ block: "center" });
    }
  }

  #isShortcutInView(row) {
    if (!row) {
      return false;
    }
    const rect = row.getBoundingClientRect();
    const view = this.#shortcutsList.getBoundingClientRect();
    return rect.height > 0 && rect.bottom > view.top && rect.top < view.bottom;
  }

  #createShortcutRow(key) {
    const row = document.createElement("div");
    row.className = "zen-settings-shortcut";
    row.dataset.id = key.id;
    row.dataset.label = key.title;
    row.role = "option";

    const label = document.createElement("span");
    label.className = "zen-settings-shortcut-label";
    label.textContent = key.title;

    const keycap = document.createElement("button");
    keycap.className = "zen-settings-keycap";
    keycap.disabled = !!key.internal;

    row.append(label, keycap);
    this.#updateShortcutRow(row, key);
    return row;
  }

  #updateShortcutRow(row, key) {
    if (!key) {
      return;
    }
    row.dataset.shortcut = key.shortcut;
    row.toggleAttribute("data-internal", !!key.internal);
    row.toggleAttribute("data-customized", !!key.isCustomized);
    const keycap = row.querySelector(".zen-settings-keycap");
    keycap.removeAttribute("data-recording");
    if (key.shortcut) {
      keycap.removeAttribute("data-l10n-id");
      keycap.textContent = key.shortcut;
    } else {
      document.l10n.setAttributes(
        keycap,
        "zen-settings-window-shortcuts-unassigned"
      );
    }
  }

  #refreshShortcutRow(row) {
    const win = this.#shortcutsWindow;
    if (win) {
      this.#updateShortcutRow(
        row,
        lazy.ZenKeyboardShortcuts.getShortcut(win, row.dataset.id)
      );
    }
  }

  #filterShortcuts() {
    const query = document
      .getElementById("zen-settings-shortcuts-search")
      .value.trim()
      .toLowerCase();
    let anyMatch = false;
    for (const section of this.#shortcutsList.children) {
      let sectionMatches = false;
      for (const row of section.querySelectorAll(".zen-settings-shortcut")) {
        const matches =
          !query ||
          row.dataset.label.toLowerCase().includes(query) ||
          row.dataset.shortcut.toLowerCase().includes(query);
        row.hidden = !matches;
        sectionMatches ||= matches;
      }
      section.hidden = !sectionMatches;
      anyMatch ||= sectionMatches;
    }
    if (this.#shortcutsList.children.length) {
      this.#setShortcutsMessage(
        anyMatch ? null : "zen-settings-window-shortcuts-no-results"
      );
    }
  }

  #selectShortcut(id) {
    let selected = null;
    for (const row of this.#shortcutRows) {
      const isSelected = !!id && row.dataset.id == id;
      row.setAttribute("aria-selected", isSelected);
      if (isSelected) {
        selected = row;
      }
    }
    this.#selectedShortcut = selected ? id : null;
    this.#updateShortcutDetails();
  }

  /**
   * Splits a shortcut as it is displayed into the keys to press, e.g. "⇧⌘N"
   * into "⇧", "⌘" and "N", or "Ctrl+Shift+N" into "Ctrl", "Shift" and "N".
   *
   * @param {string} shortcut
   * @returns {string[]}
   */
  static shortcutKeys(shortcut) {
    if (!shortcut) {
      return [];
    }
    if (shortcut.includes("+") && shortcut.length > 1) {
      // The key itself may be "+", which leaves an empty last part.
      const parts = shortcut.split("+");
      if (parts.at(-1) == "") {
        parts.splice(-2, 2, "+");
      }
      return parts.filter(part => part);
    }
    const keys = [];
    let rest = shortcut;
    while (rest.length > 1 && kModifierSymbols.includes(rest[0])) {
      keys.push(rest[0]);
      rest = rest.slice(1);
    }
    keys.push(rest);
    return keys;
  }

  #followPointer(event) {
    const face = document.getElementById("zen-settings-shortcuts-face");
    if (this.settings.currentPane != "shortcuts") {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      face.style.translate = "";
      return;
    }
    const rect = face.parentElement.getBoundingClientRect();
    if (!rect.width) {
      return;
    }
    const dx = event.clientX - (rect.x + rect.width / 2);
    const dy = event.clientY - (rect.y + rect.height / 2);
    const lean = kFaceReachPx / (Math.hypot(dx, dy) + kFaceHalfReachDistancePx);
    const snap = value =>
      Math.round(value * window.devicePixelRatio) / window.devicePixelRatio;
    face.style.translate = `${snap(dx * lean)}px ${snap(dy * lean)}px`;
  }

  #updateShortcutDetails() {
    const row = this.#selectedShortcutRow;
    const hasWindow = !!this.#shortcutsWindow;
    const title = document.getElementById("zen-settings-shortcuts-title");
    const reset = document.getElementById("zen-settings-shortcuts-reset");
    const art = document.getElementById("zen-settings-shortcuts-art");
    const keys = ZenSettingsShortcuts.shortcutKeys(row?.dataset.shortcut);

    art.toggleAttribute("data-default", !keys.length);
    for (const key of art.querySelectorAll("[data-key]")) {
      key.remove();
    }
    for (const text of keys) {
      const key = document.createElement("span");
      key.className = "zen-settings-art-key zen-squircle-before";
      key.dataset.key = text;
      key.toggleAttribute("data-word", text.length > 1);
      const label = document.createElement("span");
      label.textContent = text;
      key.append(label);
      art.append(key);
    }

    if (row) {
      title.removeAttribute("data-l10n-id");
      title.textContent = row.dataset.label;
    } else {
      document.l10n.setAttributes(
        title,
        "zen-settings-window-shortcuts-header"
      );
    }
    this.#updateLittleWindow();
    this.#updateConflict();
    reset.disabled = !row?.hasAttribute("data-customized");
    document.getElementById("zen-settings-shortcuts-more").disabled =
      !hasWindow;
    document
      .getElementById("zen-settings-shortcuts-menu-remove")
      .toggleAttribute(
        "disabled",
        !row?.dataset.shortcut || row.hasAttribute("data-internal")
      );
  }

  #startRecording(row) {
    this.#stopRecording();
    const keycap = row.querySelector(".zen-settings-keycap");
    this.#recording = { row, keycap, timer: null };
    keycap.setAttribute("data-recording", "true");
    document.l10n.setAttributes(
      keycap,
      "zen-settings-window-shortcuts-recording"
    );
    keycap.focus();
  }

  #stopRecording() {
    const recording = this.#recording;
    if (!recording) {
      return;
    }
    this.#recording = null;
    window.clearTimeout(recording.timer);
    this.#refreshShortcutRow(recording.row);
  }

  #showRecordedText(text, { temporary = false } = {}) {
    const recording = this.#recording;
    window.clearTimeout(recording.timer);
    recording.keycap.removeAttribute("data-l10n-id");
    recording.keycap.textContent = text;
    if (temporary) {
      recording.timer = window.setTimeout(() => {
        if (this.#recording == recording) {
          document.l10n.setAttributes(
            recording.keycap,
            "zen-settings-window-shortcuts-recording"
          );
        }
      }, kInvalidKeyMs);
    }
  }

  async #onRecordedKey(event) {
    const recording = this.#recording;
    const win = this.#shortcutsWindow;
    if (!recording || !win) {
      return;
    }
    const id = recording.row.dataset.id;
    const hasModifier =
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
    if (!hasModifier && event.key == "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.#stopRecording();
      return;
    }
    if (!hasModifier && (event.key == "Backspace" || event.key == "Delete")) {
      event.preventDefault();
      event.stopPropagation();
      this.#recording = null;
      this.#removeShortcut(id);
      return;
    }

    const data = lazy.ZenKeyboardShortcuts.describeKeyEvent(win, event);
    if (!data) {
      return;
    }
    if (data.isModifier) {
      this.#showRecordedText(data.modifierString);
      return;
    }
    if (!data.isValid) {
      const invalid = await document.l10n.formatValue("customkeys-key-invalid");
      if (this.#recording == recording) {
        this.#showRecordedText(invalid, { temporary: true });
      }
      return;
    }
    this.#recording = null;
    if (await this.#resolveShortcutConflict(id, data.shortcut)) {
      lazy.CustomKeys.changeKey(id, data);
    }
    await this.#buildShortcuts();
  }

  async #resolveShortcutConflict(id, shortcut) {
    for (const row of this.#shortcutRows) {
      if (row.dataset.shortcut != shortcut || row.dataset.id == id) {
        continue;
      }
      const args = { conflict: row.dataset.label };
      if (row.hasAttribute("data-internal")) {
        const [title, body] = await document.l10n.formatValues([
          { id: "customkeys-conflict-unusable-title" },
          { id: "customkeys-conflict-unusable-body", args },
        ]);
        Services.prompt.alert(window, title, body);
        return false;
      }
      const [title, body, cancelLabel, confirmLabel] =
        await document.l10n.formatValues([
          { id: "customkeys-conflict-confirm-title" },
          { id: "customkeys-conflict-confirm-body", args },
          { id: "customkeys-conflict-confirm-button-cancel" },
          { id: "customkeys-conflict-confirm-button-confirm" },
        ]);
      if (!this.settings.confirm(title, body, confirmLabel, cancelLabel)) {
        return false;
      }
      lazy.CustomKeys.clearKey(row.dataset.id);
    }
    return true;
  }

  async #removeShortcut(id) {
    if (id) {
      lazy.CustomKeys.clearKey(id);
      await this.#buildShortcuts();
    }
  }

  async #resetShortcut(id) {
    const win = this.#shortcutsWindow;
    if (!win) {
      return;
    }
    const shortcut = lazy.ZenKeyboardShortcuts.getDefaultShortcutDisplay(
      win,
      id
    );
    if (!shortcut || (await this.#resolveShortcutConflict(id, shortcut))) {
      lazy.CustomKeys.resetKey(id);
    }
    await this.#buildShortcuts();
  }

  async #resetAllShortcuts() {
    const [title, body, cancelLabel, confirmLabel] =
      await document.l10n.formatValues([
        { id: "customkeys-reset-all-confirm-title" },
        { id: "customkeys-reset-all-confirm-body" },
        { id: "customkeys-reset-all-confirm-button-cancel" },
        { id: "customkeys-reset-all-confirm-button-confirm" },
      ]);
    if (!this.settings.confirm(title, body, confirmLabel, cancelLabel)) {
      return;
    }
    lazy.CustomKeys.resetAll();
    await this.#buildShortcuts();
  }

  #openExtensionShortcuts() {
    const win = this.#shortcutsWindow;
    if (win) {
      win.focus();
      win.BrowserAddonUI.openAddonsMgr("addons://shortcuts/shortcuts");
    }
  }
}
