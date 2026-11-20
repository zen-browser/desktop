/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  AppProvidedConfigEngine:
    "moz-src:///toolkit/components/search/ConfigSearchEngine.sys.mjs",
  SearchService: "moz-src:///toolkit/components/search/SearchService.sys.mjs",
});

const kSearchEngineTopic = "browser-search-engine-modified";
const kAddEngineDialogURL = "chrome://browser/content/search/addEngine.xhtml";

export class ZenSettingsSearch {
  constructor(settings) {
    this.settings = settings;
    this.#initSearchEngines();
  }

  get actions() {
    return {
      "search-add-engine": () =>
        this.settings.openDialog(kAddEngineDialogURL, { mode: "NEW" }),
      "search-restore-defaults": () =>
        lazy.SearchService.restoreDefaultEngines(),
    };
  }

  #initSearchEngines() {
    const list = document.getElementById("zen-settings-search-engine");
    list.addEventListener("command", async () => {
      const engine = lazy.SearchService.getEngineById(list.value);
      if (engine) {
        await lazy.SearchService.setDefault(
          engine,
          lazy.SearchService.CHANGE_REASON.USER
        );
      }
    });

    const engines = document.getElementById("zen-settings-search-engines");
    engines.addEventListener("toggle", event => {
      const engine = this.#engineForEvent(event);
      if (engine) {
        engine.hidden = !event.target.pressed;
      }
    });
    engines.addEventListener("change", event => {
      const engine = this.#engineForEvent(event);
      if (engine && event.target.localName == "input") {
        this.#setEngineKeyword(engine, event.target);
      }
    });
    engines.addEventListener("click", event => {
      const engine = this.#engineForEvent(event);
      if (engine && event.target.closest(".zen-settings-row-remove")) {
        lazy.SearchService.removeEngine(
          engine,
          lazy.SearchService.CHANGE_REASON.USER
        );
      }
    });
    document.getElementById("zen-settings-search-add").hidden =
      !Services.policies.isAllowed("installSearchEngine");

    this.settings.watchTopics([kSearchEngineTopic], () =>
      this.#updateSearchEngines()
    );
    this.#updateSearchEngines();
  }

  #engineForEvent(event) {
    const row = event.target.closest(".zen-settings-engine");
    return row ? lazy.SearchService.getEngineById(row.dataset.id) : null;
  }

  async #setEngineKeyword(engine, input) {
    const keyword = input.value.trim();
    if (keyword) {
      const taken = (await lazy.SearchService.getEngines()).some(
        other =>
          other.id != engine.id &&
          [other.alias, ...other.aliases].includes(keyword)
      );
      if (taken) {
        input.value = engine.alias ?? "";
        return;
      }
    }
    engine.alias = keyword;
  }

  async #updateSearchEngines() {
    const list = document.getElementById("zen-settings-search-engine");
    const rows = document.getElementById("zen-settings-search-engines");
    let engines, current, icons;
    try {
      engines = await lazy.SearchService.getEngines();
      current = await lazy.SearchService.getDefault();
      icons = await Promise.all(
        engines.map(engine => engine.getIconURL(32).catch(() => null))
      );
    } catch (ex) {
      console.error("Failed to list the search engines", ex);
      return;
    }
    if (window.closed) {
      return;
    }

    list.removeAllItems();
    const fragment = document.createDocumentFragment();
    for (const [index, engine] of engines.entries()) {
      const icon =
        icons[index] ?? "chrome://global/skin/icons/search-glass.svg";
      if (!engine.hidden) {
        const item = list.appendItem(engine.name, engine.id);
        item.className = "menuitem-iconic";
        item.setAttribute("image", icon);
      }
      fragment.append(this.#createEngineRow(engine, icon, engine == current));
    }
    list.value = current?.id ?? "";
    rows.replaceChildren(fragment);
  }

  #createEngineRow(engine, iconURL, isDefault) {
    const row = document.createElement("div");
    row.className = "zen-settings-row zen-settings-engine";
    row.dataset.id = engine.id;

    const icon = document.createElement("img");
    icon.className = "zen-settings-row-icon";
    icon.src = iconURL;
    icon.alt = "";

    const label = document.createElement("span");
    label.className = "zen-settings-row-text";
    label.textContent = engine.name;

    const keyword = document.createElement("input");
    keyword.type = "text";
    keyword.className = "zen-settings-input";
    keyword.value = engine.alias ?? "";
    document.l10n.setAttributes(keyword, "zen-settings-window-search-keyword");

    const remove = this.settings.createIconButton(
      "trash",
      "zen-settings-window-search-engine-remove"
    );
    remove.classList.add("zen-settings-row-remove");
    remove.hidden = engine instanceof lazy.AppProvidedConfigEngine;

    const toggle = document.createElement("moz-toggle");
    toggle.className = "zen-settings-toggle";
    toggle.pressed = !engine.hidden;
    toggle.ariaLabel = engine.name;
    toggle.disabled = isDefault;

    row.append(icon, label);
    const builtInKeyword = engine.aliases.find(alias => alias != engine.alias);
    if (builtInKeyword) {
      const builtIn = document.createElement("span");
      builtIn.className = "zen-settings-row-description";
      builtIn.textContent = builtInKeyword;
      row.append(builtIn);
    }
    row.append(keyword, remove, toggle);
    return row;
  }
}
